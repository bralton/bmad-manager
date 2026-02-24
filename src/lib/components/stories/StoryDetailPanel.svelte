<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { KANBAN_COLUMNS, type Story, type Epic } from '$lib/types/stories';
  import { currentProject } from '$lib/stores/project';
  import { worktreesByStory, worktreeCreating, setWorktreeCreating, refreshWorktrees } from '$lib/stores/worktrees';
  import { conflictSummaries } from '$lib/stores/conflicts';
  import { showSuccessToast, showErrorToast } from '$lib/stores/ui';
  import { worktreeApi, parseWorktreeError } from '$lib/services/worktrees';
  import { openWorktreeInNewWindow } from '$lib/services/windows';
  import WorktreeCleanupDialog from './WorktreeCleanupDialog.svelte';
  import MergeDialog from './MergeDialog.svelte';
  import ConflictWarningBanner from '$lib/components/conflicts/ConflictWarningBanner.svelte';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';

  let {
    story,
    epic,
    onClose,
  }: {
    story: Story;
    epic: Epic | null | undefined;
    onClose: () => void;
  } = $props();

  // Get worktree for this story
  let worktree = $derived($worktreesByStory.get(story.id));
  let isCreating = $derived($worktreeCreating.get(story.id) ?? false);

  // Get conflict summary for this story using displayId (e.g., "4-3")
  let displayId = $derived.by(() => {
    if (story.subStoryNumber != null) {
      return `${story.epicId}-${story.storyNumber}-${story.subStoryNumber}`;
    }
    return `${story.epicId}-${story.storyNumber}`;
  });
  let conflictSummary = $derived($conflictSummaries.get(displayId));
  let hasConflicts = $derived(conflictSummary != null && conflictSummary.conflictCount > 0);

  // Dialog states
  let showCleanupDialog = $state(false);
  let showMergeDialog = $state(false);

  // Highlight cleanup button when story is done (AC #6)
  let isDone = $derived(story.status === 'done');

  // Convert slug to readable title
  let title = $derived.by(() => {
    return story.slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Get column config for status styling
  let columnConfig = $derived(
    KANBAN_COLUMNS.find((c) => c.status === story.status) || KANBAN_COLUMNS[0]
  );

  // Get epic status display
  let epicStatusLabel = $derived.by(() => {
    if (!epic) return 'Unknown';
    switch (epic.status) {
      case 'done':
        return 'Done';
      case 'in-progress':
        return 'In Progress';
      case 'backlog':
      default:
        return 'Backlog';
    }
  });

  // Panel and focus trap references
  let panelRef: HTMLElement | null = null;
  let closeButtonRef: HTMLButtonElement | null = null;

  /**
   * Gets all focusable elements within the panel for focus trapping.
   */
  function getFocusableElements(): HTMLElement[] {
    if (!panelRef) return [];
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(panelRef.querySelectorAll<HTMLElement>(selector));
  }

  /**
   * Handles keyboard events for Escape to close and Tab for focus trap.
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // 5-5: Panel has precedence per AC14 - close even if terminal could receive ESC
      onClose();
      return;
    }

    // Focus trap: cycle focus within the panel
    if (event.key === 'Tab') {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  onMount(() => {
    // Add keyboard listener for escape and focus trap
    window.addEventListener('keydown', handleKeyDown);
    // Focus the close button when panel opens
    closeButtonRef?.focus();
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  // Handle backdrop click
  function handleBackdropClick(event: MouseEvent) {
    // Only close if clicking on the backdrop itself, not the panel
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  async function handleCreateWorktree() {
    const project = get(currentProject);
    if (!project) {
      showErrorToast('No project loaded');
      return;
    }

    setWorktreeCreating(story.id, true);

    try {
      const createdWorktree = await worktreeApi.createWorktree(project.path, {
        storyId: story.id,
        storySlug: story.slug,
      });

      showSuccessToast(`Worktree created: ${createdWorktree.branch}`, {
        duration: 4000,
        action: {
          label: 'Open Window',
          onClick: async () => {
            try {
              await openWorktreeInNewWindow(createdWorktree.path);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              showErrorToast(`Failed to open window: ${message}`);
            }
          },
        },
      });

      // Refresh worktrees to update the store
      await refreshWorktrees(project.path);
    } catch (error) {
      const message = parseWorktreeError(error);
      showErrorToast(message);
    } finally {
      setWorktreeCreating(story.id, false);
    }
  }

  async function handleOpenInNewWindow() {
    if (!worktree) {
      showErrorToast('No worktree to open');
      return;
    }

    try {
      await openWorktreeInNewWindow(worktree.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showErrorToast(`Failed to open window: ${message}`);
    }
  }

  function handleMergeToProject() {
    showMergeDialog = true;
  }

  function handleCloseMergeDialog() {
    showMergeDialog = false;
  }

  function handleCleanUpWorktree() {
    showCleanupDialog = true;
  }

  function handleCloseCleanupDialog() {
    showCleanupDialog = false;
  }
</script>

<!-- Backdrop -->
<div
  class="fixed inset-0 bg-black/50 z-40"
  onclick={handleBackdropClick}
  role="presentation"
>
  <!-- Panel -->
  <div
    bind:this={panelRef}
    class="fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-700 shadow-xl z-50
      transform transition-transform duration-200"
    role="dialog"
    aria-modal="true"
    aria-labelledby="story-detail-title"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-700">
      <h2 id="story-detail-title" class="text-lg font-semibold text-white truncate pr-2">
        Story {displayId}
      </h2>
      <button
        bind:this={closeButtonRef}
        onclick={onClose}
        class="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
        aria-label="Close detail panel"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-4 overflow-y-auto h-[calc(100%-60px)]">
      <!-- Conflict Warning Banner -->
      {#if hasConflicts && conflictSummary}
        <ConflictWarningBanner conflicts={conflictSummary.conflicts} />
      {/if}

      <!-- Title -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Title</h3>
        <p class="text-white text-sm">{title}</p>
      </div>

      <!-- Status -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Status</h3>
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            border {columnConfig.borderColor} {columnConfig.textColor}"
        >
          {columnConfig.label}
        </span>
      </div>

      <!-- Epic Info -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Epic</h3>
        <div class="text-sm">
          <span class="text-white">Epic {story.epicId}</span>
          {#if epic}
            <span class="text-gray-400 ml-2">({epicStatusLabel})</span>
          {/if}
        </div>
      </div>

      <!-- Story ID -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Full ID</h3>
        <p class="text-white font-mono text-sm">{story.id}</p>
      </div>

      <!-- Worktree Section -->
      <div class="pt-4 border-t border-gray-700">
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Worktree</h3>

        {#if isCreating}
          <div class="flex items-center gap-2 text-indigo-300 text-sm">
            <svg
              class="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Creating worktree...</span>
          </div>
        {:else if worktree}
          <!-- Worktree exists -->
          <div class="space-y-3">
            <div class="text-sm">
              <div class="text-gray-400 mb-1">Path:</div>
              <div class="text-white font-mono text-xs bg-gray-900 p-2 rounded break-all">
                {worktree.path}
              </div>
            </div>
            <div class="text-sm">
              <div class="text-gray-400 mb-1">Branch:</div>
              <div class="text-indigo-300 font-mono text-xs">
                {worktree.branch}
              </div>
            </div>
            <div class="flex flex-col gap-2 mt-3">
              <button
                onclick={handleOpenInNewWindow}
                class="w-full px-3 py-2 text-sm rounded bg-indigo-600 text-white
                  hover:bg-indigo-500 transition-colors"
              >
                Open in New Window
              </button>
              <button
                onclick={handleMergeToProject}
                class="w-full px-3 py-2 text-sm rounded bg-emerald-600 text-white
                  hover:bg-emerald-500 transition-colors"
              >
                Merge to Project
              </button>
              <button
                onclick={handleCleanUpWorktree}
                class="w-full px-3 py-2 text-sm rounded transition-colors
                  {isDone
                    ? 'bg-yellow-600/20 text-yellow-200 border border-yellow-600/50 hover:bg-yellow-600/30'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'}"
              >
                Clean Up Worktree
              </button>
            </div>
          </div>
        {:else}
          <!-- No worktree -->
          <div class="text-sm">
            <EmptyState
              icon="branch"
              title="No worktree"
              description="Worktrees let you work on this story in an isolated branch without affecting your main working directory."
            />
            <button
              onclick={handleCreateWorktree}
              class="w-full px-3 py-2 text-sm rounded bg-indigo-600 text-white
                hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Worktree
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Merge dialog -->
{#if showMergeDialog && worktree}
  <MergeDialog
    {story}
    {worktree}
    onClose={handleCloseMergeDialog}
  />
{/if}

<!-- Cleanup dialog -->
{#if showCleanupDialog && worktree}
  <WorktreeCleanupDialog
    {story}
    {worktree}
    onClose={handleCloseCleanupDialog}
  />
{/if}
