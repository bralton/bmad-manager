<script lang="ts">
  import type { DashboardViewMode } from '$lib/types/workflow';
  import { dashboardViewMode, setDashboardViewMode } from '$lib/stores/workflow';

  interface Props {
    /** Current view mode */
    currentMode?: DashboardViewMode;
    /** Callback when mode changes */
    onModeChange?: (mode: DashboardViewMode) => void;
  }

  let { currentMode, onModeChange }: Props = $props();

  // Use store value if not provided via props
  let mode = $derived(currentMode ?? $dashboardViewMode);

  const tabs: { id: DashboardViewMode; label: string }[] = [
    { id: 'epic', label: 'Epic Progress' },
    { id: 'sprint', label: 'Sprint Overview' },
  ];

  function handleTabClick(tabId: DashboardViewMode) {
    if (onModeChange) {
      onModeChange(tabId);
    } else {
      setDashboardViewMode(tabId);
    }
  }

  function getTabClasses(tabId: DashboardViewMode): string {
    const isActive = mode === tabId;

    if (isActive) {
      return 'px-3 py-2 text-xs text-blue-400 border-b-2 border-blue-500 -mb-px font-medium';
    }
    return 'px-3 py-2 text-xs text-gray-500 hover:text-gray-300 cursor-pointer transition-colors';
  }
</script>

<div class="flex border-b border-gray-700" role="tablist" aria-label="Dashboard views">
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
