/**
 * Party Mode service for spawning multi-agent collaborative sessions.
 */

import type { Agent } from '$lib/types/agent';
import type { ClaudeSession, PartyModeInfo } from './process';
import { spawnClaudeSession, generateSessionName } from './process';

/**
 * Generates the party mode command with agent hints.
 *
 * @param agents - The agents the user wants to collaborate with
 * @returns The command string to invoke party mode
 */
export function generatePartyCommand(agents: Agent[]): string {
  const agentNames = agents.map((a) => a.displayName).join(', ');
  return `/bmad-party-mode I'd like to work with ${agentNames} today.`;
}

/**
 * Spawns a new party mode session with the selected agents.
 *
 * @param agents - The agents to include in the party
 * @param projectPath - Path to the project directory
 * @param projectName - Name of the project (for session naming)
 * @returns The created Claude session
 */
export async function spawnPartySession(
  agents: Agent[],
  projectPath: string,
  projectName: string
): Promise<ClaudeSession> {
  // Generate a unique session name for the party
  const sessionName = generateSessionName(projectName, 'party');

  // Create party mode info
  const partyMode: PartyModeInfo = {
    enabled: true,
    participants: agents.map((a) => a.displayName)
  };

  // Generate the party mode command with agent hints
  const partyCommand = generatePartyCommand(agents);

  // Spawn the session with the party command
  return spawnClaudeSession({
    sessionName,
    projectPath,
    initialCommand: partyCommand,
    resume: false,
    partyMode
  });
}
