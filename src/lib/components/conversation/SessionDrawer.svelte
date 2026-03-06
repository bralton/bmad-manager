<script lang="ts">
  import Terminal from './Terminal.svelte';
  import { terminateSession } from '$lib/services/process';
  import {
    currentSession,
    currentSessionId,
    selectSession,
  } from '$lib/stores/sessions';
  import {
    sessionDrawerOpen,
    sessionDrawerHeight,
    closeSessionDrawer,
    setSessionDrawerHeight,
    showToast,
  } from '$lib/stores/ui';
  import { isTerminalFocused } from '$lib/utils/keyboard';

  // Reactive store values
  let session = $derived($currentSession);
  let sessionId = $derived($currentSessionId);
  let drawerOpen = $derived($sessionDrawerOpen);
  let drawerHeight = $derived($sessionDrawerHeight);

  // Local state
  let showConfirmTerminate = $state(false);
  let terminating = $state(false);
  let isResizing = $state(false);
  let resizeStartY = $state(0);
  let resizeStartHeight = $state(0);

  // Derived values
  const isActive = $derived(session?.status === 'active');
  const isPartyMode = $derived(session?.partyMode?.enabled ?? false);
  const partyParticipants = $derived(session?.partyMode?.participants ?? []);

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

  function formatStartTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Collapse drawer (minimize)
  function handleCollapse() {
    closeSessionDrawer();
  }

  // Close button - terminate active session or just close
  function handleCloseClick() {
    if (isActive) {
      showConfirmTerminate = true;
    } else {
      // For completed/interrupted sessions, just close the drawer
      closeSessionDrawer();
      selectSession(null);
    }
  }

  async function handleConfirmTerminate() {
    if (!sessionId) return;

    terminating = true;
    try {
      await terminateSession(sessionId);
      showToast('Session terminated', '\u2713');
      closeSessionDrawer();
    } catch (error) {
      console.error('Failed to terminate session:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      showToast(`Failed to terminate: ${errorMsg}`, '\u2717', 3000);
    } finally {
      terminating = false;
      showConfirmTerminate = false;
    }
  }

  function handleCancelTerminate() {
    showConfirmTerminate = false;
  }

  // Resize handle logic
  function onResizeStart(e: MouseEvent) {
    isResizing = true;
    resizeStartY = e.clientY;
    resizeStartHeight = drawerHeight;
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
    e.preventDefault();
  }

  function onResizeMove(e: MouseEvent) {
    if (!isResizing) return;
    // Dragging down increases height (since drawer is at top)
    const delta = e.clientY - resizeStartY;
    setSessionDrawerHeight(resizeStartHeight + delta);
  }

  function onResizeEnd() {
    isResizing = false;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  // ESC key handler - only close drawer if terminal is not focused
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && drawerOpen) {
      // Don't close if terminal has focus (let ESC pass through to terminal)
      if (isTerminalFocused()) return;
      // Don't close if confirmation dialog is open
      if (showConfirmTerminate) {
        handleCancelTerminate();
        return;
      }
      closeSessionDrawer();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if drawerOpen && session}
  <div
    class="flex flex-col bg-gray-900 border-b border-gray-700 overflow-hidden transition-[height] duration-200 ease-out"
    class:select-none={isResizing}
    style="height: {drawerHeight}px"
  >
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
      <div class="flex items-center gap-3">
        <!-- Status indicator -->
        <span
          class="w-2 h-2 rounded-full {statusColors[session.status]}"
          class:animate-pulse={session.status === 'active'}
          title={statusLabels[session.status]}
        ></span>

        <!-- Agent name / Party mode indicator -->
        {#if isPartyMode}
          <span class="text-lg" aria-hidden="true">🎉</span>
          <h2 class="text-sm font-medium text-purple-200">Party Mode</h2>
          <!-- Participant avatars -->
          <div class="flex items-center -space-x-1" title={partyParticipants.join(', ')}>
            {#each partyParticipants.slice(0, 4) as participant, i}
              <span
                class="w-5 h-5 rounded-full bg-purple-700 border border-purple-500/50 flex items-center justify-center text-xs font-medium text-purple-100"
                style="z-index: {4 - i}"
              >
                {participant.charAt(0)}
              </span>
            {/each}
            {#if partyParticipants.length > 4}
              <span
                class="w-5 h-5 rounded-full bg-purple-900 border border-purple-500/50 flex items-center justify-center text-xs font-medium text-purple-300"
              >
                +{partyParticipants.length - 4}
              </span>
            {/if}
          </div>
          <span class="text-xs text-purple-300">{partyParticipants.length} agents</span>
        {:else}
          <h2 class="text-sm font-medium text-gray-100">{session.agent}</h2>
        {/if}

        <!-- Start time -->
        <span class="text-xs text-gray-500">
          Started {formatStartTime(session.startedAt)}
        </span>

        <!-- Workflow badge (if present) -->
        {#if session.workflow}
          <span class="px-2 py-0.5 text-xs bg-purple-900 text-purple-200 rounded">
            {session.workflow}
          </span>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <!-- Status label -->
        <span class="text-xs text-gray-400">{statusLabels[session.status]}</span>

        <!-- Collapse button -->
        <button
          onclick={handleCollapse}
          class="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
          title="Collapse drawer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
        </button>

        <!-- Close/Terminate button -->
        <button
          onclick={handleCloseClick}
          class="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
          title={isActive ? 'Terminate session' : 'Close drawer'}
          disabled={terminating}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Terminal area: keyed by session.id to remount when switching sessions -->
    {#key session.id}
      <div class="flex-1 min-h-0">
        <Terminal sessionId={session.id} visible={drawerOpen} />
      </div>
    {/key}

    <!-- Resize handle at bottom -->
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize drawer"
      tabindex="0"
      class="h-1.5 bg-gray-700 hover:bg-blue-500 cursor-row-resize flex-shrink-0 transition-colors"
      onmousedown={onResizeStart}
    ></div>

    <!-- Terminate confirmation dialog -->
    {#if showConfirmTerminate}
      <div class="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-xl max-w-sm">
          <h3 class="text-lg font-medium text-gray-100 mb-2">Terminate Session?</h3>
          <p class="text-sm text-gray-400 mb-4">
            This will stop the Claude CLI process. Any unsaved work may be lost.
          </p>
          <div class="flex justify-end gap-3">
            <button
              onclick={handleCancelTerminate}
              class="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded transition-colors"
              disabled={terminating}
            >
              Cancel
            </button>
            <button
              onclick={handleConfirmTerminate}
              class="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded transition-colors disabled:opacity-50"
              disabled={terminating}
            >
              {terminating ? 'Terminating...' : 'Terminate'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
