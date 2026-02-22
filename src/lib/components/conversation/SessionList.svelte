<script lang="ts">
  import type { SessionRecord } from '$lib/services/process';

  type FilterType = 'all' | 'active' | 'completed' | 'this-week';

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
  let activeFilter = $state<FilterType>('all');
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

  const filterChips: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'this-week', label: 'This Week' },
  ];

  // Check if a session is from this week
  function isThisWeek(isoString: string): boolean {
    const date = new Date(isoString);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo;
  }

  // Filter sessions based on active filter
  let filteredSessions = $derived.by(() => {
    if (activeFilter === 'all') return sessions;

    return sessions.filter((session) => {
      switch (activeFilter) {
        case 'active':
          return session.status === 'active';
        case 'completed':
          return session.status === 'completed';
        case 'this-week':
          return isThisWeek(session.lastActive);
        default:
          return true;
      }
    });
  });

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

  function clearSearch() {
    searchQuery = '';
    // Trigger immediate search with empty query
    onSearch?.('');
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
        class="w-full px-3 py-1.5 pr-8 text-sm bg-gray-800 border border-gray-700 rounded
          text-gray-200 placeholder-gray-500
          focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
      />
      <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {#if isSearching}
          <div class="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
        {:else if searchQuery}
          <button
            onclick={clearSearch}
            class="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
            title="Clear search"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
    <!-- Filter chips -->
    <div class="flex gap-1.5 mt-2" role="group" aria-label="Filter sessions">
      {#each filterChips as chip}
        <button
          onclick={() => (activeFilter = chip.id)}
          class="px-2 py-0.5 text-xs rounded-full transition-colors
            {activeFilter === chip.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'}"
          aria-pressed={activeFilter === chip.id}
        >
          {chip.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Session list -->
  <div class="flex-1 overflow-y-auto">
    {#if filteredSessions.length === 0}
      <div class="p-4 text-center text-gray-500 text-sm">
        {#if searchQuery}
          <div class="mb-2">
            No sessions match "<span class="text-gray-400">{searchQuery}</span>"
          </div>
          <p class="text-xs text-gray-600 mb-3">
            Try different keywords or clear the search to see all sessions.
          </p>
          <button
            onclick={clearSearch}
            class="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
          >
            Clear Search
          </button>
        {:else if activeFilter !== 'all'}
          <div class="mb-2">
            No {activeFilter === 'this-week' ? 'sessions from this week' : activeFilter + ' sessions'}
          </div>
          <button
            onclick={() => (activeFilter = 'all')}
            class="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
          >
            Show All
          </button>
        {:else}
          No session history yet
        {/if}
      </div>
    {:else}
      <ul class="divide-y divide-gray-800">
        {#each filteredSessions as session (session.id)}
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
              <div class="flex-1 min-w-0 overflow-hidden">
                <div class="font-medium text-gray-200 truncate" title={session.agent}>
                  {session.agent}
                </div>
                {#if session.workflow}
                  <div class="text-xs text-gray-500 truncate" title={session.workflow}>
                    {session.workflow}
                  </div>
                {/if}
                <div class="text-xs text-gray-600 truncate" title={session.projectPath}>
                  {getProjectName(session.projectPath)}
                </div>
              </div>

              <!-- Time and status -->
              <div class="text-right shrink-0 ml-2">
                <div class="text-xs text-gray-500 whitespace-nowrap">
                  {formatRelativeTime(session.lastActive)}
                </div>
                <div class="flex items-center justify-end gap-1 mt-0.5 flex-wrap">
                  {#if session.resumedAt}
                    <span class="px-1.5 py-0.5 text-xs rounded bg-blue-900/50 text-blue-400 whitespace-nowrap">
                      Resumed
                    </span>
                  {/if}
                  <span
                    class="px-1.5 py-0.5 text-xs rounded whitespace-nowrap
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
