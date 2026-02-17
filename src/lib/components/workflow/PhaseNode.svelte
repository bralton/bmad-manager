<script lang="ts">
  import type { Phase, ActiveWorkflow } from '$lib/types/workflow';
  import { PHASE_LABELS, getTotalSteps } from '$lib/constants/workflow';

  interface Props {
    phase: Phase;
    status: 'completed' | 'active' | 'pending';
    activeWorkflow?: ActiveWorkflow;
    onClick?: () => void;
  }

  let { phase, status, activeWorkflow, onClick }: Props = $props();

  // Derived values
  let label = $derived(PHASE_LABELS[phase] ?? phase);

  let totalSteps = $derived(
    activeWorkflow ? getTotalSteps(activeWorkflow.workflowType) : 0
  );

  let completedSteps = $derived(
    activeWorkflow ? activeWorkflow.stepsCompleted.length : 0
  );

  let progress = $derived(
    totalSteps > 0 ? completedSteps / totalSteps : 0
  );

  // SVG progress ring calculations
  const radius = 16;
  const circumference = 2 * Math.PI * radius; // ~100.53

  let strokeDasharray = $derived(
    `${progress * circumference} ${circumference}`
  );

  // Status label for accessibility
  let statusLabel = $derived((): string => {
    if (status === 'completed') {
      return `${label} phase, completed`;
    }
    if (status === 'active' && activeWorkflow) {
      return `${label} phase, ${completedSteps} of ${totalSteps} steps complete`;
    }
    if (status === 'active') {
      return `${label} phase, active`;
    }
    return `${label} phase, pending`;
  });

  function handleClick() {
    if (status !== 'pending' && onClick) {
      onClick();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && status !== 'pending') {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<div class="flex flex-col items-center gap-1">
  <!-- Phase Node Circle -->
  <button
    type="button"
    onclick={handleClick}
    onkeydown={handleKeyDown}
    disabled={status === 'pending'}
    class="relative w-10 h-10 rounded-full flex items-center justify-center
           transition-transform duration-150 ease-out
           focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
           {status === 'completed'
             ? 'bg-green-500 border-2 border-green-500 hover:scale-105 cursor-pointer'
             : status === 'active'
               ? 'bg-blue-100 border-2 border-blue-500 hover:scale-105 cursor-pointer'
               : 'bg-white border-2 border-gray-300 cursor-not-allowed'}"
    aria-label={statusLabel()}
  >
    {#if status === 'completed'}
      <!-- Checkmark icon for completed -->
      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
      </svg>
    {:else if status === 'active'}
      <!-- Progress ring for active -->
      <svg class="absolute w-10 h-10" viewBox="0 0 40 40">
        <!-- Background ring -->
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          stroke-width="3"
        />
        <!-- Progress ring -->
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="#3b82f6"
          stroke-width="3"
          stroke-dasharray={strokeDasharray}
          stroke-dashoffset={circumference * 0.25}
          stroke-linecap="round"
          transform="rotate(-90 20 20)"
          class="transition-all duration-200 ease-out"
        />
      </svg>
      <!-- Step count in center -->
      {#if activeWorkflow}
        <span class="relative z-10 text-xs font-bold text-blue-700">
          {completedSteps}/{totalSteps}
        </span>
      {/if}
    {:else}
      <!-- Empty for pending -->
    {/if}
  </button>

  <!-- Phase Label -->
  <span
    class="text-xs font-medium
           {status === 'completed'
             ? 'text-green-700'
             : status === 'active'
               ? 'text-blue-700 font-bold'
               : 'text-gray-400'}"
  >
    {label}
  </span>

  <!-- Status indicator -->
  <span
    class="text-[10px]
           {status === 'completed'
             ? 'text-green-600'
             : status === 'active'
               ? 'text-blue-600'
               : 'text-gray-400'}"
  >
    {#if status === 'completed'}
      Completed
    {:else if status === 'active'}
      Active
    {:else}
      -
    {/if}
  </span>
</div>
