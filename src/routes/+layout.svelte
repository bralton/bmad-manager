<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { confirm } from '@tauri-apps/plugin-dialog';
  import { getCurrentWindow } from '@tauri-apps/api/window';

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

    return () => {
      unlisten.then((fn) => fn());
    };
  });
</script>

{@render children()}
