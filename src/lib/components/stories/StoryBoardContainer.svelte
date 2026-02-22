<script lang="ts">
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import StoryBoard from './StoryBoard.svelte';
  import StoryDetailPanel from './StoryDetailPanel.svelte';
  import WorktreeCleanupDialog from './WorktreeCleanupDialog.svelte';
  import { currentProject } from '$lib/stores/project';
  import {
    sprintStatus,
    sprintStatusLoading,
    sprintStatusError,
    selectedStoryId,
    refreshSprintStatus,
    resetSprintStatus,
  } from '$lib/stores/stories';
  import { validateAndRefreshWorktrees, resetWorktrees, worktreesByStory } from '$lib/stores/worktrees';
  import { showToast, type ToastAction } from '$lib/stores/ui';
  import { setupEventListeners, type EventHandlers } from '$lib/services/events';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import type { Story } from '$lib/types/stories';
  import type { Worktree } from '$lib/types/worktree';

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

  // Track previous story statuses to detect transitions to "done"
  let previousStatusMap = new Map<string, string>();

  // State for cleanup prompt dialog (triggered by story completion toast action)
  let cleanupPromptStory = $state<Story | null>(null);
  let cleanupPromptWorktree = $state<Worktree | null>(null);

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
    // Clear previous status map on project change to avoid stale data
    previousStatusMap.clear();

    lastProjectPath = projectPath;

    if (projectPath && project?.state === 'fully-initialized') {
      await refreshSprintStatus(projectPath);
      // Initialize previousStatusMap with current statuses to prevent spurious toasts
      // This ensures stories already "done" don't trigger cleanup prompts on initial load
      const currentStatus = get(sprintStatus);
      if (currentStatus) {
        for (const story of currentStatus.stories) {
          previousStatusMap.set(story.id, story.status);
        }
      }
      // Validate bindings and refresh worktrees on project load (AC #5)
      validateAndRefreshWorktrees(projectPath);
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
        onStoryStatusChanged: async () => {
          // Capture previous statuses before refresh
          const currentStatus = get(sprintStatus);
          if (currentStatus) {
            for (const story of currentStatus.stories) {
              previousStatusMap.set(story.id, story.status);
            }
          }

          // Refresh the sprint status
          await refreshSprintStatus(projectPath);

          // Check for stories that transitioned to "done" and have worktrees
          checkForCompletedStoriesWithWorktrees();
        },
      };

      eventUnlisteners = await setupEventListeners(handlers);
    } catch (err) {
      console.warn('Failed to set up story status listeners:', err);
    }
  }

  /**
   * Checks for stories that just transitioned to "done" and have worktrees.
   * Shows a toast prompting to clean up.
   */
  function checkForCompletedStoriesWithWorktrees() {
    const currentStatus = get(sprintStatus);
    const worktrees = get(worktreesByStory);

    if (!currentStatus) return;

    for (const story of currentStatus.stories) {
      const previousStatus = previousStatusMap.get(story.id);
      const currentStoryStatus = story.status;

      // Detect transition to "done" (from any non-done status)
      if (previousStatus !== 'done' && currentStoryStatus === 'done') {
        const worktree = worktrees.get(story.id);
        if (worktree) {
          showCleanupPromptToast(story, worktree);
        }
      }

      // Update the map for next check
      previousStatusMap.set(story.id, currentStoryStatus);
    }
  }

  /**
   * Shows a toast prompting to clean up a worktree for a completed story.
   * AC #1: Shows "Later" and "Clean Up" actions per spec.
   */
  function showCleanupPromptToast(story: Story, worktree: Worktree) {
    const displayId = story.subStoryNumber != null
      ? `${story.epicId}-${story.storyNumber}-${story.subStoryNumber}`
      : `${story.epicId}-${story.storyNumber}`;

    const action: ToastAction = {
      label: 'Clean Up',
      onClick: () => {
        cleanupPromptStory = story;
        cleanupPromptWorktree = worktree;
      },
    };

    const secondaryAction: ToastAction = {
      label: 'Later',
      onClick: () => {
        // Dismiss is handled by returning - toast auto-closes
      },
    };

    showToast(
      `Story ${displayId} completed! Worktree can be cleaned up.`,
      {
        icon: '✅',
        duration: 8000, // 8 seconds per UX spec
        variant: 'success',
        action,
        secondaryAction,
      }
    );
  }

  function handleCloseCleanupPrompt() {
    cleanupPromptStory = null;
    cleanupPromptWorktree = null;
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

<!-- Cleanup dialog triggered from story completion toast -->
{#if cleanupPromptStory && cleanupPromptWorktree}
  <WorktreeCleanupDialog
    story={cleanupPromptStory}
    worktree={cleanupPromptWorktree}
    onClose={handleCloseCleanupPrompt}
  />
{/if}
