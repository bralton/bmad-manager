<script lang="ts">
  import {
    activeSessions,
    currentSessionId,
    sessionsWithNewOutput,
    selectSession,
  } from '$lib/stores/sessions';
  import { terminateSession } from '$lib/services/process';
  import { showToast } from '$lib/stores/ui';
  import type { ClaudeSession } from '$lib/services/process';

  // Overflow threshold - show this many tabs before overflow
  const OVERFLOW_THRESHOLD = 4;

  // Reactive store values
  let activeList = $derived($activeSessions);
  let selectedId = $derived($currentSessionId);
  let newOutputSet = $derived($sessionsWithNewOutput);

  // Overflow dropdown state
  let showOverflowDropdown = $state(false);

  // Termination dialog state
  let showTerminateDialog = $state(false);
  let terminatingSessionId = $state<string | null>(null);
  let isTerminating = $state(false);

  // Computed: visible sessions vs overflow
  let visibleSessions = $derived(activeList.slice(0, OVERFLOW_THRESHOLD));
  let overflowSessions = $derived(activeList.slice(OVERFLOW_THRESHOLD));
  let hasOverflow = $derived(overflowSessions.length > 0);

  const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    completed: 'bg-gray-500',
    interrupted: 'bg-yellow-500',
  };

  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function handleTabClick(session: ClaudeSession) {
    selectSession(session.id);
  }

  function handleCloseClick(event: MouseEvent, session: ClaudeSession) {
    event.stopPropagation();
    terminatingSessionId = session.id;
    showTerminateDialog = true;
  }

  async function confirmTerminate() {
    if (!terminatingSessionId) return;

    isTerminating = true;
    try {
      await terminateSession(terminatingSessionId);
      showToast('Session terminated', '\u2713');
    } catch (error) {
      console.error('Failed to terminate session:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      showToast(`Failed to terminate: ${errorMsg}`, '\u2717', 3000);
    } finally {
      isTerminating = false;
      showTerminateDialog = false;
      terminatingSessionId = null;
    }
  }

  function cancelTerminate() {
    showTerminateDialog = false;
    terminatingSessionId = null;
  }

  function toggleOverflowDropdown() {
    showOverflowDropdown = !showOverflowDropdown;
  }

  function closeOverflowDropdown() {
    showOverflowDropdown = false;
  }

  function handleOverflowSessionClick(session: ClaudeSession) {
    selectSession(session.id);
    closeOverflowDropdown();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && showOverflowDropdown) {
      closeOverflowDropdown();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if activeList.length > 0}
<div class="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
  <!-- Session tabs -->
  {#each visibleSessions as session (session.id)}
    {@const isSelected = session.id === selectedId}
    {@const hasNewOutput = newOutputSet.has(session.id) && !isSelected}
    <div
      role="button"
      tabindex="0"
      onclick={() => handleTabClick(session)}
      onkeydown={(e) => e.key === 'Enter' && handleTabClick(session)}
      class="group flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors shrink-0 relative cursor-pointer
        {isSelected
          ? 'bg-gray-700 text-gray-100'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}"
    >
      <!-- Status dot -->
      <span
        class="w-2 h-2 rounded-full {statusColors[session.status]}"
        class:animate-pulse={session.status === 'active'}
      ></span>

      <!-- Agent name -->
      <span class="truncate max-w-[100px]">{session.agent}</span>

      <!-- Start time -->
      <span class="text-xs text-gray-500">{formatTime(session.startedAt)}</span>

      <!-- Blue dot for new output -->
      {#if hasNewOutput}
        <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="New output"></span>
      {/if}

      <!-- Close button (visible on hover) -->
      <button
        onclick={(e) => handleCloseClick(e, session)}
        class="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-gray-200 hover:bg-gray-600 rounded transition-all ml-1"
        title="Terminate session"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/each}

  <!-- Overflow dropdown -->
  {#if hasOverflow}
    <div class="relative">
      <button
        onclick={toggleOverflowDropdown}
        aria-label="Show {overflowSessions.length} more sessions"
        aria-expanded={showOverflowDropdown}
        aria-haspopup="menu"
        class="flex items-center gap-1 px-2 py-1.5 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
      >
        +{overflowSessions.length} more
      </button>

      {#if showOverflowDropdown}
        <!-- Backdrop to close dropdown -->
        <button
          class="fixed inset-0 z-40"
          onclick={closeOverflowDropdown}
          aria-label="Close dropdown"
        ></button>

        <!-- Dropdown menu -->
        <div
          role="menu"
          aria-label="Additional sessions"
          class="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[200px]"
        >
          {#each overflowSessions as session (session.id)}
            {@const isSelected = session.id === selectedId}
            {@const hasNewOutput = newOutputSet.has(session.id) && !isSelected}
            <div
              role="menuitem"
              class="group flex items-center gap-2 px-3 py-2 text-sm transition-colors
                {isSelected
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}"
            >
              <button
                onclick={() => handleOverflowSessionClick(session)}
                class="flex items-center gap-2 flex-1 min-w-0"
              >
                <span
                  class="w-2 h-2 rounded-full shrink-0 {statusColors[session.status]}"
                  class:animate-pulse={session.status === 'active'}
                ></span>
                <span class="truncate flex-1 text-left">{session.agent}</span>
                <span class="text-xs text-gray-500 shrink-0">{formatTime(session.startedAt)}</span>
                {#if hasNewOutput}
                  <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" title="New output"></span>
                {/if}
              </button>
              <!-- Close button (visible on hover) -->
              <button
                onclick={(e) => { e.stopPropagation(); handleCloseClick(e, session); closeOverflowDropdown(); }}
                class="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-gray-200 hover:bg-gray-600 rounded transition-all shrink-0"
                title="Terminate session"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
{/if}

<!-- Terminate confirmation dialog -->
{#if showTerminateDialog}
  <div class="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-xl max-w-sm">
      <h3 class="text-lg font-medium text-gray-100 mb-2">Terminate Session?</h3>
      <p class="text-sm text-gray-400 mb-4">
        This will stop the Claude CLI process. Any unsaved work may be lost.
      </p>
      <div class="flex justify-end gap-3">
        <button
          onclick={cancelTerminate}
          class="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded transition-colors"
          disabled={isTerminating}
        >
          Cancel
        </button>
        <button
          onclick={confirmTerminate}
          class="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded transition-colors disabled:opacity-50"
          disabled={isTerminating}
        >
          {isTerminating ? 'Terminating...' : 'Terminate'}
        </button>
      </div>
    </div>
  </div>
{/if}
