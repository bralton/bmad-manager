<script lang="ts">
  import type { ArtifactInfo } from '$lib/types/artifact';
  import type { StoryWorkflowStage, StageStatus } from '$lib/types/workflow';
  import { selectArtifact } from '$lib/stores/artifacts';

  interface Props {
    /** Stage type */
    stage: StoryWorkflowStage;
    /** Stage status */
    status: StageStatus;
    /** Story artifact for Ready stage */
    storyArtifact?: ArtifactInfo | null;
    /** Task stats for Dev stage */
    taskStats?: { done: number; total: number };
  }

  let { stage, status, storyArtifact, taskStats }: Props = $props();

  // Stage labels
  const stageLabels: Record<StoryWorkflowStage, string> = {
    backlog: 'Backlog',
    ready: 'Ready',
    dev: 'Dev',
    review: 'Review',
    done: 'Done',
  };

  // Status labels
  const statusLabels: Record<StageStatus, string> = {
    completed: 'Done',
    active: 'Active',
    pending: 'Pending',
  };

  /**
   * Handle artifact click to open in viewer.
   */
  function handleArtifactClick(artifact: ArtifactInfo) {
    selectArtifact(artifact);
  }

  /**
   * Get container styles based on status.
   */
  function getContainerClasses(): string {
    const base = 'w-28 md:w-32 lg:w-36 p-3 rounded-lg border transition-colors';
    switch (status) {
      case 'completed':
        return `${base} bg-green-900/20 border-green-700/50`;
      case 'active':
        return `${base} bg-blue-900/30 border-blue-600`;
      default:
        return `${base} bg-gray-800/50 border-gray-700`;
    }
  }

  /**
   * Get status indicator icon and color.
   */
  function getStatusIndicator(): { color: string } {
    switch (status) {
      case 'completed':
        return { color: 'text-green-400' };
      case 'active':
        return { color: 'text-blue-400' };
      default:
        return { color: 'text-gray-500' };
    }
  }

  let statusIndicator = $derived(getStatusIndicator());
</script>

<div class={getContainerClasses()}>
  <!-- Stage Header -->
  <div class="flex items-center justify-between mb-2">
    <span class="text-sm font-medium text-gray-200">{stageLabels[stage]}</span>

    <!-- Status Icon -->
    {#if status === 'completed'}
      <svg class="w-4 h-4 {statusIndicator.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    {:else if status === 'active'}
      <div class="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
    {:else}
      <div class="w-3 h-3 rounded-full border border-gray-500"></div>
    {/if}
  </div>

  <!-- Status Label -->
  <div class="text-xs {statusIndicator.color} mb-2">
    {statusLabels[status]}
  </div>

  <!-- Stage Content -->
  <div class="min-h-[40px]">
    {#if stage === 'backlog'}
      <!-- Backlog: Empty state indicator -->
      <span class="text-xs text-gray-600">
        {#if status === 'active'}
          Story in backlog
        {:else if status === 'completed'}
          Completed
        {:else}
          -
        {/if}
      </span>

    {:else if stage === 'ready'}
      <!-- Ready: Show story file link -->
      {#if storyArtifact}
        <button
          class="w-full text-left text-xs text-gray-400 hover:text-blue-400 truncate transition-colors"
          onclick={() => handleArtifactClick(storyArtifact)}
          title={storyArtifact.title}
        >
          <span class="mr-1">📄</span>Story.md
        </button>
      {:else if status === 'completed' || status === 'active'}
        <span class="text-xs text-gray-600">Story ready</span>
      {:else}
        <span class="text-xs text-gray-600">-</span>
      {/if}

    {:else if stage === 'dev'}
      <!-- Dev: Show task count and progress -->
      {#if taskStats && taskStats.total > 0}
        {@const percentage = Math.round((taskStats.done / taskStats.total) * 100)}
        <div class="text-center">
          <div class="text-lg font-semibold text-gray-200">
            {taskStats.done}/{taskStats.total}
          </div>
          <div class="text-xs text-gray-500">tasks done</div>

          <!-- Progress bar -->
          <div class="mt-2 w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300 {percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}"
              style="width: {percentage}%"
            ></div>
          </div>
        </div>
      {:else if status === 'active' || status === 'completed'}
        <span class="text-xs text-gray-600">In development</span>
      {:else}
        <span class="text-xs text-gray-600">-</span>
      {/if}

    {:else if stage === 'review'}
      <!-- Review: Show review status -->
      {#if status === 'active'}
        <span class="text-xs text-purple-400">In Review</span>
      {:else if status === 'completed'}
        <span class="text-xs text-green-400">Review Passed</span>
      {:else}
        <span class="text-xs text-gray-600">-</span>
      {/if}

    {:else if stage === 'done'}
      <!-- Done: Show completion indicator -->
      {#if status === 'completed'}
        <div class="flex items-center justify-center">
          <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      {:else}
        <span class="text-xs text-gray-600">-</span>
      {/if}
    {/if}
  </div>
</div>
