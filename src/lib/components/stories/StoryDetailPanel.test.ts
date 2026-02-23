/**
 * Unit tests for StoryDetailPanel component.
 * Tests rendering, close functionality, worktree features, and accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StoryDetailPanel from './StoryDetailPanel.svelte';
import { worktrees, worktreeCreating, resetWorktrees, setWorktreeCreating } from '$lib/stores/worktrees';
import type { Story, Epic } from '$lib/types/stories';

// Mock the worktrees service
vi.mock('$lib/services/worktrees', () => ({
  worktreeApi: {
    createWorktree: vi.fn(),
    listWorktrees: vi.fn(),
  },
  parseWorktreeError: vi.fn((error: unknown) => 'Failed to create worktree'),
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

describe('StoryDetailPanel', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseMock = vi.fn();
    resetWorktrees();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorktrees();
  });

  const createStory = (overrides: Partial<Story> = {}): Story => ({
    id: '3-2-story-board-ui-kanban',
    epicId: '3',
    storyNumber: 2,
    slug: 'story-board-ui-kanban',
    status: 'review',
    ...overrides,
  });

  const createEpic = (overrides: Partial<Epic> = {}): Epic => ({
    id: '3',
    status: 'in-progress',
    ...overrides,
  });

  describe('rendering', () => {
    it('displays story ID in header', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('Story 3-2')).toBeInTheDocument();
    });

    it('displays sub-story ID correctly', () => {
      const story = createStory({
        id: '1-5-2-terminate-lock',
        epicId: '1',
        storyNumber: 5,
        subStoryNumber: 2,
        slug: 'terminate-lock',
      });
      render(StoryDetailPanel, { props: { story, epic: createEpic({ id: '1' }), onClose: onCloseMock } });

      expect(screen.getByText('Story 1-5-2')).toBeInTheDocument();
    });

    it('displays story title from slug', () => {
      const story = createStory({ slug: 'my-awesome-feature' });
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('My Awesome Feature')).toBeInTheDocument();
    });

    it('displays story status with label', () => {
      const story = createStory({ status: 'review' });
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('displays epic info', () => {
      const story = createStory({ epicId: '3' });
      const epic = createEpic({ id: '3', status: 'in-progress' });
      render(StoryDetailPanel, { props: { story, epic, onClose: onCloseMock } });

      expect(screen.getByText('Epic 3')).toBeInTheDocument();
      expect(screen.getByText('(In Progress)')).toBeInTheDocument();
    });

    it('displays full story ID', () => {
      const story = createStory({ id: '3-2-story-board-ui-kanban' });
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('3-2-story-board-ui-kanban')).toBeInTheDocument();
    });

    it('displays worktree section when no worktree exists', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('Worktree')).toBeInTheDocument();
      expect(screen.getByText('No worktree')).toBeInTheDocument();
      // EmptyState component now handles the description
      expect(screen.getByText(/Worktrees let you work on this story in an isolated branch/)).toBeInTheDocument();
      expect(screen.getByText('Create Worktree')).toBeInTheDocument();
    });

    it('handles null epic gracefully', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: null, onClose: onCloseMock } });

      expect(screen.getByText('Epic 3')).toBeInTheDocument();
      expect(screen.queryByText('(In Progress)')).not.toBeInTheDocument();
    });
  });

  describe('close functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      const closeButton = screen.getByLabelText('Close detail panel');
      await fireEvent.click(closeButton);

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', async () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      await fireEvent.keyDown(window, { key: 'Escape' });

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const story = createStory();
      const { container } = render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      // The backdrop is the outer div with bg-black/50
      const backdrop = container.querySelector('.bg-black\\/50');
      if (backdrop) {
        await fireEvent.click(backdrop);
      }

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when panel content is clicked', async () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      // Click on the title inside the panel
      const title = screen.getByText('Story 3-2');
      await fireEvent.click(title);

      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has dialog role', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('has aria-labelledby pointing to title', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      const dialog = screen.getByRole('dialog');
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(titleId).toBe('story-detail-title');

      const title = document.getElementById(titleId!);
      expect(title).toBeInTheDocument();
    });

    it('close button has accessible label', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByLabelText('Close detail panel')).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    it.each([
      ['backlog', 'Backlog'],
      ['ready-for-dev', 'Ready'],
      ['in-progress', 'In Progress'],
      ['review', 'Review'],
      ['done', 'Done'],
    ] as const)('displays correct label for %s status', (status, expectedLabel) => {
      const story = createStory({ status });
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });
  });

  describe('epic status display', () => {
    it.each([
      ['backlog', 'Backlog'],
      ['in-progress', 'In Progress'],
      ['done', 'Done'],
    ] as const)('displays correct epic status for %s', (status, expectedLabel) => {
      const story = createStory();
      const epic = createEpic({ status });
      render(StoryDetailPanel, { props: { story, epic, onClose: onCloseMock } });

      expect(screen.getByText(`(${expectedLabel})`)).toBeInTheDocument();
    });
  });

  describe('worktree features', () => {
    it('displays worktree path when worktree exists', () => {
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
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('/test/project-wt-3-3')).toBeInTheDocument();
    });

    it('displays worktree branch when worktree exists', () => {
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
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('story/3-3-worktree-test')).toBeInTheDocument();
    });

    it('shows Open in New Window button when worktree exists', () => {
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
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('Open in New Window')).toBeInTheDocument();
    });

    it('shows Clean Up Worktree button when worktree exists', () => {
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
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('Clean Up Worktree')).toBeInTheDocument();
    });

    it('shows loading spinner during worktree creation', () => {
      const story = createStory({ id: '3-3-creating' });
      setWorktreeCreating('3-3-creating', true);
      const { container } = render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      // Check for the spinner animation class
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('shows "Creating worktree..." message during creation', () => {
      const story = createStory({ id: '3-3-creating' });
      setWorktreeCreating('3-3-creating', true);
      render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      expect(screen.getByText('Creating worktree...')).toBeInTheDocument();
    });
  });
});
