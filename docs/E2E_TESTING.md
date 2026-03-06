# E2E Testing with WebdriverIO and Tauri

This document describes how to set up and run end-to-end (E2E) tests for the BMAD Manager desktop application.

## Architecture

BMAD Manager uses [WebdriverIO](https://webdriver.io/) with [tauri-driver](https://crates.io/crates/tauri-driver) for E2E testing:

```
WebdriverIO → WebDriver Protocol (port 4444) → tauri-driver → Tauri App (WRY webview)
```

**Why WebdriverIO instead of Playwright?**
- Tauri apps use WRY (a cross-platform webview library), not Chromium
- `tauri-driver` implements the W3C WebDriver protocol
- Playwright uses Chrome DevTools Protocol (CDP), which is incompatible with WebDriver
- WebdriverIO supports WebDriver protocol natively

## Prerequisites

### 1. Install tauri-driver

The `tauri-driver` binary is required to bridge WebdriverIO with your Tauri application:

```bash
cargo install tauri-driver --locked
```

Verify installation:
```bash
tauri-driver --version
```

### 2. Platform-specific requirements

#### Linux (Ubuntu/Debian)

Install the WebKit WebDriver:
```bash
sudo apt-get install webkit2gtk-driver
```

Verify it's available:
```bash
which WebKitWebDriver
```

#### Windows

Install Microsoft Edge Driver matching your Edge version:
1. Check your Edge version: `edge://version`
2. Download matching driver from [Microsoft Edge Driver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/)
3. Add to your PATH

#### macOS

⚠️ **macOS is not supported** for Tauri E2E testing due to lack of a WKWebView driver.

## Running E2E Tests

### 1. Build the debug binary

First, build the Tauri application in debug mode:

```bash
npm run build:e2e-app
```

This runs `npm run tauri build -- --debug --no-bundle` which creates:
- **Linux**: `src-tauri/target/debug/bmad-manager`
- **Windows**: `src-tauri/target/debug/bmad-manager.exe`

### 2. Run the tests

```bash
npm run test:e2e
```

This will:
1. Start `tauri-driver` (WebDriver server on port 4444)
2. Launch the Tauri application
3. Execute all tests in `e2e/*.spec.js`
4. Shut down the application and driver

## Writing Tests

Tests are located in the `e2e/` directory and use Mocha syntax with WebdriverIO globals.

### Example test

```typescript
describe('My Feature', () => {
  it('should display the sidebar', async () => {
    // Wait for element to exist
    const sidebar = await $('aside');
    await sidebar.waitForExist({ timeout: 5000 });

    // Assert element is visible
    expect(await sidebar.isDisplayed()).toBe(true);
  });

  it('should have correct window title', async () => {
    const title = await browser.getTitle();
    expect(title).toBe('BMAD Manager');
  });
});
```

### Available globals

- `browser` - The WebdriverIO browser object
- `$` - Query single element (e.g., `$('button.submit')`)
- `$$` - Query multiple elements (e.g., `$$('li.item')`)
- `expect` - WebdriverIO's expect assertions

### Selectors

WebdriverIO supports various selector strategies:
- CSS: `$('div.container')`
- Text: `$('=Click Me')` (exact match) or `$('*=Click')` (partial)
- Tag: `$('<button>')` or just `$('button')`
- Chained: `$('aside').$('h2')`

## Configuration

The WebdriverIO configuration is in `wdio.conf.js`. Key settings:

| Setting | Value | Description |
|---------|-------|-------------|
| `hostname` | `127.0.0.1` | tauri-driver host |
| `port` | `4444` | tauri-driver port |
| `browserName` | `wry` | Tauri's webview engine |
| `maxInstances` | `1` | Sequential test execution |
| `mochaOpts.timeout` | `60000` | 60s timeout for slow startups |

## CI/CD

E2E tests run automatically in GitHub Actions on:
- Push to `main`
- Pull requests to `main`

The CI pipeline:
1. Waits for unit tests to pass
2. Installs `webkit2gtk-driver` and `xvfb` (Linux)
3. Installs `tauri-driver`
4. Builds the debug binary
5. Runs E2E tests with `xvfb-run` (headless)

### Viewing CI results

Test artifacts (screenshots, logs) are uploaded and available in the GitHub Actions run artifacts.

## Troubleshooting

### "tauri-driver not found"

Ensure tauri-driver is installed and in your PATH:
```bash
cargo install tauri-driver --locked
which tauri-driver
```

### "WebKitWebDriver not found" (Linux)

Install the WebKit driver package:
```bash
sudo apt-get install webkit2gtk-driver
```

### "Binary not found"

Build the debug binary first:
```bash
npm run build:e2e-app
```

### Tests timeout on startup

The app may be slow to start. Increase timeouts in `wdio.conf.js`:
```typescript
connectionRetryTimeout: 180000, // 3 minutes
mochaOpts: { timeout: 120000 }  // 2 minutes
```

### Tests fail in CI but pass locally

CI runs in a headless environment. Ensure:
- `xvfb-run` is used in CI
- No tests rely on specific screen dimensions
- No tests rely on clipboard/system APIs

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run test:e2e` | Run all E2E tests |
| `npm run build:e2e-app` | Build debug binary for E2E |
