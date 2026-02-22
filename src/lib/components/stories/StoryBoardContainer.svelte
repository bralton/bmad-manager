<script lang="ts">
  import { onDestroy } from 'svelte';
  import StoryBoard from './StoryBoard.svelte';
  import StoryDetailPanel from './StoryDetailPanel.svelte';
  import { currentProject } from '$lib/stores/project';
  import {
    sprintStatus,
    sprintStatusLoading,
    sprintStatusError,
    selectedStoryId,
    refreshSprintStatus,
    resetSprintStatus,
  } from '$lib/stores/stories';
  import { refreshWorktrees, resetWorktrees } from '$lib/stores/worktrees';
  import { setupEventListeners, type EventHandlers } from '$lib/services/events';
  import type { UnlistenFn } from '@tauri-apps/api/event';

  // Reactive store access
  let project = $derived($currentProject);
  let status = $derived($sprintStatus);
  let loading = $derived($sprintStatusLoading);
  let error = $derived($sprintStatusError);
  let selectedId = $derived($selectedStoryId);

  // Track the last project path to detect changes
  let lastProjectPath: string | null = null;

  // Store cleanup functions for event listeners
  let eventUnlisteners: UnlistenFn[] = [];

  // Watch for project changes and refresh sprint status
  $effect(() => {
    const projectPath = project?.path ?? null;

    if (projectPath !== lastProjectPath) {
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
      refreshSprintStatus(projectPath);
      refreshWorktrees(projectPath);
      // Set up event listeners for sprint status changes
      await setupListeners(projectPath);
    } else {
      resetSprintStatus();
      resetWorktrees();
    }
  }

  /**
   * Sets up event listeners for story status changes.
   */
  async function setupListeners(projectPath: string) {
    try {
      const handlers: EventHandlers = {
        onStoryStatusChanged: () => {
          refreshSprintStatus(projectPath);
        },
      };

      eventUnlisteners = await setupEventListeners(handlers);
    } catch (err) {
      console.warn('Failed to set up story status listeners:', err);
    }
  }

  /**
   * Cleans up event listeners.
   */
  async function cleanupListeners(): Promise<void> {
    if (eventUnlisteners) {
      eventUnlisteners.forEach((unlisten) => unlisten());
      eventUnlisteners = [];
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    cleanupListeners();
  });

  function handleRetry() {
    if (project?.path) {
      refreshSprintStatus(project.path);
    }
  }

  function handleCloseDetail() {
    selectedStoryId.set(null);
  }

  // Get the selected story from the current status
  let selectedStory = $derived(
    status && selectedId ? status.stories.find((s) => s.id === selectedId) : null
  );

  // Get epic for selected story
  let selectedEpic = $derived(
    status && selectedStory ? status.epics.find((e) => e.id === selectedStory.epicId) : null
  );
</script>

<div class="h-full flex flex-col bg-gray-900">
  {#if loading && !status}
    <!-- Initial loading state -->
    <div class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-2 text-gray-400">
        <div class="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
        <span class="text-sm">Loading sprint status...</span>
      </div>
    </div>
  {:else if error && !status}
    <!-- Error state -->
    <div class="flex-1 flex items-center justify-center">
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
  {:else if status && status.stories.length > 0}
    <!-- Story board with data -->
    <div class="flex-1 min-h-0 overflow-auto">
      <StoryBoard {status} />
    </div>

    <!-- Detail panel overlay -->
    {#if selectedStory}
      <StoryDetailPanel
        story={selectedStory}
        epic={selectedEpic}
        onClose={handleCloseDetail}
      />
    {/if}
  {:else if status && status.stories.length === 0}
    <!-- Empty state - no stories in sprint status -->
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center text-gray-400 max-w-md px-4">
        <p class="text-lg font-medium mb-2">No stories found</p>
        <p class="text-sm mb-4">
          Stories are loaded from sprint-status.yaml<br />
          in _bmad-output/implementation-artifacts/
        </p>
        <p class="text-sm text-gray-500">
          Make sure your project has BMAD<br />
          sprint status configured.
        </p>
      </div>
    </div>
  {:else}
    <!-- Fallback: no state yet, not loading, no error -->
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center text-gray-400 max-w-md px-4">
        <p class="text-lg font-medium mb-2">No stories found</p>
        <p class="text-sm mb-4">
          Stories are loaded from sprint-status.yaml<br />
          in _bmad-output/implementation-artifacts/
        </p>
        <p class="text-sm text-gray-500">
          Make sure your project has BMAD<br />
          sprint status configured.
        </p>
      </div>
    </div>
  {/if}
</div>
