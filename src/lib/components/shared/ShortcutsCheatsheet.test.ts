/**
 * Tests for ShortcutsCheatsheet component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ShortcutsCheatsheet from './ShortcutsCheatsheet.svelte';

// Mock navigator.platform for consistent test output
const mockNavigatorPlatform = (platform: string) => {
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true,
  });
};

describe('ShortcutsCheatsheet', () => {
  const originalPlatform = navigator.platform;
  let onClose: () => void;

  beforeEach(() => {
    mockNavigatorPlatform('MacIntel');
    onClose = vi.fn();
  });

  afterEach(() => {
    mockNavigatorPlatform(originalPlatform);
    vi.clearAllMocks();
  });

  it('renders the title', () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
  });

  it('displays all shortcut categories', () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    // CSS uppercase class doesn't change text content
    expect(screen.getByText('Navigation')).toBeTruthy();
    expect(screen.getByText('Sessions')).toBeTruthy();
    expect(screen.getByText('General')).toBeTruthy();
  });

  it('displays shortcut descriptions', () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    expect(screen.getByText('Open command palette')).toBeTruthy();
    expect(screen.getByText('Switch to Workflows view')).toBeTruthy();
    expect(screen.getByText('New conversation')).toBeTruthy();
    expect(screen.getByText('Open settings')).toBeTruthy();
  });

  it('displays Mac-formatted shortcuts on Mac', () => {
    mockNavigatorPlatform('MacIntel');
    render(ShortcutsCheatsheet, { props: { onClose } });
    // Should display ⌘K, not Ctrl+K
    expect(screen.getByText('⌘K')).toBeTruthy();
  });

  it('displays Windows-formatted shortcuts on Windows', () => {
    mockNavigatorPlatform('Win32');
    render(ShortcutsCheatsheet, { props: { onClose } });
    // Should display Ctrl+K, not ⌘K
    expect(screen.getByText('Ctrl+K')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', async () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    const closeButton = screen.getByLabelText('Close');
    await fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    const backdrop = screen.getByLabelText('Close shortcuts cheatsheet');
    await fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has proper dialog role and accessibility attributes', () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('shortcuts-title');
  });

  it('displays footer with escape hint', () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    // Check for parts of the footer text
    const footer = screen.getByText(/Press.*to close/);
    expect(footer).toBeTruthy();
  });

  it('traps focus on Tab key press', async () => {
    render(ShortcutsCheatsheet, { props: { onClose } });
    const closeButton = screen.getByLabelText('Close');

    // Press Tab - should focus the close button
    await fireEvent.keyDown(window, { key: 'Tab' });

    // Focus should be trapped to close button
    expect(document.activeElement).toBe(closeButton);
  });
});
