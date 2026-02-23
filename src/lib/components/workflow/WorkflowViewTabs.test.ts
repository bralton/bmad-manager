/**
 * Unit tests for WorkflowViewTabs.svelte component.
 * Tests tab rendering, active state, and click handlers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import WorkflowViewTabs from './WorkflowViewTabs.svelte';
import { workflowViewMode, setWorkflowViewMode } from '$lib/stores/workflow';
import { get } from 'svelte/store';

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
    it('renders all four tabs', () => {
      render(WorkflowViewTabs);

      expect(screen.getByRole('tab', { name: 'BMAD Phase' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Epic Progress' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Sprint' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Story Tasks' })).toBeInTheDocument();
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

      const epicTab = screen.getByRole('tab', { name: 'Epic Progress' });
      expect(epicTab.className).toContain('text-gray-500');
      expect(epicTab.className).not.toContain('border-b-2');
    });
  });

  describe('tab click handling', () => {
    it('calls setWorkflowViewMode when clicking a tab', async () => {
      render(WorkflowViewTabs);

      const epicTab = screen.getByRole('tab', { name: 'Epic Progress' });
      await fireEvent.click(epicTab);

      expect(setWorkflowViewMode).toHaveBeenCalledWith('epic');
    });

    it('allows clicking Story Tasks tab', async () => {
      render(WorkflowViewTabs);

      const storyTab = screen.getByRole('tab', { name: 'Story Tasks' });
      await fireEvent.click(storyTab);

      expect(setWorkflowViewMode).toHaveBeenCalledWith('story');
    });
  });

  describe('custom mode handling', () => {
    it('uses currentMode prop when provided', () => {
      render(WorkflowViewTabs, { currentMode: 'epic' });

      const epicTab = screen.getByRole('tab', { name: 'Epic Progress' });
      expect(epicTab).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onModeChange when provided instead of store update', async () => {
      const onModeChange = vi.fn();
      render(WorkflowViewTabs, { onModeChange });

      const sprintTab = screen.getByRole('tab', { name: 'Sprint' });
      await fireEvent.click(sprintTab);

      expect(onModeChange).toHaveBeenCalledWith('sprint');
      expect(setWorkflowViewMode).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has correct role attributes', () => {
      render(WorkflowViewTabs);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(4);
    });

    it('has aria-label on tablist', () => {
      render(WorkflowViewTabs);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Workflow views');
    });
  });
});
