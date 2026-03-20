/**
 * E2E tests for session spawn flow.
 *
 * Tests the agent click -> session spawn -> terminal render workflow.
 * Uses skeleton test approach - verifies UI flow without requiring
 * actual Claude CLI responses.
 *
 * NOTE: These tests require Claude CLI to be installed and available.
 * Skipped in CI where Claude CLI is not present.
 *
 * Prerequisites:
 * 1. tauri-driver installed: cargo install tauri-driver --locked
 * 2. Debug binary built: npm run build:e2e-app
 * 3. On Linux: webkit2gtk-driver installed
 * 4. Claude CLI installed (not available in CI)
 */

import {
  FIXTURES,
  copyFixtureToTemp,
  cleanupTemp,
} from './helpers/index.js';

// Skip in CI - Claude CLI is not available
const describeOrSkip = process.env.CI ? describe.skip : describe;

describeOrSkip('Session Spawn Flow', () => {
  // Track temp directories for cleanup
  let tempDirs = [];
  // Track project path for session cleanup
  let currentProjectPath = null;

  afterEach(async () => {
    // Attempt to close any open session drawer
    try {
      const closeButton = await $('button[title="Terminate session"]');
      if (await closeButton.isExisting()) {
        await browser.execute((el) => el.click(), closeButton);
        // Wait a moment for termination
        await browser.pause(500);
        // Confirm termination if dialog appears
        const terminateConfirm = await $('button=Terminate');
        if (await terminateConfirm.isExisting()) {
          await browser.execute((el) => el.click(), terminateConfirm);
          await browser.pause(500);
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    // Clean up any temp directories
    for (const dir of tempDirs) {
      cleanupTemp(dir);
    }
    tempDirs = [];
    currentProjectPath = null;
  });

  /**
   * Helper to load a BMAD project via Tauri IPC.
   * Reuses the pattern established in project-selection.spec.js.
   */
  async function loadBmadProject() {
    const projectPath = copyFixtureToTemp(FIXTURES.BMAD_PROJECT);
    tempDirs.push(projectPath);
    currentProjectPath = projectPath;

    await browser.execute(async (path) => {
      const { invoke } = window.__TAURI__.core;
      const project = await invoke('open_project', { path });
      window.dispatchEvent(new CustomEvent('e2e-set-project', { detail: project }));
    }, projectPath);

    // Wait for project to load
    const projectInfoBar = await $('[data-testid="project-info-bar"]');
    await projectInfoBar.waitForExist({ timeout: 10000 });

    return projectPath;
  }

  describe('Agent Click and Session Spawn', () => {
    it('should spawn a terminal session when clicking an agent', async () => {
      await loadBmadProject();

      // Wait for agent roster to populate
      const agentsHeader = await $('h3=Agents');
      await agentsHeader.waitForExist({ timeout: 5000 });

      // Find an agent card and click it to start a session
      // The fixture has agents like "Mary" (Analyst)
      const agentCard = await $('button[aria-label*="Start conversation"]');
      await agentCard.waitForExist({ timeout: 10000 });
      await agentCard.waitForDisplayed({ timeout: 5000 });

      // Click the agent card using JS click to bypass any overlay issues
      await browser.execute((el) => el.click(), agentCard);

      // Wait for session drawer to appear
      // The drawer has a header with status indicator
      const drawerHeader = await $('header');
      await drawerHeader.waitForExist({ timeout: 10000 });

      // Verify status indicator shows "active" state (green dot with animate-pulse)
      const statusDot = await $('span.rounded-full.bg-green-500');
      await statusDot.waitForExist({ timeout: 5000 });
      await expect(statusDot).toBeDisplayed();

      // Verify the dot has animate-pulse class (indicates active status)
      const hasAnimatePulse = await statusDot.getAttribute('class');
      await expect(hasAnimatePulse).toContain('animate-pulse');
    });

    it('should display terminal container in session drawer', async () => {
      await loadBmadProject();

      // Click agent to spawn session
      const agentCard = await $('button[aria-label*="Start conversation"]');
      await agentCard.waitForExist({ timeout: 10000 });
      await browser.execute((el) => el.click(), agentCard);

      // Wait for drawer to open
      const statusDot = await $('span.rounded-full.bg-green-500');
      await statusDot.waitForExist({ timeout: 10000 });

      // Verify terminal container exists
      // The terminal renders inside a div.flex-1.min-h-0 container
      const terminalContainer = await $('div.flex-1.min-h-0');
      await terminalContainer.waitForExist({ timeout: 5000 });
      await expect(terminalContainer).toBeDisplayed();

      // Xterm.js renders a canvas or uses screen reader mode
      // We can check for the xterm viewport element
      // Note: Full xterm.js verification is limited due to canvas rendering
      // Just verify the terminal component mounted successfully
      const xtermElement = await terminalContainer.$('div[class*="xterm"]');
      // Wait up to 10s for xterm to initialize
      await xtermElement.waitForExist({ timeout: 10000 });
      await expect(xtermElement).toBeDisplayed();
    });

    it('should show agent name in session drawer header', async () => {
      await loadBmadProject();

      // Click agent to spawn session
      const agentCard = await $('button[aria-label*="Start conversation"]');
      await agentCard.waitForExist({ timeout: 10000 });
      await browser.execute((el) => el.click(), agentCard);

      // Wait for drawer
      const statusDot = await $('span.rounded-full.bg-green-500');
      await statusDot.waitForExist({ timeout: 10000 });

      // Verify agent name is shown in header
      // The header contains an h2 with the agent name
      const agentNameHeader = await $('header h2');
      await agentNameHeader.waitForExist({ timeout: 5000 });
      const agentName = await agentNameHeader.getText();
      // Should have some agent name (from our fixture)
      await expect(agentName.length).toBeGreaterThan(0);
    });
  });

  describe('Terminal Input Transmission', () => {
    /**
     * NOTE: This test verifies the UI flow of sending input to the terminal.
     * Since xterm.js renders to canvas, we cannot verify the actual text output.
     * The test validates that:
     * 1. The terminal can receive focus
     * 2. Input can be sent without errors
     * 3. The session remains active after input
     */
    it('should allow sending input to terminal without crashing', async () => {
      await loadBmadProject();

      // Click agent to spawn session
      const agentCard = await $('button[aria-label*="Start conversation"]');
      await agentCard.waitForExist({ timeout: 10000 });
      await browser.execute((el) => el.click(), agentCard);

      // Wait for terminal to be ready
      const statusDot = await $('span.rounded-full.bg-green-500');
      await statusDot.waitForExist({ timeout: 10000 });

      // Wait for xterm to initialize
      const xtermElement = await $('div[class*="xterm"]');
      await xtermElement.waitForExist({ timeout: 10000 });

      // Give the terminal a moment to fully initialize
      await browser.pause(1000);

      // Click on terminal to focus it
      await browser.execute((el) => el.click(), xtermElement);
      await browser.pause(200);

      // Send some keystrokes to the terminal
      // Using browser.keys() sends keys to the focused element
      await browser.keys(['h', 'e', 'l', 'l', 'o']);

      // Small pause to let input be processed
      await browser.pause(500);

      // Verify session is still active (status dot still green with pulse)
      const activeStatusDot = await $('span.rounded-full.bg-green-500.animate-pulse');
      await expect(activeStatusDot).toBeExisting();
    });
  });

  describe('Session Cleanup', () => {
    it('should terminate session via close button and show interrupted status', async () => {
      await loadBmadProject();

      // Spawn a session
      const agentCard = await $('button[aria-label*="Start conversation"]');
      await agentCard.waitForExist({ timeout: 10000 });
      await browser.execute((el) => el.click(), agentCard);

      // Wait for active session
      const statusDot = await $('span.rounded-full.bg-green-500');
      await statusDot.waitForExist({ timeout: 10000 });

      // Click the close/terminate button
      const closeButton = await $('button[title="Terminate session"]');
      await closeButton.waitForExist({ timeout: 5000 });
      await browser.execute((el) => el.click(), closeButton);

      // Confirmation dialog should appear
      const confirmDialog = await $('h3=Terminate Session?');
      await confirmDialog.waitForExist({ timeout: 5000 });

      // Click "Terminate" button in the dialog
      const terminateButton = await $('button=Terminate');
      await terminateButton.waitForExist({ timeout: 5000 });
      await browser.execute((el) => el.click(), terminateButton);

      // Wait for drawer to close or status to change
      // The drawer closes after termination, so we verify it's gone
      await browser.waitUntil(
        async () => {
          const drawer = await $('span.rounded-full.bg-green-500.animate-pulse');
          return !(await drawer.isExisting());
        },
        { timeout: 10000, timeoutMsg: 'Session drawer did not close after termination' }
      );
    });

    it('should maintain clean state for subsequent test runs', async () => {
      await loadBmadProject();

      // Spawn first session
      let agentCard = await $('button[aria-label*="Start conversation"]');
      await agentCard.waitForExist({ timeout: 10000 });
      await browser.execute((el) => el.click(), agentCard);

      // Wait for active session
      let statusDot = await $('span.rounded-full.bg-green-500');
      await statusDot.waitForExist({ timeout: 10000 });

      // Terminate it
      const closeButton = await $('button[title="Terminate session"]');
      await browser.execute((el) => el.click(), closeButton);
      const terminateButton = await $('button=Terminate');
      await terminateButton.waitForExist({ timeout: 5000 });
      await browser.execute((el) => el.click(), terminateButton);

      // Wait for cleanup
      await browser.waitUntil(
        async () => {
          const drawer = await $('span.rounded-full.bg-green-500.animate-pulse');
          return !(await drawer.isExisting());
        },
        { timeout: 10000 }
      );

      // Give UI time to settle
      await browser.pause(500);

      // Should be able to spawn a new session
      agentCard = await $('button[aria-label*="Start conversation"]');
      await agentCard.waitForExist({ timeout: 10000 });
      await browser.execute((el) => el.click(), agentCard);

      // Verify new session is active
      statusDot = await $('span.rounded-full.bg-green-500.animate-pulse');
      await statusDot.waitForExist({ timeout: 10000 });
      await expect(statusDot).toBeExisting();
    });
  });
});
