/**
 * Tests for party mode service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePartyCommand, spawnPartySession } from './partyMode';
import type { Agent } from '$lib/types/agent';

// Mock the process module
vi.mock('./process', () => ({
  spawnClaudeSession: vi.fn().mockResolvedValue({
    id: 'test-session-id',
    claudeSessionId: 'test-claude-id',
    projectPath: '/test/path',
    agent: 'party',
    startedAt: '2026-02-23T12:00:00Z',
    status: 'active',
    partyMode: {
      enabled: true,
      participants: ['Architect', 'Developer']
    }
  }),
  generateSessionName: vi.fn().mockReturnValue('bmad-test-party-20260223-120000')
}));

const mockAgents: Agent[] = [
  {
    name: 'architect',
    displayName: 'Architect',
    title: 'Solution Architect',
    icon: '🏛️',
    role: 'Designs system architecture and high-level solutions',
    identity: 'architect-identity',
    communicationStyle: 'technical',
    principles: 'scalability, simplicity',
    module: 'core',
    path: '/path/to/architect'
  },
  {
    name: 'developer',
    displayName: 'Developer',
    title: 'Senior Developer',
    icon: '💻',
    role: 'Implements features and writes clean code',
    identity: 'developer-identity',
    communicationStyle: 'practical',
    principles: 'clean code',
    module: 'core',
    path: '/path/to/developer'
  },
  {
    name: 'tester',
    displayName: 'Tester',
    title: 'QA Engineer',
    icon: '🧪',
    role: 'Tests software and ensures quality',
    identity: 'tester-identity',
    communicationStyle: 'detail-oriented',
    principles: 'quality first',
    module: 'core',
    path: '/path/to/tester'
  }
];

describe('generatePartyCommand', () => {
  it('starts with /bmad-party-mode command', () => {
    const command = generatePartyCommand(mockAgents.slice(0, 2));
    expect(command).toMatch(/^\/bmad-party-mode/);
  });

  it('includes selected agent names', () => {
    const command = generatePartyCommand(mockAgents.slice(0, 2));
    expect(command).toContain('Architect');
    expect(command).toContain('Developer');
  });

  it('works with 2 agents', () => {
    const command = generatePartyCommand(mockAgents.slice(0, 2));
    expect(command).toContain('Architect, Developer');
    expect(command).not.toContain('Tester');
  });

  it('works with 3+ agents', () => {
    const command = generatePartyCommand(mockAgents);
    expect(command).toContain('Architect, Developer, Tester');
  });

  it('includes work-with phrasing for the workflow', () => {
    const command = generatePartyCommand(mockAgents.slice(0, 2));
    expect(command).toContain("work with");
  });
});

describe('spawnPartySession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns a session with party mode info', async () => {
    const { spawnClaudeSession } = await import('./process');

    const session = await spawnPartySession(
      mockAgents.slice(0, 2),
      '/test/project',
      'test-project'
    );

    expect(spawnClaudeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: '/test/project',
        partyMode: expect.objectContaining({
          enabled: true,
          participants: ['Architect', 'Developer']
        })
      })
    );

    expect(session.partyMode?.enabled).toBe(true);
    expect(session.partyMode?.participants).toContain('Architect');
    expect(session.partyMode?.participants).toContain('Developer');
  });

  it('includes party command as initial command', async () => {
    const { spawnClaudeSession } = await import('./process');

    await spawnPartySession(mockAgents.slice(0, 2), '/test/project', 'test-project');

    expect(spawnClaudeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCommand: expect.stringContaining('/bmad-party-mode')
      })
    );
  });

  it('uses party session naming', async () => {
    const { generateSessionName, spawnClaudeSession } = await import('./process');

    await spawnPartySession(mockAgents.slice(0, 2), '/test/project', 'test-project');

    expect(generateSessionName).toHaveBeenCalledWith('test-project', 'party');
    expect(spawnClaudeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionName: 'bmad-test-party-20260223-120000'
      })
    );
  });
});
