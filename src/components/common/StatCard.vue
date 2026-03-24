<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  change?: string;
  changeColor?: 'green' | 'red' | 'blue' | 'muted';
}>();

const colorClass: Record<string, string> = {
  green: 'text-success',
  red: 'text-danger',
  blue: 'text-info',
  muted: 'text-text-muted',
};
</script>

<template>
  <div class="rounded-xl border border-border-default bg-bg-card p-5">
    <div class="text-xs uppercase tracking-wide text-text-muted">{{ label }}</div>
    <div class="mt-1.5 text-[28px] font-bold">{{ value }}</div>
    <div v-if="change" class="mt-1 flex items-center gap-1 text-xs" :class="colorClass[changeColor || 'green']">
      {{ change }}
    </div>
  </div>
</template>
