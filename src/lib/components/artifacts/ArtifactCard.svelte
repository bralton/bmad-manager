<script lang="ts">
  import type { ArtifactInfo } from '$lib/types/artifact';
  import { formatStatus, getStatusColor } from '$lib/types/artifact';

  let {
    artifact,
    onClick,
  }: {
    artifact: ArtifactInfo;
    onClick: () => void;
  } = $props();

  // Format the modified date
  let formattedDate = $derived.by(() => {
    try {
      const date = new Date(artifact.modifiedAt);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  });

  // Get display status
  let displayStatus = $derived(formatStatus(artifact.status));
  let statusColor = $derived(getStatusColor(artifact.status));

  // Get a shortened path for display
  let shortPath = $derived.by(() => {
    const parts = artifact.path.split('/');
    // Show last 2 path segments
    return parts.slice(-2).join('/');
  });
</script>

<button
  onclick={onClick}
  class="w-full text-left bg-gray-800/50 hover:bg-gray-800 rounded-lg p-3 border border-gray-700/50
    hover:border-gray-600 transition-all cursor-pointer group"
>
  <!-- Title row -->
  <div class="flex items-start justify-between gap-2 mb-2">
    <h4 class="text-sm font-medium text-white truncate flex-1 group-hover:text-blue-400">
      {artifact.title}
    </h4>

    {#if artifact.status}
      <span class="px-1.5 py-0.5 text-xs rounded {statusColor} text-white shrink-0">
        {displayStatus}
      </span>
    {/if}
  </div>

  <!-- Meta row -->
  <div class="flex items-center gap-3 text-xs text-gray-500">
    <!-- ID badge if story or epic -->
    {#if artifact.storyId}
      <span class="font-mono">{artifact.storyId}</span>
    {:else if artifact.epicId}
      <span class="font-mono">Epic {artifact.epicId}</span>
    {/if}

    <!-- Modified date -->
    <span class="flex items-center gap-1">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {formattedDate}
    </span>
  </div>
</button>
