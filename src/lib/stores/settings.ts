/**
 * Settings store for managing application settings state.
 */

import { writable, derived } from 'svelte/store';
import type { GlobalSettings, DependencyStatus } from '$lib/types/settings';
import { settingsApi } from '$lib/services/tauri';

/** Current settings state */
export const settings = writable<GlobalSettings | null>(null);

/** Whether settings are currently being loaded */
export const settingsLoading = writable(false);

/** Error message if settings load failed */
export const settingsError = writable<string | null>(null);

/** Dependency check results */
export const dependencies = writable<DependencyStatus[]>([]);

/** Whether dependency check is in progress */
export const dependenciesLoading = writable(false);

/** Error message if dependency check failed */
export const dependenciesError = writable<string | null>(null);

/** Whether the wizard should be shown */
export const showWizard = derived(settings, ($settings) => {
  // Show wizard if settings not loaded yet or wizard not completed
  return $settings === null || !$settings.wizard_completed;
});

/** Whether all dependencies are satisfied */
export const allDependenciesSatisfied = derived(dependencies, ($deps) => {
  if ($deps.length === 0) return false;
  return $deps.every((d) => d.installed && d.versionOk);
});

/**
 * Loads settings from the backend.
 */
export async function loadSettings(): Promise<void> {
  settingsLoading.set(true);
  settingsError.set(null);

  try {
    const loadedSettings = await settingsApi.getSettings();
    settings.set(loadedSettings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    settingsError.set(message);
    console.error('Failed to load settings:', error);
  } finally {
    settingsLoading.set(false);
  }
}

/**
 * Saves settings to the backend.
 */
export async function saveSettings(newSettings: GlobalSettings): Promise<void> {
  settingsLoading.set(true);
  settingsError.set(null);

  try {
    await settingsApi.saveSettings(newSettings);
    settings.set(newSettings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    settingsError.set(message);
    console.error('Failed to save settings:', error);
    throw error;
  } finally {
    settingsLoading.set(false);
  }
}

/**
 * Checks all external dependencies.
 */
export async function checkDependencies(): Promise<DependencyStatus[]> {
  dependenciesLoading.set(true);
  dependenciesError.set(null);

  try {
    const deps = await settingsApi.checkDependencies();
    dependencies.set(deps);
    return deps;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dependenciesError.set(message);
    console.error('Failed to check dependencies:', error);
    return [];
  } finally {
    dependenciesLoading.set(false);
  }
}

/**
 * Completes the wizard with the given user settings.
 */
export async function completeWizard(
  userName: string,
  workflowStyle: 'QuickFlow' | 'FullBMM',
  ideCommand: string
): Promise<void> {
  const currentSettings = await settingsApi.getSettings();

  const newSettings: GlobalSettings = {
    ...currentSettings,
    wizard_completed: true,
    user: { name: userName },
    bmad: { default_workflow: workflowStyle },
    tools: { ide_command: ideCommand },
  };

  await saveSettings(newSettings);
}

/**
 * Resets the wizard so it shows again on next check.
 * Used to allow users to re-run the setup wizard.
 */
export async function resetWizard(): Promise<void> {
  const currentSettings = await settingsApi.getSettings();

  const newSettings: GlobalSettings = {
    ...currentSettings,
    wizard_completed: false,
  };

  await saveSettings(newSettings);
}
