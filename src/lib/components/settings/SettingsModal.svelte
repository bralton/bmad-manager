<script lang="ts">
  import { onMount } from 'svelte';
  import { settings, loadSettings, saveSettings } from '$lib/stores/settings';
  import { currentProject } from '$lib/stores/project';
  import { showSuccessToast, showErrorToast } from '$lib/stores/ui';
  import { settingsApi } from '$lib/services/tauri';
  import type { GlobalSettings, ProjectSettings } from '$lib/types/settings';
  import GlobalSettingsForm from './GlobalSettingsForm.svelte';
  import ProjectSettingsForm from './ProjectSettingsForm.svelte';

  let { onClose }: { onClose: () => void } = $props();

  type Tab = 'global' | 'project';

  // State
  let activeTab = $state<Tab>('global');
  let isLoading = $state(false);
  let isSaving = $state(false);

  // Form data (local copies for editing)
  let globalFormData = $state<GlobalSettings | null>(null);
  let projectFormData = $state<ProjectSettings>({});
  let originalGlobalData = $state<string>('');
  let originalProjectData = $state<string>('');

  // Validation state
  let globalFormValid = $state(true);
  let projectFormValid = $state(true);

  // Derived
  let project = $derived($currentProject);
  let projectName = $derived(project?.name || 'No Project');
  let hasProject = $derived(!!project);

  // Check if any data has changed
  let isGlobalDirty = $derived(
    globalFormData ? JSON.stringify(globalFormData) !== originalGlobalData : false
  );
  let isProjectDirty = $derived(
    hasProject && JSON.stringify(projectFormData) !== originalProjectData
  );
  let isDirty = $derived(isGlobalDirty || isProjectDirty);
  let canSave = $derived(isDirty && globalFormValid && (activeTab === 'global' || projectFormValid));

  // Confirmation dialog state
  let showConfirmDialog = $state(false);

  onMount(async () => {
    await loadFormData();
  });

  async function loadFormData() {
    isLoading = true;
    try {
      // Load global settings
      await loadSettings();
      if ($settings) {
        globalFormData = structuredClone($settings);
        originalGlobalData = JSON.stringify($settings);
      }

      // Load project settings if project is open
      if (project) {
        const projectSettings = await settingsApi.getProjectSettings(project.path);
        projectFormData = projectSettings;
        originalProjectData = JSON.stringify(projectSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showErrorToast('Failed to load settings');
    } finally {
      isLoading = false;
    }
  }

  async function handleSave() {
    if (!canSave) return;

    isSaving = true;
    try {
      // Save global settings if changed
      if (isGlobalDirty && globalFormData) {
        await saveSettings(globalFormData);
        originalGlobalData = JSON.stringify(globalFormData);
      }

      // Save project settings if changed and project is open
      if (isProjectDirty && project) {
        await settingsApi.saveProjectSettings(project.path, projectFormData);
        originalProjectData = JSON.stringify(projectFormData);
      }

      showSuccessToast('Settings saved', { duration: 2000 });
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      showErrorToast('Failed to save settings');
    } finally {
      isSaving = false;
    }
  }

  function handleClose() {
    if (isDirty) {
      showConfirmDialog = true;
    } else {
      onClose();
    }
  }

  function handleDiscard() {
    showConfirmDialog = false;
    onClose();
  }

  function handleKeepEditing() {
    showConfirmDialog = false;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && !isSaving) {
      handleClose();
    }
  }

  // Dialog element reference for focus trap
  let dialogRef: HTMLElement | null = null;

  function getFocusableElements(): HTMLElement[] {
    if (!dialogRef) return [];
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(dialogRef.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !el.hasAttribute('disabled')
    );
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !isSaving) {
      handleClose();
      return;
    }

    // Focus trap
    if (event.key === 'Tab') {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  function handleGlobalUpdate(data: GlobalSettings) {
    globalFormData = data;
  }

  function handleProjectUpdate(data: ProjectSettings) {
    projectFormData = data;
  }

  function handleGlobalValidChange(valid: boolean) {
    globalFormValid = valid;
  }

  function handleProjectValidChange(valid: boolean) {
    projectFormValid = valid;
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- Backdrop -->
<div
  class="fixed inset-0 bg-black/50 z-40"
  onclick={handleBackdropClick}
  role="presentation"
>
  <!-- Dialog -->
  <div
    bind:this={dialogRef}
    class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
      bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-dialog-title"
  >
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
      <h2 id="settings-dialog-title" class="text-lg font-semibold text-white">
        Settings
      </h2>
      <button
        onclick={handleClose}
        disabled={isSaving}
        class="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        aria-label="Close settings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-700 flex-shrink-0">
      <button
        onclick={() => (activeTab = 'global')}
        class="px-4 py-2 text-sm font-medium transition-colors
          {activeTab === 'global'
          ? 'text-blue-400 border-b-2 border-blue-500 -mb-px'
          : 'text-gray-500 hover:text-gray-300'}"
      >
        Global
      </button>
      <button
        onclick={() => (activeTab = 'project')}
        disabled={!hasProject}
        class="px-4 py-2 text-sm font-medium transition-colors
          {activeTab === 'project'
          ? 'text-blue-400 border-b-2 border-blue-500 -mb-px'
          : 'text-gray-500 hover:text-gray-300'}
          disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {#if hasProject}
          Project: {projectName}
        {:else}
          Project
        {/if}
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-6 py-4">
      {#if isLoading}
        <div class="flex items-center justify-center py-12">
          <div class="w-6 h-6 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
        </div>
      {:else if activeTab === 'global' && globalFormData}
        <GlobalSettingsForm
          settings={globalFormData}
          onUpdate={handleGlobalUpdate}
          onValidChange={handleGlobalValidChange}
        />
      {:else if activeTab === 'project'}
        {#if hasProject && globalFormData}
          <ProjectSettingsForm
            settings={projectFormData}
            globalSettings={globalFormData}
            onUpdate={handleProjectUpdate}
            onValidChange={handleProjectValidChange}
          />
        {:else}
          <div class="text-center py-12 text-gray-400">
            Open a project to configure project-specific settings.
          </div>
        {/if}
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-gray-700 flex justify-end gap-3 flex-shrink-0">
      <button
        onclick={handleClose}
        disabled={isSaving}
        class="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        onclick={handleSave}
        disabled={!canSave || isSaving}
        class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center gap-2"
      >
        {#if isSaving}
          <svg
            class="animate-spin h-4 w-4"
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
          <span>Saving...</span>
        {:else}
          <span>Save</span>
        {/if}
      </button>
    </div>
  </div>
</div>

<!-- Confirm Dialog -->
{#if showConfirmDialog}
  <div
    class="fixed inset-0 bg-black/50 z-[60]"
    role="presentation"
  >
    <div
      class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
        bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-sm w-full mx-4 p-6"
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <h3 id="confirm-title" class="text-lg font-semibold text-white mb-2">
        Discard unsaved changes?
      </h3>
      <p id="confirm-desc" class="text-gray-400 text-sm mb-6">
        You have unsaved changes that will be lost.
      </p>
      <div class="flex justify-end gap-3">
        <button
          onclick={handleKeepEditing}
          class="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors"
        >
          Keep Editing
        </button>
        <button
          onclick={handleDiscard}
          class="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  </div>
{/if}
