<script lang="ts">
  import { selectedStoryId, sprintStatus, refreshSprintStatus, setSelectedStoryId } from '$lib/stores/stories';
  import { currentProject } from '$lib/stores/project';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import { workflowApi } from '$lib/services/tauri';
  import type { StoryProgress } from '$lib/types/workflow';

  // Subscribe to stores
  let storyId = $derived($selectedStoryId);
  let status = $derived($sprintStatus);
  let project = $derived($currentProject);

  // Load sprint status when project is available
  $effect(() => {
    if (project?.path && project?.state === 'fully-initialized') {
      refreshSprintStatus(project.path);
    }
  });

  // Local state for story tasks
  let storyTasks = $state<StoryProgress | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Get available stories sorted by epic and story number
  let availableStories = $derived(() => {
    if (!status) return [];
    return [...status.stories].sort((a, b) => {
      // Sort by epic first, then by story number
      const epicCompare = a.epicId.localeCompare(b.epicId);
      if (epicCompare !== 0) return epicCompare;
      return a.storyNumber - b.storyNumber;
    });
  });

  // Get the story display name
  let storyName = $derived(() => {
    if (!storyId || !status) return null;
    const story = status.stories.find((s) => s.id === storyId);
    return story ? story.id : storyId;
  });

  function handleStoryChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const newStoryId = select.value || null;
    setSelectedStoryId(newStoryId);
  }

  // Load story tasks when selected story changes
  $effect(() => {
    if (!storyId || !project?.path || !status) {
      storyTasks = null;
      return;
    }

    loadStoryTasks(storyId);
  });

  async function loadStoryTasks(id: string) {
    if (!project?.path) return;

    loading = true;
    error = null;

    try {
      // Construct story file path
      // Story files are in _bmad-output/implementation-artifacts/{storyId}.md
      const storyPath = `${project.path}/_bmad-output/implementation-artifacts/${id}.md`;
      const result = await workflowApi.getStoryTasks(storyPath);
      storyTasks = result;
    } catch (err) {
      console.error('Failed to load story tasks:', err);
      error = err instanceof Error ? err.message : 'Failed to load tasks';
      storyTasks = null;
    } finally {
      loading = false;
    }
  }

  function getProgressColor(percentage: number): string {
    if (percentage === 100) return 'bg-green-500';
    if (percentage > 0) return 'bg-blue-500';
    return 'bg-gray-600';
  }
</script>

<div class="p-4">
  <!-- Story selector dropdown -->
  {#if status && availableStories().length > 0}
    <div class="mb-4">
      <select
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
        value={storyId ?? ''}
        onchange={handleStoryChange}
      >
        <option value="">Select a story...</option>
        {#each availableStories() as story}
          <option value={story.id}>
            {story.id} ({story.status})
          </option>
        {/each}
      </select>
    </div>
  {/if}

  {#if !storyId}
    <EmptyState
      icon="document"
      title="No story selected"
      description="Choose a story from the dropdown above to view its task checklist."
    />
  {:else if loading}
    <div class="flex items-center justify-center py-8">
      <div class="flex items-center gap-2 text-gray-400">
        <div class="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
        <span class="text-sm">Loading tasks...</span>
      </div>
    </div>
  {:else if error}
    <div class="text-center py-8">
      <p class="text-red-400 text-sm">{error}</p>
    </div>
  {:else if !storyTasks}
    <EmptyState
      icon="document"
      title="No tasks found"
      description="This story does not have any task checkboxes."
    />
  {:else}
    <div class="space-y-4">
      <!-- Story header with progress -->
      <div class="bg-gray-800/50 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-200">
            {storyName()}
          </span>
          <span class="text-xs text-gray-400">
            {storyTasks.completed}/{storyTasks.total} tasks
          </span>
        </div>

        <!-- Progress bar -->
        <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300 {getProgressColor(storyTasks.percentage)}"
            style="width: {storyTasks.percentage}%"
            role="progressbar"
            aria-valuenow={storyTasks.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="{storyTasks.percentage}% complete"
          ></div>
        </div>

        <div class="flex items-center justify-end mt-1">
          <span class="text-xs font-medium {getProgressColor(storyTasks.percentage).replace('bg-', 'text-')}">
            {storyTasks.percentage}%
          </span>
        </div>
      </div>

      <!-- Task list -->
      <div class="space-y-1 max-h-64 overflow-y-auto">
        {#each storyTasks.tasks as task}
          <div
            class="flex items-start gap-2 text-sm py-1"
            style="padding-left: {task.level * 16}px"
          >
            <span class="flex-shrink-0 mt-0.5">
              {#if task.completed}
                <svg class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              {:else}
                <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2" />
                </svg>
              {/if}
            </span>
            <span class={task.completed ? 'text-gray-500 line-through' : 'text-gray-300'}>
              {task.text}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
