/**
 * Unit tests for StoryBoardContainer component.
 * Tests loading, error, empty states, and file watcher integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import StoryBoardContainer from './StoryBoardContainer.svelte';
import {
  sprintStatus,
  sprintStatusLoading,
  sprintStatusError,
  selectedStoryId,
  resetSprintStatus,
} from '$lib/stores/stories';
import { currentProject } from '$lib/stores/project';
import { resetWorktrees } from '$lib/stores/worktrees';
import type { SprintStatus } from '$lib/types/stories';
import type { Project } from '$lib/types/project';

// Mock the stores
vi.mock('$lib/stores/project', () => ({
  currentProject: {
    subscribe: vi.fn(),
  },
}));

// Mock the stories service
vi.mock('$lib/services/stories', () => ({
  storyApi: {
    getSprintStatus: vi.fn(),
    getEpicTitles: vi.fn(() => Promise.resolve({})),
  },
}));

// Mock the events service
vi.mock('$lib/services/events', () => ({
  setupEventListeners: vi.fn().mockResolvedValue([]),
}));

// Mock the worktrees service
vi.mock('$lib/services/worktrees', () => ({
  worktreeApi: {
    listWorktrees: vi.fn(() => Promise.resolve([])),
    createWorktree: vi.fn(),
    getWorktreeForStory: vi.fn(),
    isWorktreeDirty: vi.fn(),
    getWorktreeBinding: vi.fn(),
    getAllWorktreeBindings: vi.fn(() => Promise.resolve([])),
    validateWorktreeBindings: vi.fn(() => Promise.resolve([])),
    getCurrentWorktreeStoryId: vi.fn(() => Promise.resolve(null)),
  },
}));

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('StoryBoardContainer', () => {
  let mockProjectValue: Project | null = null;

  beforeEach(() => {
    resetSprintStatus();
    resetWorktrees();
    vi.clearAllMocks();

    // Setup currentProject mock
    (currentProject.subscribe as ReturnType<typeof vi.fn>).mockImplementation((fn: (value: Project | null) => void) => {
      fn(mockProjectValue);
      return () => {};
    });
  });

  afterEach(() => {
    mockProjectValue = null;
    vi.restoreAllMocks();
  });

  const mockProject: Project = {
    path: '/test/project',
    name: 'test-project',
    state: 'fully-initialized',
    config: null,
    agents: [],
  };

  const mockSprintStatus: SprintStatus = {
    generated: '2026-02-22',
    project: 'test-project',
    epics: [
      { id: '1', status: 'done' },
      { id: '2', status: 'in-progress' },
    ],
    stories: [
      { id: '1-1-scaffold', epicId: '1', storyNumber: 1, slug: 'scaffold', status: 'done' },
      { id: '2-1-parser', epicId: '2', storyNumber: 1, slug: 'parser', status: 'ready-for-dev' },
    ],
  };

  describe('loading state', () => {
    it('shows loading indicator when loading and no data', () => {
      mockProjectValue = mockProject;
      sprintStatusLoading.set(true);
      sprintStatus.set(null);

      render(StoryBoardContainer);

      expect(screen.getByText('Loading sprint status...')).toBeInTheDocument();
    });

    it('shows spinner during loading', () => {
      mockProjectValue = mockProject;
      sprintStatusLoading.set(true);
      sprintStatus.set(null);

      const { container } = render(StoryBoardContainer);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error occurs', () => {
      mockProjectValue = mockProject;
      sprintStatusError.set('Failed to load sprint status');
      sprintStatus.set(null);

      render(StoryBoardContainer);

      expect(screen.getByText('Failed to load sprint status')).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      mockProjectValue = mockProject;
      sprintStatusError.set('Network error');
      sprintStatus.set(null);

      render(StoryBoardContainer);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no stories exist', () => {
      mockProjectValue = mockProject;
      sprintStatus.set({
        generated: '2026-02-22',
        project: 'test',
        epics: [],
        stories: [],
      });

      render(StoryBoardContainer);

      expect(screen.getByText('No stories found')).toBeInTheDocument();
    });

    it('shows guidance about sprint-status.yaml', () => {
      mockProjectValue = mockProject;
      sprintStatus.set({
        generated: '2026-02-22',
        project: 'test',
        epics: [],
        stories: [],
      });

      render(StoryBoardContainer);

      expect(screen.getByText(/Stories are loaded from sprint-status.yaml/)).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    it('renders StoryBoard when stories exist', () => {
      mockProjectValue = mockProject;
      sprintStatus.set(mockSprintStatus);

      const { container } = render(StoryBoardContainer);

      // StoryBoard renders column headers
      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('renders epic rows', () => {
      mockProjectValue = mockProject;
      sprintStatus.set(mockSprintStatus);

      render(StoryBoardContainer);

      expect(screen.getByText('Epic 1')).toBeInTheDocument();
      expect(screen.getByText('Epic 2')).toBeInTheDocument();
    });
  });

  describe('detail panel', () => {
    it('shows detail panel when story is selected', () => {
      mockProjectValue = mockProject;
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-scaffold');

      render(StoryBoardContainer);

      // Detail panel shows story info
      expect(screen.getByText('Story 1-1')).toBeInTheDocument();
    });

    it('does not show detail panel when no story selected', () => {
      mockProjectValue = mockProject;
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set(null);

      render(StoryBoardContainer);

      // No detail panel header
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
