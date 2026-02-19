<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onDestroy } from 'svelte';
  import WorkflowVisualizer from './WorkflowVisualizer.svelte';
  import { currentProject } from '$lib/stores/project';
  import {
    workflowState,
    workflowLoading,
    workflowError,
    refreshWorkflowState,
    resetWorkflowState,
  } from '$lib/stores/workflow';
  import { setupEventListeners, type EventHandlers } from '$lib/services/events';
  import type { UnlistenFn } from '@tauri-apps/api/event';

  // Reactive store access
  let project = $derived($currentProject);
  let workflow = $derived($workflowState);
  let loading = $derived($workflowLoading);
  let error = $derived($workflowError);

  // Track the last project path to detect changes
  let lastProjectPath: string | null = null;

  // Store cleanup functions for event listeners
  let eventUnlisteners: UnlistenFn[] = [];

  // Track watcher status for UI indication
  let watcherActive = $state(false);
  let watcherError: string | null = $state(null);

  // Watch for project changes and refresh workflow state
  // This handles both initial mount (lastProjectPath starts null) and subsequent changes
  $effect(() => {
    const projectPath = project?.path ?? null;

    if (projectPath !== lastProjectPath) {
      // Handle project change asynchronously to properly await cleanup
      handleProjectChange(projectPath);
    }
  });

  /**
   * Handles project changes with proper async cleanup.
   */
  async function handleProjectChange(projectPath: string | null) {
    // Clean up previous watcher and listeners first
    await cleanupWatcher();

    lastProjectPath = projectPath;

    if (projectPath && project?.state === 'fully-initialized') {
      refreshWorkflowState(projectPath);
      // Start file watcher for the new project
      await startWatcher(projectPath);
    } else {
      resetWorkflowState();
    }
  }

  /**
   * Starts the file watcher and sets up event listeners for a project.
   */
  async function startWatcher(projectPath: string) {
    watcherError = null;

    try {
      // Start the Rust file watcher
      await invoke('start_file_watcher', { project_path: projectPath });
      watcherActive = true;

      // Set up event listeners that trigger workflow refresh
      const handlers: EventHandlers = {
        onWorkflowStateChanged: () => {
          refreshWorkflowState(projectPath);
        },
        onArtifactModified: () => {
          refreshWorkflowState(projectPath);
        },
        onStoryStatusChanged: () => {
          refreshWorkflowState(projectPath);
        },
        onWatcherError: (message: string) => {
          console.error('File watcher error:', message);
          watcherError = message;
          watcherActive = false;
        },
      };

      eventUnlisteners = await setupEventListeners(handlers);
    } catch (err) {
      // Log and set error state - user should know watching isn't working
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn('Failed to start file watcher:', errorMessage);
      watcherError = errorMessage;
      watcherActive = false;
    }
  }

  /**
   * Cleans up the file watcher and event listeners.
   * Returns a promise that resolves when cleanup is complete.
   */
  async function cleanupWatcher(): Promise<void> {
    watcherActive = false;
    watcherError = null;

    // Remove event listeners first
    eventUnlisteners.forEach((unlisten) => unlisten());
    eventUnlisteners = [];

    // Stop the Rust file watcher and wait for it
    try {
      await invoke('stop_file_watcher');
    } catch (err) {
      console.warn('Failed to stop file watcher:', err);
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    // Fire and forget - component is being destroyed anyway
    cleanupWatcher();
  });

  function handleRetry() {
    if (project?.path) {
      refreshWorkflowState(project.path);
    }
  }
</script>

{#if project?.state === 'fully-initialized'}
  <div class="border-b border-gray-800 bg-gray-900/50">
    {#if loading && !workflow}
      <!-- Initial loading state -->
      <div class="h-20 flex items-center justify-center">
        <div class="flex items-center gap-2 text-gray-400">
          <div class="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
          <span class="text-sm">Loading workflow state...</span>
        </div>
      </div>
    {:else if error && !workflow}
      <!-- Error state -->
      <div class="h-20 flex items-center justify-center">
        <div class="flex flex-col items-center gap-2">
          <p class="text-red-400 text-sm">{error}</p>
          <button
            onclick={handleRetry}
            class="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    {:else if workflow}
      <!-- Workflow visualizer -->
      <div class="relative">
        <WorkflowVisualizer workflowState={workflow} />
        {#if watcherError}
          <!-- Watcher error indicator -->
          <div class="absolute top-1 right-1" title="File watcher inactive: {watcherError}">
            <span class="text-yellow-500 text-xs">⚠</span>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Fallback: no state yet, not loading, no error -->
      <div class="h-20 flex items-center justify-center">
        <p class="text-gray-500 text-sm">Workflow state unavailable</p>
      </div>
    {/if}
  </div>
{/if}
