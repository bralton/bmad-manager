<script lang="ts">
  import { onMount } from 'svelte';
  import type { ArtifactCategory } from '$lib/types/artifact';
  import { getTotalArtifactCount } from '$lib/types/artifact';
  import {
    artifactGroups,
    artifactsLoading,
    artifactsError,
    collapsedCategories,
    nonEmptyCategories,
    loadArtifacts,
    toggleCategoryCollapsed,
    selectArtifact,
  } from '$lib/stores/artifacts';
  import ArtifactList from './ArtifactList.svelte';

  let groups = $derived($artifactGroups);
  let loading = $derived($artifactsLoading);
  let error = $derived($artifactsError);
  let categories = $derived($nonEmptyCategories);
  let collapsed = $derived($collapsedCategories);
  let totalCount = $derived(groups ? getTotalArtifactCount(groups) : 0);

  onMount(() => {
    loadArtifacts();
  });

  function handleToggle(category: ArtifactCategory) {
    toggleCategoryCollapsed(category);
  }
</script>

<div class="h-full flex flex-col bg-gray-900">
  <!-- Header -->
  <div class="px-4 py-3 border-b border-gray-800">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-white">Artifacts</h2>
      {#if totalCount > 0}
        <span class="text-xs text-gray-500">{totalCount} items</span>
      {/if}
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto p-3">
    {#if loading}
      <div class="flex items-center justify-center h-32">
        <div class="w-6 h-6 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
      </div>
    {:else if error}
      <div class="p-4 bg-red-900/20 border border-red-800 rounded-lg">
        <p class="text-sm text-red-400">{error}</p>
        <button
          onclick={loadArtifacts}
          class="mt-2 text-sm text-red-300 hover:text-red-200 underline"
        >
          Try again
        </button>
      </div>
    {:else if !groups || totalCount === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center h-64 text-center px-4">
        <svg class="w-12 h-12 text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-400 mb-2">No artifacts found</h3>
        <p class="text-sm text-gray-600 max-w-xs">
          BMAD artifacts will appear here once you create them using the workflow system.
        </p>
        <p class="text-xs text-gray-700 mt-3">
          Expected locations:<br />
          <code class="text-gray-500">_bmad-output/planning-artifacts/</code><br />
          <code class="text-gray-500">_bmad-output/implementation-artifacts/</code>
        </p>
      </div>
    {:else}
      <!-- Category lists -->
      {#each categories as category (category)}
        <ArtifactList
          {groups}
          {category}
          isCollapsed={collapsed.has(category)}
          onToggle={() => handleToggle(category)}
          onSelect={selectArtifact}
        />
      {/each}
    {/if}
  </div>
</div>
