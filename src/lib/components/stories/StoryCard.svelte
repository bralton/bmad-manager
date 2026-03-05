<script lang="ts">
  import { get } from 'svelte/store';
  import { selectedStoryId, getCachedTasks, setCachedTasks } from '$lib/stores/stories';
  import { currentProject } from '$lib/stores/project';
  import { worktreesByStory, worktreeCreating, setWorktreeCreating, refreshWorktrees, currentWorktreeStoryId } from '$lib/stores/worktrees';
  import { conflictSummaries } from '$lib/stores/conflicts';
  import { showSuccessToast, showErrorToast } from '$lib/stores/ui';
  import { worktreeApi, parseWorktreeError } from '$lib/services/worktrees';
  import { openWorktreeInNewWindow } from '$lib/services/windows';
  import { KANBAN_COLUMNS, type Story } from '$lib/types/stories';
  import type { StoryProgress } from '$lib/types/workflow';
  import { artifactBrowserApi } from '$lib/services/artifacts';
  import { storyApi } from '$lib/services/stories';
  import { selectArtifact } from '$lib/stores/artifacts';
  import TaskListInline from './TaskListInline.svelte';

  let { story }: { story: Story } = $props();

  // Task progress state (Story 5-8: Kanban Enhancement)
  let taskProgress = $state<StoryProgress | null>(null);
  let tasksLoading = $state(false);
  let isExpanded = $state(false);

  // Check if this story should show task features (not backlog)
  let showTaskFeatures = $derived(story.status !== 'backlog');

  // Fetch task stats on mount (non-blocking) - only for non-backlog stories
  $effect(() => {
    if (showTaskFeatures) {
      // Check cache first
      const cached = getCachedTasks(story.id);
      if (cached) {
        taskProgress = cached;
      } else {
        // Fetch tasks in background (non-blocking)
        fetchTaskProgress();
      }
    }
  });

  async function fetchTaskProgress() {
    const project = get(currentProject);
    if (!project?.path) return;

    try {
      // First get the story artifact to find the file path
      const artifact = await artifactBrowserApi.getStoryArtifact(project.path, story.id);
      if (artifact?.path) {
        const tasks = await storyApi.getStoryTasks(artifact.path);
        if (tasks) {
          taskProgress = tasks;
          setCachedTasks(story.id, tasks);
        }
      }
    } catch (error) {
      // Silently fail - task progress is optional enhancement
      console.debug('Failed to fetch task progress for', story.id, error);
    }
  }

  async function handleExpandToggle(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();

    if (isExpanded) {
      // Collapse
      isExpanded = false;
    } else {
      // Expand - fetch tasks if not cached
      if (!taskProgress && !tasksLoading) {
        tasksLoading = true;
        await fetchTaskProgress();
        tasksLoading = false;
      }
      isExpanded = true;
    }
  }

  function handleExpandKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleExpandToggle(event);
    }
  }

  // Get worktree for this story
  let worktree = $derived($worktreesByStory.get(story.id));
  let isCreating = $derived($worktreeCreating.get(story.id) ?? false);

  // Check if this is the current worktree (AC #4 - highlight current worktree's story)
  let isCurrentWorktree = $derived($currentWorktreeStoryId === story.id);

  // Convert slug to readable title (replace hyphens with spaces, title case)
  let title = $derived.by(() => {
    return story.slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Get display ID (e.g., "3-2" or "1-5-2" for sub-stories)
  let displayId = $derived.by(() => {
    if (story.subStoryNumber != null) {
      return `${story.epicId}-${story.storyNumber}-${story.subStoryNumber}`;
    }
    return `${story.epicId}-${story.storyNumber}`;
  });

  // Get conflict summary for this story using displayId
  let conflictSummary = $derived($conflictSummaries.get(displayId));
  let hasConflicts = $derived(conflictSummary != null && conflictSummary.conflictCount > 0);

  // Build conflict tooltip text
  let conflictTooltip = $derived.by(() => {
    if (!conflictSummary || conflictSummary.conflictCount === 0) return '';
    const storyIds = conflictSummary.conflicts.map((c) => c.conflictsWith);
    return `Conflicts with: ${storyIds.join(', ')}`;
  });

  // Get the column config for this story's status
  let columnConfig = $derived(
    KANBAN_COLUMNS.find((c) => c.status === story.status) || KANBAN_COLUMNS[0]
  );

  function handleClick() {
    selectedStoryId.set(story.id);
  }

  async function handleViewArtifact(event: MouseEvent) {
    event.stopPropagation();

    const project = get(currentProject);
    if (!project) {
      showErrorToast('No project loaded');
      return;
    }

    try {
      const artifact = await artifactBrowserApi.getStoryArtifact(project.path, story.id);
      if (artifact) {
        selectArtifact(artifact);
      } else {
        showErrorToast(`Story artifact not found: ${story.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showErrorToast(`Failed to load artifact: ${message}`);
    }
  }

  async function handleCreateWorktree(event: MouseEvent) {
    event.stopPropagation();

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

  // Build aria label
  let taskAriaLabel = $derived.by(() => {
    if (taskProgress && taskProgress.total > 0) {
      return `, ${taskProgress.completed} of ${taskProgress.total} tasks complete`;
    }
    return '';
  });

  let ariaLabel = $derived(
    `Story ${displayId}: ${title}, status: ${columnConfig.label}${taskAriaLabel}${worktree ? ', has worktree' : ''}${isCurrentWorktree ? ', current' : ''}${hasConflicts ? ', has file conflicts' : ''}`
  );

  // Build CSS classes for button
  let buttonClasses = $derived.by(() => {
    const base = `w-full text-left bg-gray-800 rounded-lg p-3 border border-gray-700
      hover:bg-gray-750 hover:border-gray-600 hover:shadow-md
      focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
      cursor-pointer transition-all min-h-[80px]
      border-l-2 ${columnConfig.borderColor} relative group`;

    // Add highlight ring for current worktree (AC #4)
    if (isCurrentWorktree) {
      return `${base} ring-2 ring-indigo-500 ring-offset-1 ring-offset-gray-900`;
    }
    return base;
  });
</script>

<button
  onclick={handleClick}
  class={buttonClasses}
  aria-label={ariaLabel}
  tabindex="0"
>
  <!-- Header row with ID and worktree badge -->
  <div class="flex items-center justify-between mb-1">
    <span class="text-xs font-mono text-gray-400">{displayId}</span>

    <!-- Badges and actions -->
    <div class="flex items-center gap-1">
      <!-- Conflict warning badge (AC #4) -->
      {#if hasConflicts}
        <span
          class="p-1 text-amber-400"
          title={conflictTooltip}
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </span>
      {/if}

      <!-- View artifact icon (visible on hover, keyboard accessible) -->
      <div
        onclick={handleViewArtifact}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewArtifact(e as unknown as MouseEvent); } }}
        role="button"
        tabindex={0}
        class="p-1 rounded text-gray-500 hover:text-blue-400 hover:bg-gray-700 cursor-pointer
          opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        title="View story artifact"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

      {#if isCreating}
        <!-- Loading spinner -->
        <span
          class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-indigo-600/50 text-indigo-200"
          title="Creating worktree..."
        >
          <svg
            class="animate-spin h-3 w-3"
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
        </span>
      {:else if worktree}
        <!-- Worktree badge -->
        <span
          class="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-indigo-100"
          title="Working in worktree: {worktree.path}"
        >
          WT
        </span>
      {:else}
        <!-- Create worktree indicator (visible on hover, keyboard accessible) -->
        <!-- Using div with role="button" to avoid nested buttons -->
        <div
          onclick={handleCreateWorktree}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCreateWorktree(e as unknown as MouseEvent); } }}
          role="button"
          tabindex={0}
          class="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400
            hover:bg-indigo-600 hover:text-indigo-100 cursor-pointer
            opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          title="Create worktree"
        >
          + WT
        </div>
      {/if}
    </div>
  </div>

  <!-- Title / Creating message -->
  {#if isCreating}
    <div class="text-sm font-medium text-gray-400 truncate italic">Creating worktree...</div>
  {:else}
    <div class="text-sm font-medium text-white truncate">{title}</div>
  {/if}

  <!-- Task progress row (AC #1, #2, #3, #8, #9) -->
  {#if showTaskFeatures && taskProgress && taskProgress.total > 0}
    <div class="mt-2 flex items-center gap-2">
      <!-- Task count -->
      <span class="text-xs text-gray-400 whitespace-nowrap">
        {taskProgress.completed}/{taskProgress.total} tasks
      </span>

      <!-- Progress bar -->
      <div class="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={taskProgress.percentage} aria-valuemin={0} aria-valuemax={100}>
        <div class="h-full bg-green-500 transition-all" style="width: {taskProgress.percentage}%"></div>
      </div>

      <!-- Expand/collapse button -->
      <div
        onclick={handleExpandToggle}
        onkeydown={handleExpandKeydown}
        role="button"
        tabindex={tasksLoading ? -1 : 0}
        class="p-0.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
        class:pointer-events-none={tasksLoading}
        class:opacity-50={tasksLoading}
        aria-expanded={isExpanded}
        aria-disabled={tasksLoading}
        aria-label={isExpanded ? 'Collapse task list' : 'Expand task list'}
        title={isExpanded ? 'Collapse tasks' : 'Expand tasks'}
      >
        {#if tasksLoading}
          <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else if isExpanded}
          <!-- Chevron up -->
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        {:else}
          <!-- Chevron down -->
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Expanded task list (AC #3, #4, #5) -->
  {#if isExpanded && taskProgress && taskProgress.tasks.length > 0}
    <TaskListInline tasks={taskProgress.tasks} />
  {/if}
</button>

<style>
  /* Custom hover state since Tailwind doesn't have gray-750 by default */
  button:hover {
    background-color: rgb(45, 55, 72);
  }
</style>
