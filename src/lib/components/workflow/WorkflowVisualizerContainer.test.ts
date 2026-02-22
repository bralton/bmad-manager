/**
 * Unit tests for WorkflowVisualizerContainer.svelte component.
 * Tests conditional rendering, loading states, error handling, and watcher integration.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import WorkflowVisualizerContainer from './WorkflowVisualizerContainer.svelte';
import { currentProject } from '$lib/stores/project';
import {
  workflowState,
  workflowLoading,
  workflowError,
  resetWorkflowState,
} from '$lib/stores/workflow';
import type { WorkflowState } from '$lib/types/workflow';
import type { Project } from '$lib/types/project';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock Tauri webviewWindow API for per-window file watcher
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: vi.fn(() => ({
    label: 'test-window',
  })),
}));

// Mock event listeners
vi.mock('$lib/services/events', () => ({
  setupEventListeners: vi.fn(() => Promise.resolve([])),
}));

// Mock artifactApi
vi.mock('$lib/services/tauri', () => ({
  artifactApi: {
    getWorkflowState: vi.fn(),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { setupEventListeners } from '$lib/services/events';
import { artifactApi } from '$lib/services/tauri';

const mockInvoke = invoke as ReturnType<typeof vi.fn>;
const mockSetupEventListeners = setupEventListeners as ReturnType<typeof vi.fn>;
const mockGetWorkflowState = artifactApi.getWorkflowState as ReturnType<typeof vi.fn>;

describe('WorkflowVisualizerContainer', () => {
  const mockWorkflowState: WorkflowState = {
    currentPhase: 'planning',
    completedArtifacts: [],
  };

  const fullyInitializedProject: Project = {
    name: 'Test Project',
    path: '/test/project',
    state: 'fully-initialized',
    config: null,
    agents: [],
  };

  const uninitializedProject: Project = {
    name: 'Uninitialized',
    path: '/test/uninitialized',
    state: 'empty',
    config: null,
    agents: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkflowState();
    currentProject.set(null);
    mockInvoke.mockResolvedValue(undefined);
    mockSetupEventListeners.mockResolvedValue([]);
    mockGetWorkflowState.mockResolvedValue(mockWorkflowState);
    // Suppress expected console output from watcher error tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    resetWorkflowState();
    currentProject.set(null);
    vi.restoreAllMocks();
  });

  describe('conditional rendering', () => {
    // P0: Test renders only for fully-initialized projects
    it('renders content only for fully-initialized projects', async () => {
      currentProject.set(fullyInitializedProject);
      workflowState.set(mockWorkflowState);

      render(WorkflowVisualizerContainer);

      // Should render workflow phases
      await waitFor(() => {
        expect(screen.getByText('Planning')).toBeInTheDocument();
      });
    });

    // P0: Test does not render for uninitialized projects
    it('does not render for uninitialized projects', () => {
      currentProject.set(uninitializedProject);

      const { container } = render(WorkflowVisualizerContainer);

      // Should not render any content
      expect(container.querySelector('.border-b')).not.toBeInTheDocument();
    });

    // P0: Test does not render when no project
    it('does not render when project is null', () => {
      currentProject.set(null);

      const { container } = render(WorkflowVisualizerContainer);

      expect(container.querySelector('.border-b')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    // P0: Test loading spinner
    it('shows loading spinner when loading and no workflow state', async () => {
      currentProject.set(fullyInitializedProject);
      workflowLoading.set(true);
      workflowState.set(null);

      render(WorkflowVisualizerContainer);

      expect(screen.getByText('Loading workflow state...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    // P0: Test shows workflow when loaded
    it('shows workflow visualizer when state is loaded', async () => {
      currentProject.set(fullyInitializedProject);
      workflowLoading.set(false);
      workflowState.set(mockWorkflowState);

      render(WorkflowVisualizerContainer);

      await waitFor(() => {
        expect(screen.getByText('Planning')).toBeInTheDocument();
        expect(screen.queryByText('Loading workflow state...')).not.toBeInTheDocument();
      });
    });
  });

  describe('error state', () => {
    // P0: Test error message display
    it('shows error message when error and no workflow state', async () => {
      currentProject.set(fullyInitializedProject);
      workflowLoading.set(false);
      workflowError.set('Failed to load workflow');
      workflowState.set(null);

      render(WorkflowVisualizerContainer);

      expect(screen.getByText('Failed to load workflow')).toBeInTheDocument();
    });

    // P1: Test retry button
    it('shows retry button on error', async () => {
      currentProject.set(fullyInitializedProject);
      workflowLoading.set(false);
      workflowError.set('Network error');
      workflowState.set(null);

      render(WorkflowVisualizerContainer);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    // P1: Test retry button calls refreshWorkflowState
    it('retry button triggers workflow refresh', async () => {
      currentProject.set(fullyInitializedProject);
      workflowLoading.set(false);
      workflowError.set('Network error');
      workflowState.set(null);

      render(WorkflowVisualizerContainer);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await fireEvent.click(retryButton);

      // Should have called getWorkflowState
      expect(mockGetWorkflowState).toHaveBeenCalled();
    });
  });

  describe('project change handling', () => {
    // P1: Test refreshWorkflowState on project change
    it('refreshes workflow state when project changes', async () => {
      const { rerender } = render(WorkflowVisualizerContainer);

      // Initial state with no project
      currentProject.set(null);
      await new Promise((r) => setTimeout(r, 0));

      // Change to a fully initialized project
      currentProject.set(fullyInitializedProject);

      // Wait for effect to trigger
      await waitFor(() => {
        expect(mockGetWorkflowState).toHaveBeenCalledWith('/test/project');
      });
    });

    // P1: Test resetWorkflowState when project becomes null
    it('resets workflow state when project becomes null', async () => {
      // Start with a project
      currentProject.set(fullyInitializedProject);
      workflowState.set(mockWorkflowState);

      render(WorkflowVisualizerContainer);

      // Set project to null
      currentProject.set(null);

      await waitFor(() => {
        expect(get(workflowState)).toBeNull();
      });
    });
  });

  describe('watcher integration', () => {
    // P1: Test watcher error indicator
    it('shows watcher error indicator when watcher has error', async () => {
      // Make start_file_watcher fail
      mockInvoke.mockImplementation((command: string) => {
        if (command === 'start_file_watcher') {
          return Promise.reject(new Error('Watch path not found'));
        }
        return Promise.resolve();
      });

      currentProject.set(fullyInitializedProject);
      workflowState.set(mockWorkflowState);

      render(WorkflowVisualizerContainer);

      // Wait for watcher to fail and indicator to appear
      await waitFor(
        () => {
          // Should show warning indicator
          const warningIndicator = document.querySelector('[title*="File watcher inactive"]');
          expect(warningIndicator).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    // P2: Test startWatcher call
    it('starts file watcher for fully initialized project', async () => {
      // Reset mock to default behavior
      mockInvoke.mockResolvedValue(undefined);

      currentProject.set(fullyInitializedProject);
      workflowState.set(mockWorkflowState);

      render(WorkflowVisualizerContainer);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('start_file_watcher', {
          windowLabel: 'test-window',
          projectPath: '/test/project',
        });
      });
    });

    // P2: Test cleanupWatcher on destroy
    it('stops file watcher on component destroy', async () => {
      // Reset mock to default behavior
      mockInvoke.mockResolvedValue(undefined);

      currentProject.set(fullyInitializedProject);
      workflowState.set(mockWorkflowState);

      const { unmount } = render(WorkflowVisualizerContainer);

      // Wait for initial setup
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('start_file_watcher', expect.anything());
      });

      // Clear calls to track new ones
      mockInvoke.mockClear();

      // Unmount
      unmount();

      // Should call stop with window label
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stop_file_watcher', {
          windowLabel: 'test-window',
        });
      });
    });
  });

  describe('fallback state', () => {
    // P2: Test fallback unavailable state
    it('shows unavailable message when no state, not loading, no error', async () => {
      currentProject.set(fullyInitializedProject);
      workflowLoading.set(false);
      workflowError.set(null);
      workflowState.set(null);

      render(WorkflowVisualizerContainer);

      await waitFor(() => {
        expect(screen.getByText('Workflow state unavailable')).toBeInTheDocument();
      });
    });
  });
});
