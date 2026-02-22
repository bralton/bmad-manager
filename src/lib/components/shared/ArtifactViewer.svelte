<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ArtifactInfo } from '$lib/types/artifact';
  import { getCategoryDisplayName } from '$lib/types/artifact';
  import {
    selectedArtifact,
    selectedArtifactContent,
    artifactContentLoading,
    artifactViewerOpen,
    navigationInfo,
    closeArtifactViewer,
    navigateToPrevious,
    navigateToNext,
    openSelectedInIde,
  } from '$lib/stores/artifacts';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import FrontmatterPanel from './FrontmatterPanel.svelte';

  let artifact = $derived($selectedArtifact);
  let content = $derived($selectedArtifactContent);
  let loading = $derived($artifactContentLoading);
  let isOpen = $derived($artifactViewerOpen);
  let navInfo = $derived($navigationInfo);

  let panelElement: HTMLDivElement | undefined = $state();

  // Extract body content (after frontmatter)
  let bodyContent = $derived.by(() => {
    if (!content) return '';
    if (!content.startsWith('---')) return content;

    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) return content;

    return content.slice(endIndex + 3).trim();
  });

  // Keyboard handler for navigation
  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    switch (event.key) {
      case 'Escape':
        closeArtifactViewer();
        break;
      case 'ArrowLeft':
        if (navInfo.hasPrev) navigateToPrevious();
        break;
      case 'ArrowRight':
        if (navInfo.hasNext) navigateToNext();
        break;
      case 'e':
        if ((event.metaKey || event.ctrlKey) && artifact) {
          event.preventDefault();
          openSelectedInIde();
        }
        break;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  // Focus trap: focus panel when opened
  $effect(() => {
    if (isOpen && panelElement) {
      panelElement.focus();
    }
  });
</script>

{#if isOpen && artifact}
  <!-- Backdrop -->
  <button
    class="fixed inset-0 bg-black/50 z-40"
    onclick={closeArtifactViewer}
    aria-label="Close viewer"
  ></button>

  <!-- Slide-in panel -->
  <div
    bind:this={panelElement}
    class="fixed right-0 top-0 h-screen w-[40%] min-w-[400px] max-w-[80vw] bg-gray-900 border-l border-gray-700
      z-50 flex flex-col shadow-2xl animate-slide-in"
    role="dialog"
    aria-modal="true"
    aria-label="Artifact viewer"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Close button -->
        <button
          onclick={closeArtifactViewer}
          class="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Title and category -->
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-white truncate">{artifact.title}</h2>
          <p class="text-xs text-gray-500">{getCategoryDisplayName(artifact.category)}</p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <!-- Navigation -->
        {#if navInfo.total > 1}
          <div class="flex items-center gap-1">
            <button
              onclick={navigateToPrevious}
              disabled={!navInfo.hasPrev}
              class="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous artifact"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span class="text-xs text-gray-500 px-1">
              {navInfo.current} / {navInfo.total}
            </span>

            <button
              onclick={navigateToNext}
              disabled={!navInfo.hasNext}
              class="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next artifact"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        {/if}

        <!-- Open in Editor -->
        <button
          onclick={openSelectedInIde}
          class="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white
            hover:bg-gray-800 rounded transition-colors"
          title="Open in Editor (Cmd+E)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span>Open in Editor</span>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-4 py-4">
      {#if loading}
        <div class="flex items-center justify-center h-32">
          <div class="w-6 h-6 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
        </div>
      {:else if content}
        <!-- Frontmatter (collapsible) -->
        <FrontmatterPanel {content} />

        <!-- Markdown content -->
        <MarkdownRenderer content={bodyContent} />
      {:else}
        <p class="text-gray-500 text-center py-8">No content available</p>
      {/if}
    </div>

    <!-- Footer with keyboard hints -->
    <div class="px-4 py-2 border-t border-gray-800 text-xs text-gray-600 shrink-0">
      <span class="mr-4">Esc to close</span>
      {#if navInfo.total > 1}
        <span class="mr-4">← → to navigate</span>
      {/if}
      <span>Cmd+E to edit</span>
    </div>
  </div>
{/if}

<style>
  @keyframes slide-in {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .animate-slide-in {
    animation: slide-in 0.2s ease-out;
  }
</style>
