<script setup lang="ts">
import { computed } from 'vue';
import { formatTokens } from '../../utils/format-tokens';

const props = defineProps<{
  items: Array<{ label: string; tokens: number; costUsd?: number }>;
  color?: string;
}>();

const maxValue = computed(() => {
  if (props.items.length === 0) return 1;
  return Math.max(...props.items.map((i) => i.tokens), 1);
});

const barColor = computed(() => props.color || 'bg-accent');
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="item in items"
      :key="item.label"
      class="flex items-center gap-3"
    >
      <span class="w-24 truncate text-right text-xs text-text-secondary">
        {{ item.label }}
      </span>
      <div class="flex h-5 flex-1 items-center rounded-md bg-bg-hover">
        <div
          class="h-full rounded-md transition-all duration-300"
          :class="barColor"
          :style="{ width: `${Math.max((item.tokens / maxValue) * 100, 1)}%` }"
        />
      </div>
      <span class="w-16 text-right text-xs font-medium text-text-primary">
        {{ formatTokens(item.tokens) }}
      </span>
    </div>
    <div v-if="items.length === 0" class="py-4 text-center text-xs text-text-muted">
      尚無數據
    </div>
  </div>
</template>
