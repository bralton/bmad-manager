/**
 * Unit tests for DashboardViewTabs.svelte component.
 * Tests tab rendering, active state, and click handlers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DashboardViewTabs from './DashboardViewTabs.svelte';
import { dashboardViewMode, setDashboardViewMode } from '$lib/stores/workflow';
import { get } from 'svelte/store';

// Mock the stores
vi.mock('$lib/stores/workflow', () => {
  const { writable } = require('svelte/store');
  const mockViewMode = writable('epic');
  return {
    dashboardViewMode: mockViewMode,
    setDashboardViewMode: vi.fn((mode: string) => mockViewMode.set(mode)),
  };
});

describe('DashboardViewTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardViewMode.set('epic');
  });

  describe('rendering', () => {
    it('renders two tabs (Epic Progress and Sprint Overview)', () => {
      render(DashboardViewTabs);

      expect(screen.getByRole('tab', { name: 'Epic Progress' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Sprint Overview' })).toBeInTheDocument();
    });

    it('shows Epic Progress as active by default', () => {
      render(DashboardViewTabs);

      const epicTab = screen.getByRole('tab', { name: 'Epic Progress' });
      expect(epicTab).toHaveAttribute('aria-selected', 'true');
    });

    it('applies active styles to the selected tab', () => {
      render(DashboardViewTabs);

      const epicTab = screen.getByRole('tab', { name: 'Epic Progress' });
      expect(epicTab.className).toContain('text-blue-400');
      expect(epicTab.className).toContain('border-b-2');
    });

    it('applies inactive styles to non-selected tabs', () => {
      render(DashboardViewTabs);

      const sprintTab = screen.getByRole('tab', { name: 'Sprint Overview' });
      expect(sprintTab.className).toContain('text-gray-500');
      expect(sprintTab.className).not.toContain('border-b-2');
    });
  });

  describe('tab click handling', () => {
    it('calls setDashboardViewMode when clicking Sprint Overview tab', async () => {
      render(DashboardViewTabs);

      const sprintTab = screen.getByRole('tab', { name: 'Sprint Overview' });
      await fireEvent.click(sprintTab);

      expect(setDashboardViewMode).toHaveBeenCalledWith('sprint');
    });

    it('calls setDashboardViewMode when clicking Epic Progress tab', async () => {
      dashboardViewMode.set('sprint');
      render(DashboardViewTabs);

      const epicTab = screen.getByRole('tab', { name: 'Epic Progress' });
      await fireEvent.click(epicTab);

      expect(setDashboardViewMode).toHaveBeenCalledWith('epic');
    });
  });

  describe('accessibility', () => {
    it('has correct role attributes', () => {
      render(DashboardViewTabs);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('has aria-label on tablist', () => {
      render(DashboardViewTabs);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Dashboard views');
    });
  });
});
