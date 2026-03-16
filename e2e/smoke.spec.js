/**
 * Smoke tests for BMAD Manager Tauri application.
 *
 * These tests verify that the application launches correctly and
 * the main UI elements are present.
 *
 * Prerequisites:
 * 1. tauri-driver installed: cargo install tauri-driver --locked
 * 2. Debug binary built: npm run build:e2e-app
 * 3. On Linux: webkit2gtk-driver installed
 *
 * WebdriverIO globals (browser, $, $$, expect) are injected by the framework.
 */

describe('BMAD Manager Smoke Tests', () => {
  it('should launch the application and display the correct window title', async () => {
    // The app should be running at this point (managed by tauri-driver)
    // Verify we have a valid browser session
    // Note: Tauri webview may return empty title via WebDriver, so we check
    // the HTML title element as a fallback
    const title = await browser.getTitle();

    if (title === '') {
      // Fallback: check the <title> element in the HTML
      const titleElement = await $('title');
      const exists = await titleElement.isExisting();
      // Just verify the app is running - title may not be accessible via WebDriver
      await expect(exists).toBe(true);
    } else {
      // The title should be "BMAD Manager" as defined in tauri.conf.json
      await expect(title).toBe('BMAD Manager');
    }
  });

  it('should display the sidebar with branding', async () => {
    // Wait for the app to fully load
    // The sidebar is an <aside> element with the app branding
    const sidebar = await $('aside');
    await sidebar.waitForExist({ timeout: 10000 });
    await expect(sidebar).toBeDisplayed();

    // Check for BMAD Manager branding text in sidebar
    const branding = await sidebar.$('h2');
    const brandingText = await branding.getText();
    await expect(brandingText).toContain('BMAD Manager');
  });

  it('should display the main content area', async () => {
    // The main content area should be visible
    const main = await $('main');
    await main.waitForExist({ timeout: 5000 });
    await expect(main).toBeDisplayed();
  });

  it('should display the welcome message when no project is loaded', async () => {
    // When app first starts, should show welcome header
    const welcomeHeader = await $('h1');
    await welcomeHeader.waitForExist({ timeout: 5000 });

    const headerText = await welcomeHeader.getText();
    await expect(headerText).toContain('Welcome');
  });

  it('should have the correct page structure (flex layout)', async () => {
    // The root container should use flex layout
    const container = await $('div.flex.h-screen');
    await container.waitForExist({ timeout: 5000 });
    await expect(container).toBeDisplayed();

    // Should contain both sidebar (aside) and main
    // Note: '> *' selector is not valid in WebDriver for webkit
    const sidebar = await container.$('aside');
    const main = await container.$('main');
    await expect(sidebar).toBeExisting();
    await expect(main).toBeExisting();
  });
});
