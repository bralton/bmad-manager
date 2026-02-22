/**
 * Unit tests for StoryDetailPanel component.
 * Tests rendering, close functionality, and accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StoryDetailPanel from './StoryDetailPanel.svelte';
import type { Story, Epic } from '$lib/types/stories';

describe('StoryDetailPanel', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseMock = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createStory = (overrides: Partial<Story> = {}): Story => ({
    id: '3-2-story-board-ui-kanban',
    epicId: '3',
    storyNumber: 2,
    slug: 'story-board-ui-kanban',
    status: 'review',
    ...overrides,
  });

  const createEpic = (overrides: Partial<Epic> = {}): Epic => ({
    id: '3',
    status: 'in-progress',
    ...overrides,
  });

  describe('rendering', () => {
    it('displays story ID in header', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('Story 3-2')).toBeInTheDocument();
    });

    it('displays sub-story ID correctly', () => {
      const story = createStory({
        id: '1-5-2-terminate-lock',
        epicId: '1',
        storyNumber: 5,
        subStoryNumber: 2,
        slug: 'terminate-lock',
      });
      render(StoryDetailPanel, { props: { story, epic: createEpic({ id: '1' }), onClose: onCloseMock } });

      expect(screen.getByText('Story 1-5-2')).toBeInTheDocument();
    });

    it('displays story title from slug', () => {
      const story = createStory({ slug: 'my-awesome-feature' });
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('My Awesome Feature')).toBeInTheDocument();
    });

    it('displays story status with label', () => {
      const story = createStory({ status: 'review' });
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('displays epic info', () => {
      const story = createStory({ epicId: '3' });
      const epic = createEpic({ id: '3', status: 'in-progress' });
      render(StoryDetailPanel, { props: { story, epic, onClose: onCloseMock } });

      expect(screen.getByText('Epic 3')).toBeInTheDocument();
      expect(screen.getByText('(In Progress)')).toBeInTheDocument();
    });

    it('displays full story ID', () => {
      const story = createStory({ id: '3-2-story-board-ui-kanban' });
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('3-2-story-board-ui-kanban')).toBeInTheDocument();
    });

    it('displays actions placeholder', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText('Worktree actions coming in Story 3-4')).toBeInTheDocument();
    });

    it('handles null epic gracefully', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: null, onClose: onCloseMock } });

      expect(screen.getByText('Epic 3')).toBeInTheDocument();
      expect(screen.queryByText('(In Progress)')).not.toBeInTheDocument();
    });
  });

  describe('close functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      const closeButton = screen.getByLabelText('Close detail panel');
      await fireEvent.click(closeButton);

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', async () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      await fireEvent.keyDown(window, { key: 'Escape' });

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const story = createStory();
      const { container } = render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      // The backdrop is the outer div with bg-black/50
      const backdrop = container.querySelector('.bg-black\\/50');
      if (backdrop) {
        await fireEvent.click(backdrop);
      }

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when panel content is clicked', async () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      // Click on the title inside the panel
      const title = screen.getByText('Story 3-2');
      await fireEvent.click(title);

      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has dialog role', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('has aria-labelledby pointing to title', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      const dialog = screen.getByRole('dialog');
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(titleId).toBe('story-detail-title');

      const title = document.getElementById(titleId!);
      expect(title).toBeInTheDocument();
    });

    it('close button has accessible label', () => {
      const story = createStory();
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByLabelText('Close detail panel')).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    it.each([
      ['backlog', 'Backlog'],
      ['ready-for-dev', 'Ready'],
      ['in-progress', 'In Progress'],
      ['review', 'Review'],
      ['done', 'Done'],
    ] as const)('displays correct label for %s status', (status, expectedLabel) => {
      const story = createStory({ status });
      render(StoryDetailPanel, { props: { story, epic: createEpic(), onClose: onCloseMock } });

      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });
  });

  describe('epic status display', () => {
    it.each([
      ['backlog', 'Backlog'],
      ['in-progress', 'In Progress'],
      ['done', 'Done'],
    ] as const)('displays correct epic status for %s', (status, expectedLabel) => {
      const story = createStory();
      const epic = createEpic({ status });
      render(StoryDetailPanel, { props: { story, epic, onClose: onCloseMock } });

      expect(screen.getByText(`(${expectedLabel})`)).toBeInTheDocument();
    });
  });
});
