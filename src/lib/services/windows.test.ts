/**
 * Unit tests for windows.ts service.
 * Tests multi-window management functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openProjectInNewWindow, openWorktreeInNewWindow } from './windows';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = invoke as ReturnType<typeof vi.fn>;

describe('windows service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('openProjectInNewWindow', () => {
    it('calls invoke with correct command and parameters', async () => {
      mockInvoke.mockResolvedValue('project-_Users_test_my-project');

      const result = await openProjectInNewWindow('/Users/test/my-project');

      expect(mockInvoke).toHaveBeenCalledWith('open_project_window', {
        projectPath: '/Users/test/my-project',
      });
      expect(result).toBe('project-_Users_test_my-project');
    });

    it('returns the window label from the backend', async () => {
      mockInvoke.mockResolvedValue('project-custom-label');

      const result = await openProjectInNewWindow('/some/path');

      expect(result).toBe('project-custom-label');
    });

    it('propagates errors from the backend', async () => {
      mockInvoke.mockRejectedValue(new Error('Window creation failed'));

      await expect(openProjectInNewWindow('/some/path')).rejects.toThrow(
        'Window creation failed'
      );
    });
  });

  describe('openWorktreeInNewWindow', () => {
    it('is an alias for openProjectInNewWindow', async () => {
      mockInvoke.mockResolvedValue('project-_Users_test_project-wt-3-4');

      const result = await openWorktreeInNewWindow('/Users/test/project-wt-3-4');

      expect(mockInvoke).toHaveBeenCalledWith('open_project_window', {
        projectPath: '/Users/test/project-wt-3-4',
      });
      expect(result).toBe('project-_Users_test_project-wt-3-4');
    });

    it('works with worktree paths', async () => {
      mockInvoke.mockResolvedValue('window-label');

      await openWorktreeInNewWindow('/path/to/bmad_manager-wt-3-4');

      expect(mockInvoke).toHaveBeenCalledWith('open_project_window', {
        projectPath: '/path/to/bmad_manager-wt-3-4',
      });
    });
  });
});
