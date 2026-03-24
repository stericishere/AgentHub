<script setup lang="ts">
import { computed } from 'vue';
import StatusDot from '../common/StatusDot.vue';
import SessionTerminal from './SessionTerminal.vue';
import type { ActiveSession } from '../../stores/sessions';
import { useTasksStore } from '../../stores/tasks';
import { formatTokens } from '../../utils/format-tokens';

const props = defineProps<{
  session: ActiveSession;
  selected?: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  select: [sessionId: string];
  stop: [sessionId: string];
  remix: [session: ActiveSession];
  openDiff: [session: ActiveSession];
  navigateToTask: [taskId: string];
  delegation: [session: ActiveSession];
  assignTask: [session: ActiveSession];
  requestSummary: [session: ActiveSession];
}>();

const tasksStore = useTasksStore();

const linkedTask = computed(() => {
  if (!props.session.taskId) return null;
  return tasksStore.tasks.find((t) => t.id === props.session.taskId) || null;
});

const statusLabel: Record<string, string> = {
  starting: '啟動中',
  running: '執行中',
  thinking: '思考中',
  executing_tool: '執行工具',
  awaiting_approval: '等待核准',
  waiting_input: '等待輸入',
  summarizing: '產生摘要中...',
  completed: '已完成',
  failed: '失敗',
  stopped: '已停止',
};

const statusDotMapping = computed(() => {
  const s = props.session.status;
  if (s === 'thinking' || s === 'starting') return 'thinking';
  if (s === 'running' || s === 'executing_tool') return 'running';
  if (s === 'summarizing') return 'thinking';
  if (s === 'failed') return 'error';
  if (s === 'completed' || s === 'stopped') return 'idle';
  return 'thinking';
});

const isSummarizing = computed(() => props.session.status === 'summarizing');

const formattedTokens = computed(() => {
  return formatTokens(props.session.inputTokens + props.session.outputTokens);
});

const formattedDuration = computed(() => {
  const ms = props.session.durationMs;
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
});

const isRunning = computed(() => {
  return !['completed', 'failed', 'stopped'].includes(props.session.status);
});
</script>

<template>
  <div
    class="flex flex-col overflow-hidden rounded-xl border transition-all duration-150"
    :class="[
      selected
        ? 'border-accent shadow-[0_0_20px_rgba(108,92,231,0.15)]'
        : 'border-border-default hover:border-border-light',
      'bg-bg-card',
    ]"
    @click="emit('select', session.sessionId)"
  >
    <!-- Header -->
    <div class="flex items-center gap-2.5 border-b border-border-default px-4 py-2.5">
      <StatusDot :status="statusDotMapping" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span class="text-sm font-medium">{{ session.agentName }}</span>
          <span class="text-xs text-text-muted">{{ session.task }}</span>
          <span
            v-if="linkedTask"
            class="flex flex-shrink-0 cursor-pointer items-center gap-1 text-[11px] text-accent-light hover:underline"
            @click.stop="emit('navigateToTask', linkedTask.id)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
            {{ linkedTask.title }}
          </span>
        </div>
      </div>
      <span class="rounded-md bg-bg-hover px-2 py-0.5 text-[11px] font-medium text-text-muted uppercase">
        {{ session.model }}
      </span>
      <button
        v-if="isRunning"
        class="flex h-6 cursor-pointer items-center justify-center gap-1 rounded border-none bg-transparent px-1.5 text-xs text-text-muted hover:bg-danger/20 hover:text-danger"
        :title="isSummarizing ? '強制停止' : '停止'"
        @click.stop="emit('stop', session.sessionId)"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10" rx="1"/></svg>
        <span v-if="isSummarizing" class="text-[10px]">強制</span>
      </button>
      <button
        v-if="!isRunning"
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-xs text-text-muted hover:bg-accent/20 hover:text-accent-light"
        title="重新執行"
        @click.stop="emit('remix', session)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      </button>
      <button
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-xs text-text-muted hover:bg-info/20 hover:text-info"
        title="檢視差異"
        @click.stop="emit('openDiff', session)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M3 12h18"/><path d="M3 6h6"/><path d="M3 18h6"/><path d="M15 6h6"/><path d="M15 18h6"/></svg>
      </button>
    </div>

    <!-- Terminal (mini view) -->
    <div v-if="!compact" class="min-h-[160px] flex-1 shrink-0 bg-bg-primary">
      <SessionTerminal :pty-id="session.ptyId" :active="selected" />
    </div>

    <!-- Footer stats -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-default px-4 py-2 text-[11px] text-text-muted">
      <span>{{ statusLabel[session.status] || session.status }}</span>
      <span class="font-medium text-text-secondary">{{ formattedTokens }} tok</span>
      <span>T{{ session.turnsCount }}</span>
      <span>{{ formattedDuration }}</span>
      <div v-if="session.projectId && isRunning" class="ml-auto flex items-center gap-1.5">
        <button
          class="cursor-pointer rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-light transition-colors hover:bg-accent/20"
          @click.stop="emit('delegation', session)"
        >
          傳送指令
        </button>
        <button
          class="cursor-pointer rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-light transition-colors hover:bg-accent/20"
          @click.stop="emit('assignTask', session)"
        >
          指派任務
        </button>
      </div>
      <button
        class="ml-auto cursor-pointer rounded-md border border-border-default bg-transparent px-2 py-0.5 text-[11px] font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-accent-light"
        :class="{ 'ml-0': session.projectId && isRunning }"
        title="手動觸發摘要"
        @click.stop="emit('requestSummary', session)"
      >
        摘要
      </button>
    </div>
  </div>
</template>
