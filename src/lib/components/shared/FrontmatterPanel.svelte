<script lang="ts">
  let {
    content,
  }: {
    content: string;
  } = $props();

  let isCollapsed = $state(true);

  // Extract frontmatter from content
  let frontmatter = $derived.by(() => {
    if (!content.startsWith('---')) {
      return null;
    }

    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) {
      return null;
    }

    const yaml = content.slice(3, endIndex).trim();
    return yaml;
  });

  // Parse frontmatter lines for display
  let frontmatterLines = $derived.by(() => {
    if (!frontmatter) return [];

    return frontmatter.split('\n').map((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        return { key: line, value: '' };
      }
      return {
        key: line.slice(0, colonIndex).trim(),
        value: line.slice(colonIndex + 1).trim(),
      };
    }).filter((item) => item.key);
  });

  function toggle() {
    isCollapsed = !isCollapsed;
  }
</script>

{#if frontmatter}
  <div class="border border-gray-700 rounded-lg overflow-hidden mb-4">
    <button
      onclick={toggle}
      class="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 text-sm text-gray-300"
    >
      <span class="font-medium">Frontmatter</span>
      <svg
        class="w-4 h-4 text-gray-500 transition-transform {isCollapsed ? '' : 'rotate-180'}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {#if !isCollapsed}
      <div class="px-3 py-2 bg-gray-850 border-t border-gray-700">
        <table class="w-full text-xs">
          <tbody>
            {#each frontmatterLines as { key, value }}
              <tr>
                <td class="py-1 pr-3 text-gray-500 font-mono whitespace-nowrap align-top">{key}:</td>
                <td class="py-1 text-gray-300 font-mono break-all">{value}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{/if}

<style>
  .bg-gray-850 {
    background-color: rgb(26, 32, 44);
  }
</style>
