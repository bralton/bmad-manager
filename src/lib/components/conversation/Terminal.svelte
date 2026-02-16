<script lang="ts">
  import { onMount } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import '@xterm/xterm/css/xterm.css';

  import {
    defaultTerminalOptions,
    tryLoadWebGLAddon,
  } from '$lib/services/terminal';
  import {
    onSessionOutput,
    onSessionExited,
    sendSessionInput,
    resizeSession,
  } from '$lib/services/process';
  import { updateSessionStatus, markNewOutput } from '$lib/stores/sessions';

  interface Props {
    sessionId: string;
    visible?: boolean;
    onSessionExit?: (status: string, exitCode?: number) => void;
  }

  let { sessionId, visible = true, onSessionExit }: Props = $props();

  let terminalEl: HTMLDivElement | undefined = $state();
  let terminal: Terminal | null = $state(null);
  let fitAddon: FitAddon | null = $state(null);
  let initError: string | null = $state(null);

  // Handle visibility changes - fit terminal and focus when becoming visible
  $effect(() => {
    if (visible && terminal && fitAddon) {
      // Small delay to ensure DOM has updated visibility
      setTimeout(() => {
        fitAddon?.fit();
        terminal?.focus();
      }, 0);
    }
  });

  onMount(() => {
    if (!terminalEl) return;

    // Track mounted state to handle async cleanup race condition
    let isMounted = true;

    // Store cleanup functions (sync ones added immediately, async ones added when resolved)
    const cleanupFns: Array<() => void> = [];

    // Initialize terminal with error handling
    let term: Terminal;
    let fit: FitAddon;

    try {
      term = new Terminal(defaultTerminalOptions);
      fit = new FitAddon();

      term.loadAddon(fit);
      term.open(terminalEl);
      fit.fit();

      terminal = term;
      fitAddon = fit;
    } catch (error) {
      initError = error instanceof Error ? error.message : 'Failed to initialize terminal';
      return;
    }

    // Try to load WebGL addon for better performance
    tryLoadWebGLAddon(term);

    // Set up PTY output listener (handles async cleanup properly)
    onSessionOutput(sessionId, (data) => {
      term.write(data);
      markNewOutput(sessionId);
    }).then((unlisten) => {
      if (isMounted) {
        cleanupFns.push(unlisten);
      } else {
        // Component already unmounted, clean up immediately
        unlisten();
      }
    });

    // Set up session exit listener (handles async cleanup properly)
    onSessionExited(sessionId, (status, exitCode) => {
      updateSessionStatus(sessionId, status as 'completed' | 'interrupted');

      // Show exit status in terminal
      const exitMessage =
        exitCode !== undefined
          ? `\r\n\x1b[90m--- Session exited with code ${exitCode} ---\x1b[0m\r\n`
          : `\r\n\x1b[90m--- Session ${status} ---\x1b[0m\r\n`;
      term.write(exitMessage);

      onSessionExit?.(status, exitCode);
    }).then((unlisten) => {
      if (isMounted) {
        cleanupFns.push(unlisten);
      } else {
        // Component already unmounted, clean up immediately
        unlisten();
      }
    });

    // Set up terminal input handler
    const inputDisposable = term.onData((data) => {
      sendSessionInput(sessionId, data);
    });
    cleanupFns.push(() => inputDisposable.dispose());

    // Set up resize observer with debouncing
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (fit && term && visible) {
          fit.fit();
          resizeSession(sessionId, term.rows, term.cols);
        }
      }, 100);
    });

    resizeObserver.observe(terminalEl);
    cleanupFns.push(() => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    });

    // Initial resize notification to backend
    resizeSession(sessionId, term.rows, term.cols);

    // Cleanup on destroy
    return () => {
      isMounted = false;
      for (const cleanup of cleanupFns) {
        cleanup();
      }
      term.dispose();
    };
  });
</script>

<div class="terminal-container h-full w-full bg-[#1a1a2e]">
  {#if initError}
    <div class="flex items-center justify-center h-full text-red-400">
      <p>Failed to initialize terminal: {initError}</p>
    </div>
  {:else}
    <div bind:this={terminalEl} class="h-full w-full"></div>
  {/if}
</div>

<style>
  .terminal-container :global(.xterm) {
    height: 100%;
    padding: 8px;
  }

  .terminal-container :global(.xterm-viewport) {
    overflow-y: auto;
  }
</style>
