/**
 * WebDriverIO Configuration for Tauri Desktop App Testing
 * Project: TT (tauri-test)
 * Version: v1.0.0
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';

let tauriDriver;
const isCI = process.env.CI === 'true';

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
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'wry', // Tauri's webview
      'tauri:options': {
        application: './src-tauri/target/debug/tauri-test-temp',
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
   * Build Tauri app and start tauri-driver before tests
   */
  onPrepare: async function () {
    // Ensure test-results directories exist
    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results', { recursive: true });
    }
    if (!fs.existsSync('./test-results/evidence')) {
      fs.mkdirSync('./test-results/evidence', { recursive: true });
    }

    // In CI, build and tauri-driver are handled externally
    if (isCI) {
      console.log('\n🤖 Running in CI - tauri-driver started externally\n');
      return;
    }

    // Local development: build app and start tauri-driver
    console.log('\n🔨 Building Tauri application...\n');
    const result = spawnSync('npm', ['run', 'tauri', 'build', '--', '--debug', '--no-bundle'], {
      stdio: 'inherit',
      shell: true,
    });

    if (result.status !== 0) {
      throw new Error('Failed to build Tauri application');
    }

    // Start tauri-driver (Linux/Windows only)
    const tauriDriverPath = path.join(os.homedir(), '.cargo', 'bin', 'tauri-driver');
    console.log('\n🚀 Starting tauri-driver...\n');

    tauriDriver = spawn(tauriDriverPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    tauriDriver.stdout.on('data', (data) => {
      console.log(`tauri-driver: ${data}`);
    });

    tauriDriver.stderr.on('data', (data) => {
      const msg = data.toString();
      if (!msg.includes('TRACE')) {
        console.error(`tauri-driver: ${msg}`);
      }
    });

    tauriDriver.on('error', (err) => {
      console.error('Failed to start tauri-driver:', err);
    });

    // Wait for driver to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('✅ tauri-driver started\n');
  },

  /**
   * Stop tauri-driver after all tests complete
   */
  onComplete: async function (exitCode, config, capabilities, results) {
    // Stop tauri-driver (only if we started it locally)
    if (tauriDriver && !isCI) {
      console.log('\n🛑 Stopping tauri-driver...\n');
      tauriDriver.kill();
      tauriDriver = null;
    }

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

      // For now, log that manual upload may be needed
      console.log('📋 Results saved to ./test-results/');
      console.log('   Use sync-test-steps.js to sync test steps to Xray\n');
    } catch (error) {
      console.error('❌ Xray upload failed:', error.message);
    }
  },
};
