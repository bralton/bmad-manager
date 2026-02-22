/**
 * Unit tests for StoryCard component.
 * Tests rendering, click handling, worktree features, and accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import StoryCard from './StoryCard.svelte';
import { selectedStoryId, resetSprintStatus } from '$lib/stores/stories';
import { worktrees, worktreeCreating, resetWorktrees, setWorktreeCreating } from '$lib/stores/worktrees';
import type { Story } from '$lib/types/stories';
import type { Worktree } from '$lib/types/worktree';

// Mock the worktrees service
vi.mock('$lib/services/worktrees', () => ({
  worktreeApi: {
    createWorktree: vi.fn(),
    listWorktrees: vi.fn(),
  },
  parseWorktreeError: vi.fn((error: unknown) => {
    if (typeof error === 'string' && error.includes('BranchInUse')) {
      return 'Branch in use by another worktree';
    }
    return 'Failed to create worktree';
  }),
}));

// Mock the project store
vi.mock('$lib/stores/project', () => ({
  currentProject: {
    subscribe: vi.fn((fn) => {
      fn({ path: '/test/project', state: 'fully-initialized' });
      return () => {};
    }),
  },
}));

// Mock the UI store
vi.mock('$lib/stores/ui', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

import { worktreeApi } from '$lib/services/worktrees';
import { showSuccessToast, showErrorToast } from '$lib/stores/ui';

describe('StoryCard', () => {
  beforeEach(() => {
    resetSprintStatus();
    resetWorktrees();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetSprintStatus();
    resetWorktrees();
  });

  const createStory = (overrides: Partial<Story> = {}): Story => ({
    id: '3-2-story-board-ui-kanban',
    epicId: '3',
    storyNumber: 2,
    subStoryNumber: undefined, // Rust serializes Option::None as null
    slug: 'story-board-ui-kanban',
    status: 'ready-for-dev',
    ...overrides,
  });

  describe('rendering', () => {
    it('displays story ID in monospace format', () => {
      const story = createStory();
      render(StoryCard, { props: { story } });

      expect(screen.getByText('3-2')).toBeInTheDocument();
    });

    it('displays story title from slug (title case)', () => {
      const story = createStory({ slug: 'my-awesome-feature' });
      render(StoryCard, { props: { story } });

      expect(screen.getByText('My Awesome Feature')).toBeInTheDocument();
    });

    it('displays sub-story ID correctly', () => {
      const story = createStory({
        id: '1-5-2-terminate-lock',
        epicId: '1',
        storyNumber: 5,
        subStoryNumber: 2,
        slug: 'terminate-lock',
      });
      render(StoryCard, { props: { story } });

      expect(screen.getByText('1-5-2')).toBeInTheDocument();
    });

    it('applies correct status border color for ready-for-dev', () => {
      const story = createStory({ status: 'ready-for-dev' });
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button?.classList.contains('border-yellow-500')).toBe(true);
    });

    it('applies correct status border color for done', () => {
      const story = createStory({ status: 'done' });
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button?.classList.contains('border-green-500')).toBe(true);
    });

    it('applies correct status border color for in-progress', () => {
      const story = createStory({ status: 'in-progress' });
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button?.classList.contains('border-blue-500')).toBe(true);
    });
  });

  describe('interaction', () => {
    it('sets selectedStoryId when clicked', async () => {
      const story = createStory();
      const { container } = render(StoryCard, { props: { story } });

      // Get the main button (not the inner worktree action)
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      await fireEvent.click(button!);

      expect(get(selectedStoryId)).toBe('3-2-story-board-ui-kanban');
    });

    // Note: Enter/Space keyboard activation is handled natively by <button> elements.
    // jsdom doesn't fully simulate native button keyboard behavior, so we test with click
    // which covers the actual interaction. The button's native keyboard handling is
    // browser-guaranteed behavior for accessible elements.
  });

  describe('accessibility', () => {
    it('has correct aria-label', () => {
      const story = createStory({ status: 'ready-for-dev' });
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button!.getAttribute('aria-label')).toBe(
        'Story 3-2: Story Board Ui Kanban, status: Ready'
      );
    });

    it('is focusable with tabindex', () => {
      const story = createStory();
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button!.getAttribute('tabindex')).toBe('0');
    });

    it('includes worktree status in aria-label when worktree exists', () => {
      const story = createStory({ id: '3-3-test' });
      worktrees.set([
        {
          path: '/test/project-wt-3-3',
          branch: 'story/3-3-test',
          head: 'abc123',
          storyId: '3-3-test',
          locked: false,
          isMain: false,
        },
      ]);
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button?.getAttribute('aria-label')).toContain('has worktree');
    });
  });

  describe('worktree features', () => {
    it('displays WT badge when worktree exists for story', () => {
      const story = createStory({ id: '3-3-worktree-test' });
      worktrees.set([
        {
          path: '/test/project-wt-3-3',
          branch: 'story/3-3-worktree-test',
          head: 'abc123',
          storyId: '3-3-worktree-test',
          locked: false,
          isMain: false,
        },
      ]);
      render(StoryCard, { props: { story } });

      expect(screen.getByText('WT')).toBeInTheDocument();
    });

    it('shows worktree path in badge tooltip', () => {
      const story = createStory({ id: '3-3-worktree-test' });
      worktrees.set([
        {
          path: '/test/project-wt-3-3',
          branch: 'story/3-3-worktree-test',
          head: 'abc123',
          storyId: '3-3-worktree-test',
          locked: false,
          isMain: false,
        },
      ]);
      const { container } = render(StoryCard, { props: { story } });

      const badge = screen.getByText('WT');
      expect(badge.getAttribute('title')).toContain('/test/project-wt-3-3');
    });

    it('shows "+ WT" hover action when no worktree exists', () => {
      const story = createStory();
      render(StoryCard, { props: { story } });

      expect(screen.getByText('+ WT')).toBeInTheDocument();
    });

    it('shows loading spinner during worktree creation', () => {
      const story = createStory({ id: '3-3-creating' });
      setWorktreeCreating('3-3-creating', true);
      const { container } = render(StoryCard, { props: { story } });

      // Check for the spinner animation class
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('shows "Creating worktree..." message during creation', () => {
      const story = createStory({ id: '3-3-creating' });
      setWorktreeCreating('3-3-creating', true);
      render(StoryCard, { props: { story } });

      expect(screen.getByText('Creating worktree...')).toBeInTheDocument();
    });

    it('does not show WT badge when no worktree exists', () => {
      const story = createStory();
      render(StoryCard, { props: { story } });

      expect(screen.queryByText('WT')).not.toBeInTheDocument();
    });
  });
});
