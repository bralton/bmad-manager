/**
 * Tests for shortcuts service.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseShortcut,
  matchesShortcut,
  isMac,
  isInputElement,
  defaultShortcuts,
  registerGlobalShortcuts,
  unregisterGlobalShortcuts,
  getShortcutsByCategory,
  formatShortcutDisplay,
  setShortcutAction,
  clearShortcutActions,
} from './shortcuts';

// Mock navigator.platform for cross-platform testing
const mockNavigatorPlatform = (platform: string) => {
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true,
  });
};

describe('shortcuts service', () => {
  describe('parseShortcut', () => {
    it('parses Cmd+K shortcut', () => {
      const result = parseShortcut('Cmd+K');
      expect(result.key).toBe('k');
      expect(result.modifiers).toContain('Cmd');
      expect(result.modifiers).toHaveLength(1);
    });

    it('parses Cmd+Shift+/ shortcut', () => {
      const result = parseShortcut('Cmd+Shift+/');
      expect(result.key).toBe('/');
      expect(result.modifiers).toContain('Cmd');
      expect(result.modifiers).toContain('Shift');
      expect(result.modifiers).toHaveLength(2);
    });

    it('parses single key shortcut', () => {
      const result = parseShortcut('Escape');
      expect(result.key).toBe('escape');
      expect(result.modifiers).toHaveLength(0);
    });

    it('parses Cmd+1 shortcut', () => {
      const result = parseShortcut('Cmd+1');
      expect(result.key).toBe('1');
      expect(result.modifiers).toContain('Cmd');
    });

    it('handles case insensitivity', () => {
      const result = parseShortcut('CMD+SHIFT+N');
      expect(result.key).toBe('n');
      expect(result.modifiers).toContain('Cmd');
      expect(result.modifiers).toContain('Shift');
    });

    it('parses Cmd+, shortcut', () => {
      const result = parseShortcut('Cmd+,');
      expect(result.key).toBe(',');
      expect(result.modifiers).toContain('Cmd');
    });
  });

  describe('isMac', () => {
    const originalPlatform = navigator.platform;

    afterEach(() => {
      mockNavigatorPlatform(originalPlatform);
    });

    it('returns true for MacIntel', () => {
      mockNavigatorPlatform('MacIntel');
      expect(isMac()).toBe(true);
    });

    it('returns true for MacARM', () => {
      mockNavigatorPlatform('MacARM');
      expect(isMac()).toBe(true);
    });

    it('returns false for Win32', () => {
      mockNavigatorPlatform('Win32');
      expect(isMac()).toBe(false);
    });

    it('returns false for Linux', () => {
      mockNavigatorPlatform('Linux x86_64');
      expect(isMac()).toBe(false);
    });
  });

  describe('matchesShortcut', () => {
    const originalPlatform = navigator.platform;

    beforeEach(() => {
      mockNavigatorPlatform('MacIntel');
    });

    afterEach(() => {
      mockNavigatorPlatform(originalPlatform);
    });

    it('matches Cmd+K on Mac with metaKey', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      });
      expect(matchesShortcut(event, 'Cmd+K')).toBe(true);
    });

    it('does not match Cmd+K when wrong modifier', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      });
      mockNavigatorPlatform('MacIntel');
      expect(matchesShortcut(event, 'Cmd+K')).toBe(false);
    });

    it('matches Cmd+K on Windows with ctrlKey', () => {
      mockNavigatorPlatform('Win32');
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      });
      expect(matchesShortcut(event, 'Cmd+K')).toBe(true);
    });

    it('matches Cmd+Shift+/ for help shortcut', () => {
      const event = new KeyboardEvent('keydown', {
        key: '/',
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      });
      expect(matchesShortcut(event, 'Cmd+Shift+/')).toBe(true);
    });

    it('matches ? key for Cmd+? (same as Cmd+Shift+/)', () => {
      const event = new KeyboardEvent('keydown', {
        key: '?',
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      });
      expect(matchesShortcut(event, 'Cmd+?')).toBe(true);
    });

    it('matches Escape without modifiers', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      });
      expect(matchesShortcut(event, 'Escape')).toBe(true);
    });

    it('matches number keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: '1',
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      });
      expect(matchesShortcut(event, 'Cmd+1')).toBe(true);
    });

    it('does not match when extra modifiers present', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        ctrlKey: false,
        shiftKey: true, // Extra modifier
        altKey: false,
      });
      expect(matchesShortcut(event, 'Cmd+K')).toBe(false);
    });
  });

  describe('isInputElement', () => {
    it('returns true for input elements', () => {
      const input = document.createElement('input');
      expect(isInputElement(input)).toBe(true);
    });

    it('returns true for textarea elements', () => {
      const textarea = document.createElement('textarea');
      expect(isInputElement(textarea)).toBe(true);
    });

    it('returns true for contenteditable elements', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      expect(isInputElement(div)).toBe(true);
    });

    it('returns false for regular div elements', () => {
      const div = document.createElement('div');
      expect(isInputElement(div)).toBe(false);
    });

    it('returns false for button elements', () => {
      const button = document.createElement('button');
      expect(isInputElement(button)).toBe(false);
    });
  });

  describe('defaultShortcuts', () => {
    it('includes command palette shortcut', () => {
      const shortcut = defaultShortcuts.find((s) => s.id === 'command-palette');
      expect(shortcut).toBeDefined();
      expect(shortcut?.key).toBe('Cmd+K');
      expect(shortcut?.category).toBe('general');
    });

    it('includes view navigation shortcuts', () => {
      const workflows = defaultShortcuts.find((s) => s.id === 'view-workflows');
      const stories = defaultShortcuts.find((s) => s.id === 'view-stories');
      const artifacts = defaultShortcuts.find((s) => s.id === 'view-artifacts');

      expect(workflows).toBeDefined();
      expect(stories).toBeDefined();
      expect(artifacts).toBeDefined();
      expect(workflows?.category).toBe('navigation');
    });

    it('includes settings shortcut', () => {
      const shortcut = defaultShortcuts.find((s) => s.id === 'settings');
      expect(shortcut).toBeDefined();
      expect(shortcut?.key).toBe('Cmd+,');
    });

    it('includes new conversation shortcut', () => {
      const shortcut = defaultShortcuts.find((s) => s.id === 'new-conversation');
      expect(shortcut).toBeDefined();
      expect(shortcut?.key).toBe('Cmd+N');
      expect(shortcut?.category).toBe('sessions');
    });

    it('includes shortcuts cheatsheet shortcut', () => {
      const shortcut = defaultShortcuts.find((s) => s.id === 'shortcuts-help');
      expect(shortcut).toBeDefined();
      expect(shortcut?.key).toBe('Cmd+?');
    });
  });

  describe('getShortcutsByCategory', () => {
    it('returns shortcuts grouped by category', () => {
      const grouped = getShortcutsByCategory();

      expect(grouped.navigation).toBeDefined();
      expect(grouped.sessions).toBeDefined();
      expect(grouped.general).toBeDefined();

      expect(grouped.navigation.length).toBeGreaterThan(0);
      expect(grouped.sessions.length).toBeGreaterThan(0);
      expect(grouped.general.length).toBeGreaterThan(0);
    });
  });

  describe('formatShortcutDisplay', () => {
    const originalPlatform = navigator.platform;

    afterEach(() => {
      mockNavigatorPlatform(originalPlatform);
    });

    it('formats Cmd+K as ⌘K on Mac', () => {
      mockNavigatorPlatform('MacIntel');
      expect(formatShortcutDisplay('Cmd+K')).toBe('⌘K');
    });

    it('formats Cmd+K as Ctrl+K on Windows', () => {
      mockNavigatorPlatform('Win32');
      expect(formatShortcutDisplay('Cmd+K')).toBe('Ctrl+K');
    });

    it('formats Cmd+Shift+/ on Mac', () => {
      mockNavigatorPlatform('MacIntel');
      expect(formatShortcutDisplay('Cmd+Shift+/')).toBe('⌘⇧/');
    });

    it('formats Escape key', () => {
      expect(formatShortcutDisplay('Escape')).toBe('Esc');
    });

    it('formats Cmd+, for settings', () => {
      mockNavigatorPlatform('MacIntel');
      expect(formatShortcutDisplay('Cmd+,')).toBe('⌘,');
    });
  });

  describe('input context awareness integration', () => {
    // These tests verify AC8: shortcuts should NOT trigger when typing in inputs
    const originalPlatform = navigator.platform;
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;
    let capturedHandler: ((event: KeyboardEvent) => void) | null = null;

    beforeEach(() => {
      mockNavigatorPlatform('MacIntel');
      // Capture the handler when registered
      window.addEventListener = vi.fn((type, handler, options) => {
        if (type === 'keydown') {
          capturedHandler = handler as (event: KeyboardEvent) => void;
        }
        originalAddEventListener.call(window, type, handler, options);
      });
      window.removeEventListener = vi.fn((type, handler, options) => {
        originalRemoveEventListener.call(window, type, handler, options);
      });
    });

    afterEach(() => {
      mockNavigatorPlatform(originalPlatform);
      window.addEventListener = originalAddEventListener;
      window.removeEventListener = originalRemoveEventListener;
      unregisterGlobalShortcuts();
      clearShortcutActions();
      capturedHandler = null;
    });

    it('skips shortcuts when focused on input element', () => {
      const actionSpy = vi.fn();
      registerGlobalShortcuts();
      setShortcutAction('command-palette', actionSpy);

      // Create input and simulate keydown with it as target
      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: input });

      // Manually call the captured handler
      if (capturedHandler) {
        capturedHandler(event);
      }

      expect(actionSpy).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('skips shortcuts when focused on textarea element', () => {
      const actionSpy = vi.fn();
      registerGlobalShortcuts();
      setShortcutAction('command-palette', actionSpy);

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: textarea });

      if (capturedHandler) {
        capturedHandler(event);
      }

      expect(actionSpy).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });

    it('skips shortcuts when focused on contenteditable element', () => {
      const actionSpy = vi.fn();
      registerGlobalShortcuts();
      setShortcutAction('command-palette', actionSpy);

      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: div });

      if (capturedHandler) {
        capturedHandler(event);
      }

      expect(actionSpy).not.toHaveBeenCalled();
      document.body.removeChild(div);
    });

    it('allows Escape in input fields', () => {
      const actionSpy = vi.fn();
      registerGlobalShortcuts();
      setShortcutAction('close-dialog', actionSpy);

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: input });

      if (capturedHandler) {
        capturedHandler(event);
      }

      expect(actionSpy).toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('triggers shortcuts when focused on regular div', () => {
      const actionSpy = vi.fn();
      registerGlobalShortcuts();
      setShortcutAction('command-palette', actionSpy);

      const div = document.createElement('div');
      document.body.appendChild(div);

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: div });

      if (capturedHandler) {
        capturedHandler(event);
      }

      expect(actionSpy).toHaveBeenCalled();
      document.body.removeChild(div);
    });
  });

  describe('registerGlobalShortcuts and unregisterGlobalShortcuts', () => {
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;

    beforeEach(() => {
      window.addEventListener = vi.fn();
      window.removeEventListener = vi.fn();
    });

    afterEach(() => {
      window.addEventListener = originalAddEventListener;
      window.removeEventListener = originalRemoveEventListener;
      // Clean up any registered handlers
      unregisterGlobalShortcuts();
    });

    it('registers keydown event listener with capture', () => {
      registerGlobalShortcuts();
      expect(window.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      );
    });

    it('unregisters keydown event listener', () => {
      registerGlobalShortcuts();
      unregisterGlobalShortcuts();
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      );
    });

    it('does not register multiple handlers', () => {
      registerGlobalShortcuts();
      registerGlobalShortcuts();
      expect(window.addEventListener).toHaveBeenCalledTimes(1);
    });
  });
});
