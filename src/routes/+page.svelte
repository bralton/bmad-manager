<script lang="ts">
  import SmokeTest from '$lib/components/SmokeTest.svelte';
  import ProjectPicker from '$lib/components/project/ProjectPicker.svelte';
</script>

<main class="min-h-screen bg-gray-900 text-gray-100">
  <div class="container mx-auto py-8">
    <header class="mb-8">
      <h1 class="text-2xl font-bold text-center">BMAD Manager</h1>
    </header>

    <ProjectPicker />

    <div class="mt-8 flex justify-center">
      <SmokeTest />
    </div>
  </div>
</main>
