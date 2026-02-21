/**
 * Unit tests for ActiveWorkflowPanel.svelte component.
 * Tests rendering, close button, keyboard handling, and artifact display.
 */

import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ActiveWorkflowPanel from './ActiveWorkflowPanel.svelte';
import type { ActiveWorkflow, ArtifactMeta } from '$lib/types/workflow';

describe('ActiveWorkflowPanel', () => {
  const defaultProps = {
    phase: 'planning' as const,
    artifacts: [] as ArtifactMeta[],
    onClose: vi.fn(),
  };

  describe('rendering', () => {
    // P0: Test renders phase label
    it('renders the phase label in header', () => {
      render(ActiveWorkflowPanel, { props: defaultProps });

      expect(screen.getByText('Planning Phase')).toBeInTheDocument();
    });

    // P0: Test close button callback
    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      render(ActiveWorkflowPanel, { props: { ...defaultProps, onClose } });

      const closeButton = screen.getByRole('button', { name: /close panel/i });
      await fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    // P0: Test Escape key closes panel
    it('calls onClose when Escape key is pressed', async () => {
      const onClose = vi.fn();
      render(ActiveWorkflowPanel, { props: { ...defaultProps, onClose } });

      await fireEvent.keyDown(window, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('workflow display', () => {
    // P1: Test workflow name display
    it('displays active workflow name', () => {
      const activeWorkflow: ActiveWorkflow = {
        workflowType: 'prd',
        outputPath: '/test/prd.md',
        stepsCompleted: [1, 2],
        lastStep: 2,
      };

      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, activeWorkflow },
      });

      expect(screen.getByText('PRD')).toBeInTheDocument();
      expect(screen.getByText('Active Workflow:')).toBeInTheDocument();
    });

    // P1: Test step progress indicators
    it('shows step progress indicators for active workflow', () => {
      const activeWorkflow: ActiveWorkflow = {
        workflowType: 'prd',
        outputPath: '/test/prd.md',
        stepsCompleted: [1, 2],
        lastStep: 2,
      };

      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, activeWorkflow },
      });

      // Should have 5 step indicators (PRD has 5 steps)
      // Two completed (show checkmarks), three pending (show numbers)
      expect(screen.getByTitle('Step 1 completed')).toBeInTheDocument();
      expect(screen.getByTitle('Step 2 completed')).toBeInTheDocument();
      expect(screen.getByTitle('Step 3 pending')).toBeInTheDocument();
      expect(screen.getByTitle('Step 4 pending')).toBeInTheDocument();
      expect(screen.getByTitle('Step 5 pending')).toBeInTheDocument();
    });

    // P1: Test completed step styling
    it('shows green background for completed steps', () => {
      const activeWorkflow: ActiveWorkflow = {
        workflowType: 'prd',
        outputPath: '/test/prd.md',
        stepsCompleted: [1],
        lastStep: 1,
      };

      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, activeWorkflow },
      });

      const completedStep = screen.getByTitle('Step 1 completed');
      expect(completedStep).toHaveClass('bg-green-500');
    });

    // P1: Test pending step styling
    it('shows gray background for pending steps', () => {
      const activeWorkflow: ActiveWorkflow = {
        workflowType: 'prd',
        outputPath: '/test/prd.md',
        stepsCompleted: [1],
        lastStep: 1,
      };

      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, activeWorkflow },
      });

      const pendingStep = screen.getByTitle('Step 2 pending');
      expect(pendingStep).toHaveClass('bg-gray-600');
    });
  });

  describe('artifacts list', () => {
    // P1: Test artifacts list rendering
    it('renders artifacts list with count', () => {
      const artifacts: ArtifactMeta[] = [
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
          status: 'draft',
          workflowType: 'tech-spec',
          stepsCompleted: [1],
          inputDocuments: [],
        },
      ];

      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, artifacts },
      });

      expect(screen.getByText('Completed Artifacts (2)')).toBeInTheDocument();
      expect(screen.getByText('prd.md')).toBeInTheDocument();
      expect(screen.getByText('tech-spec.md')).toBeInTheDocument();
    });

    // P1: Test artifact status badges
    it('shows correct status badges for artifacts', () => {
      const artifacts: ArtifactMeta[] = [
        {
          path: '/test/approved.md',
          title: 'Approved Doc',
          created: '2026-02-20',
          status: 'approved',
          workflowType: 'prd',
          stepsCompleted: [],
          inputDocuments: [],
        },
        {
          path: '/test/draft.md',
          title: 'Draft Doc',
          created: '2026-02-20',
          status: 'draft',
          workflowType: 'prd',
          stepsCompleted: [],
          inputDocuments: [],
        },
      ];

      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, artifacts },
      });

      expect(screen.getByText('approved')).toBeInTheDocument();
      expect(screen.getByText('draft')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    // P2: Test empty state when no artifacts and no workflow
    it('shows empty state message when no artifacts and no workflow', () => {
      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, artifacts: [], activeWorkflow: undefined },
      });

      expect(
        screen.getByText('No artifacts or active workflows for this phase.')
      ).toBeInTheDocument();
    });

    // P2: Test no empty state when active workflow exists
    it('does not show empty state when active workflow exists', () => {
      const activeWorkflow: ActiveWorkflow = {
        workflowType: 'prd',
        outputPath: '/test/prd.md',
        stepsCompleted: [1],
        lastStep: 1,
      };

      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, artifacts: [], activeWorkflow },
      });

      expect(
        screen.queryByText('No artifacts or active workflows for this phase.')
      ).not.toBeInTheDocument();
    });
  });

  describe('getFileName utility', () => {
    // P2: Test filename extraction from path
    it('extracts filename from full path', () => {
      const artifacts: ArtifactMeta[] = [
        {
          path: '/users/test/project/_bmad-output/planning-artifacts/prd-document.md',
          title: 'PRD',
          created: '2026-02-20',
          status: 'approved',
          workflowType: 'prd',
          stepsCompleted: [],
          inputDocuments: [],
        },
      ];

      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, artifacts },
      });

      expect(screen.getByText('prd-document.md')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    // P2: Test panel has region role with label
    it('has region role with phase details label', () => {
      render(ActiveWorkflowPanel, {
        props: { ...defaultProps, phase: 'solutioning' },
      });

      const panel = screen.getByRole('region', { name: /solutioning phase details/i });
      expect(panel).toBeInTheDocument();
    });

    // P2: Test close button has aria-label
    it('close button has aria-label', () => {
      render(ActiveWorkflowPanel, { props: defaultProps });

      const closeButton = screen.getByRole('button', { name: /close panel/i });
      expect(closeButton).toHaveAttribute('aria-label', 'Close panel');
    });
  });
});
