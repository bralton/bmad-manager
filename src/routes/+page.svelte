<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import ProjectPicker from '$lib/components/project/ProjectPicker.svelte';
  import ConversationPanel from '$lib/components/conversation/ConversationPanel.svelte';
  import SessionTabs from '$lib/components/conversation/SessionTabs.svelte';
  import FirstRunWizard from '$lib/components/settings/FirstRunWizard.svelte';
  import { sessions, currentSession, currentSessionId, selectSession } from '$lib/stores/sessions';
  import { showWizard, loadSettings, settingsLoading, settingsError } from '$lib/stores/settings';

  let selectedId = $derived($currentSessionId);
  let allSessions = $derived(Array.from($sessions.values()));
  let hasAnySessions = $derived(allSessions.length > 0);
  let wizardVisible = $derived($showWizard);
  let isLoadingSettings = $derived($settingsLoading);
  let loadError = $derived($settingsError);

  // Load settings on mount to determine if wizard should show
  onMount(() => {
    loadSettings();
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

<div class="flex h-screen bg-gray-900 text-gray-100">
  <Sidebar />

  <main class="flex-1 flex flex-col min-w-0">
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
    {:else}
      <div class="flex-1 p-8">
        <header class="mb-8">
          <h1 class="text-2xl font-bold">Welcome to BMAD Manager</h1>
        </header>

        <ProjectPicker />
      </div>
    {/if}
  </main>
</div>
