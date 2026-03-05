<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Story, StoryStatus } from '$lib/types/stories';
  import type { ArtifactInfo } from '$lib/types/artifact';
  import type { StoryWorkflowStage, StageStatus, StoryProgress } from '$lib/types/workflow';
  import { sprintStatus, epicTitles, refreshSprintStatus, refreshEpicTitles } from '$lib/stores/stories';
  import { currentProject } from '$lib/stores/project';
  import { artifactBrowserApi } from '$lib/services/artifacts';
  import { workflowApi } from '$lib/services/tauri';
  import { setupEventListeners, type EventHandlers } from '$lib/services/events';
  import { showToast } from '$lib/stores/ui';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import StoryWorkflowStageComponent from './StoryWorkflowStage.svelte';

  /** Workflow stages for a story (in order) */
  const STORY_STAGES: StoryWorkflowStage[] = ['backlog', 'ready', 'dev', 'review', 'done'];

  /** Mapping from story status to stage */
  const STATUS_TO_STAGE: Record<StoryStatus, StoryWorkflowStage> = {
    'backlog': 'backlog',
    'ready-for-dev': 'ready',
    'in-progress': 'dev',
    'review': 'review',
    'done': 'done',
  };

  // Subscribe to stores
  let status = $derived($sprintStatus);
  let titles = $derived($epicTitles);
  let project = $derived($currentProject);

  // Component state
  let selectedStoryId = $state<string | null>(null);
  let selectedEpicId = $state<string | null>(null);
  let storyArtifact = $state<ArtifactInfo | null>(null);
  let storyTasks = $state<StoryProgress | null>(null);
  let artifactLoading = $state(false);

  // Event listener cleanup
  let eventUnlisteners: UnlistenFn[] = [];

  // Get all stories sorted by epic ID then story number (most recent/highest first)
  let sortedStories = $derived.by<Story[]>(() => {
    if (!status?.stories) return [];
    return [...status.stories].sort((a, b) => {
      // Sort by epic ID descending first
      const epicCompare = parseFloat(b.epicId) - parseFloat(a.epicId);
      if (epicCompare !== 0) return epicCompare;
      // Then by story number descending
      return b.storyNumber - a.storyNumber;
    });
  });

  // Get unique epic IDs for filter dropdown
  let epicIds = $derived.by<string[]>(() => {
    if (!status?.epics) return [];
    return [...status.epics]
      .map((e) => e.id)
      .sort((a, b) => parseFloat(b) - parseFloat(a));
  });

  // Filter stories by selected epic (if any)
  let filteredStories = $derived.by<Story[]>(() => {
    if (!selectedEpicId) return sortedStories;
    return sortedStories.filter((s) => s.epicId === selectedEpicId);
  });

  // Get selected story data
  let selectedStory = $derived<Story | null>(
    status?.stories.find((s) => s.id === selectedStoryId) ?? null
  );

  // Load sprint status and epic titles when project is available
  $effect(() => {
    if (project?.path && project?.state === 'fully-initialized') {
      refreshSprintStatus(project.path);
      refreshEpicTitles(project.path);
      setupFileWatcherListeners(project.path);
    }
  });

  // Auto-select story by priority: in-progress > review > ready-for-dev > backlog > done
  $effect(() => {
    if (filteredStories.length > 0 && !selectedStoryId) {
      // Priority 1: in-progress (actively being worked on)
      const inProgressStory = filteredStories.find((s) => s.status === 'in-progress');
      if (inProgressStory) {
        selectedStoryId = inProgressStory.id;
      } else {
        // Priority 2: review (needs attention)
        const reviewStory = filteredStories.find((s) => s.status === 'review');
        if (reviewStory) {
          selectedStoryId = reviewStory.id;
        } else {
          // Priority 3: ready-for-dev (ready to start)
          const readyStory = filteredStories.find((s) => s.status === 'ready-for-dev');
          if (readyStory) {
            selectedStoryId = readyStory.id;
          } else {
            // Priority 4: backlog (next story in queue - lowest epic/story number)
            const backlogStories = filteredStories.filter((s) => s.status === 'backlog');
            if (backlogStories.length > 0) {
              // Sort ascending to get the actual "next" story (lowest epic, then lowest story number)
              const nextBacklog = backlogStories.sort((a, b) => {
                const epicCompare = parseFloat(a.epicId) - parseFloat(b.epicId);
                if (epicCompare !== 0) return epicCompare;
                return a.storyNumber - b.storyNumber;
              })[0];
              selectedStoryId = nextBacklog.id;
            } else {
              // Priority 5: done (most recently completed - fallback)
              selectedStoryId = filteredStories[0].id;
            }
          }
        }
      }
    }
  });

  // Fetch story artifact and tasks when story selection changes
  $effect(() => {
    if (project?.path && selectedStoryId) {
      fetchStoryData(project.path, selectedStoryId);
    }
  });

  /**
   * Fetches artifact and task data for the selected story.
   */
  async function fetchStoryData(projectPath: string, storyId: string) {
    artifactLoading = true;
    storyArtifact = null;
    storyTasks = null;

    try {
      // Get story artifact (the .md file)
      const artifact = await artifactBrowserApi.getStoryArtifact(projectPath, storyId);
      storyArtifact = artifact;

      // Get task progress from story file
      if (artifact?.path) {
        const tasks = await workflowApi.getStoryTasks(artifact.path);
        storyTasks = tasks;
      }
    } catch (error) {
      console.error('Failed to fetch story data:', error);
      storyArtifact = null;
      storyTasks = null;
      showToast('Failed to load story data', '⚠️', 3000);
    } finally {
      artifactLoading = false;
    }
  }

  /**
   * Sets up file watcher listeners for automatic refresh.
   */
  async function setupFileWatcherListeners(projectPath: string) {
    // Clean up previous listeners
    eventUnlisteners.forEach((unlisten) => unlisten());
    eventUnlisteners = [];

    try {
      const handlers: EventHandlers = {
        onArtifactModified: () => {
          // Refresh story data when files change
          if (selectedStoryId) {
            fetchStoryData(projectPath, selectedStoryId);
          }
        },
        onStoryStatusChanged: () => {
          // Refresh sprint status and story data
          refreshSprintStatus(projectPath);
          if (selectedStoryId) {
            fetchStoryData(projectPath, selectedStoryId);
          }
        },
      };

      eventUnlisteners = await setupEventListeners(handlers);
    } catch (error) {
      console.warn('Failed to set up file watcher listeners:', error);
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    eventUnlisteners.forEach((unlisten) => unlisten());
    eventUnlisteners = [];
  });

  /**
   * Determines the status of a workflow stage based on the story's current status.
   */
  function getStageStatus(stage: StoryWorkflowStage): StageStatus {
    if (!selectedStory) return 'pending';

    const currentStage = STATUS_TO_STAGE[selectedStory.status];
    const stageIndex = STORY_STAGES.indexOf(stage);
    const currentIndex = STORY_STAGES.indexOf(currentStage);

    // Special case: when story is done, all stages are completed
    if (selectedStory.status === 'done') {
      return 'completed';
    }

    if (stageIndex < currentIndex) {
      return 'completed';
    } else if (stageIndex === currentIndex) {
      return 'active';
    } else {
      return 'pending';
    }
  }

  /**
   * Handle story selection change.
   */
  function handleStoryChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedStoryId = select.value;
  }

  /**
   * Handle epic filter change.
   */
  function handleEpicFilterChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const newEpicId = select.value || null;
    selectedEpicId = newEpicId;

    // Select first story in new filtered list to avoid flicker
    // Filter stories immediately to find the first one
    const newFilteredStories = newEpicId
      ? sortedStories.filter((s) => s.epicId === newEpicId)
      : sortedStories;

    if (newFilteredStories.length > 0) {
      // Prefer in-progress > review > ready-for-dev > backlog (lowest) > done
      const inProgress = newFilteredStories.find((s) => s.status === 'in-progress');
      const review = newFilteredStories.find((s) => s.status === 'review');
      const ready = newFilteredStories.find((s) => s.status === 'ready-for-dev');
      // For backlog, get the lowest epic/story number (actual "next" in queue)
      const backlogStories = newFilteredStories.filter((s) => s.status === 'backlog');
      const nextBacklog = backlogStories.length > 0
        ? backlogStories.sort((a, b) => {
            const epicCompare = parseFloat(a.epicId) - parseFloat(b.epicId);
            if (epicCompare !== 0) return epicCompare;
            return a.storyNumber - b.storyNumber;
          })[0]
        : null;
      selectedStoryId = inProgress?.id ?? review?.id ?? ready?.id ?? nextBacklog?.id ?? newFilteredStories[0].id;
    } else {
      selectedStoryId = null;
    }
  }

  /**
   * Get display label for a story in the dropdown.
   */
  function getStoryLabel(story: Story): string {
    const storyNum = story.subStoryNumber
      ? `${story.storyNumber}.${story.subStoryNumber}`
      : story.storyNumber.toString();
    const slug = story.slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    const doneIndicator = story.status === 'done' ? ' ✓' : '';
    return `${story.epicId}-${storyNum}: ${slug}${doneIndicator}`;
  }
