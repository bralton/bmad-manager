/**
 * Unit tests for ui.ts store.
 * Tests command palette, toasts, and lastExecutedCommand stores.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  commandPaletteOpen,
  toggleCommandPalette,
  openCommandPalette,
  closeCommandPalette,
  toasts,
  showToast,
  dismissToast,
  clearToasts,
  lastExecutedCommand,
  setLastExecutedCommand,
  clearLastExecutedCommand,
  activeView,
  setActiveView,
  type MainView,
} from './ui';

describe('ui store', () => {
  beforeEach(() => {
    // Reset all stores to initial state
    commandPaletteOpen.set(false);
    clearToasts();
    clearLastExecutedCommand();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('commandPaletteOpen', () => {
    // P0: Test initialization
    it('initializes to false', () => {
      commandPaletteOpen.set(false); // Ensure reset
      expect(get(commandPaletteOpen)).toBe(false);
    });

    // P0: Test toggleCommandPalette opens when closed
    it('toggleCommandPalette opens palette when closed', () => {
      commandPaletteOpen.set(false);
      toggleCommandPalette();
      expect(get(commandPaletteOpen)).toBe(true);
    });

    // P0: Test toggleCommandPalette closes when open
    it('toggleCommandPalette closes palette when open', () => {
      commandPaletteOpen.set(true);
      toggleCommandPalette();
      expect(get(commandPaletteOpen)).toBe(false);
    });

    // P0: Test openCommandPalette
    it('openCommandPalette sets to true', () => {
      commandPaletteOpen.set(false);
      openCommandPalette();
      expect(get(commandPaletteOpen)).toBe(true);
    });

    // P0: Test closeCommandPalette
    it('closeCommandPalette sets to false', () => {
      commandPaletteOpen.set(true);
      closeCommandPalette();
      expect(get(commandPaletteOpen)).toBe(false);
    });
  });

  describe('toasts', () => {
    // P0: Test toasts initialization
    it('initializes to empty array', () => {
      clearToasts();
      expect(get(toasts)).toEqual([]);
    });

    // P0: Test showToast adds toast with correct properties
    it('showToast adds toast with id, message, icon, and duration', () => {
      showToast('Test message', '✓', 3000);
      const currentToasts = get(toasts);

      expect(currentToasts).toHaveLength(1);
      expect(currentToasts[0].message).toBe('Test message');
      expect(currentToasts[0].icon).toBe('✓');
      expect(currentToasts[0].duration).toBe(3000);
      expect(currentToasts[0].id).toBeDefined();
    });

    // P0: Test showToast default values
    it('showToast uses default icon and duration', () => {
      showToast('Default test');
      const currentToasts = get(toasts);

      expect(currentToasts[0].icon).toBe('⚡');
      expect(currentToasts[0].duration).toBe(2000);
    });

    // P0: Test showToast auto-dismiss
    it('showToast auto-dismisses after duration', () => {
      showToast('Auto-dismiss test', '⚡', 2000);
      expect(get(toasts)).toHaveLength(1);

      // Advance timers by duration
      vi.advanceTimersByTime(2000);

      expect(get(toasts)).toHaveLength(0);
    });

    // P0: Test dismissToast removes specific toast
    it('dismissToast removes toast by id', () => {
      // Add multiple toasts
      toasts.set([
        { id: 'toast-1', message: 'First' },
        { id: 'toast-2', message: 'Second' },
        { id: 'toast-3', message: 'Third' },
      ]);

      dismissToast('toast-2');

      const currentToasts = get(toasts);
      expect(currentToasts).toHaveLength(2);
      expect(currentToasts.find((t) => t.id === 'toast-2')).toBeUndefined();
      expect(currentToasts.find((t) => t.id === 'toast-1')).toBeDefined();
      expect(currentToasts.find((t) => t.id === 'toast-3')).toBeDefined();
    });

    // P1: Test clearToasts removes all toasts
    it('clearToasts removes all toasts', () => {
      toasts.set([
        { id: 'toast-1', message: 'First' },
        { id: 'toast-2', message: 'Second' },
      ]);

      clearToasts();

      expect(get(toasts)).toEqual([]);
    });

    // P1: Test multiple toasts can coexist
    it('supports multiple concurrent toasts', () => {
      showToast('First');
      showToast('Second');
      showToast('Third');

      expect(get(toasts)).toHaveLength(3);
    });

    // P1: Test dismissToast with non-existent id does nothing
    it('dismissToast with non-existent id does not affect other toasts', () => {
      toasts.set([{ id: 'existing', message: 'Existing toast' }]);

      dismissToast('non-existent');

      expect(get(toasts)).toHaveLength(1);
      expect(get(toasts)[0].id).toBe('existing');
    });
  });

  describe('lastExecutedCommand', () => {
    // P1: Test initialization
    it('initializes to null', () => {
      clearLastExecutedCommand();
      expect(get(lastExecutedCommand)).toBeNull();
    });

    // P1: Test setLastExecutedCommand
    it('setLastExecutedCommand sets the command', () => {
      setLastExecutedCommand('/create-prd');
      expect(get(lastExecutedCommand)).toBe('/create-prd');
    });

    // P1: Test clearLastExecutedCommand
    it('clearLastExecutedCommand resets to null', () => {
      setLastExecutedCommand('/test-command');
      clearLastExecutedCommand();
      expect(get(lastExecutedCommand)).toBeNull();
    });

    // P1: Test overwriting command
    it('setLastExecutedCommand overwrites previous command', () => {
      setLastExecutedCommand('/first-command');
      setLastExecutedCommand('/second-command');
      expect(get(lastExecutedCommand)).toBe('/second-command');
    });
  });

  describe('activeView', () => {
    beforeEach(() => {
      // Reset to default
      activeView.set('dashboards');
    });

    // P0: Test default value is 'dashboards' (AC #7)
    it('initializes to dashboards by default', () => {
      expect(get(activeView)).toBe('dashboards');
    });

    // P0: Test MainView includes 'dashboards' (AC #1)
    it('supports dashboards as a valid MainView', () => {
      const views: MainView[] = ['dashboards', 'workflows', 'stories', 'artifacts'];
      views.forEach((view) => {
        setActiveView(view);
        expect(get(activeView)).toBe(view);
      });
    });

    // P0: Test setActiveView with dashboards
    it('setActiveView sets dashboards view', () => {
      setActiveView('workflows');
      setActiveView('dashboards');
      expect(get(activeView)).toBe('dashboards');
    });

    // P0: Test setActiveView with all views
    it('setActiveView works with all view types', () => {
      setActiveView('workflows');
      expect(get(activeView)).toBe('workflows');

      setActiveView('stories');
      expect(get(activeView)).toBe('stories');

      setActiveView('artifacts');
      expect(get(activeView)).toBe('artifacts');

      setActiveView('dashboards');
      expect(get(activeView)).toBe('dashboards');
    });
  });
});
