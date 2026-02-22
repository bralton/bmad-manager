<script lang="ts">
  import type { ArtifactInfo, ArtifactCategory } from '$lib/types/artifact';
  import { getArtifactsByCategory } from '$lib/types/artifact';
  import type { ArtifactGroups } from '$lib/types/artifact';
  import ArtifactCard from './ArtifactCard.svelte';
  import ArtifactCategoryHeader from './ArtifactCategoryHeader.svelte';

  let {
    groups,
    category,
    isCollapsed,
    onToggle,
    onSelect,
  }: {
    groups: ArtifactGroups;
    category: ArtifactCategory;
    isCollapsed: boolean;
    onToggle: () => void;
    onSelect: (artifact: ArtifactInfo) => void;
  } = $props();

  let artifacts = $derived(getArtifactsByCategory(groups, category));
</script>

<div class="mb-2">
  <ArtifactCategoryHeader
    {category}
    count={artifacts.length}
    {isCollapsed}
    {onToggle}
  />

  {#if !isCollapsed}
    <div class="space-y-2 mt-2 pl-6">
      {#each artifacts as artifact (artifact.path)}
        <ArtifactCard
          {artifact}
          onClick={() => onSelect(artifact)}
        />
      {/each}
    </div>
  {/if}
</div>
