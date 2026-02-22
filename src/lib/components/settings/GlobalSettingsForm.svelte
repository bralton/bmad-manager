<script lang="ts">
  import type { GlobalSettings, WorkflowStyle } from '$lib/types/settings';
  import {
    validateUserName,
    validateIdeCommand,
    validateBranchPattern,
    validateWorktreeLocation,
    validateTheme,
    THEME_OPTIONS,
    WORKFLOW_STYLE_OPTIONS,
    WORKTREE_LOCATION_OPTIONS,
  } from '$lib/utils/settings-validation';

  let {
    settings,
    onUpdate,
    onValidChange,
  }: {
    settings: GlobalSettings;
    onUpdate: (settings: GlobalSettings) => void;
    onValidChange: (valid: boolean) => void;
  } = $props();

  // Local form state - initialize from props using JSON to avoid structuredClone issues
  let formData = $state<GlobalSettings>(JSON.parse(JSON.stringify(settings)));

  // Field errors
  let errors = $state<Record<string, string | undefined>>({});

  // Validate all fields and update parent
  function validate() {
    const newErrors: Record<string, string | undefined> = {};

    const nameResult = validateUserName(formData.user.name);
    if (!nameResult.valid) newErrors.userName = nameResult.error;

    const ideResult = validateIdeCommand(formData.tools.ide_command);
    if (!ideResult.valid) newErrors.ideCommand = ideResult.error;

    const branchResult = validateBranchPattern(formData.git.branch_pattern);
    if (!branchResult.valid) newErrors.branchPattern = branchResult.error;

    const locationResult = validateWorktreeLocation(formData.git.worktree_location);
    if (!locationResult.valid) newErrors.worktreeLocation = locationResult.error;

    const themeResult = validateTheme(formData.ui.theme);
    if (!themeResult.valid) newErrors.theme = themeResult.error;

    errors = newErrors;

    const isValid = Object.keys(newErrors).length === 0;
    onValidChange(isValid);

    return isValid;
  }

  // Update parent whenever form data changes
  $effect(() => {
    // Deep clone to avoid reference issues
    const data = JSON.parse(JSON.stringify(formData));
    onUpdate(data);
    validate();
  });

  function handleInput(field: string, value: string | boolean) {
    switch (field) {
      case 'userName':
        formData.user.name = value as string;
        break;
      case 'ideCommand':
        formData.tools.ide_command = value as string;
        break;
      case 'theme':
        formData.ui.theme = value as string;
        break;
      case 'showAgentIcons':
        formData.ui.show_agent_icons = value as boolean;
        break;
      case 'defaultWorkflow':
        formData.bmad.default_workflow = value as WorkflowStyle;
        break;
      case 'branchPattern':
        formData.git.branch_pattern = value as string;
        break;
      case 'worktreeLocation':
        formData.git.worktree_location = value as string;
        break;
    }
  }
</script>

