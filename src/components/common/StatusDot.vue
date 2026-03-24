<script setup lang="ts">
defineProps<{
  status: 'running' | 'thinking' | 'idle' | 'error';
}>();
</script>

<template>
  <span
    class="inline-block h-2 w-2 rounded-full"
    :class="{
      'bg-success shadow-[0_0_8px_var(--color-success)] animate-pulse-glow': status === 'running',
      'bg-warning shadow-[0_0_8px_var(--color-warning)] animate-pulse-fast':
        status === 'thinking',
      'bg-text-muted': status === 'idle',
      'bg-danger': status === 'error',
    }"
  />
</template>
