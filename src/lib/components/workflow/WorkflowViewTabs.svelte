<script lang="ts">
  import type { WorkflowViewMode } from '$lib/types/workflow';
  import { workflowViewMode, setWorkflowViewMode } from '$lib/stores/workflow';

  interface Props {
    /** Current view mode */
    currentMode?: WorkflowViewMode;
    /** Callback when mode changes */
    onModeChange?: (mode: WorkflowViewMode) => void;
  }

  let { currentMode, onModeChange }: Props = $props();

  // Use store value if not provided via props
  let mode = $derived(currentMode ?? $workflowViewMode);

  const tabs: { id: WorkflowViewMode; label: string }[] = [
    { id: 'phase', label: 'BMAD Phase' },
    { id: 'epic-workflow', label: 'Epic Workflow' },
    { id: 'story-workflow', label: 'Story Workflow' },
  ];

  function handleTabClick(tabId: WorkflowViewMode) {
    if (onModeChange) {
      onModeChange(tabId);
    } else {
      setWorkflowViewMode(tabId);
    }
  }

  function getTabClasses(tabId: WorkflowViewMode): string {
    const isActive = mode === tabId;

    if (isActive) {
      return 'px-3 py-2 text-xs text-blue-400 border-b-2 border-blue-500 -mb-px font-medium';
    }
    return 'px-3 py-2 text-xs text-gray-500 hover:text-gray-300 cursor-pointer transition-colors';
  }
</script>

<div class="flex border-b border-gray-700" role="tablist" aria-label="Workflow views">
  {#each tabs as tab}
    <button
      role="tab"
      aria-selected={mode === tab.id}
      class={getTabClasses(tab.id)}
      onclick={() => handleTabClick(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>
