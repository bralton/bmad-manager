<script lang="ts">
  /**
   * BugDetailPanel - Shows detailed bug information in a side panel.
   *
   * Story 5-15: Bugs on Story Board
   * Displays bug details when a bug card is clicked on the kanban board.
   */
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import type { Bug, BugContent } from '$lib/types/stories';
  import { currentProject } from '$lib/stores/project';
  import { storyApi } from '$lib/services/stories';
  import StoryContentSection from './StoryContentSection.svelte';

  let {
    bug,
    onClose,
  }: {
    bug: Bug;
    onClose: () => void;
  } = $props();

  // Bug content state
  let bugContent = $state<BugContent | null>(null);
  let contentLoading = $state(false);
  let contentError = $state<string | null>(null);
  let contentVisible = $state(false);

  // Track current fetch to prevent race conditions
  let currentFetchId = 0;

  // Track if this is a backlog bug (might still have file)
  let isBacklog = $derived(bug.status === 'backlog');

  // Track if file doesn't exist (set when load fails with "Failed to read file")
  let noFileExists = $state(false);

  // Convert slug to readable title
  let title = $derived.by(() => {
    // Use bug content title if available, otherwise derive from slug
    if (bugContent?.title) {
      return bugContent.title;
    }
    return bug.slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Get severity color
  let severityColor = $derived.by(() => {
    switch (bugContent?.severity?.toLowerCase()) {
      case 'critical':
        return 'text-red-400 border-red-400';
      case 'high':
        return 'text-orange-400 border-orange-400';
      case 'medium':
        return 'text-yellow-400 border-yellow-400';
      case 'low':
        return 'text-green-400 border-green-400';
      default:
        return 'text-gray-400 border-gray-400';
    }
  });

  // Get status color
  let statusColor = $derived.by(() => {
    switch (bug.status) {
      case 'done':
        return 'text-green-400 border-green-500';
      case 'review':
        return 'text-purple-400 border-purple-500';
      case 'in-progress':
        return 'text-blue-400 border-blue-500';
      case 'ready-for-dev':
        return 'text-yellow-400 border-yellow-500';
      default:
        return 'text-gray-400 border-gray-500';
    }
  });

  // Get status label
  let statusLabel = $derived.by(() => {
    switch (bug.status) {
      case 'ready-for-dev':
        return 'Ready';
      case 'in-progress':
        return 'In Progress';
      case 'review':
        return 'Review';
      case 'done':
        return 'Done';
      default:
        return 'Backlog';
    }
  });

  // Fetch bug content when panel opens - always try, even for backlog
  // Bug files may exist in backlog status unlike stories
  $effect(() => {
    if (bug.id) {
      fetchBugContent();
    }
  });

  async function fetchBugContent() {
    const project = get(currentProject);
    if (!project?.path) return;

    const fetchId = ++currentFetchId;

    contentLoading = true;
    contentError = null;
    bugContent = null;
    contentVisible = false;
    noFileExists = false;

    try {
      // Find the bug file path - bugs are stored like stories but with "bug-" prefix
      // Format: bug-{number}-{slug}.md
      const bugPath = `${project.path}/_bmad-output/implementation-artifacts/${bug.id}.md`;
      const content = await storyApi.getBugContent(bugPath);

      if (fetchId !== currentFetchId) return;

      if (content.error) {
        // Check if error indicates file doesn't exist
        if (content.error.includes('Failed to read file')) {
          noFileExists = true;
        } else {
          contentError = content.error;
        }
      } else {
        bugContent = content;
        requestAnimationFrame(() => {
          contentVisible = true;
        });
      }
    } catch (error) {
      if (fetchId !== currentFetchId) return;
      const errorMsg = error instanceof Error ? error.message : 'Failed to load bug content';
      if (errorMsg.includes('Failed to read file') || errorMsg.includes('No such file')) {
        noFileExists = true;
      } else {
        contentError = errorMsg;
      }
    } finally {
      if (fetchId === currentFetchId) {
        contentLoading = false;
      }
    }
  }

  function handleRetryContent() {
    fetchBugContent();
  }

  // Panel and focus trap references
  let panelRef: HTMLElement | null = null;
  let closeButtonRef: HTMLButtonElement | null = null;

  function getFocusableElements(): HTMLElement[] {
    if (!panelRef) return [];
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(panelRef.querySelectorAll<HTMLElement>(selector));
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
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

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef?.focus();
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
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
    aria-labelledby="bug-detail-title"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-700">
      <div class="flex items-center gap-2">
        <!-- Bug icon -->
        <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M6.56 1.14a.75.75 0 01.177 1.045 3.989 3.989 0 00-.464.86c.185.17.382.329.59.473A3.993 3.993 0 0110 2c1.272 0 2.405.594 3.137 1.518.208-.144.405-.302.59-.473a3.989 3.989 0 00-.464-.86.75.75 0 011.222-.869c.369.519.65 1.105.822 1.736a.75.75 0 01-.174.707 5.475 5.475 0 01-1.14.86 4.002 4.002 0 01-.673 2.149c.564.069 1.09.263 1.544.548a.75.75 0 11-.774 1.284 2.495 2.495 0 00-1.322-.387H7.232c-.476 0-.92.146-1.322.387a.75.75 0 01-.774-1.284c.453-.285.98-.479 1.544-.548a4.003 4.003 0 01-.673-2.15 5.475 5.475 0 01-1.14-.859.75.75 0 01-.174-.707c.172-.63.453-1.217.822-1.736a.75.75 0 011.045-.177zM10 4a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM5.75 10.5H5a.75.75 0 000 1.5h.75v1.25a.75.75 0 001.5 0V12h5.5v1.25a.75.75 0 001.5 0V12H15a.75.75 0 000-1.5h-.75V9.25a.75.75 0 00-1.5 0v1.25h-5.5V9.25a.75.75 0 00-1.5 0v1.25zM5.75 15H5a.75.75 0 000 1.5h.75v1.75a.75.75 0 001.5 0V16.5h5.5v1.75a.75.75 0 001.5 0V16.5H15a.75.75 0 000-1.5h-.75v-1.25a.75.75 0 00-1.5 0V15h-5.5v-1.25a.75.75 0 00-1.5 0V15z" clip-rule="evenodd" />
        </svg>
        <h2 id="bug-detail-title" class="text-lg font-semibold text-white truncate pr-2">
          BUG-{bug.bugNumber}
        </h2>
      </div>
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
      <!-- Title -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Title</h3>
        <p class="text-white text-sm">{title}</p>
      </div>

      <!-- Status -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Status</h3>
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border {statusColor}"
        >
          {statusLabel}
        </span>
      </div>

      <!-- Severity and Priority row -->
      {#if bugContent?.severity || bugContent?.priority}
        <div class="flex gap-4">
          {#if bugContent?.severity}
            <div>
              <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Severity</h3>
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border {severityColor}"
              >
                {bugContent.severity}
              </span>
            </div>
          {/if}
          {#if bugContent?.priority}
            <div>
              <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Priority</h3>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-500 text-gray-300">
                {bugContent.priority}
              </span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Reported info -->
      {#if bugContent?.reportedBy || bugContent?.reportedDate}
        <div class="flex gap-4">
          {#if bugContent?.reportedBy}
            <div>
              <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Reported By</h3>
              <p class="text-white text-sm">{bugContent.reportedBy}</p>
            </div>
          {/if}
          {#if bugContent?.reportedDate}
            <div>
              <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Date</h3>
              <p class="text-white text-sm">{bugContent.reportedDate}</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Related Stories -->
      {#if bugContent?.relatedStories && bugContent.relatedStories.length > 0}
        <div>
          <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Related Stories</h3>
          <div class="flex flex-wrap gap-1">
            {#each bugContent.relatedStories as storyId}
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-700 text-gray-300">
                {storyId}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Full ID -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Full ID</h3>
        <p class="text-white font-mono text-sm">{bug.id}</p>
      </div>

      <!-- Bug Content Section -->
      <div class="pt-4 border-t border-gray-700">
        {#if noFileExists}
          <!-- Bug file doesn't exist yet -->
          <div class="text-center py-6">
            <svg class="w-8 h-8 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-gray-400 text-sm">Bug file not yet created</p>
            <p class="text-gray-500 text-xs mt-1">{isBacklog ? 'This bug is in the backlog.' : 'Create a bug file to add details.'}</p>
          </div>
        {:else if contentLoading}
          <!-- Loading state -->
          <div class="flex items-center justify-center py-8">
            <svg
              class="animate-spin h-6 w-6 text-red-400"
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
            <span class="ml-2 text-gray-400 text-sm">Loading bug details...</span>
          </div>
        {:else if contentError}
          <!-- Error state with retry -->
          <div class="text-center py-6">
            <svg class="w-8 h-8 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p class="text-red-400 text-sm mb-3">{contentError}</p>
            <button
              onclick={handleRetryContent}
              class="px-3 py-1.5 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
            >
              Retry
            </button>
          </div>
        {:else if bugContent}
          <!-- Bug content sections with fade-in -->
          <div
            class="space-y-3 transition-opacity duration-200"
            class:opacity-0={!contentVisible}
            class:opacity-100={contentVisible}
          >
            {#if bugContent.summary}
              <StoryContentSection title="Summary" content={bugContent.summary} defaultExpanded={true} />
            {/if}
            {#if bugContent.body}
              <StoryContentSection title="Full Description" content={bugContent.body} defaultExpanded={false} />
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
