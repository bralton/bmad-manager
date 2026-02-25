<script lang="ts">
  import type { ArtifactInfo } from '$lib/types/artifact';
  import { selectArtifact } from '$lib/stores/artifacts';

  /** Workflow stages for an epic */
  type EpicStage = 'planning' | 'implementation' | 'retro';

  /** Status of a stage */
  type StageStatus = 'completed' | 'active' | 'pending';

  interface Props {
    /** Stage type */
    stage: EpicStage;
    /** Stage status */
    status: StageStatus;
    /** Artifacts for this stage (planning and retro) */
    artifacts?: ArtifactInfo[];
    /** Story stats for implementation stage */
    storyStats?: { done: number; total: number };
    /** Retro artifact for retro stage */
    retroArtifact?: ArtifactInfo | null;
  }

  let { stage, status, artifacts = [], storyStats, retroArtifact }: Props = $props();

  // Stage labels
  const stageLabels: Record<EpicStage, string> = {
    planning: 'Planning',
    implementation: 'Implementation',
    retro: 'Retro',
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
    const base = 'w-32 md:w-36 lg:w-40 p-3 rounded-lg border transition-colors';
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
  function getStatusIndicator(): { icon: string; color: string } {
    switch (status) {
      case 'completed':
        return { icon: 'check', color: 'text-green-400' };
      case 'active':
        return { icon: 'activity', color: 'text-blue-400' };
      default:
        return { icon: 'circle', color: 'text-gray-500' };
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
    {#if stage === 'planning'}
      <!-- Planning: Show artifact links -->
      {#if artifacts.length > 0}
        <div class="space-y-1">
          {#each artifacts as artifact}
            <button
              class="w-full text-left text-xs text-gray-400 hover:text-blue-400 truncate transition-colors"
              onclick={() => handleArtifactClick(artifact)}
              title={artifact.title}
            >
              <span class="mr-1">📄</span>{artifact.title}
            </button>
          {/each}
        </div>
      {:else}
        <span class="text-xs text-gray-600">No documents</span>
      {/if}
    {:else if stage === 'implementation'}
      <!-- Implementation: Show story count -->
      {#if storyStats}
        <div class="text-center">
          <div class="text-lg font-semibold text-gray-200">
            {storyStats.done}/{storyStats.total}
          </div>
          <div class="text-xs text-gray-500">stories done</div>

          <!-- Progress bar -->
          {#if storyStats.total > 0}
            {@const percentage = Math.round((storyStats.done / storyStats.total) * 100)}
            <div class="mt-2 w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300 {percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}"
                style="width: {percentage}%"
              ></div>
            </div>
          {/if}
        </div>
      {:else}
        <span class="text-xs text-gray-600">No stories</span>
      {/if}
    {:else if stage === 'retro'}
      <!-- Retro: Show retro document link -->
      {#if retroArtifact}
        <button
          class="w-full text-left text-xs text-gray-400 hover:text-blue-400 truncate transition-colors"
          onclick={() => handleArtifactClick(retroArtifact)}
          title={retroArtifact.title}
        >
          <span class="mr-1">📝</span>{retroArtifact.title}
        </button>
      {:else if artifacts.length > 0}
        <div class="space-y-1">
          {#each artifacts as artifact}
            <button
              class="w-full text-left text-xs text-gray-400 hover:text-blue-400 truncate transition-colors"
              onclick={() => handleArtifactClick(artifact)}
              title={artifact.title}
            >
              <span class="mr-1">📝</span>{artifact.title}
            </button>
          {/each}
        </div>
      {:else}
        <span class="text-xs text-gray-600">No retrospective</span>
      {/if}
    {/if}
  </div>
</div>
