<script lang="ts">
  import { sessions, currentSessionId, selectSession, activeSessions, sessionsWithNewOutput } from '$lib/stores/sessions';
  import type { ClaudeSession } from '$lib/services/process';

  let allSessions = $derived(Array.from($sessions.values()));
  let activeList = $derived($activeSessions);
  let selectedId = $derived($currentSessionId);
  let newOutputSet = $derived($sessionsWithNewOutput);

  const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    completed: 'bg-gray-500',
    interrupted: 'bg-yellow-500',
  };

  function handleTabClick(session: ClaudeSession) {
    selectSession(session.id);
  }

  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

{#if allSessions.length > 1}
  <div class="flex items-center gap-1 px-2 py-1 bg-gray-800 border-b border-gray-700 overflow-x-auto">
    {#each allSessions as session (session.id)}
      {@const isSelected = session.id === selectedId}
      {@const isActive = session.status === 'active'}
      {@const hasNewOutput = newOutputSet.has(session.id)}
      <button
        onclick={() => handleTabClick(session)}
        class="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors shrink-0
          {isSelected
            ? 'bg-gray-700 text-gray-100'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}"
      >
        <span
          class="w-2 h-2 rounded-full {statusColors[session.status]}"
          class:animate-pulse={isActive}
        ></span>
        <span class="truncate max-w-[120px]">{session.agent}</span>
        <span class="text-xs text-gray-500">{formatTime(session.startedAt)}</span>
        {#if hasNewOutput && !isSelected}
          <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="New output"></span>
        {/if}
      </button>
    {/each}
  </div>
{/if}
