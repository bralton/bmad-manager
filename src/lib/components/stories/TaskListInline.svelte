<script lang="ts">
  import type { StoryTask } from '$lib/types/workflow';

  let { tasks, maxDisplay = 6 }: { tasks: StoryTask[]; maxDisplay?: number } = $props();

  // Calculate how many tasks to show and if we need "and X more..."
  let displayTasks = $derived(tasks.slice(0, maxDisplay));
  let remainingCount = $derived(tasks.length - maxDisplay);
  let hasMore = $derived(remainingCount > 0);
</script>

<div class="border-t border-gray-700 mt-2 pt-2 text-xs" aria-live="polite" aria-atomic="false">
  <ul class="space-y-0.5" role="list" aria-label="Task list">
    {#each displayTasks as task}
      <li
        class="flex items-start gap-1.5 text-gray-300"
        class:pl-3={task.level > 0}
      >
        <!-- Checkbox icon -->
        {#if task.completed}
          <svg class="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        {:else}
          <svg class="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke-width="2" />
          </svg>
        {/if}
        <!-- Task text -->
        <span class="truncate" class:text-gray-500={task.completed} class:line-through={task.completed}>
          {task.text}
        </span>
      </li>
    {/each}
  </ul>

  {#if hasMore}
    <div class="mt-1 text-gray-500 text-xs pl-5">
      ... and {remainingCount} more
    </div>
  {/if}
</div>
