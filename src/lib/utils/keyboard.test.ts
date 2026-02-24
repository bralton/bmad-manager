/**
 * Unit tests for keyboard utilities.
 * Tests the isTerminalFocused() function for terminal-aware ESC handling.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isTerminalFocused } from './keyboard';

describe('keyboard utilities', () => {
  describe('isTerminalFocused', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      // Create a container for test elements
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      // Clean up
      container.remove();
    });

    it('returns false when no element has focus', () => {
      // Body has focus by default, but no .xterm element exists
      expect(isTerminalFocused()).toBe(false);
    });

    it('returns false when a non-terminal element has focus', () => {
      const button = document.createElement('button');
      container.appendChild(button);
      button.focus();

      expect(isTerminalFocused()).toBe(false);
    });

    it('returns true when an xterm terminal element has focus', () => {
      // Create a mock xterm container
      const xtermContainer = document.createElement('div');
      xtermContainer.className = 'xterm';
      const xtermTextarea = document.createElement('textarea');
      xtermContainer.appendChild(xtermTextarea);
      container.appendChild(xtermContainer);

      xtermTextarea.focus();

      expect(isTerminalFocused()).toBe(true);
    });

    it('returns true when a child of xterm element has focus', () => {
      // Create nested xterm structure
      const xtermContainer = document.createElement('div');
      xtermContainer.className = 'xterm';
      const nestedDiv = document.createElement('div');
      const innerElement = document.createElement('input');
      nestedDiv.appendChild(innerElement);
      xtermContainer.appendChild(nestedDiv);
      container.appendChild(xtermContainer);

      innerElement.focus();

      expect(isTerminalFocused()).toBe(true);
    });

    it('returns false when element with similar class but not xterm has focus', () => {
      const notXterm = document.createElement('div');
      notXterm.className = 'xterm-helper not-actual-xterm';
      const input = document.createElement('input');
      notXterm.appendChild(input);
      container.appendChild(notXterm);

      input.focus();

      // .xterm-helper contains 'xterm' but closest('.xterm') should NOT match
      // because the class is 'xterm-helper' not 'xterm'
      expect(isTerminalFocused()).toBe(false);
    });

    it('returns true when xterm is an ancestor further up the DOM', () => {
      const xtermContainer = document.createElement('div');
      xtermContainer.className = 'xterm';
      const level1 = document.createElement('div');
      const level2 = document.createElement('div');
      const deepInput = document.createElement('input');
      level2.appendChild(deepInput);
      level1.appendChild(level2);
      xtermContainer.appendChild(level1);
      container.appendChild(xtermContainer);

      deepInput.focus();

      expect(isTerminalFocused()).toBe(true);
    });
  });
});