</script>

<div class="w-full p-4">
  {#if !status?.stories || status.stories.length === 0}
    <EmptyState
      icon="clipboard"
      title="No stories found"
      description="Sprint status has no stories to display. Create a story to get started."
    />
  {:else}
    <!-- Story Selector Row -->
    <div class="mb-6 flex flex-col md:flex-row gap-3">
      <!-- Epic Filter (Optional) -->
      {#if epicIds.length > 1}
        <div>
          <label for="epic-filter" class="sr-only">Filter by Epic</label>
          <select
            id="epic-filter"
            class="w-full md:w-auto min-w-[160px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                   text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            value={selectedEpicId ?? ''}
            onchange={handleEpicFilterChange}
          >
            <option value="">All Epics</option>
            {#each epicIds as epicId}
              <option value={epicId}>
                Epic {epicId}: {titles.get(epicId) ?? epicId}
              </option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Story Selector -->
      <div class="flex-1">
        <label for="story-selector" class="sr-only">Select Story</label>
        <select
          id="story-selector"
          class="w-full md:w-auto min-w-[320px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          value={selectedStoryId ?? ''}
          onchange={handleStoryChange}
        >
          {#each filteredStories as story}
            <option value={story.id}>
              {getStoryLabel(story)}
            </option>
          {/each}
        </select>
      </div>
    </div>

    {#if selectedStory}
      <!-- Loading indicator for story data -->
      {#if artifactLoading}
        <div class="flex items-center justify-center py-2 mb-2">
          <div class="flex items-center gap-2 text-gray-400 text-sm">
            <div class="w-3 h-3 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
            <span>Loading story data...</span>
          </div>
        </div>
      {/if}

      <!-- Workflow Stages Row -->
      <div
        class="flex items-center justify-center gap-2
               flex-col md:flex-row"
      >
        {#each STORY_STAGES as stage, index}
          {#if index > 0}
            <!-- Connector Line -->
            <div class="hidden md:block h-0.5 w-8 md:w-12 lg:w-16 flex-shrink-0 bg-gray-600"></div>
            <div class="md:hidden w-0.5 h-4 flex-shrink-0 bg-gray-600"></div>
          {/if}

          <StoryWorkflowStageComponent
            {stage}
            status={getStageStatus(stage)}
            storyArtifact={stage === 'ready' ? storyArtifact : null}
            taskStats={stage === 'dev' && storyTasks ? { done: storyTasks.completed, total: storyTasks.total } : undefined}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>
