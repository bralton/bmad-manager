<script lang="ts">
  import { currentProject } from '$lib/stores/project';
  import { addSession, selectSession } from '$lib/stores/sessions';
  import { spawnClaudeSession, generateSessionName } from '$lib/services/process';
  import AgentCard from './AgentCard.svelte';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
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

  /**
   * Builds the slash command to invoke an agent.
   * Pattern: /bmad-agent-{module}-{name} (or /bmad-agent-{name} for core module)
   */
  function getAgentCommand(agent: Agent): string {
    if (agent.module === 'core') {
      return `/bmad-agent-${agent.name}`;
    }
    return `/bmad-agent-${agent.module}-${agent.name}`;
  }

  async function handleAgentClick(agent: Agent) {
    if (!project || spawning) return;

    spawning = true;
    showFeedback(`Starting session with ${agent.displayName}...`, 'info');

    try {
      const sessionName = generateSessionName(project.name, agent.name);
      const agentCommand = getAgentCommand(agent);

      const session = await spawnClaudeSession({
        sessionName,
        projectPath: project.path,
        initialCommand: agentCommand,
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
    <EmptyState
      icon="person"
      title="No agents found"
      description="Open a BMAD-initialized project to see available agents."
    />
  {:else if agents.length === 0}
    <EmptyState
      icon="person"
      title="No agents found"
      description="This project doesn't have any BMAD agents configured. Initialize BMAD to add agents."
    />
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
