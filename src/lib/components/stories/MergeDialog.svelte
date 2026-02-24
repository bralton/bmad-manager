<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { currentProject } from '$lib/stores/project';
  import { refreshWorktrees } from '$lib/stores/worktrees';
  import { showSuccessToast, showErrorToast } from '$lib/stores/ui';
  import { mergeApi, parseMergeError } from '$lib/services/worktrees';
  import type { Story } from '$lib/types/stories';
  import type { Worktree, MergeResult } from '$lib/types/worktree';

  let {
    story,
    worktree,
    onClose,
  }: {
    story: Story;
    worktree: Worktree;
    onClose: () => void;
  } = $props();

  // Dialog states
  type DialogState = 'confirm' | 'progress' | 'success' | 'conflict' | 'error';
  let dialogState: DialogState = $state('confirm');

  // Data
  let targetBranch: string | null = $state(null);
  let mergeResult: MergeResult | null = $state(null);
  let errorMessage: string | null = $state(null);
  let loadingBranch = $state(true);

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

  // Load target branch on mount
  onMount(async () => {
    const project = get(currentProject);
    if (!project) {
      errorMessage = 'No project loaded';
      dialogState = 'error';
      return;
    }

    try {
      targetBranch = await mergeApi.getMainRepoBranch(project.path);
    } catch (error) {
      errorMessage = parseMergeError(error);
      dialogState = 'error';
    } finally {
      loadingBranch = false;
    }
  });

  async function handleMerge() {
    const project = get(currentProject);
    if (!project) {
      showErrorToast('No project loaded');
      return;
    }

    dialogState = 'progress';

    try {
      const result = await mergeApi.mergeWorktreeBranch(
        project.path,
        worktree.branch,
        displayId
      );

      mergeResult = result;

      if (result.success) {
        dialogState = 'success';
        showSuccessToast(`Merged ${worktree.branch}`, {
          icon: '✅',
          duration: 4000,
        });
      } else if (result.conflicts.length > 0) {
        dialogState = 'conflict';
      } else {
        // Unexpected failure without conflicts
        errorMessage = result.message;
        dialogState = 'error';
      }
    } catch (error) {
      errorMessage = parseMergeError(error);
      dialogState = 'error';
      showErrorToast(errorMessage, { duration: 5000 });
    }
  }

  async function handleCleanup() {
    const project = get(currentProject);
    if (!project) {
      showErrorToast('No project loaded');
      return;
    }

    dialogState = 'progress';

    try {
      await mergeApi.cleanupAfterMerge(project.path, worktree.path, worktree.branch);

      showSuccessToast('Worktree cleaned up', {
        icon: '🗑️',
        duration: 3000,
      });

      // Refresh worktrees store
      await refreshWorktrees(project.path);

      onClose();
    } catch (error) {
      const message = parseMergeError(error);
      showErrorToast(message, { duration: 5000 });
      // Go back to success state so user can try again or keep worktree
      dialogState = 'success';
    }
  }

  async function handleKeepWorktree() {
    const project = get(currentProject);
    if (project) {
      // Refresh worktrees to update state
      await refreshWorktrees(project.path);
    }
    onClose();
  }

  function handleRetry() {
    errorMessage = null;
    dialogState = 'confirm';
  }

  async function handleOpenInTerminal() {
    const project = get(currentProject);
    if (!project) {
      showErrorToast('No project loaded');
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_in_terminal', { dirPath: project.path });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showErrorToast(`Could not open terminal: ${message}`);
    }
    onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && dialogState !== 'progress') {
      onClose();
    }
  }

  // Dialog element reference for focus trap
  let dialogRef: HTMLElement | null = null;

  function getFocusableElements(): HTMLElement[] {
    if (!dialogRef) return [];
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(dialogRef.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !el.hasAttribute('disabled')
    );
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && dialogState !== 'progress') {
      // 5-5: Dialog has precedence per AC14 - close even if terminal could receive ESC
      onClose();
      return;
    }

    if (event.key === 'Tab') {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- Backdrop -->
<div
  class="fixed inset-0 bg-black/50 z-40"
  onclick={handleBackdropClick}
  role="presentation"
>
  <!-- Dialog -->
  <div
    bind:this={dialogRef}
    class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
      bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-md w-full mx-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="merge-dialog-title"
  >
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-700">
      <h2 id="merge-dialog-title" class="text-lg font-semibold text-white">
        {#if dialogState === 'success'}
          Merge Successful
        {:else if dialogState === 'conflict'}
          Conflicts Detected
        {:else if dialogState === 'error'}
          Merge Failed
        {:else}
          Merge to Project
        {/if}
      </h2>
    </div>

    <!-- Content -->
    <div class="px-6 py-4 space-y-4">
      {#if dialogState === 'confirm'}
        <!-- Confirmation state -->
        <div class="space-y-3">
          <div class="text-sm">
            <span class="text-gray-400">Story:</span>
            <span class="text-white ml-2">{displayId} - {title}</span>
          </div>

          <div class="text-sm">
            <span class="text-gray-400">Source branch:</span>
            <div class="text-indigo-300 font-mono text-xs mt-1">{worktree.branch}</div>
          </div>

          <div class="text-sm">
            <span class="text-gray-400">Target branch:</span>
            {#if loadingBranch}
              <div class="flex items-center gap-2 text-gray-400 text-xs mt-1">
                <div class="w-3 h-3 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
                <span>Loading...</span>
              </div>
            {:else if targetBranch}
              <div class="text-emerald-300 font-mono text-xs mt-1">{targetBranch}</div>
            {:else}
              <div class="text-red-400 text-xs mt-1">Unable to determine target branch</div>
            {/if}
          </div>

          <div class="bg-gray-800 rounded p-3 mt-4">
            <p class="text-gray-300 text-sm">
              This will merge <span class="text-indigo-300 font-mono">{worktree.branch}</span> into
              {#if targetBranch}
                <span class="text-emerald-300 font-mono">{targetBranch}</span>
              {:else}
                the current branch
              {/if}
              using a merge commit.
            </p>
          </div>
        </div>

      {:else if dialogState === 'progress'}
        <!-- Progress state -->
        <div class="flex flex-col items-center justify-center py-8 gap-4">
          <svg
            class="animate-spin h-8 w-8 text-indigo-400"
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
          <p class="text-gray-300 text-sm">
            Merging <span class="text-indigo-300 font-mono">{worktree.branch}</span> into
            <span class="text-emerald-300 font-mono">{targetBranch}</span>...
          </p>
        </div>

      {:else if dialogState === 'success'}
        <!-- Success state -->
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-900/50 flex items-center justify-center">
              <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p class="text-white font-medium">Merge completed successfully</p>
              {#if mergeResult?.mergeCommit}
                <p class="text-gray-400 text-sm">
                  Commit: <span class="font-mono text-indigo-300">{mergeResult.mergeCommit}</span>
                </p>
              {/if}
            </div>
          </div>

          <div class="bg-gray-800 rounded p-3">
            <p class="text-gray-300 text-sm">
              What would you like to do with the worktree?
            </p>
          </div>
        </div>

      {:else if dialogState === 'conflict'}
        <!-- Conflict state -->
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-900/50 flex items-center justify-center">
              <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p class="text-yellow-200 font-medium">Conflicts detected</p>
              <p class="text-yellow-300/80 text-sm mt-1">
                The merge cannot be completed automatically. Please resolve conflicts manually.
              </p>
            </div>
          </div>

          {#if mergeResult?.conflicts && mergeResult.conflicts.length > 0}
            <div class="bg-red-900/20 border border-red-600/50 rounded p-4">
              <p class="text-red-200 text-sm font-medium mb-2">Conflicting files:</p>
              <ul class="space-y-1 max-h-32 overflow-y-auto">
                {#each mergeResult.conflicts as file}
                  <li class="text-red-300 font-mono text-xs truncate" title={file}>
                    {file}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="bg-gray-800 rounded p-3">
            <p class="text-gray-300 text-sm">
              To resolve conflicts:
            </p>
            <ol class="text-gray-400 text-sm mt-2 list-decimal list-inside space-y-1">
              <li>Open a terminal in the main repository</li>
              <li>Run: <code class="text-indigo-300">git merge {worktree.branch}</code></li>
              <li>Resolve conflicts in each file</li>
              <li>Stage resolved files and commit</li>
            </ol>
          </div>
        </div>

      {:else if dialogState === 'error'}
        <!-- Error state -->
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center">
              <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p class="text-red-200 font-medium">Merge failed</p>
              <p class="text-red-300/80 text-sm mt-1">{errorMessage}</p>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
      {#if dialogState === 'confirm'}
        <button
          onclick={() => onClose()}
          class="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={handleMerge}
          disabled={loadingBranch || !targetBranch}
          class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Merge
        </button>

      {:else if dialogState === 'progress'}
        <!-- No buttons during progress -->

      {:else if dialogState === 'success'}
        <button
          onclick={handleKeepWorktree}
          class="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors"
        >
          Keep Worktree
        </button>
        <button
          onclick={handleCleanup}
          class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm
            transition-colors"
        >
          Clean Up Now
        </button>

      {:else if dialogState === 'conflict'}
        <button
          onclick={handleOpenInTerminal}
          class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm transition-colors"
        >
          Open in Terminal
        </button>
        <button
          onclick={() => onClose()}
          class="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors"
        >
          Close
        </button>

      {:else if dialogState === 'error'}
        <button
          onclick={() => onClose()}
          class="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors"
        >
          Close
        </button>
        <button
          onclick={handleRetry}
          class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm transition-colors"
        >
          Retry
        </button>
      {/if}
    </div>
  </div>
</div>
