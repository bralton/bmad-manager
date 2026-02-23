<script lang="ts">
  import { onMount } from 'svelte';
  import AgentRoster from '$lib/components/agents/AgentRoster.svelte';
  import SessionList from '$lib/components/conversation/SessionList.svelte';
  import {
    getRecentSessions,
    searchSessions,
    spawnClaudeSession,
    type SessionRecord,
  } from '$lib/services/process';
  import { addSession, selectSession, sessions } from '$lib/stores/sessions';
  import { currentProject } from '$lib/stores/project';
  import { activeView, setActiveView, openSettingsModal, type MainView } from '$lib/stores/ui';
  import { formatShortcutDisplay } from '$lib/services/shortcuts';

  type SidebarTab = 'agents' | 'sessions';

  let activeTab: SidebarTab = $state('agents');
  let currentView = $derived($activeView);
  let historicalSessions: SessionRecord[] = $state([]);
  let isLoadingSessions = $state(false);
  let isSearching = $state(false);
  let currentSearchQuery = $state('');
  let resumingSessionId: string | null = $state(null);
  let resumeError: string | null = $state(null);
  let project = $derived($currentProject);

  // Track session changes for live refresh (use regular variable, not $state, to avoid effect loops)
  let lastSessionKey = '';

  // Live refresh: watch for session store changes
  $effect(() => {
    // Build a key from session IDs and statuses to detect any change
    const sessionKey = Array.from($sessions.values())
      .map((s) => `${s.id}:${s.status}`)
      .join(',');

    // Only refresh if something actually changed
    if (sessionKey !== lastSessionKey) {
      lastSessionKey = sessionKey;
      // Only refresh if not in the middle of a search
      if (!currentSearchQuery.trim()) {
        refreshSessions();
      }
    }
  });

  onMount(async () => {
    await loadRecentSessions();
  });

  async function loadRecentSessions() {
    isLoadingSessions = true;
    try {
      historicalSessions = await getRecentSessions(50);
    } catch (error) {
      console.error('Failed to load recent sessions:', error);
      historicalSessions = [];
    } finally {
      isLoadingSessions = false;
    }
  }

  // Silent refresh (no loading indicator) for live updates
  async function refreshSessions() {
    try {
      if (currentSearchQuery.trim()) {
        historicalSessions = await searchSessions(currentSearchQuery, 50);
      } else {
        historicalSessions = await getRecentSessions(50);
      }
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
    }
  }

  async function handleSearch(query: string) {
    currentSearchQuery = query;

    if (!query.trim()) {
      isSearching = false;
      await refreshSessions();
      return;
    }

    isSearching = true;
    try {
      historicalSessions = await searchSessions(query, 50);
    } catch (error) {
      console.error('Failed to search sessions:', error);
    } finally {
      isSearching = false;
    }
  }

  async function handleResume(sessionId: string) {
    // Clear any previous error
    resumeError = null;

    if (!project) {
      resumeError = 'No project selected';
      console.warn('Cannot resume session: no project selected');
      return;
    }

    const session = historicalSessions.find((s) => s.id === sessionId);
    if (!session) {
      resumeError = 'Session not found';
      console.warn('Cannot resume session: session not found in list');
      return;
    }

    // If session is already active, just select it instead of spawning a new one
    if (session.status === 'active') {
      selectSession(sessionId);
      return;
    }

    // Set loading state
    resumingSessionId = sessionId;

    try {
      // Spawn using the ORIGINAL session ID and Claude session UUID to resume
      // Note: Backend handles marking session as resumed in database atomically
      const newSession = await spawnClaudeSession({
        sessionName: sessionId, // Use original session ID
        projectPath: project.path,
        resume: true,
        claudeSessionId: session.claudeSessionId, // Pass UUID for Claude CLI --resume
      });

      addSession(newSession);
      selectSession(newSession.id);

      // Refresh the session list to show updated status
      await refreshSessions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      resumeError = `Failed to resume session: ${errorMessage}`;
      console.error('Failed to resume session:', error);
    } finally {
      resumingSessionId = null;
    }
  }
