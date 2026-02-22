<script lang="ts">
  import type { Phase, ActiveWorkflow, ArtifactMeta } from '$lib/types/workflow';
  import { PHASE_LABELS, getTotalSteps, getWorkflowDisplayName } from '$lib/constants/workflow';
  import { openPath } from '@tauri-apps/plugin-opener';
  import { showToast } from '$lib/stores/ui';

  interface Props {
    phase: Phase;
    activeWorkflow?: ActiveWorkflow;
    artifacts: ArtifactMeta[];
    onClose: () => void;
  }

  let { phase, activeWorkflow, artifacts, onClose }: Props = $props();

  // Extract filename from absolute path (handles both Unix and Windows paths)
  function getFileName(path: string): string {
    return path.split(/[/\\]/).pop() ?? path;
  }

  // Open artifact file in system's default application
  async function openArtifact(path: string) {
    try {
      await openPath(path);
    } catch (error) {
      console.error('Failed to open file:', path, error);
      showToast(`Could not open file: ${getFileName(path)}`, '❌', 3000);
    }
  }

  // Format workflow steps as array for display
  function formatSteps(stepsCompleted: number[], totalSteps: number): { step: number; completed: boolean }[] {
    const steps: { step: number; completed: boolean }[] = [];
    for (let i = 1; i <= totalSteps; i++) {
      steps.push({
        step: i,
        completed: stepsCompleted.includes(i),
      });
    }
    return steps;
  }

  let label = $derived(PHASE_LABELS[phase] ?? phase);

  let totalSteps = $derived(
    activeWorkflow ? getTotalSteps(activeWorkflow.workflowType) : 0
  );

  let workflowSteps = $derived(
    activeWorkflow ? formatSteps(activeWorkflow.stepsCompleted, totalSteps) : []
  );

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div
  class="mx-4 mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700"
  role="region"
  aria-label="{label} phase details"
>
  <!-- Header with close button -->
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-semibold text-gray-200">{label} Phase</h3>
    <button
      type="button"
      onclick={onClose}
      class="w-6 h-6 flex items-center justify-center rounded
             text-gray-400 hover:text-gray-200 hover:bg-gray-700
             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
             transition-colors"
      aria-label="Close panel"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>

  <!-- Active Workflow Info -->
  {#if activeWorkflow}
    <div class="mb-4 p-3 bg-gray-700/50 rounded-md">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs text-gray-400">Active Workflow:</span>
        <span class="text-sm font-medium text-blue-400">
          {getWorkflowDisplayName(activeWorkflow.workflowType)}
        </span>
      </div>

      <!-- Step Progress Indicators -->
      <div class="flex items-center gap-1.5">
        {#each workflowSteps as { step, completed }}
          <div
            class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium
                   {completed
                     ? 'bg-green-500 text-white'
                     : 'bg-gray-600 text-gray-400'}"
            title="Step {step} {completed ? 'completed' : 'pending'}"
          >
            {#if completed}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            {:else}
              {step}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Completed Artifacts List -->
  {#if artifacts.length > 0}
    <div>
      <span class="text-xs text-gray-400 block mb-2">
        Completed Artifacts ({artifacts.length})
      </span>
      <ul class="space-y-1">
        {#each artifacts as artifact}
          <li class="flex items-center gap-2 text-sm">
            <!-- File icon -->
            <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <button
              type="button"
              onclick={() => openArtifact(artifact.path)}
              class="text-gray-300 truncate cursor-pointer hover:text-blue-400 hover:underline
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              title={artifact.path}
              aria-label="Open {getFileName(artifact.path)} in default application"
            >
              {getFileName(artifact.path)}
            </button>
            <!-- Status badge -->
            <span
              class="ml-auto text-[10px] px-1.5 py-0.5 rounded
                     {artifact.status === 'approved'
                       ? 'bg-green-900/50 text-green-400'
                       : artifact.status === 'draft'
                         ? 'bg-yellow-900/50 text-yellow-400'
                         : 'bg-gray-600 text-gray-400'}"
            >
              {artifact.status}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {:else if !activeWorkflow}
    <p class="text-sm text-gray-500 italic">No artifacts or active workflows for this phase.</p>
  {/if}
</div>
