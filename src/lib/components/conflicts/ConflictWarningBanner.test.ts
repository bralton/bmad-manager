/**
 * Tests for ConflictWarningBanner component.
 *
 * Tests the display of file conflict warnings between stories.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ConflictWarningBanner from './ConflictWarningBanner.svelte';
import type { ConflictWarning } from '$lib/types/conflict';

describe('ConflictWarningBanner', () => {
  const mockConflicts: ConflictWarning[] = [
    {
      storyId: '4-3',
      conflictsWith: '4-4',
      sharedFiles: ['src/lib/stores/settings.ts', 'src/lib/services/settings.ts'],
    },
    {
      storyId: '4-3',
      conflictsWith: '4-5',
      sharedFiles: ['src-tauri/src/settings/store.rs'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('header display', () => {
    it('shows conflict count for single conflict', () => {
      const singleConflict: ConflictWarning[] = [mockConflicts[0]];
      render(ConflictWarningBanner, { props: { conflicts: singleConflict } });

      expect(screen.getByText(/File Conflicts/)).toBeInTheDocument();
      expect(screen.getByText(/1 story/)).toBeInTheDocument();
    });

    it('shows conflict count for multiple conflicts', () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      expect(screen.getByText(/2 stories/)).toBeInTheDocument();
    });

    it('displays warning icon', () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      // Warning icon should be present (SVG element)
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('expand/collapse', () => {
    it('is collapsed by default', () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      // Conflicting story IDs should not be visible initially
      expect(screen.queryByText('Story 4-4')).not.toBeInTheDocument();
      expect(screen.queryByText('Story 4-5')).not.toBeInTheDocument();
    });

    it('expands when header is clicked', async () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      const headerButton = screen.getByRole('button', { expanded: false });
      await fireEvent.click(headerButton);

      expect(screen.getByText('Story 4-4')).toBeInTheDocument();
      expect(screen.getByText('Story 4-5')).toBeInTheDocument();
    });

    it('collapses when header is clicked again', async () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      const headerButton = screen.getByRole('button');
      await fireEvent.click(headerButton); // expand
      await fireEvent.click(headerButton); // collapse

      expect(screen.queryByText('Story 4-4')).not.toBeInTheDocument();
    });

    it('updates aria-expanded attribute', async () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      const headerButton = screen.getByRole('button');
      expect(headerButton).toHaveAttribute('aria-expanded', 'false');

      await fireEvent.click(headerButton);
      expect(headerButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('conflict details', () => {
    it('shows conflicting story IDs when expanded', async () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      await fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Story 4-4')).toBeInTheDocument();
      expect(screen.getByText('Story 4-5')).toBeInTheDocument();
    });

    it('shows shared file count for each conflict', async () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      await fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText(/2 shared files/)).toBeInTheDocument();
      expect(screen.getByText(/1 shared file/)).toBeInTheDocument();
    });

    it('shows file paths when expanded', async () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      await fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('src/lib/stores/settings.ts')).toBeInTheDocument();
      expect(screen.getByText('src/lib/services/settings.ts')).toBeInTheDocument();
      expect(screen.getByText('src-tauri/src/settings/store.rs')).toBeInTheDocument();
    });

    it('shows coordination message', async () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      await fireEvent.click(screen.getByRole('button'));

      expect(
        screen.getByText(/Consider coordinating with these stories/)
      ).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has alert role', () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live attribute', () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('has aria-controls for expand/collapse', async () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      const headerButton = screen.getByRole('button');
      expect(headerButton).toHaveAttribute('aria-controls', 'conflict-details');
    });
  });

  describe('styling', () => {
    it('applies amber/orange warning colors', () => {
      render(ConflictWarningBanner, { props: { conflicts: mockConflicts } });

      const container = screen.getByRole('alert');
      expect(container.className).toContain('amber');
    });
  });

  describe('edge cases', () => {
    it('handles empty conflicts array', () => {
      render(ConflictWarningBanner, { props: { conflicts: [] } });

      // Should still render with 0 stories count
      expect(screen.getByText(/File Conflicts/)).toBeInTheDocument();
      expect(screen.getByText(/0 stories/)).toBeInTheDocument();
    });

    it('does not show details section when expanded with empty conflicts', async () => {
      render(ConflictWarningBanner, { props: { conflicts: [] } });

      await fireEvent.click(screen.getByRole('button'));

      // Coordination message should still be shown
      expect(
        screen.getByText(/Consider coordinating with these stories/)
      ).toBeInTheDocument();
      // But no story items should be present
      expect(screen.queryByText(/Story /)).not.toBeInTheDocument();
    });
  });
});
