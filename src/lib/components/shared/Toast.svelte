<script lang="ts">
  import { toasts, dismissToast, type Toast } from '$lib/stores/ui';

  let activeToasts = $derived($toasts);
</script>

<!-- Toast container - fixed bottom-right, z-60 per UX spec -->
<div class="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
  {#each activeToasts as toast (toast.id)}
    <div
      class="bg-gray-800 text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-3
             pointer-events-auto animate-slide-in max-w-sm"
      role="alert"
      aria-live="polite"
    >
      {#if toast.icon}
        <span class="text-lg flex-shrink-0">{toast.icon}</span>
      {/if}
      <span class="text-sm">{toast.message}</span>
      <button
        onclick={() => dismissToast(toast.id)}
        class="ml-auto text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  {/each}
</div>

<style>
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .animate-slide-in {
    animation: slide-in 150ms ease-out;
  }
</style>
