/**
 * Svelte stores for Party Mode - multi-agent collaborative sessions.
 * Tracks agent selection for party mode and provides derived state.
 */

import { writable, derived, get } from 'svelte/store';
import type { Agent } from '$lib/types/agent';

/**
 * Currently selected agents for a party mode session.
 */
export const selectedAgentsForParty = writable<Agent[]>([]);

/**
 * Derived store: whether we have enough agents to start a party (minimum 2).
 */
export const canStartParty = derived(
  selectedAgentsForParty,
  ($agents) => $agents.length >= 2
);

/**
 * Toggles an agent's selection for party mode.
 * If the agent is already selected, removes them; otherwise adds them.
 */
export function toggleAgentSelection(agent: Agent): void {
  selectedAgentsForParty.update((agents) => {
    const existingIndex = agents.findIndex((a) => a.name === agent.name);
    if (existingIndex >= 0) {
      // Remove the agent
      return agents.filter((_, i) => i !== existingIndex);
    } else {
      // Add the agent
      return [...agents, agent];
    }
  });
}

/**
 * Checks if an agent is currently selected for party mode.
 */
export function isAgentSelected(agent: Agent): boolean {
  return get(selectedAgentsForParty).some((a) => a.name === agent.name);
}

/**
 * Clears all selected agents.
 */
export function clearPartySelection(): void {
  selectedAgentsForParty.set([]);
}
