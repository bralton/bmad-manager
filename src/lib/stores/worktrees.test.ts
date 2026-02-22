/**
 * Unit tests for worktrees store.
 * Tests store state management and derived stores.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  worktrees,
  worktreesLoading,
  worktreesError,
  worktreeCreating,
  worktreesByStory,
  currentWorktreeStoryId,
  refreshWorktrees,
  validateAndRefreshWorktrees,
  setWorktreeCreating,
  resetWorktrees,
} from './worktrees';
import type { Worktree } from '$lib/types/worktree';

// Mock the worktrees service
vi.mock('$lib/services/worktrees', () => ({
  worktreeApi: {
    listWorktrees: vi.fn(),
    validateWorktreeBindings: vi.fn(),
    getCurrentWorktreeStoryId: vi.fn(),
  },
}));

import { worktreeApi } from '$lib/services/worktrees';

describe('worktrees store', () => {
  beforeEach(() => {
    resetWorktrees();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetWorktrees();
  });

  const createWorktree = (overrides: Partial<Worktree> = {}): Worktree => ({
    path: '/test/project-wt-3-3',
    branch: 'story/3-3-test-feature',
    head: 'abc123',
    storyId: '3-3',
    locked: false,
    isMain: false,
    ...overrides,
  });

  describe('worktrees store', () => {
    it('starts with empty array', () => {
      expect(get(worktrees)).toEqual([]);
    });

    it('can be set with worktree data', () => {
      const wt = createWorktree();
      worktrees.set([wt]);
      expect(get(worktrees)).toHaveLength(1);
      expect(get(worktrees)[0].path).toBe('/test/project-wt-3-3');
    });
  });

  describe('worktreesLoading store', () => {
    it('starts as false', () => {
      expect(get(worktreesLoading)).toBe(false);
    });

    it('can be set to true', () => {
      worktreesLoading.set(true);
      expect(get(worktreesLoading)).toBe(true);
    });
  });

  describe('worktreesError store', () => {
    it('starts as null', () => {
      expect(get(worktreesError)).toBeNull();
    });

    it('can be set with error message', () => {
      worktreesError.set('Test error');
      expect(get(worktreesError)).toBe('Test error');
    });
  });

  describe('worktreeCreating store', () => {
    it('starts as empty Map', () => {
      expect(get(worktreeCreating).size).toBe(0);
    });

    it('tracks creating state per story ID', () => {
      setWorktreeCreating('3-3', true);
      expect(get(worktreeCreating).get('3-3')).toBe(true);
    });

    it('removes story ID when creation completes', () => {
      setWorktreeCreating('3-3', true);
      setWorktreeCreating('3-3', false);
      expect(get(worktreeCreating).has('3-3')).toBe(false);
    });

    it('can track multiple stories', () => {
      setWorktreeCreating('3-3', true);
      setWorktreeCreating('3-4', true);
      expect(get(worktreeCreating).get('3-3')).toBe(true);
      expect(get(worktreeCreating).get('3-4')).toBe(true);
    });
  });

  describe('worktreesByStory derived store', () => {
    it('returns empty Map when no worktrees', () => {
      expect(get(worktreesByStory).size).toBe(0);
    });

    it('maps story IDs to worktrees', () => {
      const wt1 = createWorktree({ storyId: '3-3', path: '/test/wt-3-3' });
      const wt2 = createWorktree({ storyId: '3-4', path: '/test/wt-3-4' });
      worktrees.set([wt1, wt2]);

      const byStory = get(worktreesByStory);
      expect(byStory.size).toBe(2);
      expect(byStory.get('3-3')?.path).toBe('/test/wt-3-3');
      expect(byStory.get('3-4')?.path).toBe('/test/wt-3-4');
    });

    it('excludes worktrees without story ID (main worktree)', () => {
      const main = createWorktree({ storyId: undefined, isMain: true });
      const wt = createWorktree({ storyId: '3-3' });
      worktrees.set([main, wt]);

      const byStory = get(worktreesByStory);
      expect(byStory.size).toBe(1);
      expect(byStory.has('3-3')).toBe(true);
    });

    it('updates when worktrees store changes', () => {
      const wt = createWorktree({ storyId: '3-3' });
      worktrees.set([wt]);
      expect(get(worktreesByStory).has('3-3')).toBe(true);

      worktrees.set([]);
      expect(get(worktreesByStory).size).toBe(0);
    });
  });

  describe('refreshWorktrees', () => {
    it('sets loading to true then false', async () => {
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const promise = refreshWorktrees('/test/project');
      expect(get(worktreesLoading)).toBe(true);

      await promise;
      expect(get(worktreesLoading)).toBe(false);
    });

    it('updates worktrees store on success', async () => {
      const mockWorktrees = [createWorktree()];
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorktrees);

      await refreshWorktrees('/test/project');

      expect(get(worktrees)).toEqual(mockWorktrees);
      expect(get(worktreesError)).toBeNull();
    });

    it('sets error on failure', async () => {
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Git error'));

      await refreshWorktrees('/test/project');

      expect(get(worktreesError)).toBe('Git error');
      expect(get(worktrees)).toEqual([]);
    });

    it('handles string errors', async () => {
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockRejectedValue('Something went wrong');

      await refreshWorktrees('/test/project');

      expect(get(worktreesError)).toBe('Something went wrong');
    });
  });

  describe('resetWorktrees', () => {
    it('resets all stores to initial values', () => {
      worktrees.set([createWorktree()]);
      worktreesLoading.set(true);
      worktreesError.set('error');
      setWorktreeCreating('3-3', true);

      resetWorktrees();

      expect(get(worktrees)).toEqual([]);
      expect(get(worktreesLoading)).toBe(false);
      expect(get(worktreesError)).toBeNull();
      expect(get(worktreeCreating).size).toBe(0);
    });
  });

  describe('validateAndRefreshWorktrees', () => {
    it('calls validateWorktreeBindings then listWorktrees', async () => {
      const mockWorktrees = [createWorktree()];
      (worktreeApi.validateWorktreeBindings as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorktrees);
      (worktreeApi.getCurrentWorktreeStoryId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await validateAndRefreshWorktrees('/test/project');

      expect(worktreeApi.validateWorktreeBindings).toHaveBeenCalledWith('/test/project');
      expect(worktreeApi.listWorktrees).toHaveBeenCalledWith('/test/project');
      expect(get(worktrees)).toEqual(mockWorktrees);
    });

    it('sets loading to true then false', async () => {
      (worktreeApi.validateWorktreeBindings as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (worktreeApi.getCurrentWorktreeStoryId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const promise = validateAndRefreshWorktrees('/test/project');
      expect(get(worktreesLoading)).toBe(true);

      await promise;
      expect(get(worktreesLoading)).toBe(false);
    });

    it('continues even if some orphaned bindings are found', async () => {
      const mockWorktrees = [createWorktree()];
      (worktreeApi.validateWorktreeBindings as ReturnType<typeof vi.fn>).mockResolvedValue(['3-1', '3-2']);
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorktrees);
      (worktreeApi.getCurrentWorktreeStoryId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await validateAndRefreshWorktrees('/test/project');

      expect(get(worktrees)).toEqual(mockWorktrees);
      expect(get(worktreesError)).toBeNull();
    });

    it('sets error if validation fails', async () => {
      (worktreeApi.validateWorktreeBindings as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Validation error'));

      await validateAndRefreshWorktrees('/test/project');

      expect(get(worktreesError)).toBe('Validation error');
      expect(worktreeApi.listWorktrees).not.toHaveBeenCalled();
    });

    it('sets currentWorktreeStoryId when project is a worktree', async () => {
      (worktreeApi.validateWorktreeBindings as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (worktreeApi.getCurrentWorktreeStoryId as ReturnType<typeof vi.fn>).mockResolvedValue('3-4');

      await validateAndRefreshWorktrees('/test/project-wt-3-4');

      expect(get(currentWorktreeStoryId)).toBe('3-4');
    });

    it('sets currentWorktreeStoryId to null when project is main repo', async () => {
      (worktreeApi.validateWorktreeBindings as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (worktreeApi.listWorktrees as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (worktreeApi.getCurrentWorktreeStoryId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await validateAndRefreshWorktrees('/test/main-project');

      expect(get(currentWorktreeStoryId)).toBeNull();
    });
  });

  describe('currentWorktreeStoryId store', () => {
    it('starts as null', () => {
      expect(get(currentWorktreeStoryId)).toBeNull();
    });

    it('can be set with story ID', () => {
      currentWorktreeStoryId.set('3-4');
      expect(get(currentWorktreeStoryId)).toBe('3-4');
    });

    it('is reset by resetWorktrees', () => {
      currentWorktreeStoryId.set('3-4');
      resetWorktrees();
      expect(get(currentWorktreeStoryId)).toBeNull();
    });
  });
});
