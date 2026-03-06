<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { KANBAN_COLUMNS, type Story, type Epic, type StoryContent } from '$lib/types/stories';
  import { currentProject } from '$lib/stores/project';
  import { worktreesByStory, worktreeCreating, setWorktreeCreating, refreshWorktrees } from '$lib/stores/worktrees';
  import { conflictSummaries } from '$lib/stores/conflicts';
  import { showSuccessToast, showErrorToast } from '$lib/stores/ui';
  import { worktreeApi, parseWorktreeError } from '$lib/services/worktrees';
  import { openWorktreeInNewWindow } from '$lib/services/windows';
  import { artifactBrowserApi } from '$lib/services/artifacts';
  import { storyApi } from '$lib/services/stories';
  import WorktreeCleanupDialog from './WorktreeCleanupDialog.svelte';
  import MergeDialog from './MergeDialog.svelte';
  import ConflictWarningBanner from '$lib/components/conflicts/ConflictWarningBanner.svelte';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import StoryContentSection from './StoryContentSection.svelte';

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

  // Story content state (Story 5-13: Detail Panel Content)
  let storyContent = $state<StoryContent | null>(null);
  let contentLoading = $state(false);
  let contentError = $state<string | null>(null);
  let contentVisible = $state(false); // For fade-in transition (AC4)

  // Track current fetch to prevent race conditions (non-reactive, just a counter)
  let currentFetchId = 0;

  // Check if this is a backlog story (no file exists yet)
  let isBacklog = $derived(story.status === 'backlog');

  // Fetch story content when panel opens for non-backlog stories
  $effect(() => {
    if (!isBacklog && story.id) {
      fetchStoryContent();
    }
  });

  async function fetchStoryContent() {
    const project = get(currentProject);
    if (!project?.path) return;

    // Increment fetch ID to track this request
    const fetchId = ++currentFetchId;

    contentLoading = true;
    contentError = null;
    storyContent = null; // Clear previous content to prevent stale data flash
    contentVisible = false;

    try {
      // Get the artifact to find the file path
      const artifact = await artifactBrowserApi.getStoryArtifact(project.path, story.id);

      // Check if this request is still current (prevents race condition)
      if (fetchId !== currentFetchId) return;

      if (artifact?.path) {
        const content = await storyApi.getStoryContent(artifact.path);

        // Check again after second async call
        if (fetchId !== currentFetchId) return;

        if (content.error) {
          contentError = content.error;
        } else {
          storyContent = content;
          // Trigger fade-in after content is set (AC4: smooth transition)
          requestAnimationFrame(() => {
            contentVisible = true;
          });
        }
      } else {
        contentError = 'Story file not found';
      }
    } catch (error) {
      // Only set error if this request is still current
      if (fetchId !== currentFetchId) return;
      contentError = error instanceof Error ? error.message : 'Failed to load story content';
    } finally {
      // Only clear loading if this request is still current
      if (fetchId === currentFetchId) {
        contentLoading = false;
      }
    }
  }

  function handleRetryContent() {
    fetchStoryContent();
  }

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

      <!-- Story Content Section (Story 5-13) -->
      <div class="pt-4 border-t border-gray-700">
        {#if isBacklog}
          <!-- Backlog story - no file yet (AC5) -->
          <EmptyState
            icon="document"
            title="Story file not yet created"
            description="This story is in the backlog. A story file will be created when development begins."
          />
        {:else if contentLoading}
          <!-- Loading state (AC4) -->
          <div class="flex items-center justify-center py-8">
            <svg
              class="animate-spin h-6 w-6 text-indigo-400"
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
            <span class="ml-2 text-gray-400 text-sm">Loading story content...</span>
          </div>
        {:else if contentError}
          <!-- Error state with retry (AC6) -->
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
        {:else if storyContent}
          <!-- Story content sections (AC1, AC2, AC3) with fade-in (AC4) -->
          <div
            class="space-y-3 transition-opacity duration-200"
            class:opacity-0={!contentVisible}
            class:opacity-100={contentVisible}
          >
            {#if storyContent.story}
              <StoryContentSection title="Story" content={storyContent.story} defaultExpanded={true} />
            {/if}
            {#if storyContent.acceptanceCriteria}
              <StoryContentSection title="Acceptance Criteria" content={storyContent.acceptanceCriteria} defaultExpanded={true} />
            {/if}
            {#if storyContent.tasks}
              <StoryContentSection title="Tasks" content={storyContent.tasks} defaultExpanded={true} showTasks={true} />
            {/if}
            {#if storyContent.devNotes}
              <StoryContentSection title="Dev Notes" content={storyContent.devNotes} defaultExpanded={false} />
            {/if}
          </div>
        {/if}
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
