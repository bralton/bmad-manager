<script lang="ts">
  import { selectedStoryId } from '$lib/stores/stories';
  import { KANBAN_COLUMNS, type Story } from '$lib/types/stories';

  let { story }: { story: Story } = $props();

  // Convert slug to readable title (replace hyphens with spaces, title case)
  let title = $derived.by(() => {
    return story.slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Get display ID (e.g., "3-2" or "1-5-2" for sub-stories)
  let displayId = $derived.by(() => {
    if (story.subStoryNumber != null) {
      return `${story.epicId}-${story.storyNumber}-${story.subStoryNumber}`;
    }
    return `${story.epicId}-${story.storyNumber}`;
  });

  // Get the column config for this story's status
  let columnConfig = $derived(
    KANBAN_COLUMNS.find((c) => c.status === story.status) || KANBAN_COLUMNS[0]
  );

  function handleClick() {
    selectedStoryId.set(story.id);
  }

  // Build aria label
  let ariaLabel = $derived(
    `Story ${displayId}: ${title}, status: ${columnConfig.label}`
  );
</script>

<button
  onclick={handleClick}
  class="w-full text-left bg-gray-800 rounded-lg p-3 border border-gray-700
    hover:bg-gray-750 hover:border-gray-600 hover:shadow-md
    focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
    cursor-pointer transition-all min-h-[80px]
    border-l-2 {columnConfig.borderColor}"
  aria-label={ariaLabel}
  tabindex="0"
>
  <div class="text-xs font-mono text-gray-400 mb-1">{displayId}</div>
  <div class="text-sm font-medium text-white truncate">{title}</div>
</button>

<style>
  /* Custom hover state since Tailwind doesn't have gray-750 by default */
  button:hover {
    background-color: rgb(45, 55, 72);
  }
</style>
