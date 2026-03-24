<script setup lang="ts">
defineProps<{
  value: number;
  max?: number;
  color?: string;
}>();
</script>

<template>
  <div class="h-1 overflow-hidden rounded-sm bg-bg-hover">
    <div
      class="h-full rounded-sm transition-[width] duration-300"
      :class="color ?? 'bg-accent'"
      :style="{ width: `${Math.min((value / (max ?? 100)) * 100, 100)}%` }"
    />
  </div>
</template>
