/**
 * Unit tests for WorkflowViewTabs.svelte component.
 * Tests tab rendering, active state, and click handlers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import WorkflowViewTabs from './WorkflowViewTabs.svelte';
import { workflowViewMode, setWorkflowViewMode } from '$lib/stores/workflow';

// Mock the stores
vi.mock('$lib/stores/workflow', () => {
  const { writable } = require('svelte/store');
  const mockViewMode = writable('phase');
  return {
    workflowViewMode: mockViewMode,
    setWorkflowViewMode: vi.fn((mode: string) => mockViewMode.set(mode)),
  };
});

describe('WorkflowViewTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowViewMode.set('phase');
  });

  describe('rendering', () => {
    it('renders three tabs (BMAD Phase, Epic Workflow, and Story Workflow)', () => {
      render(WorkflowViewTabs);

      expect(screen.getByRole('tab', { name: 'BMAD Phase' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Epic Workflow' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Story Workflow' })).toBeInTheDocument();
    });

    it('shows BMAD Phase as active by default', () => {
      render(WorkflowViewTabs);

      const phaseTab = screen.getByRole('tab', { name: 'BMAD Phase' });
      expect(phaseTab).toHaveAttribute('aria-selected', 'true');
    });

    it('applies active styles to the selected tab', () => {
      render(WorkflowViewTabs);

      const phaseTab = screen.getByRole('tab', { name: 'BMAD Phase' });
      expect(phaseTab.className).toContain('text-blue-400');
      expect(phaseTab.className).toContain('border-b-2');
    });

    it('applies inactive styles to non-selected tabs', () => {
      render(WorkflowViewTabs);

      const epicTab = screen.getByRole('tab', { name: 'Epic Workflow' });
      expect(epicTab.className).toContain('text-gray-500');
      expect(epicTab.className).not.toContain('border-b-2');
    });
  });

  describe('tab click handling', () => {
    it('calls setWorkflowViewMode when clicking Epic Workflow tab', async () => {
      render(WorkflowViewTabs);

      const epicTab = screen.getByRole('tab', { name: 'Epic Workflow' });
      await fireEvent.click(epicTab);

      expect(setWorkflowViewMode).toHaveBeenCalledWith('epic-workflow');
    });

    it('calls setWorkflowViewMode when clicking BMAD Phase tab', async () => {
      workflowViewMode.set('epic-workflow');
      render(WorkflowViewTabs);

      const phaseTab = screen.getByRole('tab', { name: 'BMAD Phase' });
      await fireEvent.click(phaseTab);

      expect(setWorkflowViewMode).toHaveBeenCalledWith('phase');
    });
  });

  describe('accessibility', () => {
    it('has correct role attributes', () => {
      render(WorkflowViewTabs);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('has aria-label on tablist', () => {
      render(WorkflowViewTabs);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Workflow views');
    });
  });
});
