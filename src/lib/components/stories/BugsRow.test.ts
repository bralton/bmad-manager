/**
 * Unit tests for BugsRow component.
 * Tests rendering, collapse state, and bug grouping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BugsRow from './BugsRow.svelte';
import type { Bug } from '$lib/types/stories';

describe('BugsRow', () => {
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createBug = (overrides: Partial<Bug> = {}): Bug => ({
    id: 'bug-1-test',
    bugNumber: 1,
    slug: 'test',
    status: 'backlog',
    ...overrides,
  });

  describe('rendering', () => {
    it('renders Bugs header', () => {
      const bugs = [createBug()];
      render(BugsRow, { props: { bugs } });

      expect(screen.getByText('Bugs')).toBeInTheDocument();
    });

    it('shows bug count in header', () => {
      const bugs = [
        createBug({ bugNumber: 1 }),
        createBug({ bugNumber: 2, id: 'bug-2-other' }),
        createBug({ bugNumber: 3, id: 'bug-3-third' }),
      ];
      render(BugsRow, { props: { bugs } });

      expect(screen.getByText('3 bugs')).toBeInTheDocument();
    });

    it('shows singular "bug" for single bug', () => {
      const bugs = [createBug()];
      render(BugsRow, { props: { bugs } });

      expect(screen.getByText('1 bug')).toBeInTheDocument();
    });

    it('renders bug cards', () => {
      const bugs = [
        createBug({ bugNumber: 1, slug: 'first-bug' }),
        createBug({ bugNumber: 2, id: 'bug-2-second', slug: 'second-bug' }),
      ];
      render(BugsRow, { props: { bugs } });

      expect(screen.getByText('BUG-1')).toBeInTheDocument();
      expect(screen.getByText('BUG-2')).toBeInTheDocument();
    });

    it('shows checkmark when all bugs are done', () => {
      const bugs = [
        createBug({ bugNumber: 1, status: 'done' }),
        createBug({ bugNumber: 2, id: 'bug-2-done', status: 'done' }),
      ];
      const { container } = render(BugsRow, { props: { bugs } });

      // Look for checkmark character ✓
      expect(container.textContent).toContain('✓');
    });

    it('does not show checkmark when bugs are not all done', () => {
      const bugs = [
        createBug({ bugNumber: 1, status: 'done' }),
        createBug({ bugNumber: 2, id: 'bug-2-pending', status: 'in-progress' }),
      ];
      const { container } = render(BugsRow, { props: { bugs } });

      // Find spans with checkmark (not the BugCard ones)
      const headerButton = container.querySelector('button');
      expect(headerButton?.textContent).not.toContain('✓');
    });
  });

  describe('collapse state', () => {
    it('is expanded by default', () => {
      const bugs = [createBug({ slug: 'visible-bug' })];
      render(BugsRow, { props: { bugs } });

      expect(screen.getByText('BUG-1')).toBeInTheDocument();
    });

    it('hides bug cards when collapsed', async () => {
      const bugs = [createBug({ slug: 'hidden-bug' })];
      render(BugsRow, { props: { bugs } });

      // Click to collapse
      const collapseButton = screen.getByRole('button', { name: /Bugs/i });
      await fireEvent.click(collapseButton);

      expect(screen.queryByText('BUG-1')).not.toBeInTheDocument();
    });

    it('toggles collapse state on click', async () => {
      const bugs = [createBug()];
      render(BugsRow, { props: { bugs } });

      const collapseButton = screen.getByRole('button', { name: /Bugs/i });

      // Initially expanded
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true');

      // Collapse
      await fireEvent.click(collapseButton);
      expect(collapseButton).toHaveAttribute('aria-expanded', 'false');

      // Expand again
      await fireEvent.click(collapseButton);
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('persists collapse state to localStorage', async () => {
      const bugs = [createBug()];
      render(BugsRow, { props: { bugs } });

      const collapseButton = screen.getByRole('button', { name: /Bugs/i });
      await fireEvent.click(collapseButton);

      expect(localStorage.setItem).toHaveBeenCalledWith('bugs-row-collapsed', 'true');
    });

    it('loads collapse state from localStorage', async () => {
      localStorageMock['bugs-row-collapsed'] = 'true';

      const bugs = [createBug()];
      render(BugsRow, { props: { bugs } });

      // Allow effect to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should be collapsed based on localStorage
      expect(screen.queryByText('BUG-1')).not.toBeInTheDocument();
    });
  });

  describe('bug grouping by status', () => {
    it('groups bugs into kanban columns', () => {
      const bugs = [
        createBug({ id: 'bug-1-backlog', bugNumber: 1, status: 'backlog' }),
        createBug({ id: 'bug-2-progress', bugNumber: 2, status: 'in-progress' }),
        createBug({ id: 'bug-3-done', bugNumber: 3, status: 'done' }),
      ];
      render(BugsRow, { props: { bugs } });

      // All bugs should be rendered
      expect(screen.getByText('BUG-1')).toBeInTheDocument();
      expect(screen.getByText('BUG-2')).toBeInTheDocument();
      expect(screen.getByText('BUG-3')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper aria-expanded attribute', () => {
      const bugs = [createBug()];
      render(BugsRow, { props: { bugs } });

      const button = screen.getByRole('button', { name: /Bugs/i });
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('has descriptive aria-label', () => {
      const bugs = [createBug()];
      render(BugsRow, { props: { bugs } });

      const button = screen.getByRole('button', { name: /Bugs, expand|Bugs, collapse/i });
      expect(button).toBeInTheDocument();
    });
  });
});
