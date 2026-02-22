<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import ProjectPicker from '$lib/components/project/ProjectPicker.svelte';
  import ConversationPanel from '$lib/components/conversation/ConversationPanel.svelte';
  import SessionTabs from '$lib/components/conversation/SessionTabs.svelte';
  import FirstRunWizard from '$lib/components/settings/FirstRunWizard.svelte';
  import WorkflowVisualizerContainer from '$lib/components/workflow/WorkflowVisualizerContainer.svelte';
  import StoryBoardContainer from '$lib/components/stories/StoryBoardContainer.svelte';
  import CommandPalette from '$lib/components/shared/CommandPalette.svelte';
  import Toast from '$lib/components/shared/Toast.svelte';
  import {
    sessions,
    currentSession,
    currentSessionId,
    selectSession,
    addSession,
  } from '$lib/stores/sessions';
  import { showWizard, loadSettings, settingsLoading, settingsError } from '$lib/stores/settings';
  import { currentProject } from '$lib/stores/project';
  import {
    activeView,
    toggleCommandPalette,
    lastExecutedCommand,
    clearLastExecutedCommand,
    showToast,
  } from '$lib/stores/ui';
  import {
    spawnClaudeSession,
    sendSessionInput,
    generateSessionName,
  } from '$lib/services/process';
  import { api } from '$lib/services/tauri';
  import { projectLoading, projectError } from '$lib/stores/project';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

  let selectedId = $derived($currentSessionId);
  let allSessions = $derived(Array.from($sessions.values()));
  let hasAnySessions = $derived(allSessions.length > 0);
  let wizardVisible = $derived($showWizard);
  let isLoadingSettings = $derived($settingsLoading);
  let loadError = $derived($settingsError);
  let project = $derived($currentProject);
  let activeSession = $derived($currentSession);
  let executedCommand = $derived($lastExecutedCommand);
  let currentView = $derived($activeView);

  // Track when a session is being spawned to prevent duplicate spawns
  let isSpawningSession = $state(false);

  // Queue for commands received while a session is spawning (AC3: queue until ready)
  let pendingCommand = $state<string | null>(null);

  // React to command execution from CommandPalette
  $effect(() => {
    const command = executedCommand;
    if (command) {
      handleCommandExecution(command);
      clearLastExecutedCommand();
    }
  });

  // Process pending command when session spawn completes (AC3: inject once ready)
  $effect(() => {
    if (!isSpawningSession && pendingCommand && activeSession?.status === 'active') {
      const cmd = pendingCommand;
      pendingCommand = null;
      // Inject the queued command into the now-ready session
      sendSessionInput(activeSession.id, `/${cmd}\n`)
        .then(() => {
          showToast(`Sent /${cmd} to session`, '⚡');
        })
        .catch((e: unknown) => {
          const errorMsg = e instanceof Error ? e.message : String(e);
          showToast(`Failed to send queued command: ${errorMsg}`, '✗', 3000);
        });
    }
  });

  /**
   * Handles command injection into active session or spawns a new session.
   * Called when user selects a command from the CommandPalette.
   */
  async function handleCommandExecution(command: string) {
    const session = activeSession;

    if (session && session.status === 'active') {
      // Inject command into active session
      try {
        await sendSessionInput(session.id, `/${command}\n`);
        showToast(`Sent /${command} to session`, '⚡');
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        showToast(`Failed to send command: ${errorMsg}`, '✗', 3000);
      }
    } else {
      // Spawn new session with command
      if (!project?.path) {
        showToast('No project loaded. Open a project first.', '✗', 3000);
        return;
      }

      // Queue command if another spawn is in progress (AC3: queue until ready)
      if (isSpawningSession) {
        pendingCommand = command;
        showToast(`Queued /${command} - session starting...`, '⏳');
        return;
      }

      try {
        isSpawningSession = true;
        showToast(`Starting session with /${command}...`, '🚀');
        const sessionName = generateSessionName(project.name, 'command');
        const newSession = await spawnClaudeSession({
          sessionName,
          projectPath: project.path,
          initialCommand: `/${command}`,
        });
        addSession(newSession);
        selectSession(newSession.id);
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        showToast(`Failed to start session: ${errorMsg}. Try again or check Claude CLI.`, '✗', 4000);
      } finally {
        isSpawningSession = false;
      }
    }
  }

  /**
   * Initializes a project from URL params (for new windows).
   * Called when opened with ?project=/path/to/project
   */
  async function initializeFromUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectPath = urlParams.get('project');

    if (projectPath) {
      const decodedPath = decodeURIComponent(projectPath);

      projectLoading.set(true);
      projectError.set(null);

      try {
        const loadedProject = await api.openProject(decodedPath);
        currentProject.set(loadedProject);

        // Update window title to show project name
        try {
          const appWindow = getCurrentWebviewWindow();
          await appWindow.setTitle(`BMAD Manager - ${loadedProject.name}`);
        } catch (titleError) {
          console.warn('Failed to set window title:', titleError);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        projectError.set(message);
        console.error('Failed to load project from URL params:', message);
      } finally {
        projectLoading.set(false);
      }
    }
  }

  // Load settings on mount and set up global keyboard shortcut
  onMount(() => {
    loadSettings();

    // Initialize project from URL params if provided (AC #6 - new window support)
    initializeFromUrlParams();

    // Global keyboard shortcut handler for command palette
    // Uses capture phase to intercept before xterm.js
    const handler = (e: KeyboardEvent) => {
      // Cmd+K on macOS, Ctrl+K on Windows/Linux
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        toggleCommandPalette();
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  });

  function handleClosePanel() {
    selectSession(null);
  }
</script>

<!-- Settings Load Error -->
{#if loadError && !isLoadingSettings}
  <div class="fixed top-4 right-4 z-50 bg-red-900/90 border border-red-700 rounded-lg p-4 max-w-md shadow-xl">
    <div class="flex gap-3">
      <span class="text-red-400 text-lg">✗</span>
      <div>
        <p class="text-red-300 font-medium">Failed to load settings</p>
        <p class="text-red-400/70 text-sm mt-1">{loadError}</p>
        <button
          onclick={() => loadSettings()}
          class="mt-2 text-sm text-red-300 hover:text-red-100 underline"
        >
          Retry
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- First Run Wizard Modal -->
{#if wizardVisible && !isLoadingSettings}
  <FirstRunWizard />
{/if}

<!-- Command Palette -->
<CommandPalette />

<!-- Toast Notifications -->
<Toast />

<div class="flex h-screen bg-gray-900 text-gray-100">
  <Sidebar />

  <main class="flex-1 flex flex-col min-w-0">
    {#if currentView === 'stories'}
      <!-- Story Board View -->
      <StoryBoardContainer />
    {:else}
      <!-- Workflow View (default) -->
      <!-- Workflow Visualizer always visible at top when project is loaded -->
      <WorkflowVisualizerContainer />

    {#if hasAnySessions}
      <!-- Session tabs when multiple sessions exist -->
      <SessionTabs />

      <!-- Session panels - stack all with proper dimensions, show selected on top -->
      <!-- Key includes startedAt to force recreate Terminal when session is resumed -->
      <div class="flex-1 relative min-h-0">
        {#each allSessions as sess (`${sess.id}-${sess.startedAt}`)}
          {@const isSelected = sess.id === selectedId}
          <div
            class="absolute inset-0 flex"
            style="visibility: {isSelected ? 'visible' : 'hidden'}; z-index: {isSelected ? 10 : 0};"
          >
            <div class="flex-1">
              <ConversationPanel session={sess} visible={isSelected} onClose={handleClosePanel} />
            </div>
          </div>
        {/each}
      </div>
    {:else if isSpawningSession}
      <!-- Session spawning indicator (AC3: loading state) -->
      <div class="flex-1 flex items-center justify-center">
        <div class="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700 max-w-md w-full mx-4">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl animate-pulse">🚀</span>
            <span class="text-lg text-gray-100">Starting Claude session...</span>
          </div>
          <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 rounded-full animate-progress-indeterminate"></div>
          </div>
          {#if pendingCommand}
            <p class="text-sm text-gray-400 mt-3">
              Queued: <span class="text-blue-400 font-mono">/{pendingCommand}</span>
            </p>
          {/if}
        </div>
      </div>
    {:else}
      <div class="flex-1 p-8">
        <header class="mb-8">
          <h1 class="text-2xl font-bold">Welcome to BMAD Manager</h1>
        </header>

        <ProjectPicker />
      </div>
    {/if}
    {/if}
  </main>
</div>

<style>
  @keyframes progress-indeterminate {
    0% {
      width: 0%;
      margin-left: 0%;
    }
    50% {
      width: 40%;
      margin-left: 30%;
    }
    100% {
      width: 0%;
      margin-left: 100%;
    }
  }

  .animate-progress-indeterminate {
    animation: progress-indeterminate 1.5s ease-in-out infinite;
  }
</style>
