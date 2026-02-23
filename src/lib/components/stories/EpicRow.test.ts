/**
 * Unit tests for EpicRow component.
 * Tests rendering, collapse/expand, completion indicator, and epic title display.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EpicRow from './EpicRow.svelte';
import type { Epic, Story } from '$lib/types/stories';
import { epicTitles } from '$lib/stores/stories';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('EpicRow', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    // Reset epicTitles store to empty state
    epicTitles.set(new Map());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createEpic = (overrides: Partial<Epic> = {}): Epic => ({
    id: '3',
    status: 'in-progress',
    ...overrides,
  });

  const createStory = (overrides: Partial<Story> = {}): Story => ({
    id: '3-1-parser',
    epicId: '3',
    storyNumber: 1,
    slug: 'parser',
    status: 'done',
    ...overrides,
  });

  describe('rendering', () => {
    it('displays epic title', () => {
      const epic = createEpic({ id: '3' });
      const stories = [createStory()];
      render(EpicRow, { props: { epic, stories } });

      expect(screen.getByText('Epic 3')).toBeInTheDocument();
    });

    it('displays story count', () => {
      const epic = createEpic();
      const stories = [
        createStory({ id: '3-1-a', storyNumber: 1 }),
        createStory({ id: '3-2-b', storyNumber: 2 }),
      ];
      render(EpicRow, { props: { epic, stories } });

      expect(screen.getByText('2 stories')).toBeInTheDocument();
    });

    it('displays singular "story" for single story', () => {
      const epic = createEpic();
      const stories = [createStory()];
      render(EpicRow, { props: { epic, stories } });

      expect(screen.getByText('1 story')).toBeInTheDocument();
    });

    it('shows completion indicator when all stories are done', () => {
      const epic = createEpic();
      const stories = [
        createStory({ id: '3-1-a', status: 'done' }),
        createStory({ id: '3-2-b', status: 'done' }),
      ];
      const { container } = render(EpicRow, { props: { epic, stories } });

      // Check for the checkmark
      const checkmark = container.querySelector('[title="All stories completed"]');
      expect(checkmark).toBeInTheDocument();
    });

    it('does not show completion indicator when not all stories are done', () => {
      const epic = createEpic();
      const stories = [
        createStory({ id: '3-1-a', status: 'done' }),
        createStory({ id: '3-2-b', status: 'in-progress' }),
      ];
      const { container } = render(EpicRow, { props: { epic, stories } });

      const checkmark = container.querySelector('[title="All stories completed"]');
      expect(checkmark).not.toBeInTheDocument();
    });
  });

  describe('collapse/expand', () => {
    it('starts expanded by default', () => {
      const epic = createEpic();
      const stories = [createStory()];
      const { container } = render(EpicRow, { props: { epic, stories } });

      // Check for story cards (they should be visible)
      const storyCards = container.querySelectorAll('button[aria-label*="Story"]');
      expect(storyCards.length).toBeGreaterThan(0);
    });

    it('collapses when header is clicked', async () => {
      const epic = createEpic();
      const stories = [createStory()];
      render(EpicRow, { props: { epic, stories } });

      const headerButton = screen.getByRole('button', { name: /Epic 3/ });
      await fireEvent.click(headerButton);

      // After collapse, aria-expanded should be false
      expect(headerButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('expands when collapsed header is clicked', async () => {
      const epic = createEpic();
      const stories = [createStory()];
      render(EpicRow, { props: { epic, stories } });

      const headerButton = screen.getByRole('button', { name: /Epic 3/ });

      // Collapse
      await fireEvent.click(headerButton);
      expect(headerButton.getAttribute('aria-expanded')).toBe('false');

      // Expand
      await fireEvent.click(headerButton);
      expect(headerButton.getAttribute('aria-expanded')).toBe('true');
    });

    it('saves collapse state to localStorage', async () => {
      const epic = createEpic({ id: '5' });
      const stories = [createStory()];
      render(EpicRow, { props: { epic, stories } });

      const headerButton = screen.getByRole('button', { name: /Epic 5/ });
      await fireEvent.click(headerButton);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('epic-5-collapsed', 'true');
    });
  });

  describe('accessibility', () => {
    it('has aria-expanded attribute on header button', () => {
      const epic = createEpic();
      const stories = [createStory()];
      render(EpicRow, { props: { epic, stories } });

      const headerButton = screen.getByRole('button', { name: /Epic 3/ });
      expect(headerButton.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('epic title display', () => {
    it('displays only epic number when no title is available', () => {
      const epic = createEpic({ id: '1' });
      const stories = [createStory()];
      // epicTitles is empty (no titles loaded)
      render(EpicRow, { props: { epic, stories } });

      expect(screen.getByText('Epic 1')).toBeInTheDocument();
      // Should not have colon since no title
      expect(screen.queryByText('Epic 1:')).not.toBeInTheDocument();
    });

    it('displays "Epic N: Title" format when title is available', () => {
      const epic = createEpic({ id: '1' });
      const stories = [createStory()];
      // Set epic title in store
      epicTitles.set(new Map([['1', 'Foundation']]));
      render(EpicRow, { props: { epic, stories } });

      expect(screen.getByText('Epic 1:')).toBeInTheDocument();
      expect(screen.getByText('Foundation')).toBeInTheDocument();
    });

    it('displays decimal epic ID with title correctly', () => {
      const epic = createEpic({ id: '2.5' });
      const stories = [createStory({ epicId: '2.5' })];
      epicTitles.set(new Map([['2.5', 'Prep Sprint']]));
      render(EpicRow, { props: { epic, stories } });

      expect(screen.getByText('Epic 2.5:')).toBeInTheDocument();
      expect(screen.getByText('Prep Sprint')).toBeInTheDocument();
    });

    it('renders title in muted gray color', () => {
      const epic = createEpic({ id: '3' });
      const stories = [createStory()];
      epicTitles.set(new Map([['3', 'Stories & Worktrees']]));
      render(EpicRow, { props: { epic, stories } });

      const titleElement = screen.getByText('Stories & Worktrees');
      expect(titleElement).toHaveClass('text-gray-400');
    });

    it('does not display title span when no title available', () => {
      const epic = createEpic({ id: '4' });
      const stories = [createStory()];
      // No title for epic 4
      epicTitles.set(new Map([['1', 'Foundation']])); // Only other epics have titles
      render(EpicRow, { props: { epic, stories } });

      // Should only have the "Epic 4" text (no colon), not "Epic 4:" with a title
      expect(screen.getByText('Epic 4')).toBeInTheDocument();
      expect(screen.queryByText('Epic 4:')).not.toBeInTheDocument();
      // No title text should be present
      expect(screen.queryByText('Foundation')).not.toBeInTheDocument();
    });
  });
});
