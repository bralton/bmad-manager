/**
 * E2E test fixture utilities.
 *
 * Provides helpers for working with test fixtures including
 * copying fixtures to temporary directories.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

/**
 * Available test fixtures.
 */
export const FIXTURES = {
  BMAD_PROJECT: 'bmad-project',
  GIT_ONLY_PROJECT: 'git-only-project',
  EMPTY_PROJECT: 'empty-project',
};

/**
 * Gets the path to a fixture directory.
 *
 * @param {string} fixtureName - Name of the fixture (use FIXTURES constants)
 * @returns {string} Absolute path to the fixture
 */
export function getFixturePath(fixtureName) {
  return path.join(FIXTURES_DIR, fixtureName);
}

/**
 * Copies a fixture directory to a temporary location.
 *
 * This allows tests to modify the fixture without affecting other tests.
 * The temporary directory is created in the system temp folder.
 *
 * Note: Fixtures store `.git` as `dot-git` to avoid git treating them as
 * submodules. This function restores `dot-git` to `.git` when copying.
 *
 * @param {string} fixtureName - Name of the fixture to copy
 * @returns {string} Path to the temporary copy
 */
export function copyFixtureToTemp(fixtureName) {
  const fixturePath = getFixturePath(fixtureName);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `e2e-${fixtureName}-`));

  copyRecursive(fixturePath, tempDir);

  // Restore dot-git to .git for proper git detection
  const dotGitPath = path.join(tempDir, 'dot-git');
  const gitPath = path.join(tempDir, '.git');
  if (fs.existsSync(dotGitPath)) {
    fs.renameSync(dotGitPath, gitPath);
  }

  return tempDir;
}

/**
 * Recursively copies a directory.
 *
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 */
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Removes a temporary directory and all its contents.
 *
 * Safety: Only removes directories within system temp folder.
 * Errors are logged but not thrown to avoid masking test failures.
 *
 * @param {string} tempPath - Path to the temporary directory
 */
export function cleanupTemp(tempPath) {
  if (!tempPath || !tempPath.includes(os.tmpdir())) {
    return;
  }

  try {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
  } catch (error) {
    // Log but don't throw - cleanup failures shouldn't mask test failures
    // System temp folder will eventually be cleared by OS
    console.warn(`Warning: Failed to cleanup temp directory ${tempPath}:`, error.message);
  }
}

/**
 * Creates an empty temporary directory for tests that need a truly empty folder.
 *
 * @param {string} prefix - Prefix for the temp directory name
 * @returns {string} Path to the temporary directory
 */
export function createEmptyTempDir(prefix = 'e2e-empty-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
