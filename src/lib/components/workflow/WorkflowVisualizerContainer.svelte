<script lang="ts">
  import WorkflowVisualizer from './WorkflowVisualizer.svelte';
  import { currentProject } from '$lib/stores/project';
  import {
    workflowState,
    workflowLoading,
    workflowError,
    refreshWorkflowState,
    resetWorkflowState,
  } from '$lib/stores/workflow';

  // Reactive store access
  let project = $derived($currentProject);
  let state = $derived($workflowState);
  let loading = $derived($workflowLoading);
  let error = $derived($workflowError);

  // Track the last project path to detect changes
  let lastProjectPath: string | null = null;

  // Watch for project changes and refresh workflow state
  // This handles both initial mount (lastProjectPath starts null) and subsequent changes
  $effect(() => {
    const projectPath = project?.path ?? null;

    if (projectPath !== lastProjectPath) {
      lastProjectPath = projectPath;

      if (projectPath && project?.state === 'fully-initialized') {
        refreshWorkflowState(projectPath);
      } else {
        resetWorkflowState();
      }
    }
  });

  function handleRetry() {
    if (project?.path) {
      refreshWorkflowState(project.path);
    }
  }
</script>

{#if project?.state === 'fully-initialized'}
  <div class="border-b border-gray-800 bg-gray-900/50">
    {#if loading && !state}
      <!-- Initial loading state -->
      <div class="h-20 flex items-center justify-center">
        <div class="flex items-center gap-2 text-gray-400">
          <div class="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
          <span class="text-sm">Loading workflow state...</span>
        </div>
      </div>
    {:else if error && !state}
      <!-- Error state -->
      <div class="h-20 flex items-center justify-center">
        <div class="flex flex-col items-center gap-2">
          <p class="text-red-400 text-sm">{error}</p>
          <button
            onclick={handleRetry}
            class="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    {:else if state}
      <!-- Workflow visualizer -->
      <WorkflowVisualizer workflowState={state} />
    {:else}
      <!-- Fallback: no state yet, not loading, no error -->
      <div class="h-20 flex items-center justify-center">
        <p class="text-gray-500 text-sm">Workflow state unavailable</p>
      </div>
    {/if}
  </div>
{/if}
