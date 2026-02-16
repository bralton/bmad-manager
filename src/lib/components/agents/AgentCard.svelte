<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { Agent } from '$lib/types/agent';
  import AgentAvatar from './AgentAvatar.svelte';

  interface Props {
    agent: Agent;
    expanded?: boolean;
    onToggleExpand?: (agent: Agent) => void;
    onclick?: (agent: Agent) => void;
    disabled?: boolean;
  }
  let {
    agent,
    expanded = false,
    onToggleExpand,
    onclick,
    disabled = false
  }: Props = $props();

  function handleCardClick() {
    if (onclick) {
      onclick(agent);
    }
  }

  function handleExpandClick(e: MouseEvent) {
    e.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand(agent);
    }
  }
</script>

<div class="rounded-lg bg-gray-800 transition-all duration-200 overflow-hidden">
  <!-- Main card row -->
  <div class="flex items-center gap-3 p-3">
    <!-- Expand/collapse chevron button -->
    <button
      type="button"
      onclick={handleExpandClick}
      class="flex-shrink-0 w-5 h-5 flex items-center justify-center
             text-gray-400 hover:text-gray-200 transition-transform duration-200
             focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      class:rotate-90={expanded}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      aria-expanded={expanded}
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>

    <!-- Agent info (clickable to start conversation) -->
    <button
      type="button"
      onclick={handleCardClick}
      {disabled}
      class="flex-1 min-w-0 flex items-center gap-3 text-left rounded
             hover:opacity-80
             disabled:opacity-75 disabled:cursor-not-allowed
             focus:outline-none focus:ring-2 focus:ring-blue-500
             transition-opacity"
      aria-label="Start conversation with {agent.displayName}"
    >
      <AgentAvatar icon={agent.icon} />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-200 truncate">{agent.displayName}</p>
        {#if !expanded}
          <p class="text-xs text-gray-400 truncate">{agent.title}</p>
        {/if}
      </div>
    </button>
  </div>

  <!-- Expanded details: full title + role description -->
  {#if expanded}
    <div transition:slide={{ duration: 200 }} class="px-3 pb-3 pl-11 space-y-2">
      <p class="text-xs text-gray-300 font-medium">{agent.title}</p>
      <p class="text-xs text-gray-400 leading-relaxed">{agent.role}</p>
    </div>
  {/if}
</div>
