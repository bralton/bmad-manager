/**
 * Integration tests for Toast component.
 * Tests rendering and interaction of toast notifications using the toasts store.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Toast from './Toast.svelte';
import { toasts, clearToasts } from '$lib/stores/ui';

describe('Toast', () => {
  beforeEach(() => {
    // Clear any existing toasts before each test
    clearToasts();
  });

  afterEach(() => {
    // Clean up after each test
    clearToasts();
  });

  it('renders without crashing when no toasts exist', () => {
    render(Toast);
    // Should render the container even with no toasts
    const container = document.querySelector('.fixed.bottom-4.right-4');
    expect(container).toBeInTheDocument();
  });

  it('renders a toast message when added to store', async () => {
    render(Toast);

    // Add a toast to the store
    toasts.set([
      {
        id: 'test-toast-1',
        message: 'Test notification message',
        icon: '✓',
      },
    ]);

    // Wait for Svelte to update and element to appear
    await waitFor(() => {
      expect(screen.getByText('Test notification message')).toBeInTheDocument();
    });
  });

  it('renders toast icon when provided', async () => {
    render(Toast);

    toasts.set([
      {
        id: 'test-toast-2',
        message: 'Success!',
        icon: '✓',
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('✓')).toBeInTheDocument();
    });
  });

  it('renders multiple toasts', async () => {
    render(Toast);

    toasts.set([
      { id: 'toast-1', message: 'First toast', icon: '1' },
      { id: 'toast-2', message: 'Second toast', icon: '2' },
      { id: 'toast-3', message: 'Third toast', icon: '3' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('First toast')).toBeInTheDocument();
      expect(screen.getByText('Second toast')).toBeInTheDocument();
      expect(screen.getByText('Third toast')).toBeInTheDocument();
    });
  });

  it('has correct accessibility attributes', async () => {
    render(Toast);

    toasts.set([
      { id: 'accessible-toast', message: 'Accessible message' },
    ]);

    await waitFor(() => {
      const alertElement = screen.getByRole('alert');
      expect(alertElement).toBeInTheDocument();
      expect(alertElement).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('renders dismiss button for each toast', async () => {
    render(Toast);

    toasts.set([
      { id: 'dismissible-toast', message: 'Can be dismissed' },
    ]);

    await waitFor(() => {
      const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismissButton).toBeInTheDocument();
    });
  });

  it('dismisses toast when dismiss button is clicked', async () => {
    render(Toast);

    toasts.set([
      { id: 'dismissible-toast', message: 'Click to dismiss me' },
    ]);

    // Wait for toast to appear
    await waitFor(() => {
      expect(screen.getByText('Click to dismiss me')).toBeInTheDocument();
    });

    // Click the dismiss button
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    await fireEvent.click(dismissButton);

    // Wait for toast to be removed from DOM
    await waitFor(() => {
      expect(screen.queryByText('Click to dismiss me')).not.toBeInTheDocument();
    });
  });

  // P2: Test z-index and positioning classes
  it('has correct positioning classes for bottom-right corner', () => {
    render(Toast);

    // The container should have fixed positioning at bottom-right with high z-index
    const container = document.querySelector('.fixed.bottom-4.right-4');
    expect(container).toBeInTheDocument();
    // z-[60] is a Tailwind arbitrary value for z-index: 60
    expect(container).toHaveClass('z-[60]');
  });

  // P2: Test toast stacking with flex layout
  it('stacks toasts using flex column layout', async () => {
    render(Toast);

    toasts.set([
      { id: 'toast-1', message: 'First toast' },
      { id: 'toast-2', message: 'Second toast' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('First toast')).toBeInTheDocument();
      expect(screen.getByText('Second toast')).toBeInTheDocument();
    });

    // Check the container uses flex with column layout and gap
    const container = document.querySelector('.fixed.bottom-4.right-4');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('flex-col');
    expect(container).toHaveClass('gap-2');
  });
});
