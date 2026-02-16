<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { api } from '$lib/services/tauri';
  import {
    currentProject,
    projectLoading,
    projectError,
  } from '$lib/stores/project';
  import { getStateLabel, getStateDescription } from '$lib/types/project';

  // Local UI state with Svelte 5 runes
  let selectingFolder = $state(false);

  // Reactive store access using Svelte 5 $ prefix (auto-subscribes/unsubscribes)
  let project = $derived($currentProject);
  let loading = $derived($projectLoading);
  let error = $derived($projectError);

  async function selectFolder() {
    selectingFolder = true;
    projectError.set(null);

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Folder',
      });

      if (selected) {
        projectLoading.set(true);
        const loadedProject = await api.openProject(selected);
        currentProject.set(loadedProject);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      projectError.set(message);
    } finally {
      selectingFolder = false;
      projectLoading.set(false);
    }
  }

  async function refreshProject() {
    if (!project) return;

    projectLoading.set(true);
    projectError.set(null);

    try {
      const refreshed = await api.refreshProject(project.path);
      currentProject.set(refreshed);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      projectError.set(message);
    } finally {
      projectLoading.set(false);
    }
  }

  function getStateColor(state: string): string {
    switch (state) {
      case 'fully-initialized':
        return 'text-green-400';
      case 'git-only':
        return 'text-yellow-400';
      case 'bmad-only':
        return 'text-orange-400';
      case 'empty':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  }
</script>

<div class="flex flex-col gap-4 p-4">
  {#if !project}
    <!-- No project loaded - show picker -->
    <div class="flex flex-col items-center gap-4 p-8 border border-gray-700 rounded-lg bg-gray-800/50">
      <h2 class="text-xl font-semibold text-gray-200">Open a Project</h2>
      <p class="text-gray-400 text-center">
        Select a folder to detect its initialization state and load BMAD configuration.
      </p>

      <button
        onclick={selectFolder}
        disabled={selectingFolder || loading}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
      >
        {#if selectingFolder || loading}
          Loading...
        {:else}
          Select Folder
        {/if}
      </button>

      {#if error}
        <p class="text-red-400 text-sm">{error}</p>
      {/if}
    </div>
  {:else}
    <!-- Project loaded - show info -->
    <div class="flex flex-col gap-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-200">{project.name}</h2>
        <span class={`text-sm font-medium ${getStateColor(project.state)}`}>
          {getStateLabel(project.state)}
        </span>
      </div>

      <p class="text-gray-400 text-sm">{project.path}</p>

      <p class="text-gray-300 text-sm">
        {getStateDescription(project.state)}
      </p>

      {#if project.state === 'git-only'}
        <div class="flex gap-2 mt-2">
          <button
            disabled
            class="px-3 py-1.5 text-sm bg-blue-600/50 text-blue-200 rounded cursor-not-allowed"
            aria-label="Initialize BMAD (coming in Story 1-10)"
            title="Coming in Story 1-10"
          >
            Initialize BMAD
          </button>
        </div>
      {:else if project.state === 'bmad-only'}
        <div class="flex gap-2 mt-2">
          <button
            disabled
            class="px-3 py-1.5 text-sm bg-blue-600/50 text-blue-200 rounded cursor-not-allowed"
            aria-label="Initialize Git (coming in Story 1-10)"
            title="Coming in Story 1-10"
          >
            Initialize Git
          </button>
        </div>
      {:else if project.state === 'empty'}
        <div class="flex gap-2 mt-2">
          <button
            disabled
            class="px-3 py-1.5 text-sm bg-blue-600/50 text-blue-200 rounded cursor-not-allowed"
            aria-label="Initialize Git and BMAD (coming in Story 1-10)"
            title="Coming in Story 1-10"
          >
            Initialize Git + BMAD
          </button>
        </div>
      {/if}

      {#if project.config}
        <div class="mt-2 p-3 bg-gray-900/50 rounded border border-gray-700">
          <h3 class="text-sm font-medium text-gray-300 mb-2">BMAD Configuration</h3>
          <dl class="grid grid-cols-2 gap-2 text-sm">
            <dt class="text-gray-500">Project Name</dt>
            <dd class="text-gray-300">{project.config.project_name}</dd>

            <dt class="text-gray-500">User</dt>
            <dd class="text-gray-300">{project.config.user_name}</dd>

            <dt class="text-gray-500">Output Folder</dt>
            <dd class="text-gray-300">{project.config.output_folder}</dd>

            <dt class="text-gray-500">Language</dt>
            <dd class="text-gray-300">{project.config.communication_language}</dd>
          </dl>
        </div>
      {/if}

      <div class="flex gap-2 mt-2">
        <button
          onclick={selectFolder}
          disabled={selectingFolder || loading}
          class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-200 rounded transition-colors"
        >
          Open Different Folder
        </button>

        <button
          onclick={refreshProject}
          disabled={loading}
          class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-200 rounded transition-colors"
        >
          {#if loading}
            Refreshing...
          {:else}
            Refresh
          {/if}
        </button>
      </div>

      {#if error}
        <p class="text-red-400 text-sm mt-2">{error}</p>
      {/if}
    </div>
  {/if}
</div>
