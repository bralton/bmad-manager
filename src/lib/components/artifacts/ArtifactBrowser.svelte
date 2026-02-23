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
  import EmptyState from '$lib/components/shared/EmptyState.svelte';

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
    {#if loading && !groups}
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
      <div class="h-64 flex items-center justify-center">
        <EmptyState
          icon="document"
          title="No artifacts found"
          description="BMAD artifacts will appear here once you create them using the workflow system."
          secondaryDescription="Expected locations: _bmad-output/planning-artifacts/ and _bmad-output/implementation-artifacts/"
        />
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
