<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { confirm } from '@tauri-apps/plugin-dialog';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { currentProject } from '$lib/stores/project';
  import type { Project } from '$lib/types/project';

  let { children } = $props();

  onMount(() => {
    // Listen for close warning events from the backend
    const unlisten = listen<{ activeSessionCount: number }>('close-warning', async (event) => {
      const { activeSessionCount } = event.payload;

      const sessionText = activeSessionCount === 1 ? 'session' : 'sessions';
      const shouldClose = await confirm(
        `You have ${activeSessionCount} active ${sessionText}. They will be interrupted if you close the app.\n\nContinue?`,
        { title: 'Active Sessions', kind: 'warning' }
      );

      if (shouldClose) {
        // Force close the window
        await getCurrentWindow().destroy();
      }
    });

    // E2E testing hook: Listen for custom event to set project directly
    // This bypasses the native file dialog which cannot be automated
    // Safe to enable always - the event handler only updates the store,
    // which is the same effect as selecting a folder via the UI
    const handleE2ESetProject = (event: CustomEvent<Project>) => {
      currentProject.set(event.detail);
    };
    window.addEventListener('e2e-set-project', handleE2ESetProject as EventListener);
    const cleanupE2EHook = () => {
      window.removeEventListener('e2e-set-project', handleE2ESetProject as EventListener);
    };

    return () => {
      unlisten.then((fn) => fn());
      cleanupE2EHook?.();
    };
  });
</script>

{@render children()}
