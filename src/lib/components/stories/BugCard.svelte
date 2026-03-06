<script lang="ts">
  import { KANBAN_COLUMNS, type Bug } from '$lib/types/stories';
  import { setSelectedBugId, selectedBugId } from '$lib/stores/stories';

  let { bug }: { bug: Bug } = $props();

  // Check if this bug is currently selected
  let isSelected = $derived($selectedBugId === bug.id);

  // Convert slug to readable title (replace hyphens with spaces, title case)
  let title = $derived.by(() => {
    return bug.slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Get the column config for this bug's status
  let columnConfig = $derived(
    KANBAN_COLUMNS.find((c) => c.status === bug.status) || KANBAN_COLUMNS[0]
  );

  // Build aria label
  let ariaLabel = $derived(
    `Bug ${bug.bugNumber}: ${title}, status: ${columnConfig.label}`
  );

  // Build CSS classes for button
  let buttonClasses = $derived.by(() => {
    const selectedStyles = isSelected
      ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-gray-900'
      : '';
    return `w-full text-left bg-gray-800 rounded-lg p-3 border border-gray-700
      hover:bg-gray-750 hover:border-gray-600 hover:shadow-md
      focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900
      cursor-pointer transition-all min-h-[80px]
      border-l-2 border-red-500 relative group bg-red-900/10 ${selectedStyles}`;
  });

  function handleClick() {
    setSelectedBugId(bug.id);
  }
</script>

<button
  onclick={handleClick}
  class={buttonClasses}
  aria-label={ariaLabel}
  tabindex="0"
>
  <!-- Header row with bug number and badge -->
  <div class="flex items-center justify-between mb-1">
    <div class="flex items-center gap-1.5">
      <!-- Bug icon -->
      <svg class="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M6.56 1.14a.75.75 0 01.177 1.045 3.989 3.989 0 00-.464.86c.185.17.382.329.59.473A3.993 3.993 0 0110 2c1.272 0 2.405.594 3.137 1.518.208-.144.405-.302.59-.473a3.989 3.989 0 00-.464-.86.75.75 0 011.222-.869c.369.519.65 1.105.822 1.736a.75.75 0 01-.174.707 5.475 5.475 0 01-1.14.86 4.002 4.002 0 01-.673 2.149c.564.069 1.09.263 1.544.548a.75.75 0 11-.774 1.284 2.495 2.495 0 00-1.322-.387H7.232c-.476 0-.92.146-1.322.387a.75.75 0 01-.774-1.284c.453-.285.98-.479 1.544-.548a4.003 4.003 0 01-.673-2.15 5.475 5.475 0 01-1.14-.859.75.75 0 01-.174-.707c.172-.63.453-1.217.822-1.736a.75.75 0 011.045-.177zM10 4a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM5.75 10.5H5a.75.75 0 000 1.5h.75v1.25a.75.75 0 001.5 0V12h5.5v1.25a.75.75 0 001.5 0V12H15a.75.75 0 000-1.5h-.75V9.25a.75.75 0 00-1.5 0v1.25h-5.5V9.25a.75.75 0 00-1.5 0v1.25zM5.75 15H5a.75.75 0 000 1.5h.75v1.75a.75.75 0 001.5 0V16.5h5.5v1.75a.75.75 0 001.5 0V16.5H15a.75.75 0 000-1.5h-.75v-1.25a.75.75 0 00-1.5 0V15h-5.5v-1.25a.75.75 0 00-1.5 0V15z" clip-rule="evenodd" />
      </svg>
      <span class="text-xs font-mono text-red-400">BUG-{bug.bugNumber}</span>
    </div>
  </div>

  <!-- Title -->
  <div class="text-sm font-medium text-white truncate">{title}</div>
</button>

<style>
  /* Custom hover state since Tailwind doesn't have gray-750 by default */
  button:hover {
    background-color: rgb(45, 55, 72);
  }
</style>
