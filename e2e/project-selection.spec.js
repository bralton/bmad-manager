/**
 * E2E tests for project selection flow.
 *
 * Tests the project selection, detection, and initialization workflows
 * including happy path and error cases.
 *
 * Prerequisites:
 * 1. tauri-driver installed: cargo install tauri-driver --locked
 * 2. Debug binary built: npm run build:e2e-app
 * 3. On Linux: webkit2gtk-driver installed
 */

import {
  FIXTURES,
  copyFixtureToTemp,
  cleanupTemp,
  createEmptyTempDir,
} from './helpers/index.js';

describe('Project Selection Flow', () => {
  // Track temp directories for cleanup
  let tempDirs = [];

  afterEach(async () => {
    // Clean up any temp directories created during tests
    for (const dir of tempDirs) {
      cleanupTemp(dir);
    }
    tempDirs = [];
  });

  describe('Initial App State', () => {
    it('should display welcome message and Select Folder button on launch', async () => {
      // Verify welcome header exists
      const welcomeHeader = await $('h1');
      await welcomeHeader.waitForExist({ timeout: 10000 });
      const headerText = await welcomeHeader.getText();
      await expect(headerText).toContain('Welcome');

      // Verify "Open a Project" section is visible
      const projectSection = await $('h2=Open a Project');
      await projectSection.waitForExist({ timeout: 5000 });
      await expect(projectSection).toBeDisplayed();

      // Verify Select Folder button is present
      const selectButton = await $('button=Select Folder');
      await selectButton.waitForExist({ timeout: 5000 });
      await expect(selectButton).toBeDisplayed();
      await expect(selectButton).toBeEnabled();
    });

    it('should display "No agents found" empty state when no project loaded', async () => {
      // Wait for the agents section header
      const agentsHeader = await $('h3=Agents');
      await agentsHeader.waitForExist({ timeout: 5000 });
      await expect(agentsHeader).toBeDisplayed();

      // Verify empty state message is shown - look for h3 inside EmptyState component
      const emptyStateTitle = await $('h3=No agents found');
      await emptyStateTitle.waitForExist({ timeout: 5000 });
      await expect(emptyStateTitle).toBeDisplayed();
    });
  });

  describe('BMAD Project Selection', () => {
    it('should load project and show Fully Initialized status', async () => {
      // Copy fixture to temp directory to avoid modifying original
      const projectPath = copyFixtureToTemp(FIXTURES.BMAD_PROJECT);
      tempDirs.push(projectPath);

      // Use direct Tauri IPC to open project (bypassing native file dialog)
      await browser.execute(async (path) => {
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('open_project', { path });
        // Update the Svelte store - dispatch custom event that the app listens to
        window.dispatchEvent(new CustomEvent('e2e-set-project', { detail: project }));
      }, projectPath);

      // Wait for project info bar to appear
      const projectInfoBar = await $('[data-testid="project-info-bar"]');
      await projectInfoBar.waitForExist({ timeout: 10000 });

      // Verify "Fully Initialized" status label using data-testid
      const statusLabel = await $('[data-testid="project-status-badge"]');
      await statusLabel.waitForExist({ timeout: 5000 });
      const statusText = await statusLabel.getText();
      await expect(statusText).toBe('Fully Initialized');
    });

    it('should populate agent roster with available agents', async () => {
      // Copy fixture to temp directory
      const projectPath = copyFixtureToTemp(FIXTURES.BMAD_PROJECT);
      tempDirs.push(projectPath);

      // Open the project via Tauri IPC
      await browser.execute(async (path) => {
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('open_project', { path });
        window.dispatchEvent(new CustomEvent('e2e-set-project', { detail: project }));
      }, projectPath);

      // Wait for agent roster to populate
      const agentsHeader = await $('h3=Agents');
      await agentsHeader.waitForExist({ timeout: 5000 });

      // The fixture has 2 agents - verify at least one AgentCard is rendered
      // AgentCards have a specific structure with agent names
      // Wait for the first agent to appear
      const agentCard = await $('button*=Mary');
      await agentCard.waitForExist({ timeout: 10000 });
      await expect(agentCard).toBeDisplayed();
    });
  });

  describe('Non-BMAD Folder Selection', () => {
    it('should show git-only state for folder with only .git', async () => {
      // Copy git-only fixture to temp
      const projectPath = copyFixtureToTemp(FIXTURES.GIT_ONLY_PROJECT);
      tempDirs.push(projectPath);

      // Open the project via Tauri IPC
      await browser.execute(async (path) => {
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('open_project', { path });
        window.dispatchEvent(new CustomEvent('e2e-set-project', { detail: project }));
      }, projectPath);

      // Wait for project info bar to appear
      const projectInfoBar = await $('[data-testid="project-info-bar"]');
      await projectInfoBar.waitForExist({ timeout: 10000 });

      // Verify "Git Only" status label using data-testid
      const statusLabel = await $('[data-testid="project-status-badge"]');
      await statusLabel.waitForExist({ timeout: 5000 });
      const statusText = await statusLabel.getText();
      await expect(statusText).toBe('Git Only');

      // Verify "Initialize BMAD" button is visible
      const initButton = await $('button=Initialize BMAD');
      await initButton.waitForExist({ timeout: 5000 });
      await expect(initButton).toBeDisplayed();
    });

    it('should show empty state for folder with no git or bmad', async () => {
      // Create a truly empty temp directory
      const projectPath = createEmptyTempDir('e2e-empty-test-');
      tempDirs.push(projectPath);

      // Open the project via Tauri IPC
      await browser.execute(async (path) => {
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('open_project', { path });
        window.dispatchEvent(new CustomEvent('e2e-set-project', { detail: project }));
      }, projectPath);

      // Wait for project info bar to appear
      const projectInfoBar = await $('[data-testid="project-info-bar"]');
      await projectInfoBar.waitForExist({ timeout: 10000 });

      // Verify "Empty" status label using data-testid
      const statusLabel = await $('[data-testid="project-status-badge"]');
      await statusLabel.waitForExist({ timeout: 5000 });
      const statusText = await statusLabel.getText();
      await expect(statusText).toBe('Empty');

      // Verify "Initialize Git + BMAD" button is visible
      const initButton = await $('button=Initialize Git + BMAD');
      await initButton.waitForExist({ timeout: 5000 });
      await expect(initButton).toBeDisplayed();
    });
  });

  describe('BMAD Initialization', () => {
    /**
     * NOTE: This test requires network access to npm registry as it runs
     * `npx bmad-method@6 install`. It validates BUG-004 fix.
     *
     * Extended timeout (3 min) to accommodate npm registry + initialization.
     */
    it('should initialize BMAD in git-only folder and show Fully Initialized status', async function () {
      // Allow 3 minutes for npx download + initialization
      this.timeout(180000);
      // Copy git-only fixture to temp
      const projectPath = copyFixtureToTemp(FIXTURES.GIT_ONLY_PROJECT);
      tempDirs.push(projectPath);

      // Open the project via Tauri IPC
      await browser.execute(async (path) => {
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('open_project', { path });
        window.dispatchEvent(new CustomEvent('e2e-set-project', { detail: project }));
      }, projectPath);

      // Wait for project info bar to appear
      const projectInfoBar = await $('[data-testid="project-info-bar"]');
      await projectInfoBar.waitForExist({ timeout: 10000 });

      // Verify Git Only status using data-testid
      const statusLabel = await $('[data-testid="project-status-badge"]');
      await statusLabel.waitForExist({ timeout: 5000 });

      // Click "Initialize BMAD" button - wait for it to exist and use JS click
      // Note: waitForClickable can fail due to overlay detection issues in webkit
      const initButton = await $('button=Initialize BMAD');
      await initButton.waitForExist({ timeout: 5000 });
      await initButton.waitForDisplayed({ timeout: 5000 });
      // Small pause to allow any transitions to complete
      await browser.pause(500);
      // Use execute to perform JS click which bypasses interception checks
      await browser.execute((el) => el.click(), initButton);

      // Wait for the initialization form to appear
      const initForm = await $('h3=Initialize Project');
      await initForm.waitForExist({ timeout: 5000 });

      // Fill in the project name field
      const projectNameInput = await $('#project-name');
      await projectNameInput.waitForExist({ timeout: 5000 });
      await projectNameInput.clearValue();
      await projectNameInput.setValue('test-e2e-project');

      // Fill in the user name field
      const userNameInput = await $('#user-name');
      await userNameInput.waitForExist({ timeout: 5000 });
      await userNameInput.clearValue();
      await userNameInput.setValue('E2E Tester');

      // Click the submit button (it says "Initialize BMAD" in the form)
      const submitButton = await $('button[type="submit"]');
      await submitButton.waitForDisplayed({ timeout: 5000 });
      await browser.pause(500);
      await browser.execute((el) => el.click(), submitButton);

      // Wait for initialization to complete (this can take a while due to npx)
      // Look for the "Fully Initialized" status using data-testid
      const finalStatusLabel = await $('[data-testid="project-status-badge"]');
      // Wait for the status to change to "Fully Initialized"
      // 150s timeout - npx download + bmad-method install can take time
      await browser.waitUntil(
        async () => {
          const text = await browser.execute((el) => el.textContent, finalStatusLabel);
          return text === 'Fully Initialized';
        },
        { timeout: 150000, timeoutMsg: 'Expected status to be "Fully Initialized" after init' }
      );

      const finalStatus = await finalStatusLabel.getText();
      await expect(finalStatus).toBe('Fully Initialized');

      // Verify _bmad directory was created by checking via Tauri IPC
      const bmadExists = await browser.execute(async (path) => {
        const { invoke } = window.__TAURI__.core;
        try {
          // Try to get project state - if _bmad exists, it should be fully-initialized
          const project = await invoke('open_project', { path });
          return project.state === 'fully-initialized';
        } catch {
          return false;
        }
      }, projectPath);
      await expect(bmadExists).toBe(true);

      // Verify agent roster section is visible and populated
      const agentsHeader = await $('h3=Agents');
      await agentsHeader.waitForExist({ timeout: 5000 });
      await expect(agentsHeader).toBeDisplayed();

      // Verify at least one agent card appears (bmad-method creates default agents)
      // Wait for agent cards to render - look for any button in the agents section
      const agentSection = await $('h3=Agents');
      const agentButtons = await agentSection.parentElement().$$('button');
      // bmad-method@6 creates at least 1 agent by default
      await expect(agentButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
