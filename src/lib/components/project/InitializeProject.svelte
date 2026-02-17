<script lang="ts">
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { onDestroy } from 'svelte';
  import { api } from '$lib/services/tauri';
  import { currentProject, projectLoading } from '$lib/stores/project';
  import { settings } from '$lib/stores/settings';
  import type { ProjectState, InitProgress, InitWorkflowStyle } from '$lib/types/project';

  // Props
  let {
    projectPath,
    currentState,
    onComplete,
  }: {
    projectPath: string;
    currentState: ProjectState;
    onComplete: () => void;
  } = $props();

  // Form state
  let projectName = $state('');
  let userName = $state('');
  let workflowStyle = $state<InitWorkflowStyle>('quick-flow');

  // Validation state
  let projectNameError = $state<string | null>(null);
  let userNameError = $state<string | null>(null);

  // UI state
  let initializing = $state(false);
  let currentStep = $state<string | null>(null);
  let statusMessage = $state<string | null>(null);
  let error = $state<string | null>(null);

  // Progress listener cleanup
  let unlisten: UnlistenFn | null = null;

  // Pre-fill from folder name and settings
  $effect(() => {
    // Extract folder name from path
    const parts = projectPath.split(/[/\\]/);
    const folderName = parts[parts.length - 1] || 'my-project';
    projectName = folderName;

    // Get user name from settings if available
    const currentSettings = $settings;
    if (currentSettings?.user?.name) {
      userName = currentSettings.user.name;
    }

    // Get workflow style from settings if available
    if (currentSettings?.bmad?.default_workflow) {
      workflowStyle = currentSettings.bmad.default_workflow === 'QuickFlow'
        ? 'quick-flow'
        : 'full-bmm';
    }
  });

  // Set up progress event listener - returns promise that resolves when ready
  async function setupProgressListener(): Promise<void> {
    return new Promise((resolve) => {
      listen<InitProgress>('init-progress', (event) => {
        currentStep = event.payload.step;
        statusMessage = event.payload.message;

        if (event.payload.status === 'failed') {
          error = event.payload.message;
        }
      }).then((unlistenFn) => {
        unlisten = unlistenFn;
        resolve();
      });
    });
  }

  // Clean up listener on destroy
  onDestroy(() => {
    if (unlisten) {
      unlisten();
    }
  });

  // Determine which initialization to perform
  function needsGit(): boolean {
    return currentState === 'empty' || currentState === 'bmad-only';
  }

  function needsBmad(): boolean {
    return currentState === 'empty' || currentState === 'git-only';
  }

  function getButtonLabel(): string {
    if (currentState === 'empty') {
      return 'Initialize Git + BMAD';
    } else if (currentState === 'git-only') {
      return 'Initialize BMAD';
    } else if (currentState === 'bmad-only') {
      return 'Initialize Git';
    }
    return 'Initialize';
  }

  /**
   * Validates form inputs and returns true if valid.
   */
  function validateForm(): boolean {
    let isValid = true;
    projectNameError = null;
    userNameError = null;

    if (needsBmad()) {
      // Validate project name
      const trimmedProjectName = projectName.trim();
      if (!trimmedProjectName) {
        projectNameError = 'Project name is required';
        isValid = false;
      } else if (trimmedProjectName.length > 100) {
        projectNameError = 'Project name must be 100 characters or less';
        isValid = false;
      } else if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_\-. ]*$/.test(trimmedProjectName)) {
        projectNameError = 'Project name must start with a letter, number, underscore, or hyphen';
        isValid = false;
      }

      // Validate user name
      const trimmedUserName = userName.trim();
      if (!trimmedUserName) {
        userNameError = 'Your name is required';
        isValid = false;
      } else if (trimmedUserName.length > 100) {
        userNameError = 'Name must be 100 characters or less';
        isValid = false;
      }
    }

    return isValid;
  }

  async function handleInitialize() {
    // Validate before proceeding
    if (!validateForm()) {
      return;
    }

    error = null;
    initializing = true;
    projectLoading.set(true);

    try {
      // Set up listener BEFORE calling API to avoid race condition
      await setupProgressListener();

      const options = {
        projectName: projectName.trim(),
        userName: userName.trim(),
        workflowStyle,
      };

      let project;

      if (currentState === 'empty') {
        // Initialize both Git and BMAD
        project = await api.initializeProject(projectPath, options);
      } else if (currentState === 'git-only') {
        // Initialize only BMAD
        project = await api.initBmadOnly(projectPath, options);
      } else if (currentState === 'bmad-only') {
        // Initialize only Git
        project = await api.initGitOnly(projectPath);
      }

      if (project) {
        currentProject.set(project);
        onComplete();
      }
    } catch (e) {
      error = extractErrorMessage(e);
    } finally {
      initializing = false;
      projectLoading.set(false);
      currentStep = null;
      statusMessage = null;

      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    }
  }

  /**
   * Extracts a human-readable error message from various error formats.
   * Rust errors come as objects like { BmadInitFailed: "message" }
   */
  function extractErrorMessage(e: unknown): string {
    if (e instanceof Error) {
      return e.message;
    }
    if (typeof e === 'string') {
      return e;
    }
    if (typeof e === 'object' && e !== null) {
      // Rust enum errors serialize as { VariantName: "message" }
      const values = Object.values(e);
      if (values.length > 0 && typeof values[0] === 'string') {
        return values[0];
      }
      // Try JSON stringifying for other objects
      try {
        return JSON.stringify(e);
      } catch {
        return 'An unknown error occurred';
      }
    }
    return 'An unknown error occurred';
  }

  function handleCancel() {
    onComplete();
  }