<div class="space-y-6">
  <!-- User Section -->
  <section>
    <h3 class="text-sm font-semibold text-gray-200 mb-3 pb-2 border-b border-gray-800">
      User
    </h3>

    <div class="space-y-4">
      <!-- Name -->
      <div>
        <label for="userName" class="block text-sm text-gray-400 mb-1">
          Name
        </label>
        <input
          id="userName"
          type="text"
          value={formData.user.name}
          oninput={(e) => handleInput('userName', e.currentTarget.value)}
          class="w-full px-3 py-2 bg-gray-800 border rounded text-white text-sm
            {errors.userName ? 'border-red-500' : 'border-gray-700'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Your name"
        />
        {#if errors.userName}
          <p class="text-xs text-red-400 mt-1">{errors.userName}</p>
        {/if}
      </div>
    </div>
  </section>

  <!-- Tools Section -->
  <section>
    <h3 class="text-sm font-semibold text-gray-200 mb-3 pb-2 border-b border-gray-800">
      Tools
    </h3>

    <div class="space-y-4">
      <!-- IDE Command -->
      <div>
        <label for="ideCommand" class="block text-sm text-gray-400 mb-1">
          IDE Command
        </label>
        <input
          id="ideCommand"
          type="text"
          value={formData.tools.ide_command}
          oninput={(e) => handleInput('ideCommand', e.currentTarget.value)}
          class="w-full px-3 py-2 bg-gray-800 border rounded text-white text-sm font-mono
            {errors.ideCommand ? 'border-red-500' : 'border-gray-700'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="code ."
        />
        {#if errors.ideCommand}
          <p class="text-xs text-red-400 mt-1">{errors.ideCommand}</p>
        {/if}
        <p class="text-xs text-gray-500 mt-1">
          Command to open files in your IDE (e.g., "code .", "cursor .", "vim")
        </p>
      </div>

      <!-- Theme -->
      <div>
        <label for="theme" class="block text-sm text-gray-400 mb-1">
          Theme
        </label>
        <select
          id="theme"
          value={formData.ui.theme}
          onchange={(e) => handleInput('theme', e.currentTarget.value)}
          class="w-full px-3 py-2 bg-gray-800 border rounded text-white text-sm
            {errors.theme ? 'border-red-500' : 'border-gray-700'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {#each THEME_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        {#if errors.theme}
          <p class="text-xs text-red-400 mt-1">{errors.theme}</p>
        {/if}
      </div>

      <!-- Default Workflow -->
      <div>
        <label for="defaultWorkflow" class="block text-sm text-gray-400 mb-1">
          Default Workflow Style
        </label>
        <select
          id="defaultWorkflow"
          value={formData.bmad.default_workflow}
          onchange={(e) => handleInput('defaultWorkflow', e.currentTarget.value)}
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {#each WORKFLOW_STYLE_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Show Agent Icons -->
      <div class="flex items-center gap-3">
        <input
          id="showAgentIcons"
          type="checkbox"
          checked={formData.ui.show_agent_icons}
          onchange={(e) => handleInput('showAgentIcons', e.currentTarget.checked)}
          class="w-4 h-4 text-blue-600 bg-gray-800 border-gray-700 rounded
            focus:ring-blue-500 focus:ring-2"
        />
        <label for="showAgentIcons" class="text-sm text-gray-300 cursor-pointer">
          Show agent icons in roster
        </label>
      </div>
    </div>
  </section>

  <!-- Git Section -->
  <section>
    <h3 class="text-sm font-semibold text-gray-200 mb-3 pb-2 border-b border-gray-800">
      Git
    </h3>

    <div class="space-y-4">
      <!-- Branch Pattern -->
      <div>
        <label for="branchPattern" class="block text-sm text-gray-400 mb-1">
          Branch Pattern
        </label>
        <input
          id="branchPattern"
          type="text"
          value={formData.git.branch_pattern}
          oninput={(e) => handleInput('branchPattern', e.currentTarget.value)}
          class="w-full px-3 py-2 bg-gray-800 border rounded text-white text-sm font-mono
            {errors.branchPattern ? 'border-red-500' : 'border-gray-700'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="story/&#123;story_id&#125;-&#123;slug&#125;"
        />
        {#if errors.branchPattern}
          <p class="text-xs text-red-400 mt-1">{errors.branchPattern}</p>
        {/if}
        <p class="text-xs text-gray-500 mt-1">
          Use <code class="bg-gray-700 px-1 rounded">{'{story_id}'}</code> and
          <code class="bg-gray-700 px-1 rounded">{'{slug}'}</code> as placeholders
        </p>
      </div>

      <!-- Worktree Location -->
      <div>
        <label for="worktreeLocation" class="block text-sm text-gray-400 mb-1">
          Worktree Location
        </label>
        <select
          id="worktreeLocation"
          value={formData.git.worktree_location}
          onchange={(e) => handleInput('worktreeLocation', e.currentTarget.value)}
          class="w-full px-3 py-2 bg-gray-800 border rounded text-white text-sm
            {errors.worktreeLocation ? 'border-red-500' : 'border-gray-700'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {#each WORKTREE_LOCATION_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        {#if errors.worktreeLocation}
          <p class="text-xs text-red-400 mt-1">{errors.worktreeLocation}</p>
        {/if}
        <p class="text-xs text-gray-500 mt-1">
          Where to create worktrees relative to the main repository
        </p>
      </div>
    </div>
  </section>
</div>
