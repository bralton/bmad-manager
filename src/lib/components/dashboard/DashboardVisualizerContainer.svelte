<script lang="ts">
  import DashboardViewTabs from './DashboardViewTabs.svelte';
  import EpicProgressView from './EpicProgressView.svelte';
  import SprintProgressView from './SprintProgressView.svelte';
  import { currentProject } from '$lib/stores/project';
  import { dashboardViewMode } from '$lib/stores/workflow';

  // Reactive store access
  let project = $derived($currentProject);
  let viewMode = $derived($dashboardViewMode);
</script>

{#if project?.state === 'fully-initialized'}
  <div class="border-b border-gray-800 bg-gray-900/50">
    <!-- Dashboard view tabs -->
    <DashboardViewTabs />

    {#if viewMode === 'epic'}
      <!-- Epic Progress view -->
      <EpicProgressView />
    {:else if viewMode === 'sprint'}
      <!-- Sprint Overview view -->
      <SprintProgressView />
    {/if}
  </div>
{/if}
