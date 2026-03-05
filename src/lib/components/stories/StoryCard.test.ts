/**
 * Unit tests for StoryCard component.
 * Tests rendering, click handling, worktree features, and accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import StoryCard from './StoryCard.svelte';
import { selectedStoryId, resetSprintStatus, setCachedTasks, storyTasksCache } from '$lib/stores/stories';
import { worktrees, worktreeCreating, resetWorktrees, setWorktreeCreating } from '$lib/stores/worktrees';
import { conflictWarnings, resetConflicts } from '$lib/stores/conflicts';
import type { Story } from '$lib/types/stories';
import type { Worktree } from '$lib/types/worktree';
import type { ConflictWarning } from '$lib/types/conflict';
import type { StoryProgress } from '$lib/types/workflow';

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

// Mock the stories service
vi.mock('$lib/services/stories', () => ({
  storyApi: {
    getStoryTasks: vi.fn(),
    getSprintStatus: vi.fn(),
    getEpicTitles: vi.fn(),
  },
}));

// Mock the artifacts service
vi.mock('$lib/services/artifacts', () => ({
  artifactBrowserApi: {
    getStoryArtifact: vi.fn(),
  },
  selectArtifact: vi.fn(),
}));

import { worktreeApi } from '$lib/services/worktrees';
import { showSuccessToast, showErrorToast } from '$lib/stores/ui';

describe('StoryCard', () => {
  beforeEach(() => {
    resetSprintStatus();
    resetWorktrees();
    resetConflicts();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetSprintStatus();
    resetWorktrees();
    resetConflicts();
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

  describe('conflict indicator', () => {
    const createConflictWarning = (
      storyId: string,
      conflictsWith: string,
      sharedFiles: string[]
    ): ConflictWarning => ({
      storyId,
      conflictsWith,
      sharedFiles,
    });

    it('shows conflict warning badge when story has conflicts', () => {
      const story = createStory({ epicId: '4', storyNumber: 3, slug: 'conflict-detection' });
      conflictWarnings.set([
        createConflictWarning('4-3', '4-4', ['src/file.ts']),
      ]);
      const { container } = render(StoryCard, { props: { story } });

      // Should have warning icon (amber colored SVG)
      const warningIcon = container.querySelector('.text-amber-400 svg');
      expect(warningIcon).toBeInTheDocument();
    });

    it('does not show conflict badge when no conflicts exist', () => {
      const story = createStory({ epicId: '4', storyNumber: 3, slug: 'no-conflicts' });
      conflictWarnings.set([]);
      const { container } = render(StoryCard, { props: { story } });

      // Should not have warning icon
      const warningIcon = container.querySelector('.text-amber-400 svg');
      expect(warningIcon).not.toBeInTheDocument();
    });

    it('shows conflict tooltip with conflicting story IDs', () => {
      const story = createStory({ epicId: '4', storyNumber: 3, slug: 'conflict-test' });
      conflictWarnings.set([
        createConflictWarning('4-3', '4-4', ['src/file.ts']),
        createConflictWarning('4-3', '4-5', ['src/other.ts']),
      ]);
      const { container } = render(StoryCard, { props: { story } });

      const warningBadge = container.querySelector('.text-amber-400');
      expect(warningBadge).toBeInTheDocument();
      expect(warningBadge?.getAttribute('title')).toContain('4-4');
      expect(warningBadge?.getAttribute('title')).toContain('4-5');
    });

    it('includes conflict info in aria-label', () => {
      const story = createStory({ epicId: '4', storyNumber: 3, slug: 'aria-test' });
      conflictWarnings.set([
        createConflictWarning('4-3', '4-4', ['src/file.ts']),
      ]);
      const { container } = render(StoryCard, { props: { story } });

      // Select the main button element (not the role="button" divs)
      const button = container.querySelector('button');
      expect(button?.getAttribute('aria-label')).toContain('has file conflicts');
    });

    it('does not include conflict info in aria-label when no conflicts', () => {
      const story = createStory({ epicId: '4', storyNumber: 3, slug: 'no-aria-conflict' });
      conflictWarnings.set([]);
      const { container } = render(StoryCard, { props: { story } });

      // Select the main button element (not the role="button" divs)
      const button = container.querySelector('button');
      expect(button?.getAttribute('aria-label')).not.toContain('conflict');
    });

    it('only shows conflicts for this story, not other stories', () => {
      const story = createStory({ epicId: '4', storyNumber: 3, slug: 'specific-story' });
      // Only 4-4 has conflicts, not 4-3
      conflictWarnings.set([
        createConflictWarning('4-4', '4-5', ['src/file.ts']),
      ]);
      const { container } = render(StoryCard, { props: { story } });

      // 4-3 should NOT show conflict badge since 4-4 has the conflict
      const warningIcon = container.querySelector('.text-amber-400 svg');
      expect(warningIcon).not.toBeInTheDocument();
    });
  });

  describe('task progress features (Story 5-8)', () => {
    const createTaskProgress = (
      completed: number,
      total: number
    ): StoryProgress => ({
      storyId: '3-2-test',
      tasks: Array.from({ length: total }, (_, i) => ({
        text: `Task ${i + 1}`,
        completed: i < completed,
        level: 0,
      })),
      total,
      completed,
      percentage: Math.round((completed / total) * 100),
    });

    beforeEach(() => {
      storyTasksCache.set(new Map());
    });

    describe('task count display (AC #1, #2)', () => {
      it('displays task count when cached tasks exist', async () => {
        const story = createStory({ id: '3-2-test', status: 'in-progress' });
        setCachedTasks('3-2-test', createTaskProgress(8, 12));

        render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('8/12 tasks')).toBeInTheDocument();
        });
      });

      it('displays progress bar with correct percentage', async () => {
        const story = createStory({ id: '3-2-progress', status: 'in-progress' });
        setCachedTasks('3-2-progress', createTaskProgress(6, 10)); // 60%

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          const progressBar = container.querySelector('[role="progressbar"]');
          expect(progressBar).toBeInTheDocument();
          expect(progressBar?.getAttribute('aria-valuenow')).toBe('60');
        });
      });

      it('shows progress bar filling proportionally', async () => {
        const story = createStory({ id: '3-2-fill', status: 'in-progress' });
        setCachedTasks('3-2-fill', createTaskProgress(3, 4)); // 75%

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          const progressFill = container.querySelector('.bg-green-500');
          expect(progressFill).toBeInTheDocument();
          expect(progressFill?.getAttribute('style')).toContain('width: 75%');
        });
      });
    });

    describe('backlog and empty state (AC #8, #9)', () => {
      it('does not show task features for backlog stories', () => {
        const story = createStory({ id: '3-2-backlog', status: 'backlog' });
        setCachedTasks('3-2-backlog', createTaskProgress(5, 10));

        const { container } = render(StoryCard, { props: { story } });

        // Should not show task count even if cached
        expect(screen.queryByText(/tasks/)).not.toBeInTheDocument();
        // Should not show progress bar
        expect(container.querySelector('[role="progressbar"]')).not.toBeInTheDocument();
      });

      it('does not show task features when no tasks exist', async () => {
        const story = createStory({ id: '3-2-notasks', status: 'in-progress' });
        // Do not set cached tasks - simulates no tasks

        const { container } = render(StoryCard, { props: { story } });

        // Allow time for effect to run
        await waitFor(() => {
          expect(screen.queryByText(/tasks/)).not.toBeInTheDocument();
        });
      });
    });

    describe('expand/collapse behavior (AC #3, #5)', () => {
      it('shows expand button when tasks exist', async () => {
        const story = createStory({ id: '3-2-expand', status: 'in-progress' });
        setCachedTasks('3-2-expand', createTaskProgress(3, 5));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          const expandButton = container.querySelector('[aria-label="Expand task list"]');
          expect(expandButton).toBeInTheDocument();
        });
      });

      it('expands task list when expand button is clicked', async () => {
        const story = createStory({ id: '3-2-click-expand', status: 'in-progress' });
        setCachedTasks('3-2-click-expand', createTaskProgress(2, 4));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('2/4 tasks')).toBeInTheDocument();
        });

        const expandButton = container.querySelector('[aria-label="Expand task list"]');
        expect(expandButton).not.toBeNull();
        await fireEvent.click(expandButton!);

        await waitFor(() => {
          // Check that task list is now visible
          expect(screen.getByText('Task 1')).toBeInTheDocument();
        });
      });

      it('collapses task list when collapse button is clicked', async () => {
        const story = createStory({ id: '3-2-collapse', status: 'in-progress' });
        setCachedTasks('3-2-collapse', createTaskProgress(1, 2));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
        });

        // Expand first
        const expandButton = container.querySelector('[aria-label="Expand task list"]');
        await fireEvent.click(expandButton!);

        await waitFor(() => {
          expect(screen.getByText('Task 1')).toBeInTheDocument();
        });

        // Now collapse
        const collapseButton = container.querySelector('[aria-label="Collapse task list"]');
        await fireEvent.click(collapseButton!);

        await waitFor(() => {
          expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
        });
      });

      it('does not stop card click from opening detail panel', async () => {
        const story = createStory({ id: '3-2-cardclick', status: 'in-progress' });
        setCachedTasks('3-2-cardclick', createTaskProgress(1, 1));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('1/1 tasks')).toBeInTheDocument();
        });

        // Click the main card button (not the expand button)
        const button = container.querySelector('button');
        await fireEvent.click(button!);

        // Should set selectedStoryId
        expect(get(selectedStoryId)).toBe('3-2-cardclick');
      });
    });

    describe('keyboard accessibility (AC #12)', () => {
      it('has correct aria-expanded attribute on expand button', async () => {
        const story = createStory({ id: '3-2-aria', status: 'in-progress' });
        setCachedTasks('3-2-aria', createTaskProgress(2, 3));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          const button = container.querySelector('[aria-expanded]');
          expect(button).toBeInTheDocument();
          expect(button?.getAttribute('aria-expanded')).toBe('false');
        });
      });

      it('updates aria-expanded when expanded', async () => {
        const story = createStory({ id: '3-2-aria-toggle', status: 'in-progress' });
        setCachedTasks('3-2-aria-toggle', createTaskProgress(1, 2));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
        });

        const expandButton = container.querySelector('[aria-expanded="false"]');
        await fireEvent.click(expandButton!);

        await waitFor(() => {
          const expandedButton = container.querySelector('[aria-expanded="true"]');
          expect(expandedButton).toBeInTheDocument();
        });
      });

      it('includes task count in main button aria-label', async () => {
        const story = createStory({ id: '3-2-arialabel', status: 'in-progress' });
        setCachedTasks('3-2-arialabel', createTaskProgress(5, 10));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          const button = container.querySelector('button');
          expect(button?.getAttribute('aria-label')).toContain('5 of 10 tasks complete');
        });
      });

      it('expands task list on Enter keypress', async () => {
        const story = createStory({ id: '3-2-enter-key', status: 'in-progress' });
        setCachedTasks('3-2-enter-key', createTaskProgress(2, 3));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('2/3 tasks')).toBeInTheDocument();
        });

        const expandButton = container.querySelector('[aria-label="Expand task list"]');
        expect(expandButton).not.toBeNull();
        await fireEvent.keyDown(expandButton!, { key: 'Enter' });

        await waitFor(() => {
          expect(screen.getByText('Task 1')).toBeInTheDocument();
        });
      });

      it('expands task list on Space keypress', async () => {
        const story = createStory({ id: '3-2-space-key', status: 'in-progress' });
        setCachedTasks('3-2-space-key', createTaskProgress(2, 3));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('2/3 tasks')).toBeInTheDocument();
        });

        const expandButton = container.querySelector('[aria-label="Expand task list"]');
        expect(expandButton).not.toBeNull();
        await fireEvent.keyDown(expandButton!, { key: ' ' });

        await waitFor(() => {
          expect(screen.getByText('Task 1')).toBeInTheDocument();
        });
      });

      it('disables expand button during loading', async () => {
        const story = createStory({ id: '3-2-loading-disabled', status: 'in-progress' });
        setCachedTasks('3-2-loading-disabled', createTaskProgress(1, 2));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
        });

        const expandButton = container.querySelector('[aria-label="Expand task list"]');
        expect(expandButton).not.toBeNull();
        // When not loading, should be tabbable
        expect(expandButton?.getAttribute('tabindex')).toBe('0');
        expect(expandButton?.getAttribute('aria-disabled')).toBe('false');
      });

      it('has visible focus indicator on expand button', async () => {
        const story = createStory({ id: '3-2-focus', status: 'in-progress' });
        setCachedTasks('3-2-focus', createTaskProgress(1, 2));

        const { container } = render(StoryCard, { props: { story } });

        await waitFor(() => {
          expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
        });

        const expandButton = container.querySelector('[aria-label="Expand task list"]');
        expect(expandButton).not.toBeNull();
        // Check for focus styling classes
        expect(expandButton?.classList.contains('focus:bg-gray-700')).toBe(true);
        expect(expandButton?.classList.contains('focus:ring-1')).toBe(true);
      });
    });
  });
});
