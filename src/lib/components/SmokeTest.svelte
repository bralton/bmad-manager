<script lang="ts">
  let count: number = $state(0);
  const increment = (): void => { count += 1; };
</script>

<div class="p-4 bg-blue-500 text-white rounded-lg">
  <h1 class="text-xl font-bold">BMAD Manager</h1>
  <p>Scaffold working! Count: {count}</p>
  <button
    class="mt-2 px-4 py-2 bg-white text-blue-500 rounded hover:bg-gray-100"
    onclick={increment}
  >
    Increment
  </button>
</div>
