/**
 * Keyboard shortcuts service.
 * Handles registration, matching, and display formatting of global shortcuts.
 */

/**
 * Modifier keys supported by shortcuts.
 */
export type Modifier = 'Cmd' | 'Ctrl' | 'Alt' | 'Shift';

/**
 * Categories for organizing shortcuts.
 */
export type ShortcutCategory = 'navigation' | 'sessions' | 'general';

/**
 * Parsed shortcut representation.
 */
export interface ParsedShortcut {
  key: string;
  modifiers: Modifier[];
}

/**
 * Definition of a keyboard shortcut.
 */
export interface ShortcutDefinition {
  id: string;
  key: string;
  description: string;
  category: ShortcutCategory;
  action?: () => void;
  global?: boolean;
}

/**
 * Checks if the current platform is macOS.
 */
export function isMac(): boolean {
  return navigator.platform.toUpperCase().includes('MAC');
}

/**
 * Parses a shortcut string like "Cmd+K" into its components.
 * @param shortcut - Shortcut string (e.g., "Cmd+Shift+K")
 * @returns Parsed shortcut with key and modifiers
 */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+');
  const modifiers: Modifier[] = [];
  let key = '';

  for (const part of parts) {
    const normalized = part.trim();
    const upper = normalized.toUpperCase();

    if (upper === 'CMD' || upper === 'COMMAND' || upper === 'META') {
      modifiers.push('Cmd');
    } else if (upper === 'CTRL' || upper === 'CONTROL') {
      modifiers.push('Ctrl');
    } else if (upper === 'ALT' || upper === 'OPT' || upper === 'OPTION') {
      modifiers.push('Alt');
    } else if (upper === 'SHIFT') {
      modifiers.push('Shift');
    } else {
      // Last non-modifier is the key
      key = normalized.toLowerCase();
    }
  }

  return { key, modifiers };
}

/**
 * Checks if a KeyboardEvent matches a shortcut string.
 * Handles platform-specific modifier mapping (Cmd = Meta on Mac, Ctrl on Windows).
 * @param event - The keyboard event
 * @param shortcut - Shortcut string (e.g., "Cmd+K")
 * @returns True if the event matches the shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  const onMac = isMac();

  // Normalize the event key for comparison
  let eventKey = event.key.toLowerCase();

  // Handle special case for ? which is Shift+/
  if (eventKey === '?' && parsed.key === '?') {
    eventKey = '?';
  } else if (parsed.key === '?' && eventKey === '/') {
    // Cmd+? is same as Cmd+Shift+/
    eventKey = '?';
  }

  // Check key match
  if (eventKey !== parsed.key) {
    return false;
  }

  // Check modifiers
  const needsCmd = parsed.modifiers.includes('Cmd');
  const needsCtrl = parsed.modifiers.includes('Ctrl');
  const needsAlt = parsed.modifiers.includes('Alt');
  const needsShift = parsed.modifiers.includes('Shift');

  // Cmd maps to metaKey on Mac, ctrlKey on Windows
  const hasCmd = onMac ? event.metaKey : event.ctrlKey;
  // On Mac, Ctrl is its own key; on Windows, Cmd and Ctrl are the same
  const hasCtrl = onMac ? event.ctrlKey : false;
  const hasAlt = event.altKey;
  // For ?, shift is implicit so don't check it
  const hasShift = parsed.key === '?' ? needsShift : event.shiftKey;

  // Check required modifiers are present
  if (needsCmd && !hasCmd) return false;
  if (needsCtrl && !hasCtrl) return false;
  if (needsAlt && !hasAlt) return false;
  if (needsShift && !hasShift) return false;

  // Check no extra modifiers (except for ? which requires shift implicitly)
  if (!needsCmd && hasCmd) return false;
  if (!needsCtrl && hasCtrl) return false;
  if (!needsAlt && hasAlt) return false;
  if (!needsShift && hasShift && parsed.key !== '?') return false;

  return true;
}

/**
 * Checks if an element is an input field where shortcuts should be suppressed.
 * @param element - The DOM element to check
 * @returns True if the element is an input field
 */
export function isInputElement(element: Element): boolean {
  const tagName = element.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
    return true;
  }
  if (element instanceof HTMLElement) {
    // Check both property and attribute for contentEditable
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
      return true;
    }
  }
  return false;
}

/**
 * Default application shortcuts.
 * Actions are populated by the registration function.
 */
