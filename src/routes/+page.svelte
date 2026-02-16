<script lang="ts">
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import ProjectPicker from '$lib/components/project/ProjectPicker.svelte';
</script>

<div class="flex min-h-screen bg-gray-900 text-gray-100">
  <Sidebar />

  <main class="flex-1 p-8">
    <header class="mb-8">
      <h1 class="text-2xl font-bold">Welcome to BMAD Manager</h1>
    </header>

    <ProjectPicker />
  </main>
</div>
