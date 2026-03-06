/**
 * Unit tests for workflow.ts store.
 * Tests store initialization, refreshWorkflowState, resetWorkflowState,
 * and workflow dashboard stores (workflowViewMode, epicProgress, sprintProgress).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  workflowState,
  workflowLoading,
  workflowError,
  refreshWorkflowState,
  resetWorkflowState,
  workflowViewMode,
  setWorkflowViewMode,
  dashboardViewMode,
  setDashboardViewMode,
  epicProgress,
  sprintProgress,
} from './workflow';
import type { WorkflowState, WorkflowViewMode, DashboardViewMode } from '$lib/types/workflow';
import { sprintStatus, epicTitles } from '$lib/stores/stories';
import type { SprintStatus } from '$lib/types/stories';

// Mock the artifactApi
vi.mock('$lib/services/tauri', () => ({
  artifactApi: {
    getWorkflowState: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

import { artifactApi } from '$lib/services/tauri';
const mockGetWorkflowState = artifactApi.getWorkflowState as ReturnType<typeof vi.fn>;

describe('workflow store', () => {
  beforeEach(() => {
    // Reset stores to initial state before each test
    resetWorkflowState();
    vi.clearAllMocks();
    // Suppress expected console.error output from error handling tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    // P0: Test workflowState initialization
    it('workflowState initializes to null', () => {
      expect(get(workflowState)).toBeNull();
    });

    // P0: Test workflowLoading initialization
    it('workflowLoading initializes to false', () => {
      expect(get(workflowLoading)).toBe(false);
    });

    // P0: Test workflowError initialization
    it('workflowError initializes to null', () => {
      expect(get(workflowError)).toBeNull();
    });
  });

  describe('refreshWorkflowState', () => {
    const mockState: WorkflowState = {
      currentPhase: 'planning',
      completedArtifacts: [
        {
          path: '/test/prd.md',
          title: 'Product Requirements',
          created: '2026-02-20',
          status: 'approved',
          workflowType: 'prd',
          stepsCompleted: [1, 2, 3],
          inputDocuments: [],
        },
      ],
    };

    // P0: Test loading state is set to true during fetch
    it('sets loading state to true when called', async () => {
      // Use a promise that we can control
      let resolvePromise: (value: WorkflowState) => void;
      const controlledPromise = new Promise<WorkflowState>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetWorkflowState.mockReturnValue(controlledPromise);

      const refreshPromise = refreshWorkflowState('/test/project');

      // Check loading state is true while fetching
      expect(get(workflowLoading)).toBe(true);

      // Resolve the promise to complete
      resolvePromise!(mockState);
      await refreshPromise;
    });

    // P0: Test successful state update
    it('sets workflowState on success', async () => {
      mockGetWorkflowState.mockResolvedValue(mockState);

      await refreshWorkflowState('/test/project');

      expect(get(workflowState)).toEqual(mockState);
      expect(get(workflowError)).toBeNull();
    });

    // P0: Test error handling when fetch fails
    it('sets workflowError on failure with Error instance', async () => {
      mockGetWorkflowState.mockRejectedValue(new Error('Network error'));

      await refreshWorkflowState('/test/project');

      expect(get(workflowError)).toBe('Network error');
      expect(get(workflowState)).toBeNull();
    });

    // P0: Test loading state is set to false after completion
    it('sets loading state to false after completion', async () => {
      mockGetWorkflowState.mockResolvedValue(mockState);

      await refreshWorkflowState('/test/project');

      expect(get(workflowLoading)).toBe(false);
    });

    // P1: Test error handling when error is a string
    it('handles string error message', async () => {
      mockGetWorkflowState.mockRejectedValue('String error message');

      await refreshWorkflowState('/test/project');

      expect(get(workflowError)).toBe('String error message');
    });

    // P1: Test error handling when error is an object with message property
    it('handles object error with message property', async () => {
      mockGetWorkflowState.mockRejectedValue({ message: 'Object error message' });

      await refreshWorkflowState('/test/project');

      expect(get(workflowError)).toBe('Object error message');
    });

    // P1: Test fallback error message for unknown error types
    it('uses fallback message for unknown error types', async () => {
      mockGetWorkflowState.mockRejectedValue(42); // neither Error, string, nor object with message

      await refreshWorkflowState('/test/project');

      expect(get(workflowError)).toBe('Failed to load workflow state');
    });

    // P1: Test that error is cleared when refresh succeeds
    it('clears previous error on new refresh', async () => {
      // First, set an error
      mockGetWorkflowState.mockRejectedValue(new Error('First error'));
      await refreshWorkflowState('/test/project');
      expect(get(workflowError)).toBe('First error');

      // Then refresh successfully
      mockGetWorkflowState.mockResolvedValue(mockState);
      await refreshWorkflowState('/test/project');
      expect(get(workflowError)).toBeNull();
    });
  });

  describe('resetWorkflowState', () => {
    // P1: Test reset clears all stores
    it('resets all stores to initial values', async () => {
      const mockState: WorkflowState = {
        currentPhase: 'solutioning',
        completedArtifacts: [],
      };

      // First set some values
      mockGetWorkflowState.mockResolvedValue(mockState);
      await refreshWorkflowState('/test/project');

      // Verify values are set
      expect(get(workflowState)).toEqual(mockState);

      // Reset
      resetWorkflowState();

      // Verify reset
      expect(get(workflowState)).toBeNull();
      expect(get(workflowLoading)).toBe(false);
      expect(get(workflowError)).toBeNull();
    });
  });

  // =====================================================================
  // Workflow View Mode Store Tests (Story 5-1: Tab Restructure)
  // After restructure, only 'phase' view remains in Workflows tab.
  // =====================================================================

  describe('workflowViewMode', () => {
    beforeEach(() => {
      // Reset to default 'phase'
      workflowViewMode.set('phase');
    });

    it('initializes to phase by default', () => {
      expect(get(workflowViewMode)).toBe('phase');
    });

    it('setWorkflowViewMode updates the store', () => {
      setWorkflowViewMode('phase');
      expect(get(workflowViewMode)).toBe('phase');
    });
  });

  describe('epicProgress', () => {
    beforeEach(() => {
      // Reset stores
      sprintStatus.set(null);
      epicTitles.set(new Map());
    });

    it('returns empty array when sprintStatus is null', () => {
      expect(get(epicProgress)).toEqual([]);
    });

    it('computes progress for each epic', () => {
      const mockStatus: SprintStatus = {
        generated: '2026-02-23',
        project: 'test',
        epics: [
          { id: '1', status: 'done' },
          { id: '2', status: 'in-progress' },
        ],
        stories: [
          { id: '1-1-test', epicId: '1', storyNumber: 1, slug: 'test', status: 'done' },
          { id: '1-2-test', epicId: '1', storyNumber: 2, slug: 'test', status: 'done' },
          { id: '2-1-test', epicId: '2', storyNumber: 1, slug: 'test', status: 'done' },
          { id: '2-2-test', epicId: '2', storyNumber: 2, slug: 'test', status: 'in-progress' },
          { id: '2-3-test', epicId: '2', storyNumber: 3, slug: 'test', status: 'backlog' },
        ],
        bugs: [],
      };

      sprintStatus.set(mockStatus);
      epicTitles.set(
        new Map([
          ['1', 'Foundation'],
          ['2', 'Feature Sprint'],
        ])
      );

      const progress = get(epicProgress);

      expect(progress).toHaveLength(2);

      // Epic 1: 2/2 done = 100%
      expect(progress[0]).toEqual({
        epicId: '1',
        title: 'Foundation',
        status: 'done',
        stats: {
          total: 2,
          done: 2,
          inProgress: 0,
          percentage: 100,
        },
      });

      // Epic 2: 1/3 done = 33%
      expect(progress[1]).toEqual({
        epicId: '2',
        title: 'Feature Sprint',
        status: 'in-progress',
        stats: {
          total: 3,
          done: 1,
          inProgress: 1,
          percentage: 33,
        },
      });
    });

    it('uses fallback title when epicTitles is empty', () => {
      const mockStatus: SprintStatus = {
        generated: '2026-02-23',
        project: 'test',
        epics: [{ id: '3', status: 'backlog' }],
        stories: [],
        bugs: [],
      };

      sprintStatus.set(mockStatus);
      epicTitles.set(new Map());

      const progress = get(epicProgress);
      expect(progress[0].title).toBe('Epic 3');
    });

    it('handles epic with no stories', () => {
      const mockStatus: SprintStatus = {
        generated: '2026-02-23',
        project: 'test',
        epics: [{ id: '1', status: 'backlog' }],
        stories: [],
        bugs: [],
      };

      sprintStatus.set(mockStatus);

      const progress = get(epicProgress);
      expect(progress[0].stats).toEqual({
        total: 0,
        done: 0,
        inProgress: 0,
        percentage: 0,
      });
    });
  });

  describe('sprintProgress', () => {
    beforeEach(() => {
      sprintStatus.set(null);
    });

    it('returns null when sprintStatus is null', () => {
      expect(get(sprintProgress)).toBeNull();
    });

    it('computes counts by status', () => {
      const mockStatus: SprintStatus = {
        generated: '2026-02-23',
        project: 'test',
        epics: [],
        stories: [
          { id: '1-1', epicId: '1', storyNumber: 1, slug: 'a', status: 'backlog' },
          { id: '1-2', epicId: '1', storyNumber: 2, slug: 'b', status: 'backlog' },
          { id: '1-3', epicId: '1', storyNumber: 3, slug: 'c', status: 'ready-for-dev' },
          { id: '1-4', epicId: '1', storyNumber: 4, slug: 'd', status: 'in-progress' },
          { id: '1-5', epicId: '1', storyNumber: 5, slug: 'e', status: 'review' },
          { id: '1-6', epicId: '1', storyNumber: 6, slug: 'f', status: 'done' },
          { id: '1-7', epicId: '1', storyNumber: 7, slug: 'g', status: 'done' },
          { id: '1-8', epicId: '1', storyNumber: 8, slug: 'h', status: 'done' },
        ],
        bugs: [],
      };

      sprintStatus.set(mockStatus);

      const progress = get(sprintProgress);
      expect(progress).toEqual({
        counts: {
          backlog: 2,
          ready: 1,
          inProgress: 1,
          review: 1,
          done: 3,
        },
        total: 8,
        percentage: 38, // 3/8 = 37.5, rounded to 38
      });
    });

    it('handles empty stories array', () => {
      const mockStatus: SprintStatus = {
        generated: '2026-02-23',
        project: 'test',
        epics: [],
        stories: [],
        bugs: [],
      };

      sprintStatus.set(mockStatus);

      const progress = get(sprintProgress);
      expect(progress).toEqual({
        counts: {
          backlog: 0,
          ready: 0,
          inProgress: 0,
          review: 0,
          done: 0,
        },
        total: 0,
        percentage: 0,
      });
    });
  });

  // =====================================================================
  // Dashboard View Mode Store Tests (Story 5-1)
  // =====================================================================

  describe('dashboardViewMode', () => {
    beforeEach(() => {
      localStorageMock.clear();
      // Reset to default 'epic' since localStorage is cleared
      dashboardViewMode.set('epic');
    });

    it('initializes to epic by default', () => {
      expect(get(dashboardViewMode)).toBe('epic');
    });

    it('setDashboardViewMode updates the store', () => {
      setDashboardViewMode('sprint');
      expect(get(dashboardViewMode)).toBe('sprint');
    });

    it('persists view mode to localStorage', () => {
      setDashboardViewMode('sprint');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'dashboard-view-mode',
        'sprint'
      );
    });

    it('accepts all valid view modes', () => {
      const modes: DashboardViewMode[] = ['epic', 'sprint'];
      for (const mode of modes) {
        setDashboardViewMode(mode);
        expect(get(dashboardViewMode)).toBe(mode);
      }
    });
  });
});
