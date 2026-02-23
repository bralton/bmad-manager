/**
 * Unit tests for stories.ts store.
 * Tests store initialization, refreshSprintStatus, derived stores, and resetSprintStatus.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  sprintStatus,
  sprintStatusLoading,
  sprintStatusError,
  selectedStoryId,
  storiesByStatus,
  storiesByEpic,
  epicTitles,
  refreshSprintStatus,
  refreshEpicTitles,
  resetSprintStatus,
} from './stories';
import type { SprintStatus, Story } from '$lib/types/stories';

// Mock the storyApi
vi.mock('$lib/services/stories', () => ({
  storyApi: {
    getSprintStatus: vi.fn(),
    getEpicTitles: vi.fn(),
  },
}));

import { storyApi } from '$lib/services/stories';
const mockGetSprintStatus = storyApi.getSprintStatus as ReturnType<typeof vi.fn>;
const mockGetEpicTitles = storyApi.getEpicTitles as ReturnType<typeof vi.fn>;

describe('stories store', () => {
  beforeEach(() => {
    // Reset stores to initial state before each test
    resetSprintStatus();
    vi.clearAllMocks();
    // Suppress expected console.error output from error handling tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('sprintStatus initializes to null', () => {
      expect(get(sprintStatus)).toBeNull();
    });

    it('sprintStatusLoading initializes to false', () => {
      expect(get(sprintStatusLoading)).toBe(false);
    });

    it('sprintStatusError initializes to null', () => {
      expect(get(sprintStatusError)).toBeNull();
    });

    it('selectedStoryId initializes to null', () => {
      expect(get(selectedStoryId)).toBeNull();
    });
  });

  describe('refreshSprintStatus', () => {
    const mockStatus: SprintStatus = {
      generated: '2026-02-20',
      project: 'test-project',
      epics: [
        { id: '1', status: 'done' },
        { id: '2', status: 'in-progress' },
      ],
      stories: [
        {
          id: '1-1-scaffold',
          epicId: '1',
          storyNumber: 1,
          slug: 'scaffold',
          status: 'done',
        },
        {
          id: '2-1-parser',
          epicId: '2',
          storyNumber: 1,
          slug: 'parser',
          status: 'ready-for-dev',
        },
      ],
    };

    it('sets loading state to true when called', async () => {
      let resolvePromise: (value: SprintStatus) => void;
      const controlledPromise = new Promise<SprintStatus>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetSprintStatus.mockReturnValue(controlledPromise);

      const refreshPromise = refreshSprintStatus('/test/project');

      expect(get(sprintStatusLoading)).toBe(true);

      resolvePromise!(mockStatus);
      await refreshPromise;
    });

    it('sets sprintStatus on success', async () => {
      mockGetSprintStatus.mockResolvedValue(mockStatus);

      await refreshSprintStatus('/test/project');

      expect(get(sprintStatus)).toEqual(mockStatus);
      expect(get(sprintStatusError)).toBeNull();
    });

    it('sets sprintStatusError on failure with Error instance', async () => {
      mockGetSprintStatus.mockRejectedValue(new Error('Network error'));

      await refreshSprintStatus('/test/project');

      expect(get(sprintStatusError)).toBe('Network error');
      expect(get(sprintStatus)).toBeNull();
    });

    it('sets loading state to false after completion', async () => {
      mockGetSprintStatus.mockResolvedValue(mockStatus);

      await refreshSprintStatus('/test/project');

      expect(get(sprintStatusLoading)).toBe(false);
    });

    it('handles string error message', async () => {
      mockGetSprintStatus.mockRejectedValue('String error message');

      await refreshSprintStatus('/test/project');

      expect(get(sprintStatusError)).toBe('String error message');
    });

    it('handles object error with message property', async () => {
      mockGetSprintStatus.mockRejectedValue({ message: 'Object error message' });

      await refreshSprintStatus('/test/project');

      expect(get(sprintStatusError)).toBe('Object error message');
    });

    it('uses fallback message for unknown error types', async () => {
      mockGetSprintStatus.mockRejectedValue(42);

      await refreshSprintStatus('/test/project');

      expect(get(sprintStatusError)).toBe('Failed to load sprint status');
    });

    it('clears previous error on new refresh', async () => {
      mockGetSprintStatus.mockRejectedValue(new Error('First error'));
      await refreshSprintStatus('/test/project');
      expect(get(sprintStatusError)).toBe('First error');

      mockGetSprintStatus.mockResolvedValue(mockStatus);
      await refreshSprintStatus('/test/project');
      expect(get(sprintStatusError)).toBeNull();
    });
  });

  describe('storiesByStatus derived store', () => {
    it('returns empty buckets when sprintStatus is null', () => {
      const result = get(storiesByStatus);

      expect(result.get('backlog')).toEqual([]);
      expect(result.get('ready-for-dev')).toEqual([]);
      expect(result.get('in-progress')).toEqual([]);
      expect(result.get('review')).toEqual([]);
      expect(result.get('done')).toEqual([]);
    });

    it('groups stories by status correctly', async () => {
      const mockStatus: SprintStatus = {
        generated: '2026-02-20',
        project: 'test',
        epics: [],
        stories: [
          { id: '1-1-a', epicId: '1', storyNumber: 1, slug: 'a', status: 'done' },
          { id: '1-2-b', epicId: '1', storyNumber: 2, slug: 'b', status: 'done' },
          { id: '2-1-c', epicId: '2', storyNumber: 1, slug: 'c', status: 'ready-for-dev' },
          { id: '3-1-d', epicId: '3', storyNumber: 1, slug: 'd', status: 'backlog' },
        ],
      };

      mockGetSprintStatus.mockResolvedValue(mockStatus);
      await refreshSprintStatus('/test');

      const result = get(storiesByStatus);

      expect(result.get('done')?.length).toBe(2);
      expect(result.get('ready-for-dev')?.length).toBe(1);
      expect(result.get('backlog')?.length).toBe(1);
      expect(result.get('in-progress')?.length).toBe(0);
      expect(result.get('review')?.length).toBe(0);
    });
  });

  describe('storiesByEpic derived store', () => {
    it('returns empty map when sprintStatus is null', () => {
      const result = get(storiesByEpic);
      expect(result.size).toBe(0);
    });

    it('groups stories by epic ID correctly', async () => {
      const mockStatus: SprintStatus = {
        generated: '2026-02-20',
        project: 'test',
        epics: [],
        stories: [
          { id: '1-1-a', epicId: '1', storyNumber: 1, slug: 'a', status: 'done' },
          { id: '1-2-b', epicId: '1', storyNumber: 2, slug: 'b', status: 'done' },
          { id: '2-1-c', epicId: '2', storyNumber: 1, slug: 'c', status: 'ready-for-dev' },
          { id: '2.5-1-d', epicId: '2.5', storyNumber: 1, slug: 'd', status: 'backlog' },
        ],
      };

      mockGetSprintStatus.mockResolvedValue(mockStatus);
      await refreshSprintStatus('/test');

      const result = get(storiesByEpic);

      expect(result.get('1')?.length).toBe(2);
      expect(result.get('2')?.length).toBe(1);
      expect(result.get('2.5')?.length).toBe(1);
    });
  });

  describe('resetSprintStatus', () => {
    it('resets all stores to initial values', async () => {
      const mockStatus: SprintStatus = {
        generated: '2026-02-20',
        project: 'test',
        epics: [],
        stories: [],
      };

      mockGetSprintStatus.mockResolvedValue(mockStatus);
      await refreshSprintStatus('/test/project');
      selectedStoryId.set('1-1-test');

      expect(get(sprintStatus)).not.toBeNull();
      expect(get(selectedStoryId)).toBe('1-1-test');

      resetSprintStatus();

      expect(get(sprintStatus)).toBeNull();
      expect(get(sprintStatusLoading)).toBe(false);
      expect(get(sprintStatusError)).toBeNull();
      expect(get(selectedStoryId)).toBeNull();
    });

    it('resets epicTitles to empty Map', async () => {
      // Set some titles first
      mockGetEpicTitles.mockResolvedValue({ '1': 'Foundation', '2': 'Polish' });
      await refreshEpicTitles('/test/project');
      expect(get(epicTitles).size).toBe(2);

      // Reset should clear them
      resetSprintStatus();
      expect(get(epicTitles).size).toBe(0);
    });
  });

  describe('epicTitles store', () => {
    it('initializes to empty Map', () => {
      expect(get(epicTitles)).toEqual(new Map());
    });
  });

  describe('refreshEpicTitles', () => {
    it('sets epicTitles from API response', async () => {
      mockGetEpicTitles.mockResolvedValue({
        '1': 'Foundation',
        '2.5': 'Prep Sprint',
        '3': 'Stories & Worktrees',
      });

      await refreshEpicTitles('/test/project');

      const titles = get(epicTitles);
      expect(titles.get('1')).toBe('Foundation');
      expect(titles.get('2.5')).toBe('Prep Sprint');
      expect(titles.get('3')).toBe('Stories & Worktrees');
    });

    it('handles empty response gracefully', async () => {
      mockGetEpicTitles.mockResolvedValue({});

      await refreshEpicTitles('/test/project');

      expect(get(epicTitles).size).toBe(0);
    });

    it('handles API error gracefully without throwing', async () => {
      mockGetEpicTitles.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await refreshEpicTitles('/test/project');

      // Titles should remain empty
      expect(get(epicTitles).size).toBe(0);
    });

    it('replaces previous titles on refresh', async () => {
      // First load
      mockGetEpicTitles.mockResolvedValue({ '1': 'Old Title' });
      await refreshEpicTitles('/test/project');
      expect(get(epicTitles).get('1')).toBe('Old Title');

      // Second load with different data
      mockGetEpicTitles.mockResolvedValue({ '1': 'New Title', '2': 'Another' });
      await refreshEpicTitles('/test/project');

      const titles = get(epicTitles);
      expect(titles.get('1')).toBe('New Title');
      expect(titles.get('2')).toBe('Another');
    });
  });
});
