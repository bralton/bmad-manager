<script lang="ts">
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import ProjectPicker from '$lib/components/project/ProjectPicker.svelte';
  import ConversationPanel from '$lib/components/conversation/ConversationPanel.svelte';
  import SessionTabs from '$lib/components/conversation/SessionTabs.svelte';
  import { sessions, currentSession, currentSessionId, selectSession } from '$lib/stores/sessions';

  let session = $derived($currentSession);
  let selectedId = $derived($currentSessionId);
  let allSessions = $derived(Array.from($sessions.values()));
  let hasAnySessions = $derived(allSessions.length > 0);

  function handleClosePanel() {
    selectSession(null);
  }
</script>

<div class="flex h-screen bg-gray-900 text-gray-100">
  <Sidebar />

  <main class="flex-1 flex flex-col min-w-0">
    {#if hasAnySessions}
      <!-- Session tabs when multiple sessions exist -->
      <SessionTabs />

      <!-- Session panels - stack all with proper dimensions, show selected on top -->
      <div class="flex-1 relative min-h-0">
        {#each allSessions as sess (sess.id)}
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
