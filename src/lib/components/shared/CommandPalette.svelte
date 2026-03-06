<script lang="ts">
  import { workflowApi, taskApi } from '$lib/services/tauri';
  import { currentProject } from '$lib/stores/project';
  import {
    commandPaletteOpen,
    closeCommandPalette,
    setLastExecutedCommand,
  } from '$lib/stores/ui';
  import type { Workflow } from '$lib/types/workflow';
  import type { Task } from '$lib/types/task';

  // Unified command type that can be either a workflow or a task
  type Command = (Workflow & { type: 'workflow' }) | (Task & { type: 'task' });

  // Props
  let { onExecute }: { onExecute?: (command: string) => void } = $props();

  // State
  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let workflows = $state<Workflow[]>([]);
  let tasks = $state<Task[]>([]);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let previouslyFocused = $state<HTMLElement | null>(null);
  let searchInput: HTMLInputElement | undefined = $state();
  let listContainer: HTMLDivElement | undefined = $state();

  // Derived
  let isOpen = $derived($commandPaletteOpen);
  let project = $derived($currentProject);

  // Merge workflows and tasks into unified commands array
  let commands = $derived<Command[]>([
    ...workflows.map((w) => ({ ...w, type: 'workflow' as const })),
    ...tasks.map((t) => ({ ...t, type: 'task' as const })),
  ]);

  let filteredCommands = $derived(
    commands.filter((c) => {
      const query = searchQuery.toLowerCase();
      const name = c.type === 'task' ? c.displayName : c.name;
      return (
        c.name.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
      );
    })
  );

  // Load workflows and tasks when project changes
  $effect(() => {
    if (project?.path) {
      loadCommands(project.path);
    }
  });

  // Focus management when opening/closing
  $effect(() => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement;
      // Small delay to ensure modal is rendered
      setTimeout(() => searchInput?.focus(), 0);
    } else if (previouslyFocused) {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  });

  // Reset selection when filter changes
  $effect(() => {
    // Dependency: filteredCommands
    void filteredCommands;
    selectedIndex = 0;
  });

  /**
   * Loads workflows and tasks for the command palette.
   * Uses Promise.allSettled for graceful degradation - if tasks fail to load,
   * workflows are still displayed (and vice versa).
   */
  async function loadCommands(projectPath: string) {
    isLoading = true;
    loadError = null;
    try {
      // Load workflows and tasks in parallel with graceful degradation
      const [workflowsResult, tasksResult] = await Promise.allSettled([
        workflowApi.getWorkflows(projectPath),
        taskApi.getTasks(projectPath),
      ]);

      // Handle workflows result
      if (workflowsResult.status === 'fulfilled') {
        workflows = workflowsResult.value;
      } else {
        console.warn('Failed to load workflows:', workflowsResult.reason);
        workflows = [];
      }

      // Handle tasks result
      if (tasksResult.status === 'fulfilled') {
        tasks = tasksResult.value;
      } else {
        console.warn('Failed to load tasks:', tasksResult.reason);
        tasks = [];
      }

      // Only show error if BOTH failed
      if (workflowsResult.status === 'rejected' && tasksResult.status === 'rejected') {
        loadError = 'Failed to load commands';
      }
    } catch (e) {
      // Unexpected error (shouldn't happen with allSettled, but be safe)
      loadError = e instanceof Error ? e.message : String(e);
      workflows = [];
      tasks = [];
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (filteredCommands.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredCommands.length;
          scrollSelectedIntoView();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (filteredCommands.length > 0) {
          selectedIndex =
            selectedIndex <= 0
              ? filteredCommands.length - 1
              : selectedIndex - 1;
          scrollSelectedIntoView();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        // 5-5: Modal has precedence per AC14 - close even if terminal could receive ESC
        e.preventDefault();
        closeCommandPalette();
        break;
      case 'Tab':
        // Trap focus within modal (both Tab and Shift+Tab)
        e.preventDefault();
        searchInput?.focus();
        break;
    }
  }

  function scrollSelectedIntoView() {
    if (!listContainer) return;
    const items = listContainer.querySelectorAll('[data-command-item]');
    const selectedItem = items[selectedIndex] as HTMLElement | undefined;
    selectedItem?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Formats a command (workflow or task) as a BMAD skill command name.
   * Tasks: bmad-{name}
   * Workflows - Core module: bmad-{name}
   * Workflows - BMM module: bmad-bmm-{name}
   */
  function formatSkillName(command: Command): string {
    const { name, module, type } = command;
    // Tasks always use bmad-{name} format
    if (type === 'task') {
      return `bmad-${name}`;
    }
    // Workflows use module-based naming
    if (module === 'core') {
      return `bmad-${name}`;
    } else if (module === 'bmm') {
      return `bmad-bmm-${name}`;
    }
    // Fallback for unknown modules
    return `bmad-${module}-${name}`;
  }

  /**
   * Gets the display name for a command.
   * Tasks use displayName, workflows use name.
   */
  function getCommandDisplayName(command: Command): string {
    return command.type === 'task' ? command.displayName : command.name;
  }

  /**
   * Gets the badge text for a command.
   * Tasks show "task", workflows show their module.
   */
  function getCommandBadge(command: Command): string {
    return command.type === 'task' ? 'task' : command.module;
  }

  function executeCommand(command: Command) {
    const skillName = formatSkillName(command);

    // Store command for story 2-6 to inject
    // Note: Toast is shown by +page.svelte handler based on action taken
    // (active session injection vs new session spawn)
    setLastExecutedCommand(skillName);

    // Call optional handler
    onExecute?.(skillName);

    // Close palette
    closeCommandPalette();

    // Reset state
    searchQuery = '';
    selectedIndex = 0;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeCommandPalette();
    }
  }

  function escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
  }

  function highlightMatch(text: string, query: string): string {
    const escaped = escapeHtml(text);
    if (!query) return escaped;

    const lowerText = escaped.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const startIndex = lowerText.indexOf(lowerQuery);
    if (startIndex === -1) return escaped;

    const before = escaped.slice(0, startIndex);
    const match = escaped.slice(startIndex, startIndex + query.length);
    const after = escaped.slice(startIndex + query.length);
    return `${before}<mark class="bg-yellow-500/30 text-yellow-200">${match}</mark>${after}`;
  }
</script>

{#if isOpen}
  <!-- Backdrop with blur -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Escape' && closeCommandPalette()}
    role="presentation"
  >
    <!-- Modal - centered horizontally, top-[20%] from viewport -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="fixed left-1/2 top-[20%] -translate-x-1/2 w-[90vw] max-w-xl
             bg-gray-800 rounded-lg shadow-2xl border border-gray-700
             z-50 animate-scale-in overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      tabindex="-1"
      onkeydown={handleKeydown}
    >
      <!-- Search input -->
      <div class="relative border-b border-gray-700">
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Search commands..."
          class="w-full px-4 py-3 bg-transparent text-gray-100 placeholder-gray-500
                 focus:outline-none text-base"
          aria-label="Search commands"
          aria-autocomplete="list"
          aria-controls="command-list"
          aria-activedescendant={filteredCommands[selectedIndex]
            ? `command-${filteredCommands[selectedIndex].name}`
            : undefined}
        />
        <kbd
          class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500
                 bg-gray-700 px-2 py-1 rounded"
        >
          ESC
        </kbd>
      </div>

      <!-- Command list -->
      <div
        bind:this={listContainer}
        id="command-list"
        role="listbox"
        class="max-h-80 overflow-y-auto"
      >
        {#if !project?.path}
          <div class="px-4 py-8 text-center">
            <p class="text-gray-400">No project loaded</p>
            <p class="text-gray-500 text-sm mt-2">
              Open a project to see available commands
            </p>
          </div>
        {:else if isLoading}
          <div class="px-4 py-8 text-center text-gray-500">
            <span class="animate-pulse">Loading commands...</span>
          </div>
        {:else if loadError}
          <div class="px-4 py-8 text-center">
            <p class="text-red-400 text-sm">Failed to load commands</p>
            <p class="text-gray-500 text-xs mt-1">{loadError}</p>
          </div>
        {:else if filteredCommands.length === 0}
          <!-- Empty state -->
          <div class="px-4 py-8 text-center">
            <p class="text-gray-400">
              No commands match '<span class="text-white">{searchQuery}</span>'
            </p>
            <p class="text-gray-500 text-sm mt-2">
              Press ESC to close or clear your search
            </p>
          </div>
        {:else}
          {#each filteredCommands as command, index (command.type + '-' + command.name)}
            {@const isSelected = index === selectedIndex}
            {@const badge = getCommandBadge(command)}
            {@const displayName = getCommandDisplayName(command)}
            <button
              id={`command-${command.name}`}
              data-command-item
              role="option"
              aria-selected={isSelected}
              aria-label={`${displayName}: ${command.description}`}
              onclick={() => executeCommand(command)}
              onmouseenter={() => (selectedIndex = index)}
              class="w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors
                     {isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white'}"
            >
              <div class="flex items-center gap-2">
                {#if isSelected}
                  <span class="text-white/80">▸</span>
                {:else}
                  <span class="w-3"></span>
                {/if}
                <span class="font-mono text-sm">
                  /{@html highlightMatch(displayName, searchQuery)}
                </span>
                <span
                  class="text-xs px-1.5 py-0.5 rounded {isSelected
                    ? command.type === 'task'
                      ? 'bg-amber-500/50 text-amber-100'
                      : 'bg-blue-500/50 text-blue-100'
                    : command.type === 'task'
                      ? 'bg-amber-800 text-amber-300'
                      : 'bg-gray-700 text-gray-400'}"
                >
                  {badge}
                </span>
              </div>
              <span
                class="text-sm ml-5 {isSelected
                  ? 'text-blue-100'
                  : 'text-gray-500'}"
              >
                {@html highlightMatch(command.description, searchQuery)}
              </span>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Footer hints -->
      <div
        class="border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500"
      >
        <div class="flex items-center gap-4">
          <span><kbd class="bg-gray-700 px-1.5 py-0.5 rounded">↑</kbd> <kbd class="bg-gray-700 px-1.5 py-0.5 rounded">↓</kbd> navigate</span>
          <span><kbd class="bg-gray-700 px-1.5 py-0.5 rounded">↵</kbd> select</span>
        </div>
        <span class="text-gray-600">{filteredCommands.length} commands</span>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scale-in {
    from {
      opacity: 0;
      transform: translate(-50%, 0) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0) scale(1);
    }
  }

  .animate-fade-in {
    animation: fade-in 150ms ease-out;
  }

  .animate-scale-in {
    animation: scale-in 150ms ease-out;
  }

  /* Scope mark styling to command palette only (via #command-list parent) */
  :global(#command-list mark) {
    background-color: transparent;
  }
</style>
