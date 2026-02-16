/**
 * Terminal configuration and utilities for xterm.js integration.
 * Provides consistent terminal settings across the application.
 */

import type { ITerminalOptions, ITheme, ITerminalAddon } from '@xterm/xterm';

/**
 * Dark theme colors matching the app's dark mode design.
 * Based on a Dracula-inspired palette for good readability.
 */
export const darkTheme: ITheme = {
  background: '#1a1a2e',
  foreground: '#e0e0e0',
  cursor: '#e0e0e0',
  cursorAccent: '#1a1a2e',
  selectionBackground: '#44475a',
  selectionForeground: '#f8f8f2',
  selectionInactiveBackground: '#44475a80',
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};

/**
 * Default terminal options for Claude CLI sessions.
 */
export const defaultTerminalOptions: ITerminalOptions = {
  cursorBlink: true,
  cursorStyle: 'block',
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  lineHeight: 1.2,
  scrollback: 10000,
  theme: darkTheme,
  allowProposedApi: true,
};

/**
 * Checks if WebGL is supported in the current browser context.
 * Used to determine whether to load the WebGL addon.
 */
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

/**
 * Attempts to load the WebGL addon for better rendering performance.
 * Falls back silently if WebGL is not available.
 * @param terminal - The xterm Terminal instance to load the addon on
 * @returns true if WebGL addon was loaded, false if fallback to canvas
 */
export async function tryLoadWebGLAddon(
  terminal: { loadAddon: (addon: ITerminalAddon) => void }
): Promise<boolean> {
  if (!isWebGLSupported()) {
    console.info('WebGL not supported, using canvas renderer');
    return false;
  }

  try {
    const { WebglAddon } = await import('@xterm/addon-webgl');
    const webglAddon = new WebglAddon();
    terminal.loadAddon(webglAddon);
    return true;
  } catch (e) {
    console.warn('Failed to load WebGL addon, using canvas renderer:', e);
    return false;
  }
}
