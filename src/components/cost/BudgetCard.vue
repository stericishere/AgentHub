<script setup lang="ts">
import { computed } from 'vue';
import { formatTokens } from '../../utils/format-tokens';

const props = withDefaults(
  defineProps<{
    label: string;
    used: number;
    limit: number;
    pct: number;
    alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded';
    mode?: 'tokens' | 'usd';
  }>(),
  { mode: 'tokens' },
);

const barColor = computed(() => {
  switch (props.alertLevel) {
    case 'exceeded': return 'bg-danger';
    case 'critical': return 'bg-danger';
    case 'warning': return 'bg-warning';
    default: return 'bg-success';
  }
});

const textColor = computed(() => {
  switch (props.alertLevel) {
    case 'exceeded': return 'text-danger';
    case 'critical': return 'text-danger';
    case 'warning': return 'text-warning';
    default: return 'text-success';
  }
});

const clampedPct = computed(() => Math.min(props.pct, 100));

const formattedUsed = computed(() =>
  props.mode === 'tokens' ? formatTokens(props.used) : `$${props.used.toFixed(2)}`,
);

const formattedLimit = computed(() =>
  props.mode === 'tokens' ? formatTokens(props.limit) : `$${props.limit.toFixed(2)}`,
);
</script>

<template>
  <div class="rounded-xl border border-border-default bg-bg-card p-4">
    <div class="mb-2 flex items-center justify-between">
      <span class="text-xs font-medium text-text-secondary">{{ label }}</span>
      <span class="text-xs font-semibold" :class="textColor">
        {{ pct.toFixed(1) }}%
      </span>
    </div>
    <div class="mb-2 h-2 overflow-hidden rounded-full bg-bg-hover">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="barColor"
        :style="{ width: `${clampedPct}%` }"
      />
    </div>
    <div class="flex justify-between text-[11px] text-text-muted">
      <span>{{ formattedUsed }} 已使用</span>
      <span>{{ formattedLimit }} 上限</span>
    </div>
  </div>
</template>
