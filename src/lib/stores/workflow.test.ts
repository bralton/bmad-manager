/**
 * Unit tests for workflow.ts store.
 * Tests store initialization, refreshWorkflowState, and resetWorkflowState.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  workflowState,
  workflowLoading,
  workflowError,
  refreshWorkflowState,
  resetWorkflowState,
} from './workflow';
import type { WorkflowState } from '$lib/types/workflow';

// Mock the artifactApi
vi.mock('$lib/services/tauri', () => ({
  artifactApi: {
    getWorkflowState: vi.fn(),
  },
}));

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
});
