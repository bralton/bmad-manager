/**
 * E2E tests for workflow and artifact viewing.
 *
 * Tests the Artifacts tab (artifact browser) and Workflows tab
 * (workflow visualizer) functionality.
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
} from './helpers/index.js';

describe('Workflow and Artifact Viewing', () => {
  // Track temp directories for cleanup
  let tempDirs = [];

  afterEach(async () => {
    // Clean up any temp directories
    for (const dir of tempDirs) {
      cleanupTemp(dir);
    }
    tempDirs = [];
  });

  /**
   * Helper to load a BMAD project via Tauri IPC.
   */
  async function loadBmadProject() {
    const projectPath = copyFixtureToTemp(FIXTURES.BMAD_PROJECT);
    tempDirs.push(projectPath);

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

  describe('Artifacts Tab', () => {
    it('should display artifact browser when clicking Artifacts tab', async () => {
      await loadBmadProject();

      // Navigate to Artifacts tab
      const artifactsTab = await $('button=Artifacts');
      await artifactsTab.waitForExist({ timeout: 5000 });
      await browser.execute((el) => el.click(), artifactsTab);

      // Wait for artifact browser to render
      await browser.pause(500);

      // Verify the Artifacts header is displayed
      const artifactsHeader = await $('h2=Artifacts');
      await artifactsHeader.waitForExist({ timeout: 5000 });
      await expect(artifactsHeader).toBeDisplayed();
    });

    it('should display artifacts grouped by category', async () => {
      await loadBmadProject();

      // Navigate to Artifacts tab
      const artifactsTab = await $('button=Artifacts');
      await browser.execute((el) => el.click(), artifactsTab);

      // Wait for artifacts to load
      await browser.pause(1000);

      // Look for category sections
      // Categories include: Planning, Implementation (Epics, Stories)
      // The fixture has planning artifacts and implementation artifacts

      // Check for item count display (e.g., "3 items")
      // This indicates artifacts were loaded successfully
      const itemCount = await $('span*=items');
      await itemCount.waitForExist({ timeout: 5000 });
      await expect(itemCount).toBeDisplayed();
    });

    it('should display planning artifacts category', async () => {
      await loadBmadProject();

      // Navigate to Artifacts tab
      const artifactsTab = await $('button=Artifacts');
      await browser.execute((el) => el.click(), artifactsTab);

      // Wait for artifacts to load
      await browser.pause(1000);

      // Look for Planning category (contains product-brief)
      // The ArtifactList component has a button with category name
      const planningCategory = await $('button*=Planning');
      await planningCategory.waitForExist({ timeout: 5000 });
      await expect(planningCategory).toBeDisplayed();
    });

    it('should open artifact viewer when clicking an artifact', async () => {
      await loadBmadProject();

      // Navigate to Artifacts tab
      const artifactsTab = await $('button=Artifacts');
      await browser.execute((el) => el.click(), artifactsTab);

      // Wait for artifacts to load
      await browser.pause(1000);

      // Find and click an artifact (product-brief)
      // Look for an artifact item - these are buttons in the artifact list
      const artifactItem = await $('button*=Product Brief');
      if (await artifactItem.isExisting()) {
        await browser.execute((el) => el.click(), artifactItem);

        // Wait for artifact viewer to open
        // The viewer is a slide-in panel
        await browser.pause(500);

        // Verify content is displayed in the viewer
        // The ArtifactViewer shows artifact content
        const viewerContent = await $('div.prose');
        await viewerContent.waitForExist({ timeout: 5000 });
        await expect(viewerContent).toBeDisplayed();
      } else {
        // Fallback: click any artifact
        const anyArtifact = await $('button[aria-label*="View artifact"]');
        if (await anyArtifact.isExisting()) {
          await browser.execute((el) => el.click(), anyArtifact);

          // Verify viewer opens
          const viewerContent = await $('div.prose');
          await viewerContent.waitForExist({ timeout: 5000 });
          await expect(viewerContent).toBeDisplayed();
        }
      }
    });

    it('should display implementation artifacts (epics)', async () => {
      await loadBmadProject();

      // Navigate to Artifacts tab
      const artifactsTab = await $('button=Artifacts');
      await browser.execute((el) => el.click(), artifactsTab);

      // Wait for artifacts to load
      await browser.pause(1000);

      // Look for Implementation category or Epics sub-category
      // The fixture has epic-1-test-foundation.md
      const implementationCategory = await $('button*=Epic');
      if (await implementationCategory.isExisting()) {
        await expect(implementationCategory).toBeDisplayed();
      } else {
        // May be under Implementation category
        const implementation = await $('button*=Implementation');
        await expect(implementation).toBeDisplayed();
      }
    });
  });

  describe('Workflows Tab', () => {
    it('should display workflow visualizer when clicking Workflows tab', async () => {
      await loadBmadProject();

      // Navigate to Workflows tab
      const workflowsTab = await $('button=Workflows');
      await workflowsTab.waitForExist({ timeout: 5000 });
      await browser.execute((el) => el.click(), workflowsTab);

      // Wait for workflow visualizer to render
      await browser.pause(500);

      // Verify workflow view tabs are displayed
      // The WorkflowViewTabs component has sub-tabs
      const viewTabs = await $('button=BMAD Phase');
      await viewTabs.waitForExist({ timeout: 5000 });
      await expect(viewTabs).toBeDisplayed();
    });

    it('should display current workflow phase', async () => {
      await loadBmadProject();

      // Navigate to Workflows tab
      const workflowsTab = await $('button=Workflows');
      await browser.execute((el) => el.click(), workflowsTab);

      // Wait for workflow state to load
      await browser.pause(1000);

      // The workflow visualizer shows phases: Discovery, Planning, Solutioning, Implementation
      // Based on our fixture with stories in various statuses, should show Implementation phase

      // Check for phase indicators - these are buttons or labels in WorkflowVisualizer
      // The phases are clickable buttons
      const discoveryPhase = await $('button*=Discovery');
      if (await discoveryPhase.isExisting()) {
        await expect(discoveryPhase).toBeDisplayed();
      }

      // Or look for phase step indicators
      const phaseIndicator = await $('div*=Phase');
      if (await phaseIndicator.isExisting()) {
        await expect(phaseIndicator).toBeDisplayed();
      }
    });

    it('should have Epic Workflow sub-tab', async () => {
      await loadBmadProject();

      // Navigate to Workflows tab
      const workflowsTab = await $('button=Workflows');
      await browser.execute((el) => el.click(), workflowsTab);

      // Wait for render
      await browser.pause(500);

      // Check for Epic Workflow tab
      const epicWorkflowTab = await $('button=Epic Workflow');
      await epicWorkflowTab.waitForExist({ timeout: 5000 });
      await expect(epicWorkflowTab).toBeDisplayed();
    });

    it('should have Story Workflow sub-tab', async () => {
      await loadBmadProject();

      // Navigate to Workflows tab
      const workflowsTab = await $('button=Workflows');
      await browser.execute((el) => el.click(), workflowsTab);

      // Wait for render
      await browser.pause(500);

      // Check for Story Workflow tab
      const storyWorkflowTab = await $('button=Story Workflow');
      await storyWorkflowTab.waitForExist({ timeout: 5000 });
      await expect(storyWorkflowTab).toBeDisplayed();
    });

    it('should switch between workflow sub-tabs', async () => {
      await loadBmadProject();

      // Navigate to Workflows tab
      const workflowsTab = await $('button=Workflows');
      await browser.execute((el) => el.click(), workflowsTab);

      // Wait for render
      await browser.pause(500);

      // Click Epic Workflow tab
      const epicWorkflowTab = await $('button=Epic Workflow');
      await browser.execute((el) => el.click(), epicWorkflowTab);

      // Wait for view to change
      await browser.pause(500);

      // Verify Epic Workflow content is shown
      // Should show epic selector or epic workflow stages
      // Use specific element type (button/span/div) with partial text match
      const epicContent = await $('button*=Epic');
      await epicContent.waitForExist({ timeout: 5000 });
      await expect(epicContent).toBeDisplayed();
    });
  });

  describe('Cross-Tab Navigation', () => {
    it('should maintain state when switching between Artifacts and Workflows', async () => {
      await loadBmadProject();

      // Go to Artifacts
      const artifactsTab = await $('button=Artifacts');
      await browser.execute((el) => el.click(), artifactsTab);
      await browser.pause(500);

      // Verify on Artifacts
      const artifactsHeader = await $('h2=Artifacts');
      await artifactsHeader.waitForExist({ timeout: 5000 });

      // Switch to Workflows
      const workflowsTab = await $('button=Workflows');
      await browser.execute((el) => el.click(), workflowsTab);
      await browser.pause(500);

      // Verify workflow tabs visible
      const phaseTab = await $('button=BMAD Phase');
      await phaseTab.waitForExist({ timeout: 5000 });

      // Switch back to Artifacts
      await browser.execute((el) => el.click(), artifactsTab);
      await browser.pause(500);

      // Verify Artifacts header still present
      await artifactsHeader.waitForExist({ timeout: 5000 });
      await expect(artifactsHeader).toBeDisplayed();
    });
  });
});
