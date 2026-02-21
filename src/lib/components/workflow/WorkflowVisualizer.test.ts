/**
 * Unit tests for WorkflowVisualizer.svelte component.
 * Tests phase rendering, status determination, and interactions.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import WorkflowVisualizer from './WorkflowVisualizer.svelte';
import type { WorkflowState } from '$lib/types/workflow';

describe('WorkflowVisualizer', () => {
  // Base workflow state for testing
  const createWorkflowState = (overrides: Partial<WorkflowState> = {}): WorkflowState => ({
    currentPhase: 'planning',
    completedArtifacts: [],
    ...overrides,
  });

  describe('rendering', () => {
    // P0: Test renders all four phases
    it('renders all four phases', () => {
      const state = createWorkflowState();
      render(WorkflowVisualizer, { props: { workflowState: state } });

      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Solutioning')).toBeInTheDocument();
      expect(screen.getByText('Implementation')).toBeInTheDocument();
    });

    // P0: Test phases before current are marked completed
    it('marks phases before current as completed', () => {
      const state = createWorkflowState({ currentPhase: 'solutioning' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Discovery and Planning should be completed (before solutioning)
      const completedTexts = screen.getAllByText('Completed');
      expect(completedTexts.length).toBe(2); // Discovery and Planning
    });

    // P0: Test current phase is marked active
    it('marks current phase as active', () => {
      const state = createWorkflowState({ currentPhase: 'planning' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Planning should be active
      const activeTexts = screen.getAllByText('Active');
      expect(activeTexts.length).toBe(1);
    });

    // P0: Test phases after current are marked pending
    it('marks phases after current as pending', () => {
      const state = createWorkflowState({ currentPhase: 'discovery' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Solutioning and Implementation should show "-" for pending
      const pendingIndicators = screen.getAllByText('-');
      expect(pendingIndicators.length).toBe(3); // planning, solutioning, implementation
    });

    // P2: Test connector lines render between phases
    it('renders connector lines between phases', () => {
      const state = createWorkflowState();
      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Should have 3 horizontal connectors (between 4 phases)
      const container = document.querySelector('.flex.items-center');
      const connectors = container?.querySelectorAll('.bg-gray-300') || [];
      // Note: There are both horizontal (md) and vertical (mobile) connectors
      expect(connectors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('phase interactions', () => {
    // P1: Test clicking active phase expands panel
    it('expands panel when clicking active phase', async () => {
      const state = createWorkflowState({ currentPhase: 'planning' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Click on Planning phase node
      const planningButton = screen.getByRole('button', { name: /planning phase/i });
      await fireEvent.click(planningButton);

      // Panel should be visible - look for the panel region
      expect(screen.getByRole('region', { name: /planning phase details/i })).toBeInTheDocument();
    });

    // P1: Test clicking completed phase expands panel
    it('expands panel when clicking completed phase', async () => {
      const state = createWorkflowState({ currentPhase: 'solutioning' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Click on Discovery phase (completed)
      const discoveryButton = screen.getByRole('button', { name: /discovery phase/i });
      await fireEvent.click(discoveryButton);

      // Panel should show Discovery phase details
      expect(screen.getByRole('region', { name: /discovery phase details/i })).toBeInTheDocument();
    });

    // P1: Test clicking same phase again collapses panel
    it('collapses panel when clicking same phase again', async () => {
      const state = createWorkflowState({ currentPhase: 'planning' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      const planningButton = screen.getByRole('button', { name: /planning phase/i });

      // First click - expand
      await fireEvent.click(planningButton);
      expect(screen.getByRole('region', { name: /planning phase details/i })).toBeInTheDocument();

      // Second click - collapse
      await fireEvent.click(planningButton);

      // Wait for panel to be removed from DOM
      await waitFor(() => {
        expect(screen.queryByRole('region', { name: /planning phase details/i })).not.toBeInTheDocument();
      });
    });

    // P1: Test pending phases don't respond to clicks
    it('pending phases are disabled and do not expand panel', async () => {
      const state = createWorkflowState({ currentPhase: 'discovery' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Implementation phase should be pending (after discovery)
      const implButton = screen.getByRole('button', { name: /implementation phase/i });
      expect(implButton).toBeDisabled();

      // Clicking should not expand panel
      await fireEvent.click(implButton);

      // Should still only have one Implementation text
      const implTexts = screen.getAllByText('Implementation');
      expect(implTexts.length).toBe(1);
    });
  });

  describe('artifact filtering', () => {
    // P1: Test getArtifactsForPhase filtering
    it('filters artifacts by phase workflow types', async () => {
      const state = createWorkflowState({
        currentPhase: 'solutioning',
        completedArtifacts: [
          {
            path: '/test/prd.md',
            title: 'Product Requirements',
            created: '2026-02-20',
            status: 'approved',
            workflowType: 'prd',
            stepsCompleted: [1, 2, 3, 4, 5],
            inputDocuments: [],
          },
          {
            path: '/test/tech-spec.md',
            title: 'Tech Spec',
            created: '2026-02-20',
            status: 'approved',
            workflowType: 'tech-spec',
            stepsCompleted: [1, 2],
            inputDocuments: [],
          },
        ],
      });

      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Click on Planning phase to expand
      const planningButton = screen.getByRole('button', { name: /planning phase/i });
      await fireEvent.click(planningButton);

      // PRD filename should be shown in Planning phase artifacts
      expect(screen.getByText('prd.md')).toBeInTheDocument();
      // Tech spec should NOT be in Planning (it's solutioning)
      expect(screen.queryByText('tech-spec.md')).not.toBeInTheDocument();
    });
  });

  describe('not-started phase', () => {
    // P0: Test all phases are pending when not-started
    it('marks all phases as pending when currentPhase is not-started', () => {
      const state = createWorkflowState({ currentPhase: 'not-started' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      // All four phases should show "-" for pending
      const pendingIndicators = screen.getAllByText('-');
      expect(pendingIndicators.length).toBe(4);
    });

    // P0: Test no Active text when not-started
    it('has no active phase when currentPhase is not-started', () => {
      const state = createWorkflowState({ currentPhase: 'not-started' });
      render(WorkflowVisualizer, { props: { workflowState: state } });

      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });
  });

  describe('activeWorkflow prop passing', () => {
    // P2: Test activeWorkflow is passed to current phase node
    it('passes activeWorkflow to the current phase PhaseNode', () => {
      const state = createWorkflowState({
        currentPhase: 'planning',
        activeWorkflow: {
          workflowType: 'prd',
          outputPath: '/test/prd.md',
          stepsCompleted: [1, 2],
          lastStep: 2,
        },
      });

      render(WorkflowVisualizer, { props: { workflowState: state } });

      // Should see step count in Planning phase node
      expect(screen.getByText('2/5')).toBeInTheDocument();
    });
  });
});
