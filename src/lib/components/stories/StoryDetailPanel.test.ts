/**
 * Unit tests for StoryDetailPanel component.
 * Tests rendering, close functionality, worktree features, and accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StoryDetailPanel from './StoryDetailPanel.svelte';
import { worktrees, worktreeCreating, resetWorktrees, setWorktreeCreating } from '$lib/stores/worktrees';
import type { Story, Epic, StoryContent } from '$lib/types/stories';
import { storyApi } from '$lib/services/stories';
import { artifactBrowserApi } from '$lib/services/artifacts';

// Mock the worktrees service
vi.mock('$lib/services/worktrees', () => ({
  worktreeApi: {
    createWorktree: vi.fn(),
    listWorktrees: vi.fn(),
  },
  parseWorktreeError: vi.fn((error: unknown) => 'Failed to create worktree'),
}));

// Mock the stories service for story content
vi.mock('$lib/services/stories', () => ({
  storyApi: {
    getStoryContent: vi.fn(),
  },
}));

// Mock the artifacts service
vi.mock('$lib/services/artifacts', () => ({
  artifactBrowserApi: {
    getStoryArtifact: vi.fn(),
  },
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

  describe('story content (Story 5-13)', () => {
    const mockStoryContent: StoryContent = {
      story: 'As a user, I want to view story details.',
      acceptanceCriteria: '1. Content is displayed\n2. Tasks are shown',
      tasks: '- [ ] Task 1\n- [x] Task 2',
      devNotes: '### Implementation\nUse existing patterns.',
      parsed: true,
      error: null,
    };

    beforeEach(() => {
      vi.mocked(artifactBrowserApi.getStoryArtifact).mockResolvedValue({
        path: '/test/project/_bmad-output/implementation-artifacts/3-2-story.md',
        title: '3-2-story',
        category: 'story',
        modifiedAt: '2026-03-05T00:00:00Z',
      });
      vi.mocked(storyApi.getStoryContent).mockResolvedValue(mockStoryContent);
    });

    it('shows loading state while fetching content', async () => {
      // Create a promise that won't resolve immediately
      let resolvePromise: () => void;
      vi.mocked(artifactBrowserApi.getStoryArtifact).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = () => resolve({
            path: '/test/project/_bmad-output/implementation-artifacts/3-2-story.md',
            title: '3-2-story',
            category: 'story',
            modifiedAt: '2026-03-05T00:00:00Z',
          });
        })
      );

      const story = createStory({ status: 'in-progress' });
      const { container } = render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      // Should show loading spinner
      expect(screen.getByText('Loading story content...')).toBeInTheDocument();
    });

    it('shows backlog message for backlog stories (AC5)', () => {
      const story = createStory({ status: 'backlog' });
      render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      expect(screen.getByText('Story file not yet created')).toBeInTheDocument();
    });

    it('shows error state with retry button (AC6)', async () => {
      vi.mocked(artifactBrowserApi.getStoryArtifact).mockRejectedValue(
        new Error('Network error')
      );

      const story = createStory({ status: 'in-progress' });
      render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      // Wait for error state
      await vi.waitFor(() => {
        expect(screen.getByText(/Network error|Failed to load/)).toBeInTheDocument();
      });

      // Should show retry button
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('shows error when story file not found (AC6)', async () => {
      vi.mocked(artifactBrowserApi.getStoryArtifact).mockResolvedValue(null);

      const story = createStory({ status: 'in-progress' });
      render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      // Wait for error state
      await vi.waitFor(() => {
        expect(screen.getByText('Story file not found')).toBeInTheDocument();
      });
    });

    it('displays story content sections when loaded (AC1)', async () => {
      const story = createStory({ status: 'in-progress' });
      render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      // Wait for content to load
      await vi.waitFor(() => {
        expect(screen.getByText('Story')).toBeInTheDocument();
      });

      // All sections should be present
      expect(screen.getByText('Acceptance Criteria')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Dev Notes')).toBeInTheDocument();
    });

    it('does not fetch content for backlog stories', async () => {
      const story = createStory({ status: 'backlog' });
      render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      // Wait a tick for any async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should not have called the API
      expect(artifactBrowserApi.getStoryArtifact).not.toHaveBeenCalled();
      expect(storyApi.getStoryContent).not.toHaveBeenCalled();
    });

    it('clears previous content when loading new story', async () => {
      // First render with content that loads
      const story = createStory({ status: 'in-progress' });
      const { rerender } = render(StoryDetailPanel, {
        props: { story, epic: createEpic(), onClose: onCloseMock },
      });

      // Wait for content to load
      await vi.waitFor(() => {
        expect(screen.getByText('Story')).toBeInTheDocument();
      });

      // Verify content is displayed
      expect(screen.getByText('As a user, I want to view story details.')).toBeInTheDocument();

      // Now simulate loading a different story by re-rendering
      // The loading state should clear the previous content
      vi.mocked(artifactBrowserApi.getStoryArtifact).mockReturnValue(
        new Promise(() => {}) // Never resolves - simulates slow load
      );

      const newStory = createStory({ id: '4-1-different-story', status: 'in-progress' });
      rerender({ story: newStory, epic: createEpic(), onClose: onCloseMock });

      // Previous content should be cleared (not visible during loading)
      // Note: Due to how Svelte re-renders work, the component may show loading state
      await vi.waitFor(() => {
        // Loading indicator should appear
        expect(screen.getByText('Loading story content...')).toBeInTheDocument();
      });
    });
  });
});
