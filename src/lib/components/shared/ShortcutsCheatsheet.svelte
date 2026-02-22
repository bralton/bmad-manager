<script lang="ts">
  import { getShortcutsByCategory, formatShortcutDisplay } from '$lib/services/shortcuts';

  let { onClose }: { onClose: () => void } = $props();

  const shortcuts = getShortcutsByCategory();

  // Category display names
  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    sessions: 'Sessions',
    general: 'General',
  };

  // Category order for display
  const categoryOrder = ['navigation', 'sessions', 'general'] as const;

  let closeButton: HTMLButtonElement | undefined = $state();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      // Focus trap: keep focus within the modal
      event.preventDefault();
      closeButton?.focus();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<button
  type="button"
  class="fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm"
  onclick={handleBackdropClick}
  aria-label="Close shortcuts cheatsheet"
></button>

<!-- Modal -->
<div
  class="fixed inset-0 z-[46] flex items-center justify-center pointer-events-none"
  role="dialog"
  aria-modal="true"
  aria-labelledby="shortcuts-title"
>
  <div
    class="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 pointer-events-auto"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-700">
      <h2 id="shortcuts-title" class="text-lg font-semibold text-gray-100">
        Keyboard Shortcuts
      </h2>
      <button
        bind:this={closeButton}
        type="button"
        onclick={onClose}
        class="text-gray-400 hover:text-gray-200 transition-colors p-1"
        aria-label="Close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="px-6 py-4 max-h-[60vh] overflow-y-auto">
      {#each categoryOrder as category}
        {@const items = shortcuts[category]}
        {#if items.length > 0}
          <div class="mb-6 last:mb-0">
            <h3 class="text-sm font-semibold text-gray-200 mb-3 uppercase tracking-wide">
              {categoryLabels[category]}
            </h3>
            <div class="space-y-2">
              {#each items as shortcut}
                <div class="flex justify-between items-center py-1">
                  <span class="text-sm text-gray-400">{shortcut.description}</span>
                  <kbd class="font-mono text-sm bg-gray-800 px-2 py-0.5 rounded text-gray-200 border border-gray-700">
                    {formatShortcutDisplay(shortcut.key)}
                  </kbd>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Footer -->
    <div class="px-6 py-3 border-t border-gray-700 text-center">
      <span class="text-xs text-gray-500">Press <kbd class="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 border border-gray-700">Esc</kbd> to close</span>
    </div>
  </div>
</div>
