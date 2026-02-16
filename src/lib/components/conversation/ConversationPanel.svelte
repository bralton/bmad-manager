<script lang="ts">
  import Terminal from './Terminal.svelte';
  import { terminateSession } from '$lib/services/process';
  import type { ClaudeSession } from '$lib/services/process';

  interface Props {
    session: ClaudeSession;
    visible?: boolean;
    onClose?: () => void;
  }

  let { session, visible = true, onClose }: Props = $props();

  let showConfirmTerminate = $state(false);
  let terminating = $state(false);

  const isActive = $derived(session.status === 'active');

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

  function handleCloseClick() {
    if (isActive) {
      showConfirmTerminate = true;
    } else {
      onClose?.();
    }
  }

  async function handleConfirmTerminate() {
    terminating = true;
    try {
      await terminateSession(session.id);
    } catch (error) {
      console.error('Failed to terminate session:', error);
    } finally {
      terminating = false;
      showConfirmTerminate = false;
    }
  }

  function handleCancelTerminate() {
    showConfirmTerminate = false;
  }
</script>

<div class="flex flex-col h-full bg-gray-900 relative">
  <!-- Header -->
  <header class="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
    <div class="flex items-center gap-3">
      <!-- Status indicator -->
      <span
        class="w-2 h-2 rounded-full {statusColors[session.status]}"
        title={statusLabels[session.status]}
      ></span>

      <!-- Agent name -->
      <h2 class="text-sm font-medium text-gray-100">
        {session.agent}
      </h2>

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
      <span class="text-xs text-gray-400">
        {statusLabels[session.status]}
      </span>

      <!-- Close/Terminate button -->
      <button
        onclick={handleCloseClick}
        class="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
        title={isActive ? 'Terminate session' : 'Close panel'}
        disabled={terminating}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </header>

  <!-- Terminal area -->
  <div class="flex-1 min-h-0">
    <Terminal sessionId={session.id} {visible} />
  </div>

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
