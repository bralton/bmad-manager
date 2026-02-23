import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MergeDialog from './MergeDialog.svelte';
import type { Story } from '$lib/types/stories';
import type { Worktree } from '$lib/types/worktree';

// Mock stores
vi.mock('$lib/stores/project', () => ({
  currentProject: {
    subscribe: vi.fn((fn) => {
      fn({ path: '/test/project' });
      return () => {};
    }),
  },
}));

vi.mock('$lib/stores/worktrees', () => ({
  refreshWorktrees: vi.fn(),
}));

vi.mock('$lib/stores/ui', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

// Mock services - use synchronous resolution for predictable tests
vi.mock('$lib/services/worktrees', () => ({
  mergeApi: {
    getMainRepoBranch: vi.fn().mockResolvedValue('main'),
    checkMergeConflicts: vi.fn().mockResolvedValue([]),
    mergeWorktreeBranch: vi.fn().mockResolvedValue({
      success: true,
      message: 'Merge successful',
      conflicts: [],
      mergeCommit: 'abc1234',
    }),
    cleanupAfterMerge: vi.fn().mockResolvedValue(undefined),
  },
  parseMergeError: vi.fn((error) => String(error)),
}));

describe('MergeDialog', () => {
  const mockStory: Story = {
    id: '4-9-merge-test',
    epicId: '4',
    storyNumber: 9,
    slug: 'merge-test',
    status: 'in-progress',
  };

  const mockWorktree: Worktree = {
    path: '/test/worktree',
    branch: 'story/4-9-merge-test',
    head: 'abc1234',
    storyId: '4-9',
    locked: false,
    isMain: false,
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with correct title', async () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Merge to Project')).toBeTruthy();
  });

  it('displays story information', async () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    // Check story ID format - use getAllByText since it appears multiple times
    const storyIdElements = screen.getAllByText(/4-9/);
    expect(storyIdElements.length).toBeGreaterThan(0);

    // Check source branch label is present
    expect(screen.getByText('Source branch:')).toBeTruthy();
  });

  it('shows target branch label', () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    // Target branch label should be present (either loading or loaded)
    expect(screen.getByText('Target branch:')).toBeTruthy();
  });

  it('has Cancel and Merge buttons', () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    // Merge button exists but may be disabled while loading
    expect(screen.getByRole('button', { name: 'Merge' })).toBeTruthy();
  });

  it('calls onClose when Cancel is clicked', async () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays source branch from worktree', () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    // Branch appears multiple times (in source branch display and merge summary)
    const branchElements = screen.getAllByText('story/4-9-merge-test');
    expect(branchElements.length).toBeGreaterThan(0);
  });

  it('shows merge summary text', () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    expect(screen.getByText(/This will merge/)).toBeTruthy();
    expect(screen.getByText(/using a merge commit/)).toBeTruthy();
  });

  it('Merge button is initially disabled while loading branch', () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    const mergeButton = screen.getByRole('button', { name: 'Merge' });
    expect(mergeButton.hasAttribute('disabled')).toBe(true);
  });

  it('displays correct title for confirmation state', () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    expect(screen.getByText('Merge to Project')).toBeTruthy();
  });

  it('renders dialog with proper accessibility attributes', () => {
    render(MergeDialog, {
      props: {
        story: mockStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('merge-dialog-title');
  });

  it('displays sub-story ID correctly', () => {
    const subStory: Story = {
      ...mockStory,
      subStoryNumber: 1,
    };

    render(MergeDialog, {
      props: {
        story: subStory,
        worktree: mockWorktree,
        onClose: mockOnClose,
      },
    });

    // Sub-story should show 4-9-1 format
    const storyIdElements = screen.getAllByText(/4-9-1/);
    expect(storyIdElements.length).toBeGreaterThan(0);
  });
});
