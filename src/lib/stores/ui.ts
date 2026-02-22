/**
 * Svelte stores for UI state management.
 * Handles command palette, toasts, active views, and other global UI state.
 */

import { writable } from 'svelte/store';

/**
 * Available main views in the application.
 */
export type MainView = 'workflows' | 'stories' | 'artifacts';

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
 * Toast action button.
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/**
 * Toast notification data.
 */
export interface Toast {
  id: string;
  message: string;
  icon?: string;
  duration?: number;
  variant?: 'success' | 'error' | 'info';
  action?: ToastAction;
  secondaryAction?: ToastAction;
}

/**
 * Options for showing a toast.
 */
export interface ShowToastOptions {
  icon?: string;
  duration?: number;
  variant?: 'success' | 'error' | 'info';
  action?: ToastAction;
  secondaryAction?: ToastAction;
}

/**
 * Store for active toast notifications.
 */
export const toasts = writable<Toast[]>([]);

/**
 * Shows a toast notification.
 * @param message - The message to display
 * @param iconOrOptions - Optional icon string (legacy) or ShowToastOptions object
 * @param legacyDuration - Optional duration for legacy signature
 */
export function showToast(
  message: string,
  iconOrOptions?: string | ShowToastOptions,
  legacyDuration?: number
) {
  // Handle legacy signature: showToast(message, icon, duration)
  let options: ShowToastOptions;
  if (typeof iconOrOptions === 'string') {
    options = {
      icon: iconOrOptions,
      duration: legacyDuration ?? 2000,
    };
  } else {
    options = iconOrOptions ?? {};
  }

  const {
    icon = '⚡',
    duration = 2000,
    variant = 'info',
    action,
    secondaryAction,
  } = options;
  const id = crypto.randomUUID();
  toasts.update((t) => [...t, { id, message, icon, duration, variant, action, secondaryAction }]);

  // Don't auto-dismiss if there's an action button (user needs time to click)
  const actualDuration = action ? Math.max(duration, 4000) : duration;

  setTimeout(() => {
    toasts.update((t) => t.filter((toast) => toast.id !== id));
  }, actualDuration);
}

/**
 * Shows a success toast.
 */
export function showSuccessToast(message: string, options: Omit<ShowToastOptions, 'variant'> = {}) {
  showToast(message, { ...options, variant: 'success', icon: options.icon ?? '✓' });
}

/**
 * Shows an error toast.
 */
export function showErrorToast(message: string, options: Omit<ShowToastOptions, 'variant'> = {}) {
  showToast(message, { ...options, variant: 'error', icon: options.icon ?? '✕', duration: options.duration ?? 4000 });
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
