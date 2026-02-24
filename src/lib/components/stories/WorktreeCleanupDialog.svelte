<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { currentProject } from '$lib/stores/project';
  import { refreshWorktrees } from '$lib/stores/worktrees';
  import { showSuccessToast, showErrorToast } from '$lib/stores/ui';
  import { worktreeApi, parseWorktreeError } from '$lib/services/worktrees';
  import type { Story } from '$lib/types/stories';
  import type { Worktree, CleanupMode } from '$lib/types/worktree';

  let {
    story,
    worktree,
    onClose,
  }: {
    story: Story;
    worktree: Worktree;
    onClose: () => void;
  } = $props();

  // State
  let cleanupMode = $state<CleanupMode>('worktree-only');
  let isLoading = $state(false);
  let isDirty = $state(false);
  let dirtyFiles = $state<string[]>([]);
  let checkingDirty = $state(true);

  // Derived values
  let displayId = $derived.by(() => {
    if (story.subStoryNumber != null) {
      return `${story.epicId}-${story.storyNumber}-${story.subStoryNumber}`;
    }
    return `${story.epicId}-${story.storyNumber}`;
  });

  let title = $derived.by(() => {
    return story.slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  let buttonText = $derived(isDirty ? 'Force Remove' : 'Remove');

  onMount(async () => {
    try {
      // Check if worktree is dirty
      isDirty = await worktreeApi.isWorktreeDirty(worktree.path);
      if (isDirty) {
        dirtyFiles = await worktreeApi.getDirtyFiles(worktree.path);
      }
    } catch (error) {
      console.error('Failed to check worktree status:', error);
    } finally {
      checkingDirty = false;
    }
  });

  async function handleCleanup() {
    const project = get(currentProject);
    if (!project) {
      showErrorToast('No project loaded');
      return;
    }

    isLoading = true;

    try {
      await worktreeApi.cleanupWorktree(
        project.path,
        worktree.path,
        cleanupMode === 'worktree-and-branch',
        isDirty // force if dirty
      );

      showSuccessToast(`Worktree removed: ${worktree.branch}`, {
        icon: '🗑️',
        duration: 3000,
      });

      // Refresh worktrees to update store
      await refreshWorktrees(project.path);

      onClose();
    } catch (error) {
      const message = parseWorktreeError(error);
      showErrorToast(message, { duration: 5000 });
    } finally {
      isLoading = false;
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && !isLoading) {
      onClose();
    }
  }

  // Dialog element reference for focus trap
  let dialogRef: HTMLElement | null = null;

  /**
   * Gets all focusable elements within the dialog for focus trapping.
   */
  function getFocusableElements(): HTMLElement[] {
    if (!dialogRef) return [];
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(dialogRef.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !el.hasAttribute('disabled')
    );
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !isLoading) {
      // 5-5: Dialog has precedence per AC14 - close even if terminal could receive ESC
      onClose();
      return;
    }

    // Focus trap: cycle focus within the dialog
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
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- Backdrop (z-40 per UX spec) -->
<div
  class="fixed inset-0 bg-black/50 z-40"
  onclick={handleBackdropClick}
  role="presentation"
>
  <!-- Dialog (z-50 per UX spec) -->
  <div
    bind:this={dialogRef}
    class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
      bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-md w-full mx-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cleanup-dialog-title"
  >
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-700">
      <h2 id="cleanup-dialog-title" class="text-lg font-semibold text-white">
        Clean Up Worktree
      </h2>
    </div>

    <!-- Content -->
    <div class="px-6 py-4 space-y-4">
      <!-- Story info -->
      <div class="space-y-2">
        <div class="text-sm">
          <span class="text-gray-400">Story:</span>
          <span class="text-white ml-2">{displayId} - {title}</span>
        </div>
        <div class="text-sm">
          <span class="text-gray-400">Path:</span>
          <div class="text-white font-mono text-xs bg-gray-800 p-2 rounded mt-1 break-all">
            {worktree.path}
          </div>
        </div>
        <div class="text-sm">
          <span class="text-gray-400">Branch:</span>
          <span class="text-indigo-300 font-mono text-xs ml-2">{worktree.branch}</span>
        </div>
      </div>

      <!-- Dirty warning banner -->
      {#if checkingDirty}
        <div class="flex items-center gap-2 text-gray-400 text-sm">
          <div class="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
          <span>Checking for uncommitted changes...</span>
        </div>
      {:else if isDirty}
        <div class="bg-yellow-900/20 border border-yellow-600/50 rounded p-4">
          <div class="flex items-start gap-2">
            <span class="text-yellow-500 text-lg flex-shrink-0">⚠️</span>
            <div class="flex-1">
              <p class="text-yellow-200 text-sm font-medium">
                This worktree has uncommitted changes
              </p>
              <p class="text-yellow-300/80 text-xs mt-1">
                The following changes will be lost:
              </p>
              <ul class="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
                {#each dirtyFiles as file}
                  <li class="text-yellow-300/70 font-mono text-xs truncate" title={file}>
                    {file}
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        </div>
      {/if}

      <!-- Cleanup mode options -->
      <div class="space-y-2">
        <label class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-800 transition-colors">
          <input
            type="radio"
            name="cleanup-mode"
            value="worktree-only"
            bind:group={cleanupMode}
            disabled={isLoading}
            class="text-indigo-600 focus:ring-indigo-500 bg-gray-700 border-gray-600"
          />
          <div>
            <span class="text-white text-sm">Remove worktree only</span>
            <p class="text-gray-400 text-xs">Keep the branch for future use</p>
          </div>
        </label>

        <label class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-800 transition-colors">
          <input
            type="radio"
            name="cleanup-mode"
            value="worktree-and-branch"
            bind:group={cleanupMode}
            disabled={isLoading}
            class="text-indigo-600 focus:ring-indigo-500 bg-gray-700 border-gray-600"
          />
          <div>
            <span class="text-white text-sm">Remove worktree and delete branch</span>
            <p class="text-gray-400 text-xs">Clean up completely</p>
          </div>
        </label>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
      <button
        onclick={() => onClose()}
        disabled={isLoading}
        class="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        onclick={handleCleanup}
        disabled={isLoading || checkingDirty}
        class="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center gap-2"
      >
        {#if isLoading}
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
          <span>Removing...</span>
        {:else}
          <span>{buttonText}</span>
        {/if}
      </button>
    </div>
  </div>
</div>
