<script lang="ts">
  interface Props {
    icon: string;
    size?: 'sm' | 'md' | 'lg';
  }
  let { icon, size = 'md' }: Props = $props();

  const sizeClasses = {
    sm: 'text-lg w-6 h-6',
    md: 'text-2xl w-10 h-10',
    lg: 'text-3xl w-12 h-12'
  };
</script>

<div
  class="flex items-center justify-center rounded-full bg-gray-700 {sizeClasses[size]}"
  role="img"
  aria-label="Agent avatar"
>
  <span>{icon}</span>
</div>
