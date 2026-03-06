<script lang="ts">
  import BugCard from './BugCard.svelte';
  import { KANBAN_COLUMNS, type Bug, type StoryStatus } from '$lib/types/stories';

  let { bugs }: { bugs: Bug[] } = $props();

  // Storage key for collapse state
  const storageKey = 'bugs-row-collapsed';

  // Load initial collapse state from localStorage
  let collapsed = $state(false);

  // Initialize collapse state once mounted
  $effect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'true') {
        collapsed = true;
      }
    } catch {
      // Ignore storage errors
    }
  });

  function saveCollapseState(value: boolean) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      // Ignore storage errors
    }
  }

  function toggleCollapse() {
    collapsed = !collapsed;
    saveCollapseState(collapsed);
  }

  // Check if all bugs are done
  let allDone = $derived(bugs.every((b) => b.status === 'done'));

  // Group bugs by status for the kanban columns
  let bugsByStatus = $derived.by(() => {
    const result = new Map<StoryStatus, Bug[]>();
    for (const column of KANBAN_COLUMNS) {
      result.set(column.status, []);
    }
    for (const bug of bugs) {
      result.get(bug.status)?.push(bug);
    }
    return result;
  });
</script>

<div class="bg-gray-800/50 rounded-lg border border-gray-700">
  <!-- Bugs Header -->
  <button
    onclick={toggleCollapse}
    class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800/80 rounded-t-lg transition-colors"
    aria-expanded={!collapsed}
    aria-label="Bugs, {collapsed ? 'expand' : 'collapse'}"
  >
    <span
      class="text-gray-400 transform transition-transform text-xs"
      style:transform={collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}
    >
      &#x25BC;
    </span>
    <!-- Bug icon in header -->
    <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M6.56 1.14a.75.75 0 01.177 1.045 3.989 3.989 0 00-.464.86c.185.17.382.329.59.473A3.993 3.993 0 0110 2c1.272 0 2.405.594 3.137 1.518.208-.144.405-.302.59-.473a3.989 3.989 0 00-.464-.86.75.75 0 011.222-.869c.369.519.65 1.105.822 1.736a.75.75 0 01-.174.707 5.475 5.475 0 01-1.14.86 4.002 4.002 0 01-.673 2.149c.564.069 1.09.263 1.544.548a.75.75 0 11-.774 1.284 2.495 2.495 0 00-1.322-.387H7.232c-.476 0-.92.146-1.322.387a.75.75 0 01-.774-1.284c.453-.285.98-.479 1.544-.548a4.003 4.003 0 01-.673-2.15 5.475 5.475 0 01-1.14-.859.75.75 0 01-.174-.707c.172-.63.453-1.217.822-1.736a.75.75 0 011.045-.177zM10 4a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM5.75 10.5H5a.75.75 0 000 1.5h.75v1.25a.75.75 0 001.5 0V12h5.5v1.25a.75.75 0 001.5 0V12H15a.75.75 0 000-1.5h-.75V9.25a.75.75 0 00-1.5 0v1.25h-5.5V9.25a.75.75 0 00-1.5 0v1.25zM5.75 15H5a.75.75 0 000 1.5h.75v1.75a.75.75 0 001.5 0V16.5h5.5v1.75a.75.75 0 001.5 0V16.5H15a.75.75 0 000-1.5h-.75v-1.25a.75.75 0 00-1.5 0V15h-5.5v-1.25a.75.75 0 00-1.5 0V15z" clip-rule="evenodd" />
    </svg>
    <span class="font-medium text-sm text-red-400">Bugs</span>
    {#if allDone}
      <span class="text-green-500 text-xs ml-1" title="All bugs fixed">&#x2713;</span>
    {/if}
    <span class="text-xs text-gray-500 ml-auto">
      {bugs.length} {bugs.length === 1 ? 'bug' : 'bugs'}
    </span>
  </button>

  <!-- Bug Cards Grid -->
  {#if !collapsed}
    <div class="flex gap-2 p-2 pt-0">
      {#each KANBAN_COLUMNS as column}
        <div class="flex-1 min-w-[180px] min-h-[60px]">
          <div class="space-y-2">
            {#each bugsByStatus.get(column.status) || [] as bug (bug.id)}
              <BugCard {bug} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
