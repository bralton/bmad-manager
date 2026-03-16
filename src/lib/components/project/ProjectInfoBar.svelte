<script lang="ts">
  import { currentProject } from '$lib/stores/project';
  import { showToast } from '$lib/stores/ui';
  import { getStateLabel, type ProjectState } from '$lib/types/project';

  let project = $derived($currentProject);

  /**
   * Returns the appropriate badge color classes based on project state.
   */
  function getStateBadgeClass(state: ProjectState): string {
    switch (state) {
      case 'fully-initialized':
        return 'bg-green-900/50 text-green-400';
      case 'git-only':
        return 'bg-yellow-900/50 text-yellow-400';
      case 'bmad-only':
        return 'bg-orange-900/50 text-orange-400';
      case 'empty':
        return 'bg-gray-700 text-gray-400';
    }
  }

  /**
   * Copies the project path to clipboard and shows a toast.
   */
  async function copyPath() {
    if (project?.path) {
      try {
        await navigator.clipboard.writeText(project.path);
        showToast('Path copied to clipboard', '📋');
      } catch (e) {
        console.error('Failed to copy path:', e);
        showToast('Failed to copy path', '✗', 3000);
      }
    }
  }
</script>

{#if project}
  <div
    data-testid="project-info-bar"
    class="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700"
  >
    <!-- Folder icon -->
    <span class="text-gray-400">📁</span>

    <!-- Project name -->
    <span class="font-medium text-gray-100 truncate max-w-[200px]">
      {project.name}
    </span>

    <!-- Status badge -->
    <span
      data-testid="project-status-badge"
      class="text-xs px-2 py-0.5 rounded-full shrink-0 {getStateBadgeClass(project.state)}"
    >
      {getStateLabel(project.state)}
    </span>

    <!-- Separator -->
    <span class="text-gray-600">|</span>

    <!-- Project path (click to copy) - uses RTL direction for left-truncation -->
    <button
      data-testid="project-path"
      onclick={copyPath}
      class="font-mono text-sm text-gray-400 truncate max-w-md cursor-pointer hover:text-gray-200 transition-colors [direction:rtl]"
      title="Click to copy path"
      aria-label="Copy project path to clipboard"
    >
      <bdi>{project.path}</bdi>
    </button>
  </div>
{/if}
