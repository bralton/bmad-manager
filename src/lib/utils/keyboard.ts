/**
 * Keyboard utilities for terminal-aware event handling.
 *
 * These utilities help components determine when to handle keyboard events
 * vs. when to pass them through to the terminal (xterm.js).
 */

/**
 * Check if a terminal (xterm.js) element has focus.
 * Used to determine if ESC should be passed to terminal vs handled by UI.
 *
 * When the terminal is focused, keyboard events like ESC should pass through
 * to the terminal so users can interrupt Claude sessions (Ctrl+C, ESC).
 *
 * @returns true if an xterm.js terminal element currently has focus
 */
export function isTerminalFocused(): boolean {
  return document.activeElement?.closest('.xterm') !== null;
}
