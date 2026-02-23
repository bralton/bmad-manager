<script lang="ts">
  import StoryCard from './StoryCard.svelte';
  import { KANBAN_COLUMNS, type Epic, type Story, type StoryStatus } from '$lib/types/stories';
  import { epicTitles } from '$lib/stores/stories';

  let { epic, stories }: { epic: Epic; stories: Story[] } = $props();

  // Storage key derived from epic ID
  let storageKey = $derived(`epic-${epic.id}-collapsed`);

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

  // Check if all stories in this epic are done
  let allDone = $derived(stories.every((s) => s.status === 'done'));

  // Group stories by status for the kanban columns
  let storiesByStatus = $derived.by(() => {
    const result = new Map<StoryStatus, Story[]>();
    for (const column of KANBAN_COLUMNS) {
      result.set(column.status, []);
    }
    for (const story of stories) {
      result.get(story.status)?.push(story);
    }
    return result;
  });

  // Get title from store (may be undefined if not loaded yet)
  let title = $derived($epicTitles.get(epic.id));
  // Format epic title with optional title suffix
  let epicTitle = $derived(title ? `Epic ${epic.id}:` : `Epic ${epic.id}`);
</script>

<div class="bg-gray-800/50 rounded-lg border border-gray-700">
  <!-- Epic Header -->
  <button
    onclick={toggleCollapse}
    class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800/80 rounded-t-lg transition-colors"
    aria-expanded={!collapsed}
    aria-label="{epicTitle}, {collapsed ? 'expand' : 'collapse'}"
  >
    <span
      class="text-gray-400 transform transition-transform text-xs"
      style:transform={collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}
    >
      &#x25BC;
    </span>
    <span class="font-medium text-sm text-gray-200">{epicTitle}</span>
    {#if title}
      <span class="font-medium text-sm text-gray-400">{title}</span>
    {/if}
    {#if allDone}
      <span class="text-green-500 text-xs ml-1" title="All stories completed">&#x2713;</span>
    {/if}
    <span class="text-xs text-gray-500 ml-auto">
      {stories.length} {stories.length === 1 ? 'story' : 'stories'}
    </span>
  </button>

  <!-- Story Cards Grid -->
  {#if !collapsed}
    <div class="flex gap-2 p-2 pt-0">
      {#each KANBAN_COLUMNS as column}
        <div class="flex-1 min-w-[180px] min-h-[60px]">
          <div class="space-y-2">
            {#each storiesByStatus.get(column.status) || [] as story (story.id)}
              <StoryCard {story} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
