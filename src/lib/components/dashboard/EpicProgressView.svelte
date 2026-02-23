<script lang="ts">
  import type { EpicProgress } from '$lib/types/workflow';
  import { epicProgress } from '$lib/stores/workflow';
  import { currentProject } from '$lib/stores/project';
  import { refreshSprintStatus, refreshEpicTitles } from '$lib/stores/stories';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import { selectArtifact } from '$lib/stores/artifacts';
  import { artifactBrowserApi } from '$lib/services/artifacts';
  import { showToast } from '$lib/stores/ui';

  // Subscribe to epicProgress store
  let progress = $derived($epicProgress);
  let project = $derived($currentProject);

  // Load sprint status and epic titles when project is available
  $effect(() => {
    if (project?.path && project?.state === 'fully-initialized') {
      refreshSprintStatus(project.path);
      refreshEpicTitles(project.path);
    }
  });

  /**
   * Get progress bar color based on percentage.
   */
  function getProgressColor(percentage: number): string {
    if (percentage === 100) return 'bg-green-500';
    if (percentage > 0) return 'bg-blue-500';
    return 'bg-gray-600';
  }

  /**
   * Get status badge color.
   */
  function getStatusColor(status: 'backlog' | 'in-progress' | 'done'): string {
    switch (status) {
      case 'done':
        return 'text-green-400';
      case 'in-progress':
        return 'text-blue-400';
      default:
        return 'text-gray-500';
    }
  }

  /**
   * Handle click on an epic row to open in artifact viewer.
   */
  async function handleEpicClick(epicId: string) {
    if (!project?.path) return;

    try {
      const artifact = await artifactBrowserApi.getEpicArtifact(project.path, epicId);
      if (artifact) {
        selectArtifact(artifact);
      }
    } catch (error) {
      console.error('Failed to load epic artifact:', error);
      showToast('Failed to load epic details', '✗', 3000);
    }
  }
</script>

<div class="p-4">
  {#if progress.length === 0}
    <EmptyState
      icon="clipboard"
      title="No epics found"
      description="Sprint status has no epics to display."
    />
  {:else}
    <div class="space-y-3">
      {#each progress as epic}
        <button
          class="w-full text-left bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          onclick={() => handleEpicClick(epic.epicId)}
          aria-label={`View Epic ${epic.epicId}: ${epic.title}`}
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-200">{epic.title}</span>
              <span class="text-xs {getStatusColor(epic.status)}">
                ({epic.status})
              </span>
            </div>
            <span class="text-xs text-gray-400">
              {epic.stats.done}/{epic.stats.total} done
            </span>
          </div>

          <!-- Progress bar -->
          <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300 {getProgressColor(epic.stats.percentage)}"
              style="width: {epic.stats.percentage}%"
              role="progressbar"
              aria-valuenow={epic.stats.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${epic.stats.percentage}% complete`}
            ></div>
          </div>

          <div class="flex items-center justify-between mt-1">
            <span class="text-xs text-gray-500">
              Epic {epic.epicId}
            </span>
            <span class="text-xs font-medium {getProgressColor(epic.stats.percentage).replace('bg-', 'text-')}">
              {epic.stats.percentage}%
            </span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
