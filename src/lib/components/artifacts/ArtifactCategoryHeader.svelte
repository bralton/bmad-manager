<script lang="ts">
  import type { ArtifactCategory } from '$lib/types/artifact';
  import { getCategoryDisplayName, getCategoryIcon } from '$lib/types/artifact';

  let {
    category,
    count,
    isCollapsed,
    onToggle,
  }: {
    category: ArtifactCategory;
    count: number;
    isCollapsed: boolean;
    onToggle: () => void;
  } = $props();

  let displayName = $derived(getCategoryDisplayName(category));
  let icon = $derived(getCategoryIcon(category));
</script>

<button
  onclick={onToggle}
  class="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-300
    hover:bg-gray-800/50 transition-colors rounded-lg"
  aria-expanded={!isCollapsed}
>
  <div class="flex items-center gap-2">
    <!-- Collapse/expand chevron -->
    <svg
      class="w-4 h-4 text-gray-500 transition-transform {isCollapsed ? '' : 'rotate-90'}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>

    <!-- Category icon -->
    {#if icon === 'folder'}
      <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    {:else if icon === 'file-text'}
      <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    {:else if icon === 'clock'}
      <svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    {:else if icon === 'palette'}
      <svg class="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    {:else if icon === 'clipboard'}
      <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    {:else}
      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    {/if}

    <!-- Category name -->
    <span>{displayName}</span>
  </div>

  <!-- Count badge -->
  <span class="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded-full">
    {count}
  </span>
</button>
