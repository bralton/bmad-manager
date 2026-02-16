<script lang="ts">
  import AgentRoster from '$lib/components/agents/AgentRoster.svelte';
</script>

<aside class="w-64 h-screen bg-gray-900 border-r border-gray-800 flex flex-col overflow-x-hidden">
  <div class="p-4 border-b border-gray-800">
    <h2 class="text-lg font-semibold text-gray-200">BMAD Manager</h2>
  </div>

  <nav class="flex-1 overflow-y-auto p-2">
    <AgentRoster />
  </nav>
</aside>
