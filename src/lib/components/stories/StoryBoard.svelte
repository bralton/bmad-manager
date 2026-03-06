<script lang="ts">
  import EpicRow from './EpicRow.svelte';
  import BugsRow from './BugsRow.svelte';
  import { KANBAN_COLUMNS, type SprintStatus, type Story } from '$lib/types/stories';

  let { status }: { status: SprintStatus } = $props();

  // Group stories by epic for rendering
  let storiesByEpic = $derived.by(() => {
    const result = new Map<string, Story[]>();
    for (const story of status.stories) {
      const existing = result.get(story.epicId);
      if (existing) {
        existing.push(story);
      } else {
        result.set(story.epicId, [story]);
      }
    }
    return result;
  });

  // Get count of stories AND bugs per column (AC #7)
  function getColumnCount(statusValue: string): number {
    const storyCount = status.stories.filter((s) => s.status === statusValue).length;
    const bugCount = status.bugs.filter((b) => b.status === statusValue).length;
    return storyCount + bugCount;
  }

  // Check if bugs exist to render BugsRow (AC #8)
  let hasBugs = $derived(status.bugs && status.bugs.length > 0);
</script>

<div class="p-4">
  <!-- Column Headers -->
  <div class="flex gap-2 mb-4">
    {#each KANBAN_COLUMNS as column}
      <div class="flex-1 min-w-[180px]">
        <div class="flex items-center gap-2 px-3 py-2">
          <span class="{column.textColor} font-medium text-sm">{column.label}</span>
          <span class="text-xs text-gray-500">({getColumnCount(column.status)})</span>
        </div>
        <div class="h-0.5 {column.borderColor} bg-current opacity-50"></div>
      </div>
    {/each}
  </div>

  <!-- Epic Rows -->
  <div class="space-y-3">
    {#each status.epics as epic (epic.id)}
      {@const epicStories = storiesByEpic.get(epic.id) || []}
      {#if epicStories.length > 0}
        <EpicRow {epic} stories={epicStories} />
      {/if}
    {/each}

    <!-- Bugs Row (AC #6, #8) - only shown if bugs exist -->
    {#if hasBugs}
      <BugsRow bugs={status.bugs} />
    {/if}
  </div>
</div>
