<script lang="ts">
  import type { DependencyStatus } from '$lib/types/settings';
  import {
    dependencies,
    dependenciesLoading,
    dependenciesError,
    allDependenciesSatisfied,
    checkDependencies,
    completeWizard,
    settings,
  } from '$lib/stores/settings';
  import { onMount } from 'svelte';

  // Constants
  const MAX_NAME_LENGTH = 100;

  // Wizard state
  let currentStep = $state(1);
  const totalSteps = 3;

  // Form state - will be pre-filled from existing settings if available
  let userName = $state('');
  let workflowStyle = $state<'QuickFlow' | 'FullBMM'>('QuickFlow');
  let ideCommand = $state('code .');

  // UI state
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  // Derived state
  let deps = $derived($dependencies);
  let isCheckingDeps = $derived($dependenciesLoading);
  let depsError = $derived($dependenciesError);
  let canProceedFromStep1 = $derived($allDependenciesSatisfied);
  let canProceedFromStep2 = $derived(userName.trim().length > 0 && userName.trim().length <= MAX_NAME_LENGTH);

  // Run dependency check on mount and pre-fill existing settings
  onMount(() => {
    checkDependencies();

    // Pre-fill form with existing settings if available (for re-running wizard)
    const currentSettings = $settings;
    if (currentSettings) {
      userName = currentSettings.user?.name || '';
      workflowStyle = currentSettings.bmad?.default_workflow || 'QuickFlow';
      ideCommand = currentSettings.tools?.ide_command || 'code .';
    }
  });

  async function handleRecheck() {
    await checkDependencies();
  }

  function nextStep() {
    if (currentStep < totalSteps) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
    }
  }

  async function handleComplete() {
    isSubmitting = true;
    submitError = null;

    try {
      await completeWizard(userName.trim(), workflowStyle, ideCommand.trim() || 'code .');
      // The store will update showWizard to false, closing the wizard
    } catch (error) {
      submitError = error instanceof Error ? error.message : String(error);
    } finally {
      isSubmitting = false;
    }
  }

  function getStatusIcon(dep: DependencyStatus): string {
    if (!dep.installed) return '✗';
    if (!dep.versionOk) return '⚠';
    return '✓';
  }

  function getStatusColor(dep: DependencyStatus): string {
    if (!dep.installed) return 'text-red-400';
    if (!dep.versionOk) return 'text-yellow-400';
    return 'text-green-400';
  }
</script>