</script>

<aside class="w-72 h-screen bg-gray-900 border-r border-gray-800 flex flex-col overflow-x-hidden relative">
  <div class="p-4 border-b border-gray-800">
    <h2 class="text-lg font-semibold text-gray-200">BMAD Manager</h2>
  </div>

  <!-- Main View Switcher -->
  <div class="flex border-b border-gray-800">
    <button
      onclick={() => setActiveView('dashboards')}
      class="flex-1 px-2 py-2 text-xs font-medium transition-colors
        {currentView === 'dashboards'
        ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'}"
      title="Dashboards ({formatShortcutDisplay('Cmd+1')})"
    >
      Dashboards
    </button>
    <button
      onclick={() => setActiveView('workflows')}
      class="flex-1 px-2 py-2 text-xs font-medium transition-colors
        {currentView === 'workflows'
        ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'}"
      title="Workflows ({formatShortcutDisplay('Cmd+2')})"
    >
      Workflows
    </button>
    <button
      onclick={() => setActiveView('stories')}
      class="flex-1 px-2 py-2 text-xs font-medium transition-colors
        {currentView === 'stories'
        ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'}"
      title="Stories ({formatShortcutDisplay('Cmd+3')})"
    >
      Stories
    </button>
    <button
      onclick={() => setActiveView('artifacts')}
      class="flex-1 px-2 py-2 text-xs font-medium transition-colors
        {currentView === 'artifacts'
        ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'}"
      title="Artifacts ({formatShortcutDisplay('Cmd+4')})"
    >
      Artifacts
    </button>
  </div>

  <!-- Tab switcher -->
  <div class="flex border-b border-gray-800">
    <button
      onclick={() => (activeTab = 'agents')}
      class="flex-1 px-4 py-2 text-sm font-medium transition-colors
        {activeTab === 'agents'
        ? 'text-gray-200 border-b-2 border-blue-500'
        : 'text-gray-500 hover:text-gray-300'}"
    >
      Agents
    </button>
    <button
      onclick={() => (activeTab = 'sessions')}
      class="flex-1 px-4 py-2 text-sm font-medium transition-colors
        {activeTab === 'sessions'
        ? 'text-gray-200 border-b-2 border-blue-500'
        : 'text-gray-500 hover:text-gray-300'}"
    >
      Sessions
    </button>
  </div>

  <nav class="flex-1 overflow-y-auto pb-14">
    {#if activeTab === 'agents'}
      <div class="p-2">
        <AgentRoster />
      </div>
    {:else}
      {#if isLoadingSessions && historicalSessions.length === 0}
        <!-- Only show full loading state on initial load -->
        <div class="flex items-center justify-center p-8">
          <div class="w-6 h-6 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
        </div>
      {:else}
        <!-- Show error message if resume failed -->
        {#if resumeError}
          <div class="mx-2 mb-2 p-2 text-sm bg-red-900/50 text-red-300 rounded border border-red-800">
            {resumeError}
            <button
              onclick={() => (resumeError = null)}
              class="ml-2 text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        {/if}
        <SessionList
          sessions={historicalSessions}
          isSearching={isSearching}
          {resumingSessionId}
          onResume={handleResume}
          onSearch={handleSearch}
        />
      {/if}
    {/if}
  </nav>

  <!-- Settings Button (fixed at bottom) -->
  <div class="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-800 bg-gray-900">
    <button
      onclick={() => openSettingsModal()}
      class="flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors w-full group"
      title="Open settings ({formatShortcutDisplay('Cmd+,')})"
    >
      <span class="flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Settings</span>
      </span>
      <kbd class="text-xs text-gray-600 group-hover:text-gray-500 font-mono">{formatShortcutDisplay('Cmd+,')}</kbd>
    </button>
  </div>
</aside>
