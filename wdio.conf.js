/**
 * WebDriverIO Configuration for Tauri Desktop App Testing
 * Project: TT (tauri-test)
 * Version: v1.0.0
 *
 * Based on official Tauri WebDriver documentation:
 * https://v2.tauri.app/develop/tests/webdriver/example/webdriverio/
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tauriDriver;
let exit = false;
const isCI = process.env.CI === 'true';

// Use absolute path for the application binary (add .exe on Windows)
const isWindows = process.platform === 'win32';
const appPath = path.resolve(__dirname, `./src-tauri/target/debug/tauri-test-temp${isWindows ? '.exe' : ''}`);

// Helper to close tauri-driver
function closeTauriDriver() {
  if (tauriDriver) {
    exit = true;
    tauriDriver.kill();
    tauriDriver = null;
  }
}

export const config = {
  //
  // ====================
  // Runner Configuration
  // ====================
  hostname: '127.0.0.1',
  port: 4444,

  //
  // ==================
  // Specify Test Files
  // ==================
  specs: ['./tests/e2e/**/*.spec.js'],
  exclude: [],

  //
  // ============
  // Capabilities
  // ============
  // Per Tauri docs: only tauri:options, no browserName
  maxInstances: 1,
  capabilities: [
    {
      'tauri:options': {
        application: appPath,
      },
    },
  ],

  //
  // ===================
  // Test Configurations
  // ===================
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  //
  // ===========
  // Framework
  // ===========
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  //
  // ===========
  // Reporters
  // ===========
  reporters: [
    'spec',
    [
      'json',
      {
        outputDir: './test-results',
        outputFileFormat: (options) => `results-${options.cid}.json`,
      },
    ],
  ],

  //
  // =====
  // Hooks
  // =====

  /**
   * Ensure directories exist before tests start
   */
  onPrepare: async function () {
    // Ensure test-results directories exist
    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results', { recursive: true });
    }
    if (!fs.existsSync('./test-results/evidence')) {
      fs.mkdirSync('./test-results/evidence', { recursive: true });
    }

    // Local development: build app first
    if (!isCI) {
      console.log('\n🔨 Building Tauri application...\n');
      const result = spawnSync('npm', ['run', 'tauri', 'build', '--', '--debug', '--no-bundle'], {
        stdio: 'inherit',
        shell: true,
      });

      if (result.status !== 0) {
        throw new Error('Failed to build Tauri application');
      }
    }
  },

  /**
   * Spawn tauri-driver before each session
   * Per Tauri docs: use beforeSession to start the driver
   */
  beforeSession: function () {
    const tauriDriverPath = isCI
      ? 'tauri-driver'  // In CI, it's in PATH
      : path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver');

    console.log(`\n🚀 Starting tauri-driver from: ${tauriDriverPath}\n`);
    console.log(`📱 Application path: ${appPath}\n`);

    tauriDriver = spawn(tauriDriverPath, [], {
      stdio: [null, process.stdout, process.stderr],
    });

    tauriDriver.on('error', (error) => {
      console.error('tauri-driver error:', error);
      process.exit(1);
    });

    tauriDriver.on('exit', (code) => {
      if (!exit) {
        console.error('tauri-driver exited unexpectedly with code:', code);
        process.exit(1);
      }
    });

    // Handle process termination
    process.on('SIGINT', closeTauriDriver);
    process.on('SIGTERM', closeTauriDriver);
    process.on('beforeExit', closeTauriDriver);
  },

  /**
   * Close tauri-driver after each session
   */
  afterSession: function () {
    closeTauriDriver();
  },

  /**
   * Handle test completion and Xray upload
   */
  onComplete: async function () {
    const clientId = process.env.XRAY_CLIENT_ID;
    const clientSecret = process.env.XRAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log('\n⚠️  Xray credentials not set, skipping upload');
      console.log('   Set XRAY_CLIENT_ID and XRAY_CLIENT_SECRET to enable auto-upload\n');
      return;
    }

    const resultsDir = './test-results';
    const resultsFiles = fs.readdirSync(resultsDir).filter((f) => f.startsWith('results-'));

    if (resultsFiles.length === 0) {
      console.log('\n⚠️  No results files found\n');
      return;
    }

    console.log('\n📤 Uploading results to Xray...\n');

    try {
      // Authenticate with Xray
      const authResponse = await fetch('https://xray.cloud.getxray.app/api/v2/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      });

      if (!authResponse.ok) {
        throw new Error(`Authentication failed: ${await authResponse.text()}`);
      }

      const token = (await authResponse.text()).replace(/"/g, '');
      console.log('✅ Authenticated with Xray\n');

      // Map spec files to test case keys
      const specToTestKey = {
        'welcome-screen.spec.js': 'TT-13',
        'greeting-workflow.spec.js': 'TT-14',
        'external-links.spec.js': 'TT-15',
        'input-validation.spec.js': 'TT-16',
      };

      // Parse results and build Xray payload
      const tests = [];
      for (const file of resultsFiles) {
        const resultsPath = path.join(resultsDir, file);
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

        // Get spec file from specs array (e.g., "file:///D:/a/.../external-links.spec.js")
        const specPath = results.specs?.[0] || '';
        const specFile = path.basename(specPath.replace('file:///', ''));
        const testKey = specToTestKey[specFile];

        if (!testKey) {
          console.log(`  ⚠️  No mapping for spec: ${specFile}`);
          continue;
        }

        // Determine overall status from all suites/tests
        let status = 'PASSED';
        let totalTests = 0;

        for (const suite of results.suites || []) {
          for (const test of suite.tests || []) {
            totalTests++;
            if (test.state === 'failed') status = 'FAILED';
          }
        }

        // Check for evidence screenshot (format: TT-14-greeting-workflow.png)
        const evidenceFile = `${testKey}-${specFile.replace('.spec.js', '')}.png`;
        const evidencePath = path.join(resultsDir, 'evidence', evidenceFile);
        const evidence = [];

        if (fs.existsSync(evidencePath)) {
          const imageData = fs.readFileSync(evidencePath);
          evidence.push({
            data: imageData.toString('base64'),
            filename: evidenceFile,
            contentType: 'image/png',
          });
          console.log(`  📷 Found evidence: ${evidenceFile}`);
        }

        tests.push({
          testKey,
          status,
          comment: `Automated test run - ${totalTests} test(s) - ${status}`,
          evidence,
        });
      }

      if (tests.length === 0) {
        console.log('⚠️  No test results mapped to Xray test cases\n');
        return;
      }

      console.log(`📋 Creating ${tests.length} separate Test Execution(s) in Xray...\n`);

      // Test case to Test Execution name mapping
      const testCaseNames = {
        'TT-13': 'Welcome Screen Verification',
        'TT-14': 'Greeting Workflow Verification',
        'TT-15': 'External Links Verification',
        'TT-16': 'Input Validation Verification',
      };

      // Jira credentials for attachment upload
      const jiraBaseUrl = process.env.JIRA_BASE_URL || 'https://revvity-dpx.atlassian.net';
      const jiraEmail = process.env.JIRA_EMAIL;
      const jiraApiToken = process.env.JIRA_API_TOKEN;
      const canUploadAttachments = jiraEmail && jiraApiToken;

      if (!canUploadAttachments) {
        console.log('  ⚠️  JIRA_EMAIL/JIRA_API_TOKEN not set - attachments will only be in Xray\n');
      }

      // Import each test as a separate Test Execution
      for (const test of tests) {
        const xrayPayload = {
          info: {
            summary: `${testCaseNames[test.testKey] || test.testKey} - ${new Date().toISOString().split('T')[0]}`,
            description: `Automated E2E test execution for ${test.testKey}`,
            project: 'TT',
          },
          tests: [test],
        };

        const importResponse = await fetch('https://xray.cloud.getxray.app/api/v2/import/execution', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(xrayPayload),
        });

        if (!importResponse.ok) {
          const errorText = await importResponse.text();
          console.error(`  ✗ ${test.testKey}: Import failed - ${errorText}`);
          continue;
        }

        const importResult = await importResponse.json();
        const testExecKey = importResult.key;
        const icon = test.status === 'PASSED' ? '✓' : '✗';
        console.log(`  ${icon} ${test.testKey}: ${test.status} → ${testExecKey}`);

        // Upload evidence as Jira attachment if credentials available
        if (canUploadAttachments && test.evidence && test.evidence.length > 0) {
          for (const evidence of test.evidence) {
            try {
              const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
              const fileContent = Buffer.from(evidence.data, 'base64');

              const body = Buffer.concat([
                Buffer.from(`--${boundary}\r\n`),
                Buffer.from(`Content-Disposition: form-data; name="file"; filename="${evidence.filename}"\r\n`),
                Buffer.from(`Content-Type: ${evidence.contentType}\r\n\r\n`),
                fileContent,
                Buffer.from(`\r\n--${boundary}--\r\n`),
              ]);

              const attachResponse = await fetch(`${jiraBaseUrl}/rest/api/3/issue/${testExecKey}/attachments`, {
                method: 'POST',
                headers: {
                  Authorization: `Basic ${Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')}`,
                  'X-Atlassian-Token': 'no-check',
                  'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                body,
              });

              if (attachResponse.ok) {
                console.log(`    📎 Attached: ${evidence.filename}`);
              } else {
                console.log(`    ⚠️  Attachment failed: ${await attachResponse.text()}`);
              }
            } catch (attachError) {
              console.log(`    ⚠️  Attachment error: ${attachError.message}`);
            }
          }
        }
      }
      console.log('');
    } catch (error) {
      console.error('❌ Xray upload failed:', error.message);
    }
  },
};
