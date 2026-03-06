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
  storyTasksCache,
  refreshSprintStatus,
  refreshEpicTitles,
  resetSprintStatus,
  getCachedTasks,
  setCachedTasks,
  invalidateCachedTasks,
  clearTasksCache,
} from './stories';
import type { SprintStatus, Story } from '$lib/types/stories';
import type { StoryProgress } from '$lib/types/workflow';

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
      bugs: [],
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
        bugs: [],
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
        bugs: [],
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
        bugs: [],
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

  describe('storyTasksCache (Story 5-8)', () => {
    const createMockProgress = (storyId: string, completed: number, total: number): StoryProgress => ({
      storyId,
      tasks: Array.from({ length: total }, (_, i) => ({
        text: `Task ${i + 1}`,
        completed: i < completed,
        level: 0,
      })),
      total,
      completed,
      percentage: Math.round((completed / total) * 100),
    });

    beforeEach(() => {
      clearTasksCache();
    });

    describe('getCachedTasks', () => {
      it('returns undefined when cache is empty', () => {
        expect(getCachedTasks('1-1-test')).toBeUndefined();
      });

      it('returns cached progress when available', () => {
        const progress = createMockProgress('1-1-test', 5, 10);
        setCachedTasks('1-1-test', progress);

        const cached = getCachedTasks('1-1-test');
        expect(cached).toEqual(progress);
      });

      it('returns undefined for uncached story when others are cached', () => {
        setCachedTasks('1-1-cached', createMockProgress('1-1-cached', 3, 5));

        expect(getCachedTasks('1-2-uncached')).toBeUndefined();
      });
    });

    describe('setCachedTasks', () => {
      it('adds progress to cache', () => {
        const progress = createMockProgress('2-1-auth', 8, 12);
        setCachedTasks('2-1-auth', progress);

        expect(get(storyTasksCache).get('2-1-auth')).toEqual(progress);
      });

      it('overwrites existing cache entry', () => {
        const oldProgress = createMockProgress('2-1-auth', 3, 10);
        const newProgress = createMockProgress('2-1-auth', 8, 10);

        setCachedTasks('2-1-auth', oldProgress);
        setCachedTasks('2-1-auth', newProgress);

        expect(getCachedTasks('2-1-auth')?.completed).toBe(8);
      });

      it('caches multiple stories independently', () => {
        setCachedTasks('1-1-first', createMockProgress('1-1-first', 1, 2));
        setCachedTasks('1-2-second', createMockProgress('1-2-second', 3, 4));

        expect(get(storyTasksCache).size).toBe(2);
        expect(getCachedTasks('1-1-first')?.completed).toBe(1);
        expect(getCachedTasks('1-2-second')?.completed).toBe(3);
      });
    });

    describe('invalidateCachedTasks', () => {
      it('removes specific story from cache', () => {
        setCachedTasks('1-1-target', createMockProgress('1-1-target', 2, 5));
        setCachedTasks('1-2-keep', createMockProgress('1-2-keep', 3, 6));

        invalidateCachedTasks('1-1-target');

        expect(getCachedTasks('1-1-target')).toBeUndefined();
        expect(getCachedTasks('1-2-keep')).toBeDefined();
      });

      it('does not throw when invalidating non-existent story', () => {
        expect(() => invalidateCachedTasks('non-existent')).not.toThrow();
      });

      it('handles various story ID formats', () => {
        // Standard format
        setCachedTasks('5-8-stories-kanban', createMockProgress('5-8-stories-kanban', 1, 1));
        invalidateCachedTasks('5-8-stories-kanban');
        expect(getCachedTasks('5-8-stories-kanban')).toBeUndefined();

        // Sub-story format
        setCachedTasks('1-5-2-terminate-lock', createMockProgress('1-5-2-terminate-lock', 2, 3));
        invalidateCachedTasks('1-5-2-terminate-lock');
        expect(getCachedTasks('1-5-2-terminate-lock')).toBeUndefined();

        // Decimal epic format
        setCachedTasks('2.5-1-prep-sprint', createMockProgress('2.5-1-prep-sprint', 4, 5));
        invalidateCachedTasks('2.5-1-prep-sprint');
        expect(getCachedTasks('2.5-1-prep-sprint')).toBeUndefined();
      });
    });

    describe('clearTasksCache', () => {
      it('removes all cached tasks', () => {
        setCachedTasks('1-1-a', createMockProgress('1-1-a', 1, 2));
        setCachedTasks('1-2-b', createMockProgress('1-2-b', 2, 3));
        setCachedTasks('2-1-c', createMockProgress('2-1-c', 3, 4));

        expect(get(storyTasksCache).size).toBe(3);

        clearTasksCache();

        expect(get(storyTasksCache).size).toBe(0);
      });

      it('is called by resetSprintStatus', () => {
        setCachedTasks('1-1-test', createMockProgress('1-1-test', 1, 2));
        expect(get(storyTasksCache).size).toBe(1);

        resetSprintStatus();

        expect(get(storyTasksCache).size).toBe(0);
      });
    });

    describe('file watcher story ID regex patterns', () => {
      // Test the regex pattern used in StoryBoardContainer.svelte:123
      // Pattern: /(\d+(?:\.\d+)?-\d+(?:-\d+)?-[^/]+)\.md$/
      const storyIdRegex = /(\d+(?:\.\d+)?-\d+(?:-\d+)?-[^/]+)\.md$/;

      it('matches standard story file paths', () => {
        const path = '/project/_bmad-output/implementation-artifacts/5-8-stories-kanban-enhancement.md';
        const match = path.match(storyIdRegex);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('5-8-stories-kanban-enhancement');
      });

      it('matches sub-story file paths', () => {
        const path = '/project/_bmad-output/implementation-artifacts/1-5-2-terminate-lock.md';
        const match = path.match(storyIdRegex);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('1-5-2-terminate-lock');
      });

      it('matches decimal epic story file paths', () => {
        const path = '/project/_bmad-output/implementation-artifacts/2.5-1-prep-sprint.md';
        const match = path.match(storyIdRegex);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('2.5-1-prep-sprint');
      });

      it('does not match non-story files', () => {
        const paths = [
          '/project/src/lib/components/stories/StoryCard.svelte',
          '/project/_bmad-output/planning-artifacts/architecture.md',
          '/project/README.md',
        ];

        for (const path of paths) {
          expect(path.match(storyIdRegex)).toBeNull();
        }
      });

      it('extracts correct story ID for cache invalidation', () => {
        // Simulate what StoryBoardContainer does
        const onArtifactModified = (path: string) => {
          const match = path.match(storyIdRegex);
          if (match) {
            return match[1];
          }
          return null;
        };

        expect(onArtifactModified('5-8-stories-kanban-enhancement.md')).toBe('5-8-stories-kanban-enhancement');
        expect(onArtifactModified('/full/path/3-2-story-board.md')).toBe('3-2-story-board');
        expect(onArtifactModified('not-a-story.md')).toBeNull();
      });
    });
  });
});
