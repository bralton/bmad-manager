<script lang="ts">
  import { currentProject } from '$lib/stores/project';
  import { addSession, selectSession } from '$lib/stores/sessions';
  import { spawnClaudeSession, generateSessionName } from '$lib/services/process';
  import AgentCard from './AgentCard.svelte';
  import type { Agent } from '$lib/types/agent';

  let project = $derived($currentProject);
  let agents = $derived(project?.agents ?? []);

  // Accordion state - track which agent is expanded (only one at a time)
  let expandedAgentName = $state<string | null>(null);

  // Feedback message state
  let feedbackMessage = $state<string | null>(null);
  let feedbackType = $state<'info' | 'error' | 'success'>('info');
  let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  // Track if a spawn is in progress to prevent double-clicks
  let spawning = $state(false);

  function handleToggleExpand(agent: Agent) {
    // Toggle: if already expanded, collapse; otherwise expand this one (and collapse others)
    expandedAgentName = expandedAgentName === agent.name ? null : agent.name;
  }

  function showFeedback(message: string, type: 'info' | 'error' | 'success' = 'info', duration = 3000) {
    if (feedbackTimeout) clearTimeout(feedbackTimeout);
    feedbackMessage = message;
    feedbackType = type;
    feedbackTimeout = setTimeout(() => {
      feedbackMessage = null;
    }, duration);
  }

  async function handleAgentClick(agent: Agent) {
    if (!project || spawning) return;

    spawning = true;
    showFeedback(`Starting session with ${agent.displayName}...`, 'info');

    try {
      const sessionName = generateSessionName(project.name, agent.name);

      const session = await spawnClaudeSession({
        sessionName,
        projectPath: project.path,
        resume: false
      });

      // Add session to store and select it for display
      addSession(session);
      selectSession(session.id);

      showFeedback(`Session started: ${agent.displayName}`, 'success');

    } catch (error) {
      console.error('Failed to spawn session:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      showFeedback(`Failed to start session: ${errorMsg}`, 'error', 5000);
    } finally {
      spawning = false;
    }
  }
</script>

<div class="flex flex-col gap-1">
  <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 px-3 mb-2">
    Agents
  </h3>

  <!-- Feedback toast -->
  {#if feedbackMessage}
    {@const isInfo = feedbackType === 'info'}
    {@const isSuccess = feedbackType === 'success'}
    {@const isError = feedbackType === 'error'}
    <div
      class="mx-3 mb-2 px-3 py-2 rounded-md text-xs border"
      class:bg-blue-900={isInfo}
      class:border-blue-700={isInfo}
      class:text-blue-200={isInfo}
      class:bg-green-900={isSuccess}
      class:border-green-700={isSuccess}
      class:text-green-200={isSuccess}
      class:bg-red-900={isError}
      class:border-red-700={isError}
      class:text-red-200={isError}
    >
      {feedbackMessage}
    </div>
  {/if}

  {#if !project}
    <p class="text-sm text-gray-500 px-3 py-4">Open a project to see available agents</p>
  {:else if agents.length === 0}
    <p class="text-sm text-gray-500 px-3 py-4">No agents found in this project</p>
  {:else}
    {#each agents as agent (agent.path)}
      <AgentCard
        {agent}
        expanded={expandedAgentName === agent.name}
        onToggleExpand={handleToggleExpand}
        onclick={handleAgentClick}
        disabled={spawning}
      />
    {/each}
  {/if}
</div>
