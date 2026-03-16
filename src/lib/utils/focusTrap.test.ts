/**
 * Tests for focus trap utility.
 *
 * Story 6-8: Focus Trap Utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFocusableElements, handleFocusTrap } from './focusTrap';

describe('focusTrap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('getFocusableElements', () => {
    it('should return empty array for container with no focusable elements', () => {
      container.innerHTML = '<div><span>Not focusable</span></div>';
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(0);
    });

    it('should find buttons', () => {
      container.innerHTML = '<button>Click me</button>';
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(1);
      expect(elements[0].tagName).toBe('BUTTON');
    });

    it('should find inputs', () => {
      container.innerHTML = '<input type="text" />';
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(1);
      expect(elements[0].tagName).toBe('INPUT');
    });

    it('should find links with href', () => {
      container.innerHTML = '<a href="https://example.com">Link</a>';
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(1);
      expect(elements[0].tagName).toBe('A');
    });

    it('should find elements with positive tabindex', () => {
      container.innerHTML = '<div tabindex="0">Focusable div</div>';
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(1);
    });

    it('should exclude elements with tabindex="-1"', () => {
      container.innerHTML = '<button tabindex="-1">Hidden</button>';
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(0);
    });

    it('should exclude disabled buttons', () => {
      container.innerHTML = '<button disabled>Disabled</button>';
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(0);
    });

    it('should find multiple focusable elements', () => {
      container.innerHTML = `
        <button>First</button>
        <input type="text" />
        <a href="#">Link</a>
        <button>Last</button>
      `;
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(4);
    });
  });

  describe('handleFocusTrap', () => {
    it('should return false for non-Tab keys', () => {
      container.innerHTML = '<button>Focus</button>';
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const result = handleFocusTrap(event, container);
      expect(result).toBe(false);
    });

    it('should handle empty container by preventing default', () => {
      container.innerHTML = '<div>No focusable elements</div>';
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      const result = handleFocusTrap(event, container);

      expect(result).toBe(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should handle single element by keeping focus on it', () => {
      container.innerHTML = '<button id="only">Only button</button>';
      const button = container.querySelector('#only') as HTMLButtonElement;
      button.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const focusSpy = vi.spyOn(button, 'focus');

      const result = handleFocusTrap(event, container);

      expect(result).toBe(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should wrap focus from last to first on Tab', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      const firstButton = container.querySelector('#first') as HTMLButtonElement;
      const lastButton = container.querySelector('#last') as HTMLButtonElement;
      lastButton.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const focusSpy = vi.spyOn(firstButton, 'focus');

      const result = handleFocusTrap(event, container);

      expect(result).toBe(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should wrap focus from first to last on Shift+Tab', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      const firstButton = container.querySelector('#first') as HTMLButtonElement;
      const lastButton = container.querySelector('#last') as HTMLButtonElement;
      firstButton.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const focusSpy = vi.spyOn(lastButton, 'focus');

      const result = handleFocusTrap(event, container);

      expect(result).toBe(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should allow normal Tab navigation for middle elements', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="middle">Middle</button>
        <button id="last">Last</button>
      `;
      const middleButton = container.querySelector('#middle') as HTMLButtonElement;
      middleButton.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      const result = handleFocusTrap(event, container);

      expect(result).toBe(false);
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });
});
