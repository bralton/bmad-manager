/**
 * Unit tests for StoryTasksView.svelte component.
 * Tests task display, empty states, loading state, and progress visualization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import StoryTasksView from './StoryTasksView.svelte';
import { selectedStoryId, sprintStatus } from '$lib/stores/stories';
import { currentProject } from '$lib/stores/project';
import type { StoryProgress } from '$lib/types/workflow';
import type { SprintStatus } from '$lib/types/stories';

// Mock the stores
vi.mock('$lib/stores/stories', () => {
  const { writable } = require('svelte/store');
  return {
    selectedStoryId: writable(null),
    sprintStatus: writable(null),
    refreshSprintStatus: vi.fn(),
    setSelectedStoryId: vi.fn(),
  };
});

vi.mock('$lib/stores/project', () => {
  const { writable } = require('svelte/store');
  return {
    currentProject: writable({
      path: '/test/project',
      state: 'fully-initialized',
    }),
  };
});

// Mock the workflowApi
const mockGetStoryTasks = vi.fn();
vi.mock('$lib/services/tauri', () => ({
  workflowApi: {
    getStoryTasks: (...args: unknown[]) => mockGetStoryTasks(...args),
  },
}));

describe('StoryTasksView', () => {
  const mockStoryTasks: StoryProgress = {
    storyId: '1-1-test-story',
    tasks: [
      { text: 'Task 1: Implement feature', completed: true, level: 0 },
      { text: '1.1: Create module', completed: true, level: 1 },
      { text: '1.2: Add types', completed: false, level: 1 },
      { text: 'Task 2: Write tests', completed: false, level: 0 },
    ],
    total: 4,
    completed: 2,
    percentage: 50,
  };

  const mockSprintStatus: SprintStatus = {
    generated: '2026-02-23',
    project: 'test',
    epics: [],
    stories: [
      {
        id: '1-1-test-story',
        epicId: '1',
        storyNumber: 1,
        slug: 'test-story',
        status: 'in-progress',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selectedStoryId.set(null);
    sprintStatus.set(null);
    mockGetStoryTasks.mockReset();
  });

  describe('empty states', () => {
    it('shows empty state when no story is selected', () => {
      selectedStoryId.set(null);
      render(StoryTasksView);

      expect(screen.getByText('No story selected')).toBeInTheDocument();
      expect(screen.getByText('Choose a story from the dropdown above to view its task checklist.')).toBeInTheDocument();
    });

    it('shows no tasks state when story has no tasks', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(null);

      render(StoryTasksView);

      await waitFor(() => {
        expect(screen.getByText('No tasks found')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching tasks', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');

      // Use a promise that we control
      let resolvePromise: (value: StoryProgress) => void;
      mockGetStoryTasks.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      render(StoryTasksView);

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument();

      // Resolve to complete
      resolvePromise!(mockStoryTasks);
    });
  });

  describe('task display', () => {
    it('renders all tasks when data is loaded', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        expect(screen.getByText('Task 1: Implement feature')).toBeInTheDocument();
        expect(screen.getByText('1.1: Create module')).toBeInTheDocument();
        expect(screen.getByText('1.2: Add types')).toBeInTheDocument();
        expect(screen.getByText('Task 2: Write tests')).toBeInTheDocument();
      });
    });

    it('shows task completion counts', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        expect(screen.getByText('2/4 tasks')).toBeInTheDocument();
      });
    });

    it('shows completion percentage', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });

    it('applies line-through style to completed tasks', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        const completedTask = screen.getByText('Task 1: Implement feature');
        expect(completedTask.className).toContain('line-through');
      });
    });

    it('does not apply line-through to incomplete tasks', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        const incompleteTask = screen.getByText('Task 2: Write tests');
        expect(incompleteTask.className).not.toContain('line-through');
      });
    });
  });

  describe('progress bar', () => {
    it('renders progress bar with correct width', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveStyle('width: 50%');
      });
    });

    it('uses blue color for partial completion', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar.className).toContain('bg-blue-500');
      });
    });

    it('uses green color for 100% completion', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue({
        ...mockStoryTasks,
        completed: 4,
        percentage: 100,
      });

      render(StoryTasksView);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar.className).toContain('bg-green-500');
      });
    });
  });

  describe('error handling', () => {
    it('shows error message when loading fails', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockRejectedValue(new Error('Failed to parse'));

      render(StoryTasksView);

      await waitFor(() => {
        expect(screen.getByText('Failed to parse')).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('constructs correct story path', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        expect(mockGetStoryTasks).toHaveBeenCalledWith(
          '/test/project/_bmad-output/implementation-artifacts/1-1-test-story.md'
        );
      });
    });
  });

  describe('accessibility', () => {
    it('has proper aria attributes on progress bar', async () => {
      sprintStatus.set(mockSprintStatus);
      selectedStoryId.set('1-1-test-story');
      mockGetStoryTasks.mockResolvedValue(mockStoryTasks);

      render(StoryTasksView);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      });
    });
  });
});