<div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
  <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-700">
      <h2 class="text-xl font-semibold text-gray-100">BMAD Manager Setup</h2>
      <p class="text-sm text-gray-400 mt-1">
        Step {currentStep} of {totalSteps}:
        {#if currentStep === 1}
          Check Dependencies
        {:else if currentStep === 2}
          Your Profile
        {:else}
          Confirmation
        {/if}
      </p>
    </div>

    <!-- Content -->
    <div class="px-6 py-6 min-h-[280px]">
      {#if currentStep === 1}
        <!-- Step 1: Dependency Check -->
        <div class="space-y-4">
          {#each deps as dep}
            <div class="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
              <div class="flex items-center gap-3">
                <span class="text-lg {getStatusColor(dep)}">{getStatusIcon(dep)}</span>
                <span class="text-gray-200">{dep.name}</span>
                {#if dep.minVersion}
                  <span class="text-xs text-gray-500">(requires {dep.minVersion}+)</span>
                {/if}
              </div>
              <div class="text-right">
                {#if dep.installed && dep.version}
                  <span class="text-sm text-gray-400">v{dep.version}</span>
                {:else if !dep.installed}
                  <span class="text-sm text-red-400">Missing</span>
                {:else if !dep.versionOk}
                  <span class="text-sm text-yellow-400">Update needed</span>
                {/if}
              </div>
            </div>
            {#if dep.installCommand && (!dep.installed || !dep.versionOk)}
              <div class="ml-8 -mt-2 mb-2">
                <code class="text-xs bg-gray-900 px-2 py-1 rounded text-gray-300">{dep.installCommand}</code>
              </div>
            {/if}
          {/each}

          {#if depsError}
            <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 mt-4">
              <p class="text-red-300 text-sm">Failed to check dependencies: {depsError}</p>
            </div>
          {:else if deps.length === 0 && !isCheckingDeps}
            <p class="text-gray-400 text-center py-4">No dependency information available.</p>
          {/if}

          <button
            onclick={handleRecheck}
            disabled={isCheckingDeps}
            class="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-200 rounded transition-colors"
          >
            {isCheckingDeps ? 'Checking...' : 'Re-check Dependencies'}
          </button>

          {#if !canProceedFromStep1 && deps.length > 0}
            <p class="text-sm text-yellow-400 mt-2">
              Please install missing dependencies before continuing.
            </p>
          {/if}
        </div>

      {:else if currentStep === 2}
        <!-- Step 2: User Profile -->
        <div class="space-y-6">
          <div>
            <label for="userName" class="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <input
              id="userName"
              type="text"
              bind:value={userName}
              placeholder="Enter your name"
              maxlength={MAX_NAME_LENGTH}
              class="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {#if userName.trim().length > MAX_NAME_LENGTH}
              <p class="text-xs text-red-400 mt-1">Name must be {MAX_NAME_LENGTH} characters or less</p>
            {:else}
              <p class="text-xs text-gray-500 mt-1">{userName.trim().length}/{MAX_NAME_LENGTH} characters</p>
            {/if}
          </div>

          <div>
            <label for="workflowStyle" class="block text-sm font-medium text-gray-300 mb-2">
              Default Workflow Style
            </label>
            <select
              id="workflowStyle"
              bind:value={workflowStyle}
              class="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="QuickFlow">QuickFlow (Faster, less formal)</option>
              <option value="FullBMM">FullBMM (Comprehensive, structured)</option>
            </select>
          </div>

          <div>
            <label for="ideCommand" class="block text-sm font-medium text-gray-300 mb-2">
              IDE Command (optional)
            </label>
            <input
              id="ideCommand"
              type="text"
              bind:value={ideCommand}
              placeholder="code ."
              class="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">
              Command to open your IDE (e.g., "code ." for VS Code, "cursor ." for Cursor)
            </p>
          </div>
        </div>

      {:else}
        <!-- Step 3: Confirmation -->
        <div class="space-y-6">
          <div class="bg-gray-900 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-400 mb-3">Setup Summary</h3>
            <dl class="space-y-2">
              <div class="flex justify-between">
                <dt class="text-gray-500">Name:</dt>
                <dd class="text-gray-200">{userName}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Workflow:</dt>
                <dd class="text-gray-200">{workflowStyle}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">IDE:</dt>
                <dd class="text-gray-200">{ideCommand || 'code .'}</dd>
              </div>
            </dl>
          </div>

          {#if canProceedFromStep1}
            <div class="bg-green-900/30 border border-green-800 rounded-lg p-4">
              <div class="flex gap-3">
                <span class="text-green-400 text-lg">✓</span>
                <div>
                  <p class="text-green-300 font-medium">All dependencies satisfied</p>
                  <p class="text-green-400/70 text-sm mt-1">
                    Git, Node.js, and Claude CLI are installed and ready.
                  </p>
                </div>
              </div>
            </div>
          {:else}
            <div class="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4">
              <div class="flex gap-3">
                <span class="text-yellow-400 text-lg">⚠</span>
                <div>
                  <p class="text-yellow-300 font-medium">Dependencies may have changed</p>
                  <p class="text-yellow-400/70 text-sm mt-1">
                    Go back to Step 1 to verify all dependencies are still satisfied.
                  </p>
                </div>
              </div>
            </div>
          {/if}

          {#if submitError}
            <div class="bg-red-900/30 border border-red-800 rounded-lg p-4">
              <p class="text-red-300">{submitError}</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-gray-700 flex justify-between">
      <div>
        {#if currentStep > 1}
          <button
            onclick={prevStep}
            disabled={isSubmitting}
            class="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            Back
          </button>
        {/if}
      </div>

      <div>
        {#if currentStep < totalSteps}
          <button
            onclick={nextStep}
            disabled={(currentStep === 1 && !canProceedFromStep1) || (currentStep === 2 && !canProceedFromStep2)}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
          >
            Next
          </button>
        {:else}
          <button
            onclick={handleComplete}
            disabled={isSubmitting}
            class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Complete Setup'}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
