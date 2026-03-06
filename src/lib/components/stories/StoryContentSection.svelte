<script lang="ts">
  /**
   * StoryContentSection - Collapsible section for story content display.
   *
   * Story 5-13: Story Detail Panel - Full Content View
   * AC1: Display content sections
   * AC2: Show task completion state
   * AC3: Scrollable within panel
   */

  let {
    title,
    content,
    defaultExpanded = false,
    showTasks = false,
  }: {
    title: string;
    content: string;
    defaultExpanded?: boolean;
    showTasks?: boolean;
  } = $props();

  // svelte-ignore state_referenced_locally - defaultExpanded only captures initial value (intentional)
  let isExpanded = $state(defaultExpanded);

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleExpanded();
    }
  }

  /**
   * Parses task lines to extract completion state.
   * Returns array of { text, completed, level } objects.
   */
  function parseTasks(text: string): Array<{ text: string; completed: boolean; level: number }> {
    const lines = text.split('\n');
    const tasks: Array<{ text: string; completed: boolean; level: number }> = [];

    for (const line of lines) {
      const trimmed = line.trimStart();
      const indent = line.length - trimmed.length;
      const level = Math.floor(indent / 2);

      // Check for task patterns (with or without trailing space after checkbox)
      if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ')) {
        tasks.push({ text: trimmed.slice(6).trim(), completed: false, level });
      } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('* [ ]')) {
        // Handle case without trailing space (e.g., "- [ ]Task")
        tasks.push({ text: trimmed.slice(5).trim(), completed: false, level });
      } else if (
        trimmed.startsWith('- [x] ') ||
        trimmed.startsWith('- [X] ') ||
        trimmed.startsWith('* [x] ') ||
        trimmed.startsWith('* [X] ')
      ) {
        tasks.push({ text: trimmed.slice(6).trim(), completed: true, level });
      } else if (
        trimmed.startsWith('- [x]') ||
        trimmed.startsWith('- [X]') ||
        trimmed.startsWith('* [x]') ||
        trimmed.startsWith('* [X]')
      ) {
        // Handle case without trailing space (e.g., "- [x]Task")
        tasks.push({ text: trimmed.slice(5).trim(), completed: true, level });
      }
    }

    return tasks;
  }

  // Parse tasks if showing task view
  let tasks = $derived(showTasks ? parseTasks(content) : []);
</script>

<div class="border border-gray-700 rounded-lg overflow-hidden">
  <!-- Header (clickable to expand/collapse) -->
  <button
    onclick={toggleExpanded}
    onkeydown={handleKeydown}
    class="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 transition-colors text-left"
    aria-expanded={isExpanded}
  >
    <h4 class="text-sm font-medium text-gray-300">{title}</h4>
    <svg
      class="w-4 h-4 text-gray-400 transition-transform"
      class:rotate-180={isExpanded}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <!-- Content (collapsible) -->
  {#if isExpanded}
    <div class="px-3 py-2 bg-gray-900 text-sm max-h-64 overflow-y-auto">
      {#if showTasks && tasks.length > 0}
        <!-- Task list view with checkboxes (AC2) - matches TaskListInline styling -->
        <ul class="space-y-1" role="list" aria-label="Task list">
          {#each tasks as task}
            <li
              class="flex items-start gap-1.5 text-gray-300"
              class:pl-4={task.level > 0}
            >
              <!-- Checkbox icon (matches TaskListInline) -->
              {#if task.completed}
                <svg class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              {:else}
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke-width="2" />
                </svg>
              {/if}
              <!-- Task text -->
              <span class:text-gray-500={task.completed} class:line-through={task.completed}>
                {task.text}
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <!-- Plain text content with basic markdown-like formatting -->
        <div class="text-gray-300 whitespace-pre-wrap leading-relaxed story-content">
          {content}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Custom hover state */
  button:hover {
    background-color: rgb(45, 55, 72);
  }

  /* Basic styling for story content */
  .story-content {
    font-family: inherit;
  }
</style>
