<script lang="ts">
  import { sprintProgress } from '$lib/stores/workflow';
  import { currentProject } from '$lib/stores/project';
  import { refreshSprintStatus } from '$lib/stores/stories';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';

  // Subscribe to sprintProgress store
  let progress = $derived($sprintProgress);
  let project = $derived($currentProject);

  // Load sprint status when project is available
  $effect(() => {
    if (project?.path && project?.state === 'fully-initialized') {
      refreshSprintStatus(project.path);
    }
  });

  interface MetricCard {
    label: string;
    key: 'backlog' | 'ready' | 'inProgress' | 'review' | 'done';
    colorClass: string;
  }

  const metricCards: MetricCard[] = [
    { label: 'Backlog', key: 'backlog', colorClass: 'text-gray-400' },
    { label: 'Ready', key: 'ready', colorClass: 'text-yellow-400' },
    { label: 'In Progress', key: 'inProgress', colorClass: 'text-blue-400' },
    { label: 'Review', key: 'review', colorClass: 'text-purple-400' },
    { label: 'Done', key: 'done', colorClass: 'text-green-400' },
  ];
</script>

<div class="p-4">
  {#if !progress}
    <EmptyState
      icon="clipboard"
      title="No sprint data"
      description="Sprint status is not available for this project."
    />
  {:else}
    <div class="space-y-4">
      <!-- Metric Cards Grid -->
      <div class="grid grid-cols-5 gap-2">
        {#each metricCards as card}
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold {card.colorClass}">
              {progress.counts[card.key]}
            </div>
            <div class="text-xs text-gray-500 mt-1">
              {card.label}
            </div>
          </div>
        {/each}
      </div>

      <!-- Summary Row -->
      <div class="bg-gray-800/30 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="text-sm">
              <span class="text-gray-400">Total Stories:</span>
              <span class="text-gray-200 font-medium ml-1">{progress.total}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400">Completion:</span>
            <div class="flex items-center gap-2">
              <!-- Mini progress bar -->
              <div class="w-24 bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  class="h-full rounded-full bg-green-500 transition-all duration-300"
                  style="width: {progress.percentage}%"
                  role="progressbar"
                  aria-valuenow={progress.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                ></div>
              </div>
              <span class="text-sm font-medium text-green-400">
                {progress.percentage}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
