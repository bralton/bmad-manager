/**
 * WebdriverIO configuration for Tauri E2E tests.
 *
 * This configuration uses tauri-driver to connect to the Tauri desktop app
 * via the WebDriver protocol.
 *
 * Prerequisites:
 * 1. Install tauri-driver: cargo install tauri-driver --locked
 * 2. Build debug binary: npm run build:e2e-app
 * 3. On Linux: Ensure webkit2gtk-driver is installed
 *
 * Architecture:
 * WebdriverIO → WebDriver Protocol (port 4444) → tauri-driver → Tauri App (WRY webview)
 */

import { spawn } from 'child_process';
import { createConnection } from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Store the driver process globally so we can clean it up
let tauriDriver = null;

/**
 * Simple delay function.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a port to be available by attempting to connect.
 * @param {number} port - Port number to check
 * @param {number} timeout - Max time to wait in ms
 * @param {number} interval - Time between checks in ms
 * @returns {Promise<boolean>} - Resolves true when port is available, false on timeout
 */
async function waitForPort(port, timeout = 10000, interval = 500) {
  const start = Date.now();
  let attempts = 0;

  while (Date.now() - start < timeout) {
    attempts++;
    try {
      const available = await new Promise((resolve) => {
        const socket = createConnection({ port, host: '127.0.0.1' });
        const timer = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, 1000);

        socket.once('connect', () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(false);
        });
      });

      if (available) {
        console.log(`Port ${port} is available after ${attempts} attempts`);
        return true;
      }
    } catch (err) {
      console.log(`Port check attempt ${attempts} failed:`, err.message);
    }

    await delay(interval);
  }

  console.log(`Port ${port} not available after ${attempts} attempts (${timeout}ms)`);
  return false;
}

/**
 * Resolves the path to tauri-driver binary.
 */
function getTauriDriverPath() {
  const cargoHome = process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');
  const driverName = process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver';
  return path.join(cargoHome, 'bin', driverName);
}

/**
 * Resolves the path to the Tauri application binary.
 */
function getAppBinaryPath() {
  const binaryName = process.platform === 'win32' ? 'bmad-manager.exe' : 'bmad-manager';
  // Path relative to project root
  return path.join(__dirname, 'src-tauri', 'target', 'debug', binaryName);
}

export const config = {
  // ====================
  // Runner Configuration
  // ====================
  runner: 'local',

  // ==================
  // Test Configuration
  // ==================
  specs: ['./e2e/**/*.spec.js'],
  exclude: [],

  // Maximum instances to run in parallel
  // For Tauri desktop tests, we run one at a time
  maxInstances: 1,

  // ===================
  // WebDriver Capabilities
  // ===================
  capabilities: [
    {
      // Tauri-specific options - tauri-driver handles the browser type
      'tauri:options': {
        application: getAppBinaryPath(),
      },
      maxInstances: 1,
    },
  ],

  // ===================
  // Test Framework
  // ===================
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 300000, // 5 minutes - BMAD init test runs npx which takes time
  },

  // ===================
  // Reporters
  // ===================
  reporters: ['spec'],

  // ===================
  // WebDriver Connection
  // ===================
  // tauri-driver listens on port 4444 by default
  hostname: '127.0.0.1',
  port: 4444,

  // Increase connection timeout for app startup
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // ===================
  // Hooks
  // ===================

  /**
   * Gets executed before test execution begins.
   * Spawns the tauri-driver process (unless SKIP_TAURI_DRIVER_SPAWN is set).
   */
  onPrepare: async function () {
    // Log the app binary path being used
    const appPath = getAppBinaryPath();
    console.log(`App binary path: ${appPath}`);

    // Check if app binary exists
    if (!fs.existsSync(appPath)) {
      console.error(`App binary NOT FOUND at: ${appPath}`);
    } else {
      console.log(`App binary exists at: ${appPath}`);
    }

    // In CI, tauri-driver is started externally
    if (process.env.SKIP_TAURI_DRIVER_SPAWN === 'true') {
      console.log('Skipping tauri-driver spawn (SKIP_TAURI_DRIVER_SPAWN=true)');
      return;
    }

    const driverPath = getTauriDriverPath();
    console.log(`Starting tauri-driver from: ${driverPath}`);

    // Check if tauri-driver binary exists
    if (!fs.existsSync(driverPath)) {
      throw new Error(
        `tauri-driver not found at ${driverPath}. ` +
          'Install it with: cargo install tauri-driver --locked'
      );
    }

    tauriDriver = spawn(driverPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RUST_LOG: process.env.RUST_LOG || 'info',
      },
    });

    console.log(`tauri-driver spawned with PID: ${tauriDriver.pid}`);

    tauriDriver.stdout?.on('data', (data) => {
      console.log(`[tauri-driver] ${data.toString().trim()}`);
    });

    tauriDriver.stderr?.on('data', (data) => {
      console.error(`[tauri-driver:err] ${data.toString().trim()}`);
    });

    tauriDriver.on('error', (err) => {
      console.error('Failed to start tauri-driver:', err);
    });

    tauriDriver.on('exit', (code, signal) => {
      console.log(`tauri-driver exited with code ${code}, signal ${signal}`);
    });

    // Give the process a moment to start
    await delay(500);
    console.log(`tauri-driver running: ${!tauriDriver.killed}, exitCode: ${tauriDriver.exitCode}`);

    // Wait for tauri-driver to be ready by checking port 4444
    const portTimeout = parseInt(process.env.TAURI_DRIVER_STARTUP_DELAY || '15000', 10);
    console.log(`Waiting up to ${portTimeout}ms for tauri-driver to listen on port 4444...`);

    try {
      const portReady = await waitForPort(4444, portTimeout);
      if (!portReady) {
        console.error('tauri-driver failed to start listening on port 4444');
        // Don't throw - let wdio's connection retry handle it
        console.error('Continuing anyway, wdio will retry connection...');
      } else {
        console.log('tauri-driver is ready!');
      }
    } catch (err) {
      console.error('Error waiting for port:', err);
      // Don't throw - let wdio's connection retry handle it
    }
  },

  /**
   * Gets executed after all workers have shut down.
   * Cleans up the tauri-driver process.
   */
  onComplete: function () {
    const driver = tauriDriver; // Capture reference to avoid race condition
    if (driver) {
      console.log('Stopping tauri-driver...');
      driver.kill('SIGTERM');

      // Force kill if needed after 2 seconds
      setTimeout(() => {
        if (!driver.killed) {
          console.log('Force killing tauri-driver...');
          driver.kill('SIGKILL');
        }
      }, 2000);

      // Clear the global reference
      tauriDriver = null;
    }
  },

  // ===================
  // Output Directory
  // ===================
  outputDir: './e2e-results',

  // ===================
  // Log Level
  // ===================
  logLevel: 'info',

  // ===================
  // Bail Configuration
  // ===================
  // Stop after first failure in CI
  bail: process.env.CI ? 1 : 0,

  // ===================
  // Wait Timeouts
  // ===================
  waitforTimeout: 10000,
};
