/**
 * Unit tests for WorktreeCleanupDialog component.
 * Tests rendering, cleanup mode selection, dirty worktree handling, and cleanup execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import WorktreeCleanupDialog from './WorktreeCleanupDialog.svelte';
import type { Story } from '$lib/types/stories';
import type { Worktree } from '$lib/types/worktree';

// Mock the worktrees service
const mockIsWorktreeDirty = vi.fn();
const mockGetDirtyFiles = vi.fn();
const mockCleanupWorktree = vi.fn();

vi.mock('$lib/services/worktrees', () => ({
  worktreeApi: {
    isWorktreeDirty: (...args: unknown[]) => mockIsWorktreeDirty(...args),
    getDirtyFiles: (...args: unknown[]) => mockGetDirtyFiles(...args),
    cleanupWorktree: (...args: unknown[]) => mockCleanupWorktree(...args),
    listWorktrees: vi.fn(),
  },
  parseWorktreeError: vi.fn((error: unknown) => 'Cleanup failed'),
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

// Mock the worktrees store
vi.mock('$lib/stores/worktrees', () => ({
  refreshWorktrees: vi.fn(),
}));

// Mock the UI store
const mockShowSuccessToast = vi.fn();
const mockShowErrorToast = vi.fn();
vi.mock('$lib/stores/ui', () => ({
  showSuccessToast: (...args: unknown[]) => mockShowSuccessToast(...args),
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

describe('WorktreeCleanupDialog', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseMock = vi.fn();
    mockIsWorktreeDirty.mockResolvedValue(false);
    mockGetDirtyFiles.mockResolvedValue([]);
    mockCleanupWorktree.mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createStory = (overrides: Partial<Story> = {}): Story => ({
    id: '3-2-story-board-ui-kanban',
    epicId: '3',
    storyNumber: 2,
    slug: 'story-board-ui-kanban',
    status: 'done',
    ...overrides,
  });

  const createWorktree = (overrides: Partial<Worktree> = {}): Worktree => ({
    path: '/test/project-wt-3-2',
    branch: 'story/3-2-story-board-ui-kanban',
    head: 'abc123',
    storyId: '3-2-story-board-ui-kanban',
    locked: false,
    isMain: false,
    ...overrides,
  });

  describe('rendering', () => {
    it('displays dialog title', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      expect(screen.getByText('Clean Up Worktree')).toBeInTheDocument();
    });

    it('displays story ID and title', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      expect(screen.getByText('3-2 - Story Board Ui Kanban')).toBeInTheDocument();
    });

    it('displays sub-story ID correctly', async () => {
      const story = createStory({
        id: '1-5-2-terminate-lock',
        epicId: '1',
        storyNumber: 5,
        subStoryNumber: 2,
        slug: 'terminate-lock',
      });
      render(WorktreeCleanupDialog, {
        props: { story, worktree: createWorktree(), onClose: onCloseMock },
      });

      expect(screen.getByText('1-5-2 - Terminate Lock')).toBeInTheDocument();
    });

    it('displays worktree path', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      expect(screen.getByText('/test/project-wt-3-2')).toBeInTheDocument();
    });

    it('displays worktree branch', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      expect(screen.getByText('story/3-2-story-board-ui-kanban')).toBeInTheDocument();
    });

    it('displays cleanup mode options', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      expect(screen.getByText('Remove worktree only')).toBeInTheDocument();
      expect(screen.getByText('Remove worktree and delete branch')).toBeInTheDocument();
    });

    it('displays Remove button when not dirty', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });
    });
  });

  describe('radio option selection', () => {
    it('has worktree-only selected by default', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      const worktreeOnlyRadio = screen.getByLabelText(/Remove worktree only/i);
      expect(worktreeOnlyRadio).toBeChecked();
    });

    it('allows selecting worktree-and-branch option', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      const worktreeAndBranchRadio = screen.getByLabelText(/Remove worktree and delete branch/i);
      await fireEvent.click(worktreeAndBranchRadio);

      expect(worktreeAndBranchRadio).toBeChecked();
    });
  });

  describe('dirty worktree warning', () => {
    it('displays loading state while checking', async () => {
      mockIsWorktreeDirty.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(false), 1000))
      );

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      expect(screen.getByText('Checking for uncommitted changes...')).toBeInTheDocument();
    });

    it('displays warning banner when worktree is dirty', async () => {
      mockIsWorktreeDirty.mockResolvedValue(true);
      mockGetDirtyFiles.mockResolvedValue(['M  src/file.ts', '?? new-file.ts']);

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('This worktree has uncommitted changes')).toBeInTheDocument();
      });
    });

    it('displays dirty files list', async () => {
      mockIsWorktreeDirty.mockResolvedValue(true);
      mockGetDirtyFiles.mockResolvedValue(['M  src/file.ts', '?? new-file.ts']);

      const { container } = render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        // Use container query since test library normalizes whitespace
        const listItems = container.querySelectorAll('li');
        expect(listItems.length).toBe(2);
        expect(listItems[0].textContent).toBe('M  src/file.ts');
        expect(listItems[1].textContent).toBe('?? new-file.ts');
      });
    });

    it('displays Force Remove button when dirty', async () => {
      mockIsWorktreeDirty.mockResolvedValue(true);
      mockGetDirtyFiles.mockResolvedValue(['M  src/file.ts']);

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Force Remove')).toBeInTheDocument();
      });
    });
  });

  describe('close functionality', () => {
    it('calls onClose when Cancel button is clicked', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      const cancelButton = screen.getByText('Cancel');
      await fireEvent.click(cancelButton);

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', async () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await fireEvent.keyDown(window, { key: 'Escape' });

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const { container } = render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      // The backdrop is the outer div with bg-black/50
      const backdrop = container.querySelector('.bg-black\\/50');
      if (backdrop) {
        await fireEvent.click(backdrop);
      }

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup execution', () => {
    it('calls cleanupWorktree with correct params for worktree-only mode', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove');
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockCleanupWorktree).toHaveBeenCalledWith(
          '/test/project',
          '/test/project-wt-3-2',
          false, // deleteBranch
          false // force
        );
      });
    });

    it('calls cleanupWorktree with deleteBranch=true when that option is selected', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      // Select the "Remove worktree and delete branch" option
      const worktreeAndBranchRadio = screen.getByLabelText(/Remove worktree and delete branch/i);
      await fireEvent.click(worktreeAndBranchRadio);

      const removeButton = screen.getByText('Remove');
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockCleanupWorktree).toHaveBeenCalledWith(
          '/test/project',
          '/test/project-wt-3-2',
          true, // deleteBranch
          false // force
        );
      });
    });

    it('calls cleanupWorktree with force=true when worktree is dirty', async () => {
      mockIsWorktreeDirty.mockResolvedValue(true);
      mockGetDirtyFiles.mockResolvedValue(['M  src/file.ts']);

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Force Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Force Remove');
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockCleanupWorktree).toHaveBeenCalledWith(
          '/test/project',
          '/test/project-wt-3-2',
          false, // deleteBranch
          true // force
        );
      });
    });

    it('calls onClose after successful cleanup', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove');
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('loading state', () => {
    it('shows loading spinner during cleanup', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);
      mockCleanupWorktree.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(undefined), 1000))
      );

      const { container } = render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove');
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('Removing...')).toBeInTheDocument();
      });
    });

    it('disables buttons during cleanup', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);
      mockCleanupWorktree.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(undefined), 1000))
      );

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove');
      await fireEvent.click(removeButton);

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('accessibility', () => {
    it('has dialog role', () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      const dialog = screen.getByRole('dialog');
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(titleId).toBe('cleanup-dialog-title');

      const title = document.getElementById(titleId!);
      expect(title).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error toast when cleanup fails', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);
      mockCleanupWorktree.mockRejectedValue(new Error('Permission denied'));

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove');
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith('Cleanup failed', { duration: 5000 });
      });
    });

    it('does not call onClose when cleanup fails', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);
      mockCleanupWorktree.mockRejectedValue(new Error('Git error'));

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove');
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalled();
      });

      // onClose should NOT have been called on error
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('resets loading state after cleanup error', async () => {
      mockIsWorktreeDirty.mockResolvedValue(false);
      mockCleanupWorktree.mockRejectedValue(new Error('Network error'));

      render(WorktreeCleanupDialog, {
        props: { story: createStory(), worktree: createWorktree(), onClose: onCloseMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove');
      await fireEvent.click(removeButton);

      // Wait for error to be handled
      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalled();
      });

      // Button should be back to normal state
      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
        expect(screen.queryByText('Removing...')).not.toBeInTheDocument();
      });
    });
  });
});