</script>

<div class="flex flex-col gap-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
  <h3 class="text-lg font-semibold text-gray-200">Initialize Project</h3>

  {#if initializing}
    <!-- Progress view -->
    <div class="flex flex-col gap-3" role="status" aria-live="polite" aria-label="Initialization progress">
      <div class="flex items-center gap-3">
        <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" aria-hidden="true"></div>
        <span class="text-gray-300">{statusMessage || 'Initializing...'}</span>
      </div>

      {#if needsGit() && needsBmad()}
        <div
          class="flex gap-2"
          role="progressbar"
          aria-label="Initialization steps"
          aria-valuenow={currentStep === 'bmad' ? 2 : 1}
          aria-valuemin="1"
          aria-valuemax="2"
        >
          <div class={`flex-1 h-2 rounded ${currentStep === 'git' || currentStep === 'bmad' ? 'bg-blue-500' : 'bg-gray-700'}`}>
            {#if currentStep === 'git'}
              <div class="h-full bg-blue-400 rounded animate-pulse"></div>
            {:else if currentStep === 'bmad'}
              <div class="h-full bg-green-500 rounded"></div>
            {/if}
          </div>
          <div class={`flex-1 h-2 rounded ${currentStep === 'bmad' ? 'bg-blue-500' : 'bg-gray-700'}`}>
            {#if currentStep === 'bmad'}
              <div class="h-full bg-blue-400 rounded animate-pulse"></div>
            {/if}
          </div>
        </div>
        <div class="flex justify-between text-xs text-gray-500" aria-hidden="true">
          <span>Git</span>
          <span>BMAD</span>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Form view -->
    <form onsubmit={(e) => { e.preventDefault(); handleInitialize(); }} class="flex flex-col gap-4">
      {#if needsBmad()}
        <div class="flex flex-col gap-1.5">
          <label for="project-name" class="text-sm text-gray-400">Project Name</label>
          <input
            id="project-name"
            type="text"
            bind:value={projectName}
            required
            maxlength="100"
            aria-describedby={projectNameError ? 'project-name-error' : undefined}
            aria-invalid={projectNameError ? 'true' : undefined}
            class="px-3 py-2 bg-gray-900 border rounded text-gray-200 focus:border-blue-500 focus:outline-none {projectNameError ? 'border-red-500' : 'border-gray-700'}"
            placeholder="my-project"
          />
          {#if projectNameError}
            <p id="project-name-error" class="text-xs text-red-400" role="alert">{projectNameError}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="user-name" class="text-sm text-gray-400">Your Name</label>
          <input
            id="user-name"
            type="text"
            bind:value={userName}
            required
            maxlength="100"
            aria-describedby={userNameError ? 'user-name-error' : undefined}
            aria-invalid={userNameError ? 'true' : undefined}
            class="px-3 py-2 bg-gray-900 border rounded text-gray-200 focus:border-blue-500 focus:outline-none {userNameError ? 'border-red-500' : 'border-gray-700'}"
            placeholder="Your Name"
          />
          {#if userNameError}
            <p id="user-name-error" class="text-xs text-red-400" role="alert">{userNameError}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="workflow-style" class="text-sm text-gray-400">Workflow Style</label>
          <select
            id="workflow-style"
            bind:value={workflowStyle}
            aria-describedby="workflow-style-description"
            class="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="quick-flow">QuickFlow (simpler, faster)</option>
            <option value="full-bmm">Full BMM (comprehensive)</option>
          </select>
          <p id="workflow-style-description" class="text-xs text-gray-500">
            {workflowStyle === 'quick-flow'
              ? 'Best for smaller projects or getting started quickly.'
              : 'Full methodology with epics, stories, and detailed planning.'}
          </p>
        </div>
      {:else}
        <p class="text-gray-400">
          This will initialize a Git repository in this folder.
        </p>
      {/if}

      {#if error}
        <div class="p-3 bg-red-900/30 border border-red-700 rounded" role="alert" aria-live="assertive">
          <p class="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            onclick={() => { error = null; }}
            class="mt-2 text-xs text-red-300 hover:text-red-200 underline"
          >
            Dismiss
          </button>
        </div>
      {/if}

      <div class="flex gap-2 mt-2">
        <button
          type="submit"
          class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          {getButtonLabel()}
        </button>
        <button
          type="button"
          onclick={handleCancel}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  {/if}
</div>