export const defaultShortcuts: ShortcutDefinition[] = [
  // Navigation
  {
    id: 'view-dashboards',
    key: 'Cmd+1',
    description: 'Switch to Dashboards view',
    category: 'navigation',
    global: true,
  },
  {
    id: 'view-workflows',
    key: 'Cmd+2',
    description: 'Switch to Workflows view',
    category: 'navigation',
    global: true,
  },
  {
    id: 'view-stories',
    key: 'Cmd+3',
    description: 'Switch to Stories view',
    category: 'navigation',
    global: true,
  },
  {
    id: 'view-artifacts',
    key: 'Cmd+4',
    description: 'Switch to Artifacts view',
    category: 'navigation',
    global: true,
  },

  // Sessions
  {
    id: 'new-conversation',
    key: 'Cmd+N',
    description: 'New conversation',
    category: 'sessions',
    global: true,
  },
  {
    id: 'toggle-session-drawer',
    key: 'Cmd+`',
    description: 'Toggle session drawer',
    category: 'sessions',
    global: true,
  },

  // General
  {
    id: 'command-palette',
    key: 'Cmd+K',
    description: 'Open command palette',
    category: 'general',
    global: true,
  },
  {
    id: 'settings',
    key: 'Cmd+,',
    description: 'Open settings',
    category: 'general',
    global: true,
  },
  {
    id: 'shortcuts-help',
    key: 'Cmd+?',
    description: 'Show keyboard shortcuts',
    category: 'general',
    global: true,
  },
  {
    id: 'close-dialog',
    key: 'Escape',
    description: 'Close dialogs/panels',
    category: 'general',
    global: true,
  },
];

/**
 * Gets shortcuts grouped by category.
 */
export function getShortcutsByCategory(): Record<ShortcutCategory, ShortcutDefinition[]> {
  const grouped: Record<ShortcutCategory, ShortcutDefinition[]> = {
    navigation: [],
    sessions: [],
    general: [],
  };

  for (const shortcut of defaultShortcuts) {
    grouped[shortcut.category].push(shortcut);
  }

  return grouped;
}

/**
 * Formats a shortcut for display, using platform-appropriate symbols.
 * @param shortcut - Shortcut string (e.g., "Cmd+K")
 * @returns Display string (e.g., "⌘K" on Mac, "Ctrl+K" on Windows)
 */
export function formatShortcutDisplay(shortcut: string): string {
  const onMac = isMac();
  const parsed = parseShortcut(shortcut);

  const modifierSymbols: string[] = [];

  for (const mod of parsed.modifiers) {
    if (mod === 'Cmd') {
      modifierSymbols.push(onMac ? '⌘' : 'Ctrl+');
    } else if (mod === 'Ctrl') {
      modifierSymbols.push(onMac ? '⌃' : 'Ctrl+');
    } else if (mod === 'Alt') {
      modifierSymbols.push(onMac ? '⌥' : 'Alt+');
    } else if (mod === 'Shift') {
      modifierSymbols.push(onMac ? '⇧' : 'Shift+');
    }
  }

  // Format key
  let keyDisplay = parsed.key.toUpperCase();
  if (parsed.key === 'escape') {
    keyDisplay = 'Esc';
  } else if (parsed.key === ',') {
    keyDisplay = ',';
  } else if (parsed.key === '/') {
    keyDisplay = '/';
  } else if (parsed.key === '?') {
    keyDisplay = '?';
  } else if (parsed.key.length === 1) {
    keyDisplay = parsed.key.toUpperCase();
  }

  // Join modifiers - on Mac they concatenate, on Windows they use +
  const modifiers = onMac
    ? modifierSymbols.join('')
    : modifierSymbols.join('');

  return modifiers + keyDisplay;
}

/**
 * Action handlers mapped by shortcut ID.
 */
const shortcutActions = new Map<string, () => void>();

/**
 * Reference to the registered global handler.
 */
let globalHandler: ((event: KeyboardEvent) => void) | null = null;

/**
 * Sets the action handler for a shortcut.
 * @param id - Shortcut ID
 * @param action - Action function to execute
 */
export function setShortcutAction(id: string, action: () => void): void {
  shortcutActions.set(id, action);
}

/**
 * Removes the action handler for a shortcut.
 * @param id - Shortcut ID
 */
export function removeShortcutAction(id: string): void {
  shortcutActions.delete(id);
}

/**
 * Clears all shortcut actions.
 */
export function clearShortcutActions(): void {
  shortcutActions.clear();
}

/**
 * Handles a global keydown event.
 * Checks for matching shortcuts and executes actions.
 */
function handleGlobalKeydown(event: KeyboardEvent): void {
  const target = event.target as Element;

  // Skip shortcuts when in input fields (except Escape)
  if (isInputElement(target) && event.key !== 'Escape') {
    return;
  }

  // Check each shortcut
  for (const shortcut of defaultShortcuts) {
    if (!shortcut.global) continue;

    if (matchesShortcut(event, shortcut.key)) {
      const action = shortcutActions.get(shortcut.id);
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        action();
        return;
      }
    }
  }
}

/**
 * Registers the global keyboard shortcut handler.
 * Uses capture phase to intercept events before other handlers (like xterm.js).
 */
export function registerGlobalShortcuts(): void {
  if (globalHandler) {
    // Already registered
    return;
  }

  globalHandler = handleGlobalKeydown;
  window.addEventListener('keydown', globalHandler, { capture: true });
}

/**
 * Unregisters the global keyboard shortcut handler.
 */
export function unregisterGlobalShortcuts(): void {
  if (globalHandler) {
    window.removeEventListener('keydown', globalHandler, { capture: true });
    globalHandler = null;
  }
}
