<script lang="ts">
  import { onMount } from 'svelte';
  import { workflowApi } from '$lib/services/tauri';
  import { currentProject } from '$lib/stores/project';
  import {
    commandPaletteOpen,
    closeCommandPalette,
    setLastExecutedCommand,
  } from '$lib/stores/ui';
  import type { Workflow } from '$lib/types/workflow';

  // Props
  let { onExecute }: { onExecute?: (command: string) => void } = $props();

  // State
  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let workflows = $state<Workflow[]>([]);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let previouslyFocused = $state<HTMLElement | null>(null);
  let searchInput: HTMLInputElement | undefined = $state();
  let listContainer: HTMLDivElement | undefined = $state();

  // Derived
  let isOpen = $derived($commandPaletteOpen);
  let project = $derived($currentProject);

  let filteredWorkflows = $derived(
    workflows.filter((w) => {
      const query = searchQuery.toLowerCase();
      return (
        w.name.toLowerCase().includes(query) ||
        w.description.toLowerCase().includes(query)
      );
    })
  );

  // Load workflows when project changes
  $effect(() => {
    if (project?.path) {
      loadWorkflows(project.path);
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
    // Dependency: filteredWorkflows
    void filteredWorkflows;
    selectedIndex = 0;
  });

  async function loadWorkflows(projectPath: string) {
    isLoading = true;
    loadError = null;
    try {
      workflows = await workflowApi.getWorkflows(projectPath);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
      workflows = [];
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (filteredWorkflows.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredWorkflows.length;
          scrollSelectedIntoView();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (filteredWorkflows.length > 0) {
          selectedIndex =
            selectedIndex <= 0
              ? filteredWorkflows.length - 1
              : selectedIndex - 1;
          scrollSelectedIntoView();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredWorkflows[selectedIndex]) {
          executeCommand(filteredWorkflows[selectedIndex].name);
        }
        break;
      case 'Escape':
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

  function executeCommand(commandName: string) {
    // Store command for story 2-6 to inject
    // Note: Toast is shown by +page.svelte handler based on action taken
    // (active session injection vs new session spawn)
    setLastExecutedCommand(commandName);

    // Call optional handler
    onExecute?.(commandName);

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
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
    onclick={handleBackdropClick}
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
          placeholder="Search workflows..."
          class="w-full px-4 py-3 bg-transparent text-gray-100 placeholder-gray-500
                 focus:outline-none text-base"
          aria-label="Search workflows"
          aria-autocomplete="list"
          aria-controls="command-list"
          aria-activedescendant={filteredWorkflows[selectedIndex]
            ? `command-${filteredWorkflows[selectedIndex].name}`
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
              Open a project to see available workflows
            </p>
          </div>
        {:else if isLoading}
          <div class="px-4 py-8 text-center text-gray-500">
            <span class="animate-pulse">Loading workflows...</span>
          </div>
        {:else if loadError}
          <div class="px-4 py-8 text-center">
            <p class="text-red-400 text-sm">Failed to load workflows</p>
            <p class="text-gray-500 text-xs mt-1">{loadError}</p>
          </div>
        {:else if filteredWorkflows.length === 0}
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
          {#each filteredWorkflows as workflow, index (workflow.name)}
            {@const isSelected = index === selectedIndex}
            <button
              id={`command-${workflow.name}`}
              data-command-item
              role="option"
              aria-selected={isSelected}
              aria-label={`${workflow.name}: ${workflow.description}`}
              onclick={() => executeCommand(workflow.name)}
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
                  /{@html highlightMatch(workflow.name, searchQuery)}
                </span>
                <span
                  class="text-xs px-1.5 py-0.5 rounded {isSelected
                    ? 'bg-blue-500/50 text-blue-100'
                    : 'bg-gray-700 text-gray-400'}"
                >
                  {workflow.module}
                </span>
              </div>
              <span
                class="text-sm ml-5 {isSelected
                  ? 'text-blue-100'
                  : 'text-gray-500'}"
              >
                {@html highlightMatch(workflow.description, searchQuery)}
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
        <span class="text-gray-600">{filteredWorkflows.length} commands</span>
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
