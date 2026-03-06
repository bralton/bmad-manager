/**
 * Unit tests for BugCard component.
 * Tests rendering, styling, accessibility, and selection behavior.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import BugCard from './BugCard.svelte';
import type { Bug } from '$lib/types/stories';

// Mock the stores module
vi.mock('$lib/stores/stories', () => ({
  setSelectedBugId: vi.fn(),
  selectedBugId: {
    subscribe: vi.fn(),
  },
}));

import { setSelectedBugId, selectedBugId } from '$lib/stores/stories';

describe('BugCard', () => {
  const createBug = (overrides: Partial<Bug> = {}): Bug => ({
    id: 'bug-1-terminal-crash',
    bugNumber: 1,
    slug: 'terminal-crash',
    status: 'backlog',
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    // Default: no bug selected
    (selectedBugId.subscribe as Mock).mockImplementation((callback: (value: string | null) => void) => {
      callback(null);
      return vi.fn();
    });
  });

  describe('rendering', () => {
    it('renders bug number with BUG prefix', () => {
      const bug = createBug({ bugNumber: 42 });
      render(BugCard, { props: { bug } });

      expect(screen.getByText('BUG-42')).toBeInTheDocument();
    });

    it('renders title from slug', () => {
      const bug = createBug({ slug: 'session-freeze-on-resize' });
      render(BugCard, { props: { bug } });

      expect(screen.getByText('Session Freeze On Resize')).toBeInTheDocument();
    });

    it('capitalizes each word in title', () => {
      const bug = createBug({ slug: 'multi-word-bug-title' });
      render(BugCard, { props: { bug } });

      expect(screen.getByText('Multi Word Bug Title')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has red border for visual distinction', () => {
      const bug = createBug();
      const { container } = render(BugCard, { props: { bug } });

      const button = container.querySelector('button');
      expect(button?.className).toContain('border-red-500');
    });

    it('has red-tinted background', () => {
      const bug = createBug();
      const { container } = render(BugCard, { props: { bug } });

      const button = container.querySelector('button');
      expect(button?.className).toContain('bg-red-900/10');
    });

    it('shows bug icon', () => {
      const bug = createBug();
      const { container } = render(BugCard, { props: { bug } });

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has descriptive aria-label', () => {
      const bug = createBug({ bugNumber: 5, slug: 'crash-on-startup', status: 'in-progress' });
      render(BugCard, { props: { bug } });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Bug 5: Crash On Startup, status: In Progress');
    });

    it('is focusable via keyboard', () => {
      const bug = createBug();
      render(BugCard, { props: { bug } });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabindex', '0');
    });
  });

  describe('status variations', () => {
    it.each([
      ['backlog', 'Backlog'],
      ['ready-for-dev', 'Ready'],
      ['in-progress', 'In Progress'],
      ['review', 'Review'],
      ['done', 'Done'],
    ])('handles %s status in aria-label', (status, label) => {
      const bug = createBug({ status: status as Bug['status'] });
      render(BugCard, { props: { bug } });

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toContain(`status: ${label}`);
    });
  });

  describe('selection behavior', () => {
    it('calls setSelectedBugId when clicked', async () => {
      const bug = createBug({ id: 'bug-5-test-bug' });
      render(BugCard, { props: { bug } });

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(setSelectedBugId).toHaveBeenCalledWith('bug-5-test-bug');
    });

    it('shows selection ring when selected', () => {
      const bug = createBug({ id: 'bug-3-selected-bug' });

      // Mock the bug as selected
      (selectedBugId.subscribe as Mock).mockImplementation((callback: (value: string | null) => void) => {
        callback('bug-3-selected-bug');
        return vi.fn();
      });

      const { container } = render(BugCard, { props: { bug } });

      const button = container.querySelector('button');
      expect(button?.className).toContain('ring-2');
      expect(button?.className).toContain('ring-red-500');
    });

    it('does not show selection ring when not selected', () => {
      const bug = createBug({ id: 'bug-3-not-selected' });

      // Mock a different bug as selected
      (selectedBugId.subscribe as Mock).mockImplementation((callback: (value: string | null) => void) => {
        callback('bug-99-other');
        return vi.fn();
      });

      const { container } = render(BugCard, { props: { bug } });

      const button = container.querySelector('button');
      // Should not have the selection ring classes (except in focus state)
      expect(button?.className).not.toContain('ring-offset-2 ring-offset-gray-900');
    });
  });
});
