<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '../common/BaseButton.vue';
import BaseTag from '../common/BaseTag.vue';
import { useAgentsStore, type AgentDefinition } from '../../stores/agents';

const props = defineProps<{
  agent: AgentDefinition;
}>();

const emit = defineEmits<{
  launch: [agentId: string];
  detail: [agentId: string];
}>();

const agentsStore = useAgentsStore();

const colorMap: Record<string, string> = {
  green: 'green',
  blue: 'blue',
  purple: 'purple',
  yellow: 'yellow',
  red: 'red',
};

const tagColor = computed(() => colorMap[props.agent.color] || 'purple');

const modelLabel: Record<string, string> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};

const icon = computed(() => agentsStore.agentIcon(props.agent));

const avatarBg = computed(() => {
  const colors: Record<string, string> = {
    green: 'bg-success/20 text-success',
    blue: 'bg-info/20 text-info',
    purple: 'bg-accent/20 text-accent-light',
    yellow: 'bg-warning/20 text-warning',
    red: 'bg-danger/20 text-danger',
  };
  return colors[props.agent.color] || colors.purple;
});

const departmentLabel: Record<string, string> = {
  engineering: '工程部',
  design: '設計部',
  product: '產品部',
  marketing: '行銷部',
  testing: '測試部',
  'project-management': '專案管理',
  'studio-operations': '營運部',
  bonus: '特殊',
};
</script>

<template>
  <div
    class="group flex flex-col rounded-xl border border-border-default bg-bg-card p-4 transition-all duration-150 hover:border-border-light hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
  >
    <!-- Top: Avatar + Info -->
    <div class="mb-3 flex items-start gap-3">
      <div
        class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-xl"
        :class="avatarBg"
      >
        {{ icon }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold">{{ agentsStore.displayName(agent) }}</div>
        <div class="truncate text-[11px] text-text-muted/60">{{ agent.id }}</div>
        <div class="mt-0.5 line-clamp-2 text-xs text-text-muted">{{ agent.description }}</div>
      </div>
    </div>

    <!-- Tags -->
    <div class="mb-3 flex flex-wrap gap-1.5">
      <BaseTag :color="tagColor as any">{{ agent.level }}</BaseTag>
      <BaseTag>{{ departmentLabel[agent.department] || agent.department }}</BaseTag>
      <BaseTag :color="agent.model === 'opus' ? 'red' : agent.model === 'haiku' ? 'green' : 'blue'">
        {{ modelLabel[agent.model] || agent.model }}
      </BaseTag>
    </div>

    <!-- Actions -->
    <div class="mt-auto flex items-center gap-2">
      <BaseButton
        variant="primary"
        size="sm"
        class="flex-1"
        @click="emit('launch', agent.id)"
      >
        啟動
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('detail', agent.id)">
        詳情
      </BaseButton>
    </div>
  </div>
</template>
