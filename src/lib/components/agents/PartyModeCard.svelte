<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { Agent } from '$lib/types/agent';
  import {
    selectedAgentsForParty,
    canStartParty,
    toggleAgentSelection,
    isAgentSelected,
    clearPartySelection
  } from '$lib/stores/partyMode';
  import AgentAvatar from './AgentAvatar.svelte';

  interface Props {
    agents: Agent[];
    onStartParty?: (agents: Agent[]) => void;
    disabled?: boolean;
  }

  let { agents, onStartParty, disabled = false }: Props = $props();

  let expanded = $state(false);
  let selectedAgents = $derived($selectedAgentsForParty);
  let canStart = $derived($canStartParty);

  function handleExpandClick(e: MouseEvent) {
    e.stopPropagation();
    expanded = !expanded;
  }

  function handleAgentToggle(agent: Agent) {
    toggleAgentSelection(agent);
  }

  function handleStartParty() {
    if (canStart && onStartParty) {
      onStartParty(selectedAgents);
      // Clear selection after starting
      clearPartySelection();
      expanded = false;
    }
  }
</script>

<div class="rounded-lg bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 transition-all duration-200 overflow-hidden">
  <!-- Main card row -->
  <div class="flex items-center gap-3 p-3">
    <!-- Expand/collapse chevron button -->
    <button
      type="button"
      onclick={handleExpandClick}
      class="flex-shrink-0 w-5 h-5 flex items-center justify-center
             text-purple-300 hover:text-purple-100 transition-transform duration-200
             focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
      class:rotate-90={expanded}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      aria-expanded={expanded}
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>

    <!-- Party mode info -->
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <!-- Party icon -->
      <span class="text-xl text-purple-300" aria-hidden="true">🎉</span>

      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-white">Party Mode</p>
        {#if !expanded}
          <p class="text-xs text-purple-300">Start a multi-agent session</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Expanded details -->
  {#if expanded}
    <div transition:slide={{ duration: 200 }} class="px-3 pb-3 pl-11 space-y-3">
      <p class="text-xs text-purple-200">Select agents to collaborate:</p>

      <!-- Agent checkboxes -->
      <div class="space-y-2">
        {#each agents as agent (agent.name)}
          <label class="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={isAgentSelected(agent)}
              onchange={() => handleAgentToggle(agent)}
              class="w-4 h-4 rounded border-purple-400 bg-gray-800 text-purple-500
                     focus:ring-purple-500 focus:ring-offset-gray-900"
            />
            <AgentAvatar icon={agent.icon} size="sm" />
            <span class="text-sm text-gray-200 group-hover:text-white">{agent.displayName}</span>
          </label>
        {/each}
      </div>

      <!-- Selection status -->
      <div class="text-xs text-purple-300">
        {#if selectedAgents.length === 0}
          Select at least 2 agents to start
        {:else if selectedAgents.length === 1}
          {selectedAgents.length} selected - select at least 2 agents
        {:else}
          {selectedAgents.length} selected
        {/if}
      </div>

      <!-- Start button -->
      <button
        type="button"
        onclick={handleStartParty}
        disabled={!canStart || disabled}
        class="w-full py-2 px-4 rounded-md text-sm font-medium
               bg-purple-600 text-white
               hover:bg-purple-500
               disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
               focus:outline-none focus:ring-2 focus:ring-purple-500
               transition-colors"
      >
        Start Party Session
      </button>
    </div>
  {/if}
</div>
