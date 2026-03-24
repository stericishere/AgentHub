<script setup lang="ts">
import { computed } from 'vue';
import BaseTag from '../common/BaseTag.vue';
import type { ProjectRecord, ProjectStats } from '../../stores/projects';
import { formatTokens } from '../../utils/format-tokens';

const props = defineProps<{
  project: ProjectRecord;
  stats: ProjectStats | null;
}>();

const statusLabel: Record<string, string> = {
  planning: '規劃中',
  active: '進行中',
  paused: '暫停',
  completed: '已完成',
  archived: '已封存',
};

const statusColor = computed((): 'purple' | 'green' | 'yellow' | 'red' | 'blue' => {
  const map: Record<string, 'purple' | 'green' | 'yellow' | 'red' | 'blue'> = {
    planning: 'blue',
    active: 'green',
    paused: 'yellow',
    completed: 'purple',
    archived: 'red',
  };
  return map[props.project.status] || 'purple';
});

const isCompleted = computed(() =>
  ['completed', 'archived'].includes(props.project.status),
);

const gateStatusColor = computed((): 'green' | 'yellow' | 'red' | 'blue' | 'purple' => {
  if (!props.stats?.latestGate) return 'purple';
  const map: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'purple'> = {
    approved: 'green',
    pending: 'yellow',
    rejected: 'red',
    submitted: 'blue',
  };
  return map[props.stats.latestGate.status] || 'purple';
});

const gateStatusLabel: Record<string, string> = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  submitted: 'Submitted',
};

function formatUsage(tokens: number): string {
  return formatTokens(tokens);
}

function formatDate(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '今日建立';
  if (diffDays === 1) return '昨日建立';
  if (diffDays < 14) return `${diffDays} 天前建立`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks} 週前建立`;
}

const sprintProgressLabel = computed(() => {
  if (!props.stats) return '';
  const s = props.stats.activeSprint;
  if (s) {
    return s.activeCount > 1 ? `${s.activeCount} 個 Sprint 總進度` : `${s.name} 進度`;
  }
  if (isCompleted.value) return '所有 Sprint 已完成';
  return '無進行中 Sprint';
});

const sprintProgressPct = computed(() => {
  if (!props.stats) return 0;
  if (props.stats.activeSprint) return props.stats.activeSprint.progressPct;
  if (isCompleted.value) return 100;
  return 0;
});

const sprintFooterText = computed(() => {
  if (!props.stats) return '';
  if (props.stats.activeSprint) return props.stats.activeSprint.name;
  if (isCompleted.value) return '所有 Sprint 已完成';
  return '尚無進行中 Sprint';
});
</script>

<template>
  <router-link
    :to="'/projects/' + project.id"
    class="block cursor-pointer rounded-xl border border-border-default bg-bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
    :class="{ 'opacity-70': isCompleted }"
  >
    <!-- Row 1: status tag (left) + creation date (right) -->
    <div class="mb-2.5 flex items-center gap-2">
      <BaseTag :color="statusColor">{{ statusLabel[project.status] }}</BaseTag>
      <span class="ml-auto text-[11px] text-text-muted">{{ formatDate(project.createdAt) }}</span>
    </div>

    <!-- Row 2: title + workDir -->
    <h3 class="mb-1 text-base font-semibold">{{ project.name }}</h3>
    <p v-if="project.workDir" class="mb-3 truncate text-[11px] text-text-muted" :title="project.workDir">
      {{ project.workDir }}
    </p>
    <div v-else class="mb-4" />

    <!-- Stats skeleton -->
    <template v-if="!stats">
      <div class="mb-4 grid grid-cols-3 gap-3">
        <div v-for="i in 3" :key="i" class="text-center">
          <div class="mx-auto mb-1 h-6 w-10 animate-pulse rounded bg-bg-hover" />
          <div class="mx-auto h-3 w-12 animate-pulse rounded bg-bg-hover" />
        </div>
      </div>
      <div class="mb-3">
        <div class="mb-1 h-3 w-24 animate-pulse rounded bg-bg-hover" />
        <div class="h-1.5 animate-pulse rounded-full bg-bg-hover" />
      </div>
      <div class="border-t border-border-default pt-3">
        <div class="h-4 w-32 animate-pulse rounded bg-bg-hover" />
      </div>
    </template>

    <!-- Stats data -->
    <template v-else>
      <!-- 3-column stats -->
      <div class="mb-4 grid grid-cols-3 gap-3">
        <div class="text-center">
          <div class="text-lg font-bold text-success">{{ stats.tasksDone }}</div>
          <div class="text-[10px] uppercase text-text-muted">已完成</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold text-warning">{{ stats.tasksInProgress }}</div>
          <div class="text-[10px] uppercase text-text-muted">進行中</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold text-accent-light">{{ formatUsage(stats.totalTokens) }}</div>
          <div class="text-[10px] uppercase text-text-muted">總用量</div>
        </div>
      </div>

      <!-- Sprint progress bar -->
      <div class="mb-3">
        <div class="mb-1 flex items-center justify-between text-[11px] text-text-muted">
          <span>{{ sprintProgressLabel }}</span>
          <span>{{ sprintProgressPct }}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-bg-hover">
          <div
            class="h-full rounded-full bg-success transition-all"
            :style="{ width: `${sprintProgressPct}%` }"
          />
        </div>
      </div>

      <!-- Footer: sprint name + gate tag -->
      <div class="flex items-center justify-between border-t border-border-default pt-3">
        <div class="text-xs">
          <template v-if="stats.activeSprint">
            <span class="text-text-muted">Sprint:</span>
            <span class="ml-1 font-medium">{{ stats.activeSprint.name }}</span>
          </template>
          <span v-else class="text-text-muted">{{ sprintFooterText }}</span>
        </div>
        <BaseTag v-if="stats.latestGate" :color="gateStatusColor">
          {{ stats.latestGate.type }} {{ gateStatusLabel[stats.latestGate.status] || stats.latestGate.status }}
        </BaseTag>
      </div>
    </template>
  </router-link>
</template>
