/**
 * Svelte stores for UI state management.
 * Handles command palette, toasts, active views, and other global UI state.
 */

import { writable } from 'svelte/store';

/**
 * Available main views in the application.
 */
export type MainView = 'workflows' | 'stories';

/**
 * The currently active main view.
 * Determines what content is shown in the main panel.
 */
export const activeView = writable<MainView>('workflows');

/**
 * Sets the active main view.
 */
export function setActiveView(view: MainView) {
  activeView.set(view);
}

/**
 * Whether the command palette is currently open.
 */
export const commandPaletteOpen = writable<boolean>(false);

/**
 * Toggles the command palette open/closed.
 */
export function toggleCommandPalette() {
  commandPaletteOpen.update((v) => !v);
}

/**
 * Opens the command palette.
 */
export function openCommandPalette() {
  commandPaletteOpen.set(true);
}

/**
 * Closes the command palette.
 */
export function closeCommandPalette() {
  commandPaletteOpen.set(false);
}

/**
 * Toast notification data.
 */
export interface Toast {
  id: string;
  message: string;
  icon?: string;
  duration?: number;
}

/**
 * Store for active toast notifications.
 */
export const toasts = writable<Toast[]>([]);

/**
 * Shows a toast notification.
 * @param message - The message to display
 * @param icon - Optional icon (defaults to ⚡)
 * @param duration - Auto-dismiss duration in ms (defaults to 2000)
 */
export function showToast(message: string, icon = '⚡', duration = 2000) {
  const id = crypto.randomUUID();
  toasts.update((t) => [...t, { id, message, icon, duration }]);
  setTimeout(() => {
    toasts.update((t) => t.filter((toast) => toast.id !== id));
  }, duration);
}

/**
 * Manually dismisses a toast by ID.
 */
export function dismissToast(id: string) {
  toasts.update((t) => t.filter((toast) => toast.id !== id));
}

/**
 * Clears all toasts.
 */
export function clearToasts() {
  toasts.set([]);
}

/**
 * Store for the last executed command (for story 2-6 to pick up).
 */
export const lastExecutedCommand = writable<string | null>(null);

/**
 * Sets the last executed command for session injection.
 */
export function setLastExecutedCommand(command: string) {
  lastExecutedCommand.set(command);
}

/**
 * Clears the last executed command.
 */
export function clearLastExecutedCommand() {
  lastExecutedCommand.set(null);
}
