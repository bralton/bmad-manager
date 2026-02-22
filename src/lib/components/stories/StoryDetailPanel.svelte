<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { KANBAN_COLUMNS, type Story, type Epic } from '$lib/types/stories';

  let {
    story,
    epic,
    onClose,
  }: {
    story: Story;
    epic: Epic | null | undefined;
    onClose: () => void;
  } = $props();

  // Convert slug to readable title
  let title = $derived.by(() => {
    return story.slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Get display ID
  let displayId = $derived.by(() => {
    if (story.subStoryNumber != null) {
      return `${story.epicId}-${story.storyNumber}-${story.subStoryNumber}`;
    }
    return `${story.epicId}-${story.storyNumber}`;
  });

  // Get column config for status styling
  let columnConfig = $derived(
    KANBAN_COLUMNS.find((c) => c.status === story.status) || KANBAN_COLUMNS[0]
  );

  // Get epic status display
  let epicStatusLabel = $derived.by(() => {
    if (!epic) return 'Unknown';
    switch (epic.status) {
      case 'done':
        return 'Done';
      case 'in-progress':
        return 'In Progress';
      case 'backlog':
      default:
        return 'Backlog';
    }
  });

  // Panel and focus trap references
  let panelRef: HTMLElement | null = null;
  let closeButtonRef: HTMLButtonElement | null = null;

  /**
   * Gets all focusable elements within the panel for focus trapping.
   */
  function getFocusableElements(): HTMLElement[] {
    if (!panelRef) return [];
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(panelRef.querySelectorAll<HTMLElement>(selector));
  }

  /**
   * Handles keyboard events for Escape to close and Tab for focus trap.
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    // Focus trap: cycle focus within the panel
    if (event.key === 'Tab') {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  onMount(() => {
    // Add keyboard listener for escape and focus trap
    window.addEventListener('keydown', handleKeyDown);
    // Focus the close button when panel opens
    closeButtonRef?.focus();
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  // Handle backdrop click
  function handleBackdropClick(event: MouseEvent) {
    // Only close if clicking on the backdrop itself, not the panel
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<!-- Backdrop -->
<div
  class="fixed inset-0 bg-black/50 z-40"
  onclick={handleBackdropClick}
  role="presentation"
>
  <!-- Panel -->
  <div
    bind:this={panelRef}
    class="fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-700 shadow-xl z-50
      transform transition-transform duration-200"
    role="dialog"
    aria-modal="true"
    aria-labelledby="story-detail-title"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-700">
      <h2 id="story-detail-title" class="text-lg font-semibold text-white truncate pr-2">
        Story {displayId}
      </h2>
      <button
        bind:this={closeButtonRef}
        onclick={onClose}
        class="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
        aria-label="Close detail panel"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-4 overflow-y-auto h-[calc(100%-60px)]">
      <!-- Title -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Title</h3>
        <p class="text-white text-sm">{title}</p>
      </div>

      <!-- Status -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Status</h3>
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            border {columnConfig.borderColor} {columnConfig.textColor}"
        >
          {columnConfig.label}
        </span>
      </div>

      <!-- Epic Info -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Epic</h3>
        <div class="text-sm">
          <span class="text-white">Epic {story.epicId}</span>
          {#if epic}
            <span class="text-gray-400 ml-2">({epicStatusLabel})</span>
          {/if}
        </div>
      </div>

      <!-- Story ID -->
      <div>
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Full ID</h3>
        <p class="text-white font-mono text-sm">{story.id}</p>
      </div>

      <!-- Actions placeholder -->
      <div class="pt-4 border-t border-gray-700">
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Actions</h3>
        <p class="text-gray-500 text-sm italic">
          Worktree actions coming in Story 3-4
        </p>
      </div>
    </div>
  </div>
</div>
