/**
 * Unit tests for StoryCard component.
 * Tests rendering, click handling, and accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import StoryCard from './StoryCard.svelte';
import { selectedStoryId, resetSprintStatus } from '$lib/stores/stories';
import type { Story } from '$lib/types/stories';

describe('StoryCard', () => {
  beforeEach(() => {
    resetSprintStatus();
  });

  afterEach(() => {
    resetSprintStatus();
  });

  const createStory = (overrides: Partial<Story> = {}): Story => ({
    id: '3-2-story-board-ui-kanban',
    epicId: '3',
    storyNumber: 2,
    subStoryNumber: undefined, // Rust serializes Option::None as null
    slug: 'story-board-ui-kanban',
    status: 'ready-for-dev',
    ...overrides,
  });

  describe('rendering', () => {
    it('displays story ID in monospace format', () => {
      const story = createStory();
      render(StoryCard, { props: { story } });

      expect(screen.getByText('3-2')).toBeInTheDocument();
    });

    it('displays story title from slug (title case)', () => {
      const story = createStory({ slug: 'my-awesome-feature' });
      render(StoryCard, { props: { story } });

      expect(screen.getByText('My Awesome Feature')).toBeInTheDocument();
    });

    it('displays sub-story ID correctly', () => {
      const story = createStory({
        id: '1-5-2-terminate-lock',
        epicId: '1',
        storyNumber: 5,
        subStoryNumber: 2,
        slug: 'terminate-lock',
      });
      render(StoryCard, { props: { story } });

      expect(screen.getByText('1-5-2')).toBeInTheDocument();
    });

    it('applies correct status border color for ready-for-dev', () => {
      const story = createStory({ status: 'ready-for-dev' });
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button?.classList.contains('border-yellow-500')).toBe(true);
    });

    it('applies correct status border color for done', () => {
      const story = createStory({ status: 'done' });
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button?.classList.contains('border-green-500')).toBe(true);
    });

    it('applies correct status border color for in-progress', () => {
      const story = createStory({ status: 'in-progress' });
      const { container } = render(StoryCard, { props: { story } });

      const button = container.querySelector('button');
      expect(button?.classList.contains('border-blue-500')).toBe(true);
    });
  });

  describe('interaction', () => {
    it('sets selectedStoryId when clicked', async () => {
      const story = createStory();
      render(StoryCard, { props: { story } });

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(get(selectedStoryId)).toBe('3-2-story-board-ui-kanban');
    });

    // Note: Enter/Space keyboard activation is handled natively by <button> elements.
    // jsdom doesn't fully simulate native button keyboard behavior, so we test with click
    // which covers the actual interaction. The button's native keyboard handling is
    // browser-guaranteed behavior for accessible elements.
  });

  describe('accessibility', () => {
    it('has correct aria-label', () => {
      const story = createStory({ status: 'ready-for-dev' });
      render(StoryCard, { props: { story } });

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toBe(
        'Story 3-2: Story Board Ui Kanban, status: Ready'
      );
    });

    it('is focusable with tabindex', () => {
      const story = createStory();
      render(StoryCard, { props: { story } });

      const button = screen.getByRole('button');
      expect(button.getAttribute('tabindex')).toBe('0');
    });
  });
});
