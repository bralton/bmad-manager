<script lang="ts">
  import { get } from 'svelte/store';
  import { selectedStoryId } from '$lib/stores/stories';
  import { currentProject } from '$lib/stores/project';
  import { worktreesByStory, worktreeCreating, setWorktreeCreating, refreshWorktrees } from '$lib/stores/worktrees';
  import { showSuccessToast, showErrorToast } from '$lib/stores/ui';
  import { worktreeApi, parseWorktreeError } from '$lib/services/worktrees';
  import { KANBAN_COLUMNS, type Story } from '$lib/types/stories';

  let { story }: { story: Story } = $props();

  // Get worktree for this story
  let worktree = $derived($worktreesByStory.get(story.id));
  let isCreating = $derived($worktreeCreating.get(story.id) ?? false);

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

  async function handleCreateWorktree(event: MouseEvent) {
    event.stopPropagation();

    const project = get(currentProject);
    if (!project) {
      showErrorToast('No project loaded');
      return;
    }

    setWorktreeCreating(story.id, true);

    try {
      const createdWorktree = await worktreeApi.createWorktree(project.path, {
        storyId: story.id,
        storySlug: story.slug,
      });

      showSuccessToast(`Worktree created: ${createdWorktree.branch}`, {
        duration: 4000,
        action: {
          label: 'Open Window',
          onClick: () => {
            // Placeholder - actual implementation in Story 3-5
            // TODO(Story 3-5): Open worktree in new window
          },
        },
      });

      // Refresh worktrees to update the store
      await refreshWorktrees(project.path);
    } catch (error) {
      const message = parseWorktreeError(error);
      showErrorToast(message);
    } finally {
      setWorktreeCreating(story.id, false);
    }
  }

  // Build aria label
  let ariaLabel = $derived(
    `Story ${displayId}: ${title}, status: ${columnConfig.label}${worktree ? ', has worktree' : ''}`
  );
</script>

<button
  onclick={handleClick}
  class="w-full text-left bg-gray-800 rounded-lg p-3 border border-gray-700
    hover:bg-gray-750 hover:border-gray-600 hover:shadow-md
    focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
    cursor-pointer transition-all min-h-[80px]
    border-l-2 {columnConfig.borderColor} relative group"
  aria-label={ariaLabel}
  tabindex="0"
>
  <!-- Header row with ID and worktree badge -->
  <div class="flex items-center justify-between mb-1">
    <span class="text-xs font-mono text-gray-400">{displayId}</span>

    <!-- Worktree badge / loading / hover action -->
    <div class="flex items-center gap-1">
      {#if isCreating}
        <!-- Loading spinner -->
        <span
          class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-indigo-600/50 text-indigo-200"
          title="Creating worktree..."
        >
          <svg
            class="animate-spin h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </span>
      {:else if worktree}
        <!-- Worktree badge -->
        <span
          class="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-indigo-100"
          title="Working in worktree: {worktree.path}"
        >
          WT
        </span>
      {:else}
        <!-- Create worktree indicator (visible on hover) -->
        <!-- Using div with role="button" to avoid nested buttons -->
        <div
          onclick={handleCreateWorktree}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCreateWorktree(e as unknown as MouseEvent); } }}
          role="button"
          tabindex={-1}
          class="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400
            hover:bg-indigo-600 hover:text-indigo-100 cursor-pointer
            opacity-0 group-hover:opacity-100 transition-opacity"
          title="Create worktree"
        >
          + WT
        </div>
      {/if}
    </div>
  </div>

  <!-- Title / Creating message -->
  {#if isCreating}
    <div class="text-sm font-medium text-gray-400 truncate italic">Creating worktree...</div>
  {:else}
    <div class="text-sm font-medium text-white truncate">{title}</div>
  {/if}
</button>

<style>
  /* Custom hover state since Tailwind doesn't have gray-750 by default */
  button:hover {
    background-color: rgb(45, 55, 72);
  }
</style>
