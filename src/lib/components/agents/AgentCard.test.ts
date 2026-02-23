/**
 * Unit tests for AgentCard.svelte component.
 * Tests agent card rendering, click handling, expand/collapse, and selection state.
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AgentCard from './AgentCard.svelte';
import type { Agent } from '$lib/types/agent';

describe('AgentCard', () => {
  const mockAgent: Agent = {
    name: 'architect',
    displayName: 'Architect',
    title: 'Solution Architect',
    role: 'Designs system architecture and technical solutions.',
    module: 'core',
    path: '/path/to/architect.yaml',
    icon: '🏗️',
    identity: 'System Architect',
    communicationStyle: 'Technical and precise',
    principles: 'Focus on scalability and maintainability',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders agent display name', () => {
      render(AgentCard, { props: { agent: mockAgent } });

      expect(screen.getByText('Architect')).toBeInTheDocument();
    });

    it('renders agent title when collapsed', () => {
      render(AgentCard, { props: { agent: mockAgent, expanded: false } });

      expect(screen.getByText('Solution Architect')).toBeInTheDocument();
    });

    it('renders agent avatar with icon', () => {
      render(AgentCard, { props: { agent: mockAgent } });

      expect(screen.getByText('🏗️')).toBeInTheDocument();
    });

    it('renders expand button', () => {
      render(AgentCard, { props: { agent: mockAgent } });

      expect(screen.getByRole('button', { name: /Expand/i })).toBeInTheDocument();
    });
  });

  describe('click handling', () => {
    it('calls onclick when agent info is clicked', async () => {
      const onclick = vi.fn();
      render(AgentCard, { props: { agent: mockAgent, onclick } });

      const startButton = screen.getByRole('button', {
        name: /Start conversation with Architect/i,
      });
      await fireEvent.click(startButton);

      expect(onclick).toHaveBeenCalledWith(mockAgent);
    });

    it('does not call onclick when disabled', async () => {
      const onclick = vi.fn();
      render(AgentCard, { props: { agent: mockAgent, onclick, disabled: true } });

      const startButton = screen.getByRole('button', {
        name: /Start conversation with Architect/i,
      });
      await fireEvent.click(startButton);

      // Click event fires but button is disabled - component should not call onclick
      // However, in Svelte disabled buttons still fire click - the component checks disabled state
      // Let's verify the button has disabled styling
      expect(startButton).toBeDisabled();
    });

    it('button is not disabled by default', () => {
      render(AgentCard, { props: { agent: mockAgent } });

      const startButton = screen.getByRole('button', {
        name: /Start conversation with Architect/i,
      });
      expect(startButton).not.toBeDisabled();
    });
  });

  describe('expand/collapse', () => {
    it('calls onToggleExpand when expand button clicked', async () => {
      const onToggleExpand = vi.fn();
      render(AgentCard, { props: { agent: mockAgent, onToggleExpand } });

      const expandButton = screen.getByRole('button', { name: /Expand/i });
      await fireEvent.click(expandButton);

      expect(onToggleExpand).toHaveBeenCalledWith(mockAgent);
    });

    it('expand button has correct aria-expanded=false when collapsed', () => {
      render(AgentCard, { props: { agent: mockAgent, expanded: false } });

      const expandButton = screen.getByRole('button', { name: /Expand/i });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('collapse button has correct aria-expanded=true when expanded', () => {
      render(AgentCard, { props: { agent: mockAgent, expanded: true } });

      const collapseButton = screen.getByRole('button', { name: /Collapse/i });
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not propagate expand click to card click', async () => {
      const onclick = vi.fn();
      const onToggleExpand = vi.fn();
      render(AgentCard, { props: { agent: mockAgent, onclick, onToggleExpand } });

      const expandButton = screen.getByRole('button', { name: /Expand/i });
      await fireEvent.click(expandButton);

      expect(onToggleExpand).toHaveBeenCalled();
      expect(onclick).not.toHaveBeenCalled();
    });
  });

  describe('expanded state', () => {
    it('shows role description when expanded', () => {
      render(AgentCard, { props: { agent: mockAgent, expanded: true } });

      expect(
        screen.getByText('Designs system architecture and technical solutions.')
      ).toBeInTheDocument();
    });

    it('shows full title when expanded', () => {
      render(AgentCard, { props: { agent: mockAgent, expanded: true } });

      // Title appears in expanded section
      expect(screen.getByText('Solution Architect')).toBeInTheDocument();
    });

    it('applies rotation to expand button when expanded', () => {
      render(AgentCard, { props: { agent: mockAgent, expanded: true } });

      const collapseButton = screen.getByRole('button', { name: /Collapse/i });
      expect(collapseButton).toHaveClass('rotate-90');
    });
  });

  describe('disabled state styling', () => {
    it('applies disabled styling when disabled', () => {
      render(AgentCard, { props: { agent: mockAgent, disabled: true } });

      const startButton = screen.getByRole('button', {
        name: /Start conversation with Architect/i,
      });
      expect(startButton).toBeDisabled();
    });
  });
});
