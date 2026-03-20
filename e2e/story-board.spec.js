/**
 * E2E tests for story board navigation.
 *
 * Tests the Stories tab kanban view and story detail panel.
 * Uses the bmad-project fixture which includes sprint-status.yaml
 * with stories across multiple statuses.
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

describe('Story Board Navigation', () => {
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
   * Helper to load a BMAD project and navigate to Stories tab.
   */
  async function loadProjectAndNavigateToStories() {
    const projectPath = copyFixtureToTemp(FIXTURES.BMAD_PROJECT);
    tempDirs.push(projectPath);

    // Load project via Tauri IPC
    await browser.execute(async (path) => {
      const { invoke } = window.__TAURI__.core;
      const project = await invoke('open_project', { path });
      window.dispatchEvent(new CustomEvent('e2e-set-project', { detail: project }));
    }, projectPath);

    // Wait for project to load
    const projectInfoBar = await $('[data-testid="project-info-bar"]');
    await projectInfoBar.waitForExist({ timeout: 10000 });

    // Navigate to Stories tab
    const storiesTab = await $('button=Stories');
    await storiesTab.waitForExist({ timeout: 5000 });
    await storiesTab.waitForDisplayed({ timeout: 5000 });
    await browser.execute((el) => el.click(), storiesTab);

    // Wait for story board to render
    await browser.pause(500);

    return projectPath;
  }

  describe('Stories Tab Navigation', () => {
    it('should display the story board when clicking Stories tab', async () => {
      await loadProjectAndNavigateToStories();

      // Verify kanban columns are present
      // Columns: Backlog, Ready for Dev, In Progress, Review, Done
      const backlogColumn = await $('span=Backlog');
      await backlogColumn.waitForExist({ timeout: 5000 });
      await expect(backlogColumn).toBeDisplayed();

      const inProgressColumn = await $('span=In Progress');
      await inProgressColumn.waitForExist({ timeout: 5000 });
      await expect(inProgressColumn).toBeDisplayed();

      const doneColumn = await $('span=Done');
      await doneColumn.waitForExist({ timeout: 5000 });
      await expect(doneColumn).toBeDisplayed();
    });

    it('should display story counts per column', async () => {
      await loadProjectAndNavigateToStories();

      // The fixture has:
      // - 2 backlog (1-4, 2-1)
      // - 1 ready-for-dev (1-3)
      // - 1 in-progress (1-2)
      // - 1 done (1-1)

      // Look for the count displays next to column headers
      // Format is: "Column Name (count)"
      const backlogHeader = await $('span=Backlog');
      await backlogHeader.waitForExist({ timeout: 5000 });

      // Get the parent container and find the count
      const backlogCountElement = await backlogHeader.parentElement().$('span.text-gray-500');
      const backlogCount = await backlogCountElement.getText();
      // Should show "(2)" for 2 backlog stories
      await expect(backlogCount).toContain('2');
    });
  });

  describe('Story Display', () => {
    it('should display story cards in kanban columns', async () => {
      await loadProjectAndNavigateToStories();

      // Look for story cards - they have aria-label starting with "Story"
      // The cards are buttons with specific structure
      const storyCards = await $$('button[aria-label^="Story"]');

      // Wait for at least one story card
      await browser.waitUntil(
        async () => {
          const cards = await $$('button[aria-label^="Story"]');
          return cards.length > 0;
        },
        { timeout: 10000, timeoutMsg: 'No story cards found' }
      );

      // Should have at least our fixture stories visible
      const cards = await $$('button[aria-label^="Story"]');
      await expect(cards.length).toBeGreaterThan(0);
    });

    it('should display story ID and title on cards', async () => {
      await loadProjectAndNavigateToStories();

      // Wait for story cards to render
      await browser.waitUntil(
        async () => {
          const cards = await $$('button[aria-label^="Story"]');
          return cards.length > 0;
        },
        { timeout: 10000 }
      );

      // Find a specific story card by its ID display
      // Story 1-1 should be visible (it's in done status)
      const storyIdDisplay = await $('span.font-mono=1-1');
      await storyIdDisplay.waitForExist({ timeout: 5000 });
      await expect(storyIdDisplay).toBeDisplayed();
    });
  });

  describe('Story Detail Panel', () => {
    it('should open detail panel when clicking a story card', async () => {
      await loadProjectAndNavigateToStories();

      // Wait for story cards
      await browser.waitUntil(
        async () => {
          const cards = await $$('button[aria-label^="Story"]');
          return cards.length > 0;
        },
        { timeout: 10000 }
      );

      // Click a specific story card (1-1) to ensure consistent behavior
      const storyCard = await $('button[aria-label*="1-1"]');
      await storyCard.waitForDisplayed({ timeout: 5000 });
      await browser.execute((el) => el.click(), storyCard);

      // Wait for detail panel to open
      const detailPanel = await $('div[role="dialog"]');
      await detailPanel.waitForExist({ timeout: 5000 });
      await expect(detailPanel).toBeDisplayed();

      // Verify panel title shows story ID
      // Use browser.execute to get text directly (getText() unreliable in wry/WebKit)
      const panelTitle = await detailPanel.$('h2#story-detail-title');
      await panelTitle.waitForExist({ timeout: 5000 });

      // Get text content directly from DOM
      const titleText = await browser.execute((el) => el.textContent, panelTitle);
      await expect(titleText).toContain('Story');
      await expect(titleText).toContain('1-1');
    });

    it('should close detail panel when clicking close button', async () => {
      await loadProjectAndNavigateToStories();

      // Wait and click a story card
      await browser.waitUntil(
        async () => {
          const cards = await $$('button[aria-label^="Story"]');
          return cards.length > 0;
        },
        { timeout: 10000 }
      );

      const storyCard = await $('button[aria-label^="Story"]');
      await browser.execute((el) => el.click(), storyCard);

      // Wait for panel to open
      const detailPanel = await $('div[role="dialog"]');
      await detailPanel.waitForExist({ timeout: 5000 });

      // Click close button
      const closeButton = await $('button[aria-label="Close detail panel"]');
      await closeButton.waitForExist({ timeout: 5000 });
      await browser.execute((el) => el.click(), closeButton);

      // Wait for panel to close
      await browser.waitUntil(
        async () => {
          const panel = await $('div[role="dialog"]');
          return !(await panel.isExisting());
        },
        { timeout: 5000, timeoutMsg: 'Detail panel did not close' }
      );
    });

    it('should display story content in detail panel', async () => {
      await loadProjectAndNavigateToStories();

      // Wait for story cards
      await browser.waitUntil(
        async () => {
          const cards = await $$('button[aria-label^="Story"]');
          return cards.length > 0;
        },
        { timeout: 10000 }
      );

      // Click on a story that has a file (story 1-1 which is done)
      // Use aria-label to find the button directly
      const card = await $('button[aria-label*="1-1"]');
      await card.waitForExist({ timeout: 5000 });
      await card.waitForDisplayed({ timeout: 5000 });
      await browser.execute((el) => el.click(), card);

      // Wait for panel
      const detailPanel = await $('div[role="dialog"]');
      await detailPanel.waitForExist({ timeout: 5000 });

      // Panel should show status section
      const statusLabel = await detailPanel.$('h3=Status');
      await statusLabel.waitForExist({ timeout: 5000 });
      await expect(statusLabel).toBeDisplayed();

      // Panel should show Epic section
      const epicLabel = await detailPanel.$('h3=Epic');
      await epicLabel.waitForExist({ timeout: 5000 });
      await expect(epicLabel).toBeDisplayed();
    });
  });

  describe('Epic Grouping', () => {
    it('should group stories by epic', async () => {
      await loadProjectAndNavigateToStories();

      // Wait for the story board to render
      await browser.pause(500);

      // Look for epic row indicators
      // Epics are displayed as row headers with format "Epic N:" or "Epic N"
      // The EpicRow component shows epic info in a span with class text-gray-200
      // Use contains text match for span elements
      const epicText = await $('span.text-gray-200*=Epic 1');
      await epicText.waitForExist({ timeout: 5000 });
      await expect(epicText).toBeDisplayed();
    });
  });
});
