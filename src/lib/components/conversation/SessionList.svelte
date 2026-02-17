<script lang="ts">
  import type { SessionRecord } from '$lib/services/process';

  let {
    sessions,
    isSearching = false,
    resumingSessionId = null,
    onResume,
    onSearch,
  }: {
    sessions: SessionRecord[];
    isSearching?: boolean;
    resumingSessionId?: string | null;
    onResume?: (sessionId: string) => void;
    onSearch?: (query: string) => void;
  } = $props();

  let searchQuery = $state('');
  // Use regular variable for timeout to avoid effect tracking issues
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    completed: 'bg-gray-500',
    interrupted: 'bg-yellow-500',
  };

  const statusLabels: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    interrupted: 'Interrupted',
  };

  // Debounced search effect - only tracks searchQuery
  $effect(() => {
    // Read searchQuery to track it
    const query = searchQuery;

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce the search callback
    searchTimeout = setTimeout(() => {
      onSearch?.(query);
    }, 300);

    // Cleanup on effect re-run
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  });

  function handleResume(sessionId: string) {
    onResume?.(sessionId);
  }

  function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function getProjectName(projectPath: string): string {
    const parts = projectPath.split('/');
    return parts[parts.length - 1] || projectPath;
  }
</script>

<div class="flex flex-col h-full">
  <!-- Search input -->
  <div class="p-2 border-b border-gray-700">
    <div class="relative">
      <input
        type="text"
        placeholder="Search sessions..."
        bind:value={searchQuery}
        class="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded
          text-gray-200 placeholder-gray-500
          focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
      />
      {#if isSearching}
        <div class="absolute right-2 top-1/2 -translate-y-1/2">
          <div class="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Session list -->
  <div class="flex-1 overflow-y-auto">
    {#if sessions.length === 0}
      <div class="p-4 text-center text-gray-500 text-sm">
        {searchQuery ? 'No matching sessions found' : 'No session history yet'}
      </div>
    {:else}
      <ul class="divide-y divide-gray-800">
        {#each sessions as session (session.id)}
          {@const isResuming = resumingSessionId === session.id}
          <li class="hover:bg-gray-800/50 transition-colors">
            <button
              onclick={() => handleResume(session.id)}
              disabled={isResuming}
              class="w-full px-3 py-2 text-left flex items-start gap-3
                {isResuming ? 'opacity-50 cursor-wait' : ''}"
            >
              <!-- Status indicator -->
              {#if isResuming}
                <div class="mt-1 w-3 h-3 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin shrink-0"></div>
              {:else}
                <span
                  class="mt-1.5 w-2 h-2 rounded-full shrink-0 {statusColors[session.status]}"
                  class:animate-pulse={session.status === 'active'}
                  title={statusLabels[session.status]}
                ></span>
              {/if}

              <!-- Session info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-200 truncate">{session.agent}</span>
                  {#if session.workflow}
                    <span class="text-xs text-gray-500 truncate">{session.workflow}</span>
                  {/if}
                </div>
                <div class="text-xs text-gray-500 truncate">
                  {getProjectName(session.projectPath)}
                </div>
              </div>

              <!-- Time and status -->
              <div class="text-right shrink-0">
                <div class="text-xs text-gray-500">
                  {formatRelativeTime(session.lastActive)}
                </div>
                <div class="flex items-center justify-end gap-1 mt-0.5">
                  {#if session.resumedAt}
                    <span class="px-1.5 py-0.5 text-xs rounded bg-blue-900/50 text-blue-400">
                      Resumed
                    </span>
                  {/if}
                  <span
                    class="px-1.5 py-0.5 text-xs rounded
                      {session.status === 'active'
                      ? 'bg-green-900/50 text-green-400'
                      : session.status === 'completed'
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-yellow-900/50 text-yellow-400'}"
                  >
                    {statusLabels[session.status]}
                  </span>
                </div>
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
