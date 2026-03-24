<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import BaseButton from '../common/BaseButton.vue';
import BaseTag from '../common/BaseTag.vue';
import StatusDot from '../common/StatusDot.vue';
import type { TaskRecord, TaskStatus } from '../../stores/tasks';
import { useSessionsStore, type SessionRecord } from '../../stores/sessions';
import { useAgentsStore } from '../../stores/agents';
import { useProjectsStore } from '../../stores/projects';
import { formatTokens } from '../../utils/format-tokens';

const props = defineProps<{
  task: TaskRecord;
}>();

const emit = defineEmits<{
  close: [];
  transition: [taskId: string, toStatus: TaskStatus];
  delete: [taskId: string];
  launchSession: [taskId: string, agentId: string | null];
}>();

const sessionsStore = useSessionsStore();
const agentsStore = useAgentsStore();
const projectsStore = useProjectsStore();
const taskSessionsLoading = ref(false);

const sprintName = computed(() => {
  if (!props.task.sprintId) return null;
  const sprint = projectsStore.sprints.find((s) => s.id === props.task.sprintId);
  return sprint?.name ?? null;
});

// Load sessions when task changes
watch(
  () => props.task.id,
  async (taskId) => {
    if (taskId) {
      taskSessionsLoading.value = true;
      await sessionsStore.fetchByTask(taskId);
      taskSessionsLoading.value = false;
    }
  },
  { immediate: true },
);

const sessionStatusDot = (status: string) => {
  if (['thinking', 'starting'].includes(status)) return 'thinking';
  if (['running', 'executing_tool'].includes(status)) return 'running';
  if (status === 'failed') return 'error';
  return 'idle';
};

function formatSessionDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

const statusLabel: Record<string, string> = {
  created: '已建立',
  assigned: '已分配',
  in_progress: '進行中',
  in_review: '審查中',
  blocked: '被阻塞',
  rejected: '被拒絕',
  done: '完成',
};

const statusColor: Record<string, 'purple' | 'blue' | 'green' | 'yellow' | 'red'> = {
  created: 'purple',
  assigned: 'blue',
  in_progress: 'yellow',
  in_review: 'blue',
  blocked: 'red',
  rejected: 'red',
  done: 'green',
};

const availableTransitions = computed((): { status: TaskStatus; label: string }[] => {
  const map: Record<string, { status: TaskStatus; label: string }[]> = {
    created: [
      { status: 'assigned', label: '分配' },
      { status: 'rejected', label: '拒絕' },
    ],
    assigned: [
      { status: 'in_progress', label: '開始' },
      { status: 'rejected', label: '拒絕' },
    ],
    in_progress: [
      { status: 'in_review', label: '送審' },
      { status: 'blocked', label: '阻塞' },
    ],
    in_review: [
      { status: 'done', label: '完成' },
      { status: 'rejected', label: '退回' },
    ],
    blocked: [{ status: 'in_progress', label: '解除阻塞' }],
    rejected: [{ status: 'assigned', label: '重新分配' }],
    done: [],
  };
  return map[props.task.status] || [];
});

const priorityLabel: Record<string, string> = {
  critical: '緊急',
  high: '高',
  medium: '中',
  low: '低',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="flex h-full flex-col border-l border-border-default bg-bg-secondary">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border-default px-4 py-3">
      <h3 class="text-sm font-semibold">任務詳情</h3>
      <BaseButton variant="icon" size="sm" @click="emit('close')">✕</BaseButton>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-4">
      <h4 class="mb-2 text-base font-semibold">{{ task.title }}</h4>

      <div class="mb-4 flex flex-wrap gap-1.5">
        <BaseTag :color="statusColor[task.status]">
          {{ statusLabel[task.status] }}
        </BaseTag>
        <BaseTag :color="task.priority === 'critical' ? 'red' : task.priority === 'high' ? 'yellow' : 'blue'">
          {{ priorityLabel[task.priority] }}
        </BaseTag>
      </div>

      <div v-if="task.description" class="mb-4 whitespace-pre-wrap text-xs text-text-secondary">
        {{ task.description }}
      </div>

      <!-- Meta -->
      <div class="space-y-2 text-xs">
        <div v-if="sprintName" class="flex items-center justify-between">
          <span class="text-text-muted">Sprint</span>
          <span class="font-medium">{{ sprintName }}</span>
        </div>
        <div v-if="task.assignedTo" class="flex items-center justify-between">
          <span class="text-text-muted">指派給</span>
          <span class="font-medium">
            {{ agentsStore.agentIcon(task.assignedTo) }}
            {{ agentsStore.displayName(task.assignedTo) }}
          </span>
        </div>
        <div v-if="task.createdBy" class="flex items-center justify-between">
          <span class="text-text-muted">建立者</span>
          <span class="font-medium">{{ task.createdBy }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-text-muted">建立時間</span>
          <span>{{ formatDate(task.createdAt) }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-text-muted">更新時間</span>
          <span>{{ formatDate(task.updatedAt) }}</span>
        </div>
        <div v-if="task.dependsOn.length > 0" class="flex items-center justify-between">
          <span class="text-text-muted">依賴</span>
          <span>{{ task.dependsOn.length }} 項</span>
        </div>
      </div>

      <!-- Associated Sessions -->
      <div class="mt-6 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs font-semibold text-text-muted">關聯工作階段</div>
          <BaseButton
            variant="ghost"
            size="sm"
            @click="emit('launchSession', task.id, task.assignedTo)"
          >
            + 啟動
          </BaseButton>
        </div>
        <div v-if="taskSessionsLoading" class="py-2 text-center text-xs text-text-muted">
          載入中...
        </div>
        <div v-else-if="sessionsStore.taskSessions.length === 0" class="py-2 text-center text-xs text-text-muted">
          尚無關聯工作階段
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="s in sessionsStore.taskSessions"
            :key="s.id"
            class="flex items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-2.5 py-1.5 text-[11px]"
          >
            <StatusDot :status="sessionStatusDot(s.status)" />
            <span class="font-medium">{{ s.agent_id }}</span>
            <span class="ml-auto text-text-muted">{{ formatTokens((s.input_tokens || 0) + (s.output_tokens || 0)) }} tok</span>
            <span class="text-text-muted">{{ formatSessionDuration(s.duration_ms) }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="availableTransitions.length > 0" class="mt-6 space-y-2">
        <div class="text-xs font-semibold text-text-muted">狀態操作</div>
        <div class="flex flex-wrap gap-2">
          <BaseButton
            v-for="t in availableTransitions"
            :key="t.status"
            :variant="t.status === 'done' ? 'primary' : 'secondary'"
            size="sm"
            @click="emit('transition', task.id, t.status)"
          >
            {{ t.label }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-border-default px-4 py-3">
      <BaseButton variant="ghost" size="sm" class="text-danger" @click="emit('delete', task.id)">
        刪除任務
      </BaseButton>
    </div>
  </div>
</template>
