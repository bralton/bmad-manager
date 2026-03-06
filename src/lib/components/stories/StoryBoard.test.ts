/**
 * Unit tests for StoryBoard component.
 * Tests column rendering, epic rows, and story counts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StoryBoard from './StoryBoard.svelte';
import { resetSprintStatus } from '$lib/stores/stories';
import type { SprintStatus } from '$lib/types/stories';

describe('StoryBoard', () => {
  beforeEach(() => {
    resetSprintStatus();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createStatus = (overrides: Partial<SprintStatus> = {}): SprintStatus => ({
    generated: '2026-02-22',
    project: 'test-project',
    epics: [
      { id: '1', status: 'done' },
      { id: '2', status: 'in-progress' },
    ],
    stories: [
      { id: '1-1-scaffold', epicId: '1', storyNumber: 1, slug: 'scaffold', status: 'done' },
      { id: '1-2-detection', epicId: '1', storyNumber: 2, slug: 'detection', status: 'done' },
      { id: '2-1-parser', epicId: '2', storyNumber: 1, slug: 'parser', status: 'ready-for-dev' },
      { id: '2-2-visualizer', epicId: '2', storyNumber: 2, slug: 'visualizer', status: 'backlog' },
    ],
    bugs: [],
    ...overrides,
  });

  describe('column headers', () => {
    it('renders all 5 kanban columns', () => {
      const status = createStatus();
      render(StoryBoard, { props: { status } });

      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('shows story count per column', () => {
      const status = createStatus();
      render(StoryBoard, { props: { status } });

      // Backlog: 1, Ready: 1, In Progress: 0, Review: 0, Done: 2
      expect(screen.getAllByText('(1)').length).toBe(2); // Backlog and Ready each have 1
      expect(screen.getByText('(2)')).toBeInTheDocument(); // Done
      expect(screen.getAllByText('(0)').length).toBe(2); // In Progress, Review
    });
  });

  describe('epic rows', () => {
    it('renders epic rows for epics with stories', () => {
      const status = createStatus();
      render(StoryBoard, { props: { status } });

      expect(screen.getByText('Epic 1')).toBeInTheDocument();
      expect(screen.getByText('Epic 2')).toBeInTheDocument();
    });

    it('does not render epic row if epic has no stories', () => {
      const status = createStatus({
        epics: [
          { id: '1', status: 'done' },
          { id: '2', status: 'in-progress' },
          { id: '3', status: 'backlog' }, // No stories for this epic
        ],
      });
      render(StoryBoard, { props: { status } });

      expect(screen.getByText('Epic 1')).toBeInTheDocument();
      expect(screen.getByText('Epic 2')).toBeInTheDocument();
      expect(screen.queryByText('Epic 3')).not.toBeInTheDocument();
    });

    it('renders story cards within epic rows', () => {
      const status = createStatus();
      render(StoryBoard, { props: { status } });

      // Story IDs should be visible
      expect(screen.getByText('1-1')).toBeInTheDocument();
      expect(screen.getByText('1-2')).toBeInTheDocument();
      expect(screen.getByText('2-1')).toBeInTheDocument();
      expect(screen.getByText('2-2')).toBeInTheDocument();
    });
  });

  describe('decimal epic IDs', () => {
    it('handles decimal epic IDs (e.g., 2.5)', () => {
      const status = createStatus({
        epics: [
          { id: '2', status: 'done' },
          { id: '2.5', status: 'in-progress' },
          { id: '3', status: 'backlog' },
        ],
        stories: [
          { id: '2-1-first', epicId: '2', storyNumber: 1, slug: 'first', status: 'done' },
          { id: '2.5-1-prep', epicId: '2.5', storyNumber: 1, slug: 'prep', status: 'ready-for-dev' },
          { id: '3-1-third', epicId: '3', storyNumber: 1, slug: 'third', status: 'backlog' },
        ],
      });
      render(StoryBoard, { props: { status } });

      expect(screen.getByText('Epic 2')).toBeInTheDocument();
      expect(screen.getByText('Epic 2.5')).toBeInTheDocument();
      expect(screen.getByText('Epic 3')).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('renders column headers even with no stories', () => {
      const status = createStatus({
        epics: [],
        stories: [],
      });
      render(StoryBoard, { props: { status } });

      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('shows zero counts when no stories', () => {
      const status = createStatus({
        epics: [],
        stories: [],
      });
      render(StoryBoard, { props: { status } });

      // All columns should show (0)
      expect(screen.getAllByText('(0)').length).toBe(5);
    });
  });

  describe('bugs row (Story 5-15)', () => {
    it('renders BugsRow when bugs exist', () => {
      const status = createStatus({
        bugs: [
          { id: 'bug-1-crash', bugNumber: 1, slug: 'crash', status: 'backlog' },
          { id: 'bug-2-freeze', bugNumber: 2, slug: 'freeze', status: 'in-progress' },
        ],
      });
      render(StoryBoard, { props: { status } });

      // BugsRow header should be visible
      expect(screen.getByText('Bugs')).toBeInTheDocument();
      expect(screen.getByText('2 bugs')).toBeInTheDocument();
    });

    it('does not render BugsRow when no bugs exist', () => {
      const status = createStatus({
        bugs: [],
      });
      render(StoryBoard, { props: { status } });

      expect(screen.queryByText('Bugs')).not.toBeInTheDocument();
    });

    it('includes bugs in column counts (AC #7)', () => {
      const status = createStatus({
        stories: [
          { id: '1-1-scaffold', epicId: '1', storyNumber: 1, slug: 'scaffold', status: 'backlog' },
        ],
        bugs: [
          { id: 'bug-1-crash', bugNumber: 1, slug: 'crash', status: 'backlog' },
          { id: 'bug-2-freeze', bugNumber: 2, slug: 'freeze', status: 'backlog' },
        ],
      });
      render(StoryBoard, { props: { status } });

      // Backlog should show 3 (1 story + 2 bugs)
      expect(screen.getByText('(3)')).toBeInTheDocument();
    });

    it('renders bug cards with distinct styling', () => {
      const status = createStatus({
        bugs: [
          { id: 'bug-1-terminal-crash', bugNumber: 1, slug: 'terminal-crash', status: 'backlog' },
        ],
      });
      render(StoryBoard, { props: { status } });

      expect(screen.getByText('BUG-1')).toBeInTheDocument();
      expect(screen.getByText('Terminal Crash')).toBeInTheDocument();
    });
  });
});
