<script lang="ts">
  import type { GlobalSettings, ProjectSettings } from '$lib/types/settings';
  import {
    validateBranchPattern,
    validateWorktreeLocation,
    validateIdeCommand,
    WORKTREE_LOCATION_OPTIONS,
  } from '$lib/utils/settings-validation';

  let {
    settings,
    globalSettings,
    onUpdate,
    onValidChange,
  }: {
    settings: ProjectSettings;
    globalSettings: GlobalSettings;
    onUpdate: (settings: ProjectSettings) => void;
    onValidChange: (valid: boolean) => void;
  } = $props();

  // Local form state - initialize from props using JSON to avoid structuredClone issues
  let formData = $state<ProjectSettings>(JSON.parse(JSON.stringify(settings)));

  // Field errors
  let errors = $state<Record<string, string | undefined>>({});

  // Validate all fields
  function validate() {
    const newErrors: Record<string, string | undefined> = {};

    // Only validate if values are set (empty = use global)
    if (formData.branchPattern) {
      const result = validateBranchPattern(formData.branchPattern);
      if (!result.valid) newErrors.branchPattern = result.error;
    }

    if (formData.worktreeLocation) {
      const result = validateWorktreeLocation(formData.worktreeLocation);
      if (!result.valid) newErrors.worktreeLocation = result.error;
    }

    if (formData.ideCommand) {
      const result = validateIdeCommand(formData.ideCommand);
      if (!result.valid) newErrors.ideCommand = result.error;
    }

    errors = newErrors;

    const isValid = Object.keys(newErrors).length === 0;
    onValidChange(isValid);

    return isValid;
  }

  // Update parent whenever form data changes
  $effect(() => {
    const data = JSON.parse(JSON.stringify(formData));
    onUpdate(data);
    validate();
  });

  function handleInput(field: keyof ProjectSettings, value: string) {
    // Treat empty string as undefined (use global)
    const finalValue = value.trim() === '' ? undefined : value;
    formData = { ...formData, [field]: finalValue };
  }

  function clearField(field: keyof ProjectSettings) {
    formData = { ...formData, [field]: undefined };
  }
</script>

<div class="space-y-6">
  <div class="bg-gray-800/50 rounded p-4 border border-gray-700">
    <p class="text-sm text-gray-300">
      Override global settings for this project. Leave fields empty to use global defaults.
    </p>
  </div>

  <!-- Branch Pattern Override -->
  <div>
    <label for="branchPattern" class="block text-sm text-gray-400 mb-1">
      Branch Pattern Override
    </label>
    <div class="relative">
      <input
        id="branchPattern"
        type="text"
        value={formData.branchPattern ?? ''}
        oninput={(e) => handleInput('branchPattern', e.currentTarget.value)}
        placeholder={globalSettings.git.branch_pattern}
        class="w-full px-3 py-2 pr-8 bg-gray-800 border rounded text-white text-sm font-mono
          {errors.branchPattern ? 'border-red-500' : 'border-gray-700'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          placeholder:text-gray-600"
      />
      {#if formData.branchPattern}
        <button
          type="button"
          onclick={() => clearField('branchPattern')}
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          aria-label="Clear branch pattern override"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      {/if}
    </div>
    {#if errors.branchPattern}
      <p class="text-xs text-red-400 mt-1">{errors.branchPattern}</p>
    {:else if !formData.branchPattern}
      <p class="text-xs text-gray-500 mt-1">
        Using global: <code class="bg-gray-700 px-1 rounded">{globalSettings.git.branch_pattern}</code>
      </p>
    {/if}
  </div>

  <!-- Worktree Location Override -->
  <div>
    <label for="worktreeLocation" class="block text-sm text-gray-400 mb-1">
      Worktree Location Override
    </label>
    <div class="relative">
      <select
        id="worktreeLocation"
        value={formData.worktreeLocation ?? ''}
        onchange={(e) => handleInput('worktreeLocation', e.currentTarget.value)}
        class="w-full px-3 py-2 bg-gray-800 border rounded text-white text-sm
          {errors.worktreeLocation ? 'border-red-500' : 'border-gray-700'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          {!formData.worktreeLocation ? 'text-gray-500' : ''}"
      >
        <option value="">Use Global ({WORKTREE_LOCATION_OPTIONS.find(o => o.value === globalSettings.git.worktree_location)?.label})</option>
        {#each WORKTREE_LOCATION_OPTIONS as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>
    {#if errors.worktreeLocation}
      <p class="text-xs text-red-400 mt-1">{errors.worktreeLocation}</p>
    {/if}
  </div>

  <!-- IDE Command Override -->
  <div>
    <label for="ideCommand" class="block text-sm text-gray-400 mb-1">
      IDE Command Override
    </label>
    <div class="relative">
      <input
        id="ideCommand"
        type="text"
        value={formData.ideCommand ?? ''}
        oninput={(e) => handleInput('ideCommand', e.currentTarget.value)}
        placeholder={globalSettings.tools.ide_command}
        class="w-full px-3 py-2 pr-8 bg-gray-800 border rounded text-white text-sm font-mono
          {errors.ideCommand ? 'border-red-500' : 'border-gray-700'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          placeholder:text-gray-600"
      />
      {#if formData.ideCommand}
        <button
          type="button"
          onclick={() => clearField('ideCommand')}
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          aria-label="Clear IDE command override"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      {/if}
    </div>
    {#if errors.ideCommand}
      <p class="text-xs text-red-400 mt-1">{errors.ideCommand}</p>
    {:else if !formData.ideCommand}
      <p class="text-xs text-gray-500 mt-1">
        Using global: <code class="bg-gray-700 px-1 rounded">{globalSettings.tools.ide_command}</code>
      </p>
    {/if}
  </div>
</div>
