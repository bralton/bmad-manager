<script lang="ts">
  import type { ConflictWarning } from '$lib/types/conflict';

  let {
    conflicts,
  }: {
    conflicts: ConflictWarning[];
  } = $props();

  let expanded = $state(false);

  // Group shared files by conflicting story for display
  let conflictSummary = $derived.by(() => {
    return conflicts.map((c) => ({
      storyId: c.conflictsWith,
      fileCount: c.sharedFiles.length,
      files: c.sharedFiles,
    }));
  });

  let totalConflicts = $derived(conflicts.length);

  function toggleExpanded() {
    expanded = !expanded;
  }
</script>

<div
  class="bg-amber-900/20 border border-amber-500/50 rounded-lg overflow-hidden"
  role="alert"
  aria-live="polite"
>
  <!-- Header -->
  <button
    onclick={toggleExpanded}
    class="w-full flex items-center justify-between p-4 text-left hover:bg-amber-900/30 transition-colors"
    aria-expanded={expanded}
    aria-controls="conflict-details"
  >
    <div class="flex items-center gap-2">
      <!-- Warning icon -->
      <svg
        class="w-5 h-5 text-amber-400 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span class="text-sm font-medium text-amber-300">
        File Conflicts
        <span class="text-amber-400/70 ml-1">
          ({totalConflicts} {totalConflicts === 1 ? 'story' : 'stories'})
        </span>
      </span>
    </div>
    <!-- Expand/collapse chevron -->
    <svg
      class="w-4 h-4 text-amber-400 transition-transform duration-200"
      class:rotate-180={expanded}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <!-- Details (expandable) -->
  {#if expanded}
    <div
      id="conflict-details"
      class="px-4 pb-4 border-t border-amber-500/20"
    >
      <p class="text-xs text-amber-200/70 mt-3 mb-3">
        This story modifies files also touched by:
      </p>

      <ul class="space-y-3">
        {#each conflictSummary as conflict}
          <li>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-amber-200 text-sm font-medium">
                Story {conflict.storyId}
              </span>
              <span class="text-amber-400/60 text-xs">
                ({conflict.fileCount} shared {conflict.fileCount === 1 ? 'file' : 'files'})
              </span>
            </div>
            <ul class="pl-4 space-y-0.5">
              {#each conflict.files as file}
                <li class="font-mono text-xs text-amber-300/70 truncate" title={file}>
                  {file}
                </li>
              {/each}
            </ul>
          </li>
        {/each}
      </ul>

      <p class="text-xs text-amber-200/50 mt-4 italic">
        Consider coordinating with these stories to avoid merge pain.
      </p>
    </div>
  {/if}
</div>
