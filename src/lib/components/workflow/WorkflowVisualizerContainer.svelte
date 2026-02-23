<script lang="ts">
  import { onDestroy } from 'svelte';
  import WorkflowVisualizer from './WorkflowVisualizer.svelte';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import { currentProject } from '$lib/stores/project';
  import {
    workflowState,
    workflowLoading,
    workflowError,
    refreshWorkflowState,
    resetWorkflowState,
  } from '$lib/stores/workflow';
  import { openCommandPalette } from '$lib/stores/ui';
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

  // Watch for project changes and refresh workflow state
  // This handles both initial mount (lastProjectPath starts null) and subsequent changes
  // Note: File watcher is managed at the page level (+page.svelte)
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
    // Clean up previous listeners first
    await cleanupListeners();

    lastProjectPath = projectPath;

    if (projectPath && project?.state === 'fully-initialized') {
      refreshWorkflowState(projectPath);
      // Set up event listeners for workflow refresh
      // (file watcher is managed at page level)
      await setupListeners(projectPath);
    } else {
      resetWorkflowState();
    }
  }

  /**
   * Sets up event listeners that trigger workflow refresh.
   * The file watcher is started by +page.svelte at the page level.
   */
  async function setupListeners(projectPath: string) {
    try {
      const handlers: EventHandlers = {
        onWorkflowStateChanged: () => {
          refreshWorkflowState(projectPath);
        },
        onArtifactModified: () => {
          refreshWorkflowState(projectPath);
        },
        onStoryStatusChanged: () => {
          // Also refresh workflow when story status changes
          // (sprint status affects workflow phase detection)
          refreshWorkflowState(projectPath);
        },
        onWatcherError: (message: string) => {
          console.error('File watcher error:', message);
        },
      };

      eventUnlisteners = await setupEventListeners(handlers);
    } catch (err) {
      console.warn('Failed to set up event listeners:', err);
    }
  }

  /**
   * Cleans up event listeners.
   */
  async function cleanupListeners(): Promise<void> {
    eventUnlisteners.forEach((unlisten) => unlisten());
    eventUnlisteners = [];
  }

  // Cleanup on component destroy
  onDestroy(() => {
    cleanupListeners();
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
      <WorkflowVisualizer workflowState={workflow} />
    {:else}
      <!-- Fallback: no state yet, not loading, no error -->
      <div class="py-6">
        <EmptyState
          icon="workflow"
          title="Workflow state unavailable"
          description="The project may not have any BMAD artifacts yet. Start a workflow to begin."
          actionLabel="Open Command Palette"
          onAction={() => openCommandPalette()}
        />
      </div>
    {/if}
  </div>
{/if}
