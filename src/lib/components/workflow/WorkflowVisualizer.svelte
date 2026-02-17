<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { Phase, WorkflowState, ArtifactMeta } from '$lib/types/workflow';
  import PhaseNode from './PhaseNode.svelte';
  import ActiveWorkflowPanel from './ActiveWorkflowPanel.svelte';

  interface Props {
    workflowState: WorkflowState;
  }

  let { workflowState }: Props = $props();

  // Track which phase panel is expanded (only one at a time)
  let expandedPhase: Phase | null = $state(null);

  // All phases in order
  const phases: Phase[] = ['discovery', 'planning', 'solutioning', 'implementation'];

  // Phase order for comparison
  const phaseOrder: Phase[] = ['discovery', 'planning', 'solutioning', 'implementation'];

  /**
   * Determine the status of a phase based on current workflow state.
   */
  function getPhaseStatus(phase: Phase): 'completed' | 'active' | 'pending' {
    if (workflowState.currentPhase === 'not-started') {
      return 'pending';
    }

    const currentIndex = phaseOrder.indexOf(workflowState.currentPhase as Phase);
    const phaseIndex = phaseOrder.indexOf(phase);

    if (phaseIndex < currentIndex) {
      return 'completed';
    }
    if (phaseIndex === currentIndex) {
      return 'active';
    }
    return 'pending';
  }

  /**
   * Get artifacts that belong to a specific phase.
   */
  function getArtifactsForPhase(phase: Phase): ArtifactMeta[] {
    // Map workflow types to phases (excluding 'not-started' which has no artifacts)
    const phaseWorkflowTypes: Record<string, string[]> = {
      'discovery': ['product-brief'],
      'planning': ['prd'],
      'solutioning': ['ux-design', 'tech-spec', 'architecture'],
      'implementation': ['create-story', 'dev-story', 'sprint-planning'],
    };

    const workflowTypes = phaseWorkflowTypes[phase] || [];
    return workflowState.completedArtifacts.filter(
      (artifact) => workflowTypes.includes(artifact.workflowType.toLowerCase())
    );
  }

  /**
   * Handle click on a phase node.
   */
  function handlePhaseClick(phase: Phase) {
    const status = getPhaseStatus(phase);
    if (status === 'pending') {
      return; // Do nothing for pending phases
    }

    // Toggle expanded phase (collapse if clicking same phase)
    if (expandedPhase === phase) {
      expandedPhase = null;
    } else {
      expandedPhase = phase;
    }
  }

  /**
   * Close the expanded panel.
   */
  function handleClosePanel() {
    expandedPhase = null;
  }

  // Derived: get active workflow for the expanded phase
  let expandedPhaseActiveWorkflow = $derived(
    expandedPhase && workflowState.currentPhase === expandedPhase
      ? workflowState.activeWorkflow
      : undefined
  );

  let expandedPhaseArtifacts = $derived(
    expandedPhase ? getArtifactsForPhase(expandedPhase) : []
  );
</script>

<div class="w-full">
  <!-- Phase Nodes Row -->
  <div
    class="px-4 py-4 flex items-center justify-center gap-2
           flex-col md:flex-row md:h-20"
  >
    {#each phases as phase, index}
      <!-- Connector line (before node, except first) -->
      {#if index > 0}
        <div
          class="hidden md:block h-0.5 w-8 flex-shrink-0 bg-gray-300
                 md:w-12 lg:w-16"
        ></div>
        <div
          class="md:hidden w-0.5 h-4 flex-shrink-0 bg-gray-300"
        ></div>
      {/if}

      <PhaseNode
        {phase}
        status={getPhaseStatus(phase)}
        activeWorkflow={workflowState.currentPhase === phase ? workflowState.activeWorkflow : undefined}
        onClick={() => handlePhaseClick(phase)}
      />
    {/each}
  </div>

  <!-- Expanded Panel -->
  {#if expandedPhase}
    <div transition:slide={{ duration: 300 }}>
      <ActiveWorkflowPanel
        phase={expandedPhase}
        activeWorkflow={expandedPhaseActiveWorkflow}
        artifacts={expandedPhaseArtifacts}
        onClose={handleClosePanel}
      />
    </div>
  {/if}
</div>
