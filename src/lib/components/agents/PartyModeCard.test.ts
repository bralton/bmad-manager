/**
 * Tests for PartyModeCard component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import PartyModeCard from './PartyModeCard.svelte';
import { clearPartySelection } from '$lib/stores/partyMode';
import type { Agent } from '$lib/types/agent';

// Mock agents for testing
const mockAgents: Agent[] = [
  {
    name: 'architect',
    displayName: 'Architect',
    title: 'Solution Architect',
    icon: '🏛️',
    role: 'Designs system architecture',
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
    role: 'Implements features',
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
    role: 'Tests software',
    identity: 'tester-identity',
    communicationStyle: 'detail-oriented',
    principles: 'quality first',
    module: 'core',
    path: '/path/to/tester'
  }
];

describe('PartyModeCard', () => {
  beforeEach(() => {
    clearPartySelection();
  });

  it('renders with party icon and title', () => {
    render(PartyModeCard, { props: { agents: mockAgents } });

    expect(screen.getByText('Party Mode')).toBeInTheDocument();
    expect(screen.getByText('Start a multi-agent session')).toBeInTheDocument();
  });

  it('shows collapsed state by default', () => {
    render(PartyModeCard, { props: { agents: mockAgents } });

    // Agent checkboxes should not be visible in collapsed state
    expect(screen.queryByText('Architect')).not.toBeInTheDocument();
    expect(screen.queryByText('Developer')).not.toBeInTheDocument();
  });

  it('expands when clicked', async () => {
    render(PartyModeCard, { props: { agents: mockAgents } });

    // Find and click the expand button
    const expandButton = screen.getByRole('button', { name: /expand/i });
    await fireEvent.click(expandButton);

    // Agent names should now be visible
    expect(screen.getByText('Architect')).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Tester')).toBeInTheDocument();
  });

  it('shows Start Party Session button when expanded', async () => {
    render(PartyModeCard, { props: { agents: mockAgents } });

    const expandButton = screen.getByRole('button', { name: /expand/i });
    await fireEvent.click(expandButton);

    expect(screen.getByRole('button', { name: /start party session/i })).toBeInTheDocument();
  });

  it('disables Start Party Session button when fewer than 2 agents selected', async () => {
    render(PartyModeCard, { props: { agents: mockAgents } });

    const expandButton = screen.getByRole('button', { name: /expand/i });
    await fireEvent.click(expandButton);

    const startButton = screen.getByRole('button', { name: /start party session/i });
    expect(startButton).toBeDisabled();
  });

  it('enables Start Party Session button when 2+ agents selected', async () => {
    render(PartyModeCard, { props: { agents: mockAgents } });

    const expandButton = screen.getByRole('button', { name: /expand/i });
    await fireEvent.click(expandButton);

    // Click two agent checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.click(checkboxes[0]);
    await fireEvent.click(checkboxes[1]);

    const startButton = screen.getByRole('button', { name: /start party session/i });
    expect(startButton).not.toBeDisabled();
  });

  it('calls onStartParty when Start Party Session clicked with 2+ agents', async () => {
    const onStartParty = vi.fn();
    render(PartyModeCard, { props: { agents: mockAgents, onStartParty } });

    const expandButton = screen.getByRole('button', { name: /expand/i });
    await fireEvent.click(expandButton);

    // Select two agents
    const checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.click(checkboxes[0]);
    await fireEvent.click(checkboxes[1]);

    // Click start
    const startButton = screen.getByRole('button', { name: /start party session/i });
    await fireEvent.click(startButton);

    expect(onStartParty).toHaveBeenCalled();
    expect(onStartParty).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'architect' }),
      expect.objectContaining({ name: 'developer' })
    ]));
  });

  it('shows minimum agents message when fewer than 2 selected', async () => {
    render(PartyModeCard, { props: { agents: mockAgents } });

    const expandButton = screen.getByRole('button', { name: /expand/i });
    await fireEvent.click(expandButton);

    expect(screen.getByText(/select at least 2 agents/i)).toBeInTheDocument();
  });

  it('updates selection count as agents are selected', async () => {
    render(PartyModeCard, { props: { agents: mockAgents } });

    const expandButton = screen.getByRole('button', { name: /expand/i });
    await fireEvent.click(expandButton);

    const checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.click(checkboxes[0]);

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();

    await fireEvent.click(checkboxes[1]);

    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });

  it('applies disabled styling when disabled prop is true', async () => {
    render(PartyModeCard, { props: { agents: mockAgents, disabled: true } });

    const expandButton = screen.getByRole('button', { name: /expand/i });
    await fireEvent.click(expandButton);

    // Select agents
    const checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.click(checkboxes[0]);
    await fireEvent.click(checkboxes[1]);

    const startButton = screen.getByRole('button', { name: /start party session/i });
    expect(startButton).toBeDisabled();
  });
});
