<script lang="ts">
  import { currentProject } from '$lib/stores/project';
  import AgentCard from './AgentCard.svelte';
  import type { Agent } from '$lib/types/agent';

  let project = $derived($currentProject);
  let agents = $derived(project?.agents ?? []);

  // Accordion state - track which agent is expanded (only one at a time)
  let expandedAgentName = $state<string | null>(null);

  // Feedback message state for disabled click
  let feedbackMessage = $state<string | null>(null);
  let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleToggleExpand(agent: Agent) {
    // Toggle: if already expanded, collapse; otherwise expand this one (and collapse others)
    expandedAgentName = expandedAgentName === agent.name ? null : agent.name;
  }

  function handleAgentClick(agent: Agent) {
    // Placeholder for Story 1-5 - show user feedback
    console.log('Agent clicked:', agent.name, '- Session spawn not yet implemented');

    // Clear any existing timeout
    if (feedbackTimeout) clearTimeout(feedbackTimeout);

    // Show feedback message
    feedbackMessage = `Chat with ${agent.displayName} coming soon!`;

    // Auto-dismiss after 2 seconds
    feedbackTimeout = setTimeout(() => {
      feedbackMessage = null;
    }, 2000);

    // TODO (Story 1-5): Call spawnSession with agent context
  }
</script>

<div class="flex flex-col gap-1">
  <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 px-3 mb-2">
    Agents
  </h3>

  <!-- Feedback toast for disabled clicks -->
  {#if feedbackMessage}
    <div class="mx-3 mb-2 px-3 py-2 bg-blue-900/50 border border-blue-700 rounded-md text-xs text-blue-200">
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
        disabled={true}
      />
    {/each}
  {/if}
</div>
