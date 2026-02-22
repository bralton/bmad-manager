<script lang="ts">
  import { toasts, dismissToast, type Toast } from '$lib/stores/ui';

  let activeToasts = $derived($toasts);

  function getVariantClasses(toast: Toast): string {
    switch (toast.variant) {
      case 'success':
        return 'border-l-4 border-green-500';
      case 'error':
        return 'border-l-4 border-red-500';
      default:
        return 'border-l-4 border-blue-500';
    }
  }
</script>

<!-- Toast container - fixed bottom-right, z-60 per UX spec -->
<div class="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
  {#each activeToasts as toast (toast.id)}
    <div
      class="bg-gray-800 text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-3
             pointer-events-auto animate-slide-in max-w-sm {getVariantClasses(toast)}"
      role="alert"
      aria-live="polite"
    >
      {#if toast.icon}
        <span class="text-lg flex-shrink-0">{toast.icon}</span>
      {/if}
      <span class="text-sm flex-1">{toast.message}</span>
      {#if toast.secondaryAction}
        <button
          onclick={() => {
            toast.secondaryAction?.onClick();
            dismissToast(toast.id);
          }}
          class="text-sm text-gray-400 hover:text-gray-300 font-medium transition-colors whitespace-nowrap"
        >
          {toast.secondaryAction.label}
        </button>
      {/if}
      {#if toast.action}
        <button
          onclick={() => {
            toast.action?.onClick();
            dismissToast(toast.id);
          }}
          class="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors whitespace-nowrap"
        >
          {toast.action.label}
        </button>
      {/if}
      <button
        onclick={() => dismissToast(toast.id)}
        class="text-gray-400 hover:text-white transition-colors flex-shrink-0"
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
