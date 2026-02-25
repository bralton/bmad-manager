<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EpicProgress } from '$lib/types/workflow';
  import type { EpicArtifacts, ArtifactInfo } from '$lib/types/artifact';
  import { epicProgress } from '$lib/stores/workflow';
  import { currentProject } from '$lib/stores/project';
  import { refreshSprintStatus, refreshEpicTitles } from '$lib/stores/stories';
  import { artifactBrowserApi } from '$lib/services/artifacts';
  import { setupEventListeners, type EventHandlers } from '$lib/services/events';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import EpicWorkflowStage from './EpicWorkflowStage.svelte';

  /** Workflow stages for an epic */
  type EpicStage = 'planning' | 'implementation' | 'retro';

  /** Status of a stage */
  type StageStatus = 'completed' | 'active' | 'pending';

  // Subscribe to stores
  let progress = $derived($epicProgress);
  let project = $derived($currentProject);

  // Track selected epic ID
  let selectedEpicId = $state<string | null>(null);

  // Epic artifacts state
  let epicArtifacts = $state<EpicArtifacts | null>(null);
  let artifactsLoading = $state(false);
  let artifactsError = $state<string | null>(null);

  // Event listener cleanup
  let eventUnlisteners: UnlistenFn[] = [];

  // Load sprint status and epic titles when project is available
  $effect(() => {
    if (project?.path && project?.state === 'fully-initialized') {
      refreshSprintStatus(project.path);
      refreshEpicTitles(project.path);
      setupFileWatcherListeners(project.path);
    }
  });

  // Auto-select first in-progress epic, or most recent if none in-progress
  $effect(() => {
    if (progress.length > 0 && !selectedEpicId) {
      // Find first in-progress epic
      const inProgressEpic = progress.find((e) => e.status === 'in-progress');
      if (inProgressEpic) {
        selectedEpicId = inProgressEpic.epicId;
      } else {
        // Fall back to first epic (highest ID = most recent, since sorted desc)
        selectedEpicId = progress[0].epicId;
      }
    }
  });

  // Fetch epic artifacts when epic selection changes
  $effect(() => {
    if (project?.path && selectedEpicId) {
      fetchEpicArtifacts(project.path, selectedEpicId);
    }
  });

  /**
   * Fetches artifacts for the selected epic.
   */
  async function fetchEpicArtifacts(projectPath: string, epicId: string) {
    artifactsLoading = true;
    artifactsError = null;
    try {
      epicArtifacts = await artifactBrowserApi.getEpicArtifacts(projectPath, epicId);
    } catch (error) {
      console.error('Failed to fetch epic artifacts:', error);
      epicArtifacts = null;
      // Extract error message for display
      if (error instanceof Error) {
        artifactsError = error.message;
      } else if (typeof error === 'string') {
        artifactsError = error;
      } else {
        artifactsError = 'Failed to load epic artifacts';
      }
    } finally {
      artifactsLoading = false;
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
          // Refresh artifacts when files change
          if (selectedEpicId) {
            fetchEpicArtifacts(projectPath, selectedEpicId);
          }
        },
        onStoryStatusChanged: () => {
          // Refresh sprint status and artifacts when story status changes
          refreshSprintStatus(projectPath);
          if (selectedEpicId) {
            fetchEpicArtifacts(projectPath, selectedEpicId);
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

  // Get selected epic data
  let selectedEpic = $derived(
    progress.find((e) => e.epicId === selectedEpicId) ?? null
  );

  // Epics sorted by ID descending (most recent first) for dropdown
  let sortedEpics = $derived(
    [...progress].sort((a, b) => {
      // Handle numeric and string IDs (e.g., "1", "2.5", "99")
      const aNum = parseFloat(a.epicId);
      const bNum = parseFloat(b.epicId);
      return bNum - aNum;
    })
  );

  // Derived planning artifacts
  let planningArtifacts = $derived<ArtifactInfo[]>(epicArtifacts?.planning ?? []);

  // Derived retro artifact
  let retroArtifact = $derived<ArtifactInfo | null>(epicArtifacts?.retro ?? null);

  /**
   * Determine stage status based on epic status.
   */
  function getStageStatus(stage: EpicStage): StageStatus {
    if (!selectedEpic) return 'pending';

    const epicStatus = selectedEpic.status;

    // Status mapping from Dev Notes
    // backlog: all pending
    // in-progress: planning completed, implementation active, retro pending
    // done: all completed (retro may be pending if no retro doc exists)
    switch (epicStatus) {
      case 'backlog':
        return 'pending';
      case 'in-progress':
        if (stage === 'planning') return 'completed';
        if (stage === 'implementation') return 'active';
        return 'pending';
      case 'done':
        return 'completed';
      default:
        return 'pending';
    }
  }

  /**
   * Handle epic selection change.
   */
  function handleEpicChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedEpicId = select.value;
  }
</script>

<div class="w-full p-4">
  {#if progress.length === 0}
    <EmptyState
      icon="clipboard"
      title="No epics found"
      description="Sprint status has no epics to display. Create an epic to get started."
    />
  {:else}
    <!-- Epic Selector -->
    <div class="mb-6">
      <label for="epic-selector" class="sr-only">Select Epic</label>
      <select
        id="epic-selector"
        class="w-full md:w-auto min-w-[280px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
               text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
        value={selectedEpicId ?? ''}
        onchange={handleEpicChange}
      >
        {#each sortedEpics as epic}
          <option value={epic.epicId}>
            Epic {epic.epicId}: {epic.title}
          </option>
        {/each}
      </select>
    </div>

    {#if artifactsError}
      <!-- Error State -->
      <div class="flex items-center justify-center py-8">
        <div class="flex flex-col items-center gap-2 text-center">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-red-400 text-sm">{artifactsError}</p>
          <button
            onclick={() => selectedEpicId && project?.path && fetchEpicArtifacts(project.path, selectedEpicId)}
            class="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    {:else if selectedEpic}
      <!-- Workflow Stages Row -->
      <div
        class="flex items-center justify-center gap-2
               flex-col md:flex-row"
      >
        <!-- Planning Stage -->
        <EpicWorkflowStage
          stage="planning"
          status={getStageStatus('planning')}
          artifacts={planningArtifacts}
        />

        <!-- Connector: Planning to Implementation -->
        <div class="hidden md:block h-0.5 w-8 md:w-12 lg:w-16 flex-shrink-0 bg-gray-600"></div>
        <div class="md:hidden w-0.5 h-4 flex-shrink-0 bg-gray-600"></div>

        <!-- Implementation Stage -->
        <EpicWorkflowStage
          stage="implementation"
          status={getStageStatus('implementation')}
          storyStats={{
            done: epicArtifacts?.storyDoneCount ?? selectedEpic.stats.done,
            total: epicArtifacts?.storyTotalCount ?? selectedEpic.stats.total,
          }}
        />

        <!-- Connector: Implementation to Retro -->
        <div class="hidden md:block h-0.5 w-8 md:w-12 lg:w-16 flex-shrink-0 bg-gray-600"></div>
        <div class="md:hidden w-0.5 h-4 flex-shrink-0 bg-gray-600"></div>

        <!-- Retro Stage -->
        <EpicWorkflowStage
          stage="retro"
          status={getStageStatus('retro')}
          retroArtifact={retroArtifact}
        />
      </div>
    {/if}
  {/if}
</div>
