/**
 * Unit tests for PhaseNode.svelte component.
 * Tests rendering, status styling, progress ring, and interactions.
 */

import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import PhaseNode from './PhaseNode.svelte';
import type { ActiveWorkflow } from '$lib/types/workflow';

describe('PhaseNode', () => {
  describe('rendering', () => {
    // P0: Test renders phase label
    it('renders the phase label', () => {
      render(PhaseNode, {
        props: { phase: 'discovery', status: 'pending' },
      });

      expect(screen.getByText('Discovery')).toBeInTheDocument();
    });

    // P0: Test completed status styling
    it('shows checkmark for completed status', () => {
      render(PhaseNode, {
        props: { phase: 'planning', status: 'completed' },
      });

      // Should show "Completed" indicator
      expect(screen.getByText('Completed')).toBeInTheDocument();

      // Button should have green styling
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-green-500');
    });

    // P0: Test active status styling
    it('shows active styling for active status', () => {
      render(PhaseNode, {
        props: { phase: 'solutioning', status: 'active' },
      });

      // Should show "Active" indicator
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Button should have blue styling
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-100');
      expect(button).toHaveClass('border-blue-500');
    });

    // P0: Test pending status styling
    it('shows pending styling and is disabled', () => {
      render(PhaseNode, {
        props: { phase: 'implementation', status: 'pending' },
      });

      // Should show "-" indicator for pending
      expect(screen.getByText('-')).toBeInTheDocument();

      // Button should be disabled and have gray styling
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('bg-white');
      expect(button).toHaveClass('border-gray-300');
    });

    // P0: Test progress ring calculation
    it('shows progress ring with correct step count for active workflow', () => {
      const activeWorkflow: ActiveWorkflow = {
        workflowType: 'prd',
        outputPath: '/test/prd.md',
        stepsCompleted: [1, 2, 3],
        lastStep: 3,
      };

      render(PhaseNode, {
        props: {
          phase: 'planning',
          status: 'active',
          activeWorkflow,
        },
      });

      // Should show step count (3 out of 5 for PRD)
      expect(screen.getByText('3/5')).toBeInTheDocument();
    });
  });

  describe('step count display', () => {
    // P1: Test step count for different workflow types
    it('calculates correct step count for tech-spec workflow', () => {
      const activeWorkflow: ActiveWorkflow = {
        workflowType: 'tech-spec',
        outputPath: '/test/tech-spec.md',
        stepsCompleted: [1, 2],
        lastStep: 2,
      };

      render(PhaseNode, {
        props: {
          phase: 'solutioning',
          status: 'active',
          activeWorkflow,
        },
      });

      // Tech-spec has 5 total steps
      expect(screen.getByText('2/5')).toBeInTheDocument();
    });

    // P1: Test no step count when no active workflow
    it('does not show step count when no activeWorkflow', () => {
      render(PhaseNode, {
        props: { phase: 'planning', status: 'active' },
      });

      // Should not have any step count text
      expect(screen.queryByText(/\d\/\d/)).not.toBeInTheDocument();
    });
  });

  describe('click callbacks', () => {
    // P1: Test click callback fires for non-pending phases
    it('calls onClick for completed phase', async () => {
      const onClick = vi.fn();
      render(PhaseNode, {
        props: { phase: 'discovery', status: 'completed', onClick },
      });

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    // P1: Test click callback fires for active phase
    it('calls onClick for active phase', async () => {
      const onClick = vi.fn();
      render(PhaseNode, {
        props: { phase: 'planning', status: 'active', onClick },
      });

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    // P1: Test click callback does not fire for pending phases
    it('does not call onClick for pending phase', async () => {
      const onClick = vi.fn();
      render(PhaseNode, {
        props: { phase: 'implementation', status: 'pending', onClick },
      });

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('keyboard interactions', () => {
    // P1: Test Enter key triggers click
    it('triggers onClick on Enter key for non-pending phase', async () => {
      const onClick = vi.fn();
      render(PhaseNode, {
        props: { phase: 'planning', status: 'active', onClick },
      });

      const button = screen.getByRole('button');
      await fireEvent.keyDown(button, { key: 'Enter' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    // P1: Test Space key triggers click
    it('triggers onClick on Space key for non-pending phase', async () => {
      const onClick = vi.fn();
      render(PhaseNode, {
        props: { phase: 'discovery', status: 'completed', onClick },
      });

      const button = screen.getByRole('button');
      await fireEvent.keyDown(button, { key: ' ' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    // P1: Test keyboard does not trigger for pending
    it('does not trigger onClick on keyboard for pending phase', async () => {
      const onClick = vi.fn();
      render(PhaseNode, {
        props: { phase: 'solutioning', status: 'pending', onClick },
      });

      const button = screen.getByRole('button');
      await fireEvent.keyDown(button, { key: 'Enter' });
      await fireEvent.keyDown(button, { key: ' ' });

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    // P1: Test disabled state for pending phases
    it('has disabled attribute for pending phase', () => {
      render(PhaseNode, {
        props: { phase: 'implementation', status: 'pending' },
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    // P1: Test enabled state for non-pending phases
    it('is not disabled for active phase', () => {
      render(PhaseNode, {
        props: { phase: 'planning', status: 'active' },
      });

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('accessibility', () => {
    // P2: Test accessibility attributes for completed phase
    it('has correct aria-label for completed phase', () => {
      render(PhaseNode, {
        props: { phase: 'discovery', status: 'completed' },
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Discovery phase, completed');
    });

    // P2: Test accessibility attributes for active phase with workflow
    it('has correct aria-label for active phase with steps', () => {
      const activeWorkflow: ActiveWorkflow = {
        workflowType: 'prd',
        outputPath: '/test/prd.md',
        stepsCompleted: [1, 2],
        lastStep: 2,
      };

      render(PhaseNode, {
        props: {
          phase: 'planning',
          status: 'active',
          activeWorkflow,
        },
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Planning phase, 2 of 5 steps complete');
    });

    // P2: Test accessibility attributes for active phase without workflow
    it('has correct aria-label for active phase without workflow', () => {
      render(PhaseNode, {
        props: { phase: 'solutioning', status: 'active' },
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Solutioning phase, active');
    });

    // P2: Test accessibility attributes for pending phase
    it('has correct aria-label for pending phase', () => {
      render(PhaseNode, {
        props: { phase: 'implementation', status: 'pending' },
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Implementation phase, pending');
    });
  });

  describe('focus ring', () => {
    // P2: Test focus ring CSS classes
    it('has focus-visible ring classes', () => {
      render(PhaseNode, {
        props: { phase: 'planning', status: 'active' },
      });

      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:ring-2');
      expect(button).toHaveClass('focus-visible:ring-blue-500');
    });
  });
});
