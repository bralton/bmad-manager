<script lang="ts">
  import type { EmptyStateIcon } from '$lib/types/empty-state';
  // Re-export for backward compatibility
  export type { EmptyStateIcon };

  let {
    icon,
    title,
    description,
    secondaryDescription,
    actionLabel,
    onAction,
  }: {
    icon?: EmptyStateIcon;
    title: string;
    description: string;
    secondaryDescription?: string;
    actionLabel?: string;
    onAction?: () => void;
  } = $props();
</script>

<div
  role="status"
  aria-label={title}
  class="flex flex-col items-center justify-center py-12 px-4 text-center"
>
  {#if icon}
    <svg
      class="w-12 h-12 text-gray-600 mb-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {#if icon === 'chat'}
        <!-- Chat bubble with clock icon -->
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      {:else if icon === 'clipboard'}
        <!-- Clipboard/list icon -->
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      {:else if icon === 'search'}
        <!-- Search icon with X -->
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      {:else if icon === 'person'}
        <!-- Person icon with question mark -->
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      {:else if icon === 'workflow'}
        <!-- Workflow/flow icon -->
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
        />
      {:else if icon === 'document'}
        <!-- Document icon -->
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      {:else if icon === 'branch'}
        <!-- Git branch icon -->
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M7 3v12m0 0a3 3 0 103 3m-3-3a3 3 0 01-3 3m14-8a3 3 0 11-6 0 3 3 0 016 0zm-6 0v7m0 0a3 3 0 01-3 3"
        />
      {/if}
    </svg>
  {/if}

  <h3 class="text-lg font-medium text-gray-300 mb-2">{title}</h3>

  <p class="text-sm text-gray-500 max-w-sm mb-4">{description}</p>

  {#if secondaryDescription}
    <p class="text-xs text-gray-600 max-w-xs">{secondaryDescription}</p>
  {/if}

  {#if actionLabel && onAction}
    <button
      onclick={onAction}
      class="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
    >
      {actionLabel}
    </button>
  {/if}
</div>
