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
      console.log('📋 Results saved to ./test-results/');
      console.log('   Use sync-test-steps.js to sync test steps to Xray\n');
    } catch (error) {
      console.error('❌ Xray upload failed:', error.message);
    }
  },
};
