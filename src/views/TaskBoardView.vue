<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTasksStore, type TaskStatus } from '../stores/tasks';
import { useProjectsStore } from '../stores/projects';
import { useAgentsStore } from '../stores/agents';
import { useUiStore } from '../stores/ui';
import KanbanColumn from '../components/task/KanbanColumn.vue';
import BaseButton from '../components/common/BaseButton.vue';

const router = useRouter();
const tasksStore = useTasksStore();
const projectsStore = useProjectsStore();
const agentsStore = useAgentsStore();
const uiStore = useUiStore();

const selectedProjectId = ref<string | null>(null);
const selectedSprintId = ref<string | null>(null);

const showCreateModal = ref(false);
const newTitle = ref('');
const newDescription = ref('');
const newPriority = ref<'low' | 'medium' | 'high' | 'critical'>('medium');
const newAssignedTo = ref('');

// ── Drag & Drop state ────────────────────────────────────────────────────────

/** Mirrors the backend VALID_TRANSITIONS from task-manager.ts */
const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ['assigned', 'rejected'],
  assigned: ['in_progress', 'rejected'],
  in_progress: ['in_review', 'blocked'],
  in_review: ['done', 'rejected'],
  blocked: ['in_progress'],
  rejected: ['assigned'],
  done: [],
};

/** Chinese labels for status values used in toast messages */
const STATUS_LABELS: Record<string, string> = {
  created: '建立',
  assigned: '已分配',
  in_progress: '進行中',
  in_review: '審查中',
  blocked: '已阻塞',
  rejected: '已拒絕',
  done: '完成',
};

/** The status of the task currently being dragged, or null when not dragging */
const dragSourceStatus = ref<string | null>(null);

function isValidTransition(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return false;
  return (VALID_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

function handleCardDragStart(payload: { taskId: string; fromStatus: string }) {
  dragSourceStatus.value = payload.fromStatus;
}

function handleDragEnd() {
  dragSourceStatus.value = null;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (agentsStore.agents.length === 0) await agentsStore.fetchAll();
  if (projectsStore.projects.length === 0) await projectsStore.fetchAll();
  if (projectsStore.projects.length > 0 && !selectedProjectId.value) {
    selectedProjectId.value = projectsStore.projects[0].id;
  }
});

// 選專案 → 載入 Sprints → 自動選 active sprint
watch(selectedProjectId, async (id) => {
  selectedSprintId.value = null;
  if (id) {
    await projectsStore.fetchSprints(id);
    const active = projectsStore.sprints.find((s) => s.status === 'active');
    selectedSprintId.value = active?.id ?? projectsStore.sprints[0]?.id ?? null;
  }
});

// 選 Sprint → 設定 context + refetch
watch(selectedSprintId, async (sprintId) => {
  if (selectedProjectId.value) {
    tasksStore.setContext(selectedProjectId.value, sprintId);
    await tasksStore.fetchTasks();
    await tasksStore.fetchSessionCounts();
  }
});

const hasProject = computed(() => projectsStore.projects.length > 0);

async function handleDrop(taskId: string, toStatus: string) {
  // Find source status: prefer dragSourceStatus, fall back to store lookup
  const task = tasksStore.tasks.find((t) => t.id === taskId);
  const fromStatus = dragSourceStatus.value ?? task?.status ?? '';

  if (fromStatus && !isValidTransition(fromStatus, toStatus)) {
    const fromLabel = STATUS_LABELS[fromStatus] ?? fromStatus;
    const toLabel = STATUS_LABELS[toStatus] ?? toStatus;
    uiStore.addToast(
      `無法從「${fromLabel}」移動到「${toLabel}」，此狀態轉換不被允許。`,
      'warning',
      '狀態轉換無效',
    );
    dragSourceStatus.value = null;
    return;
  }

  dragSourceStatus.value = null;

  try {
    await tasksStore.transition(taskId, toStatus as TaskStatus);
  } catch (e: any) {
    console.error('Transition failed', e);
    uiStore.addToast(
      `無法轉換狀態：${e.message || e}`,
      'error',
      '操作失敗',
    );
  }
}

async function handleCreateTask() {
  if (!newTitle.value.trim() || !selectedProjectId.value) return;

  await tasksStore.create({
    projectId: selectedProjectId.value,
    title: newTitle.value.trim(),
    description: newDescription.value.trim() || undefined,
    priority: newPriority.value,
    assignedTo: newAssignedTo.value || undefined,
    sprintId: selectedSprintId.value || undefined,
  });

  newTitle.value = '';
  newDescription.value = '';
  newPriority.value = 'medium';
  newAssignedTo.value = '';
  showCreateModal.value = false;
}

function switchProject(projectId: string) {
  selectedProjectId.value = projectId;
}

const currentSprintName = computed(() => {
  if (!selectedSprintId.value) return null;
  const sprint = projectsStore.sprints.find((s) => s.id === selectedSprintId.value);
  return sprint?.name ?? null;
});
</script>

<template>
  <div class="flex h-full flex-col" @dragend="handleDragEnd">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-semibold">任務看板</h2>
        <select
          v-if="hasProject"
          class="rounded-lg border border-border-default bg-bg-secondary px-3 py-1.5 text-xs text-text-primary"
          :value="selectedProjectId || ''"
          @change="switchProject(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in projectsStore.projects" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <select
          v-if="hasProject && projectsStore.sprints.length > 0"
          class="rounded-lg border border-border-default bg-bg-secondary px-3 py-1.5 text-xs text-text-primary"
          :value="selectedSprintId || ''"
          @change="selectedSprintId = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">全部 Sprint</option>
          <option v-for="s in projectsStore.sprints" :key="s.id" :value="s.id">
            {{ s.name }}{{ s.status === 'active' ? ' (進行中)' : '' }}
          </option>
        </select>
        <span v-if="tasksStore.totalCount > 0" class="text-xs text-text-muted">
          {{ tasksStore.doneCount }}/{{ tasksStore.totalCount }} 完成
        </span>
      </div>
      <BaseButton v-if="hasProject" variant="primary" size="sm" @click="showCreateModal = true">
        新增任務
      </BaseButton>
    </div>

    <!-- No project -->
    <div
      v-if="!hasProject"
      class="flex flex-1 items-center justify-center rounded-xl border border-border-default bg-bg-card text-sm text-text-muted"
    >
      請先建立專案
    </div>

    <!-- Kanban -->
    <div v-else class="flex flex-1 gap-3 overflow-x-auto pb-2">
      <KanbanColumn
        v-for="col in tasksStore.columns"
        :key="col.key"
        :label="col.label"
        :status="col.key"
        :tasks="tasksStore.tasksByStatus[col.key] || []"
        :drag-source-status="dragSourceStatus"
        :is-valid-target="
          dragSourceStatus != null
            ? isValidTransition(dragSourceStatus, col.key)
            : undefined
        "
        @drop="handleDrop"
        @task-click="router.push('/tasks/' + $event)"
        @card-dragstart="handleCardDragStart"
      />
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showCreateModal = false"
      >
        <div class="w-[480px] rounded-xl border border-border-default bg-bg-secondary p-6">
          <h3 class="mb-4 text-base font-semibold">新增任務</h3>

          <div class="mb-3">
            <label class="mb-1 block text-xs text-text-muted">標題</label>
            <input
              v-model="newTitle"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="任務標題"
              @keydown.enter="handleCreateTask"
            />
          </div>

          <div class="mb-3">
            <label class="mb-1 block text-xs text-text-muted">描述</label>
            <textarea
              v-model="newDescription"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              rows="3"
              placeholder="任務描述（選填）"
            />
          </div>

          <div v-if="currentSprintName" class="mb-3">
            <label class="mb-1 block text-xs text-text-muted">Sprint</label>
            <div class="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-muted">
              {{ currentSprintName }}
            </div>
          </div>

          <div class="mb-3 flex gap-3">
            <div class="flex-1">
              <label class="mb-1 block text-xs text-text-muted">優先級</label>
              <select
                v-model="newPriority"
                class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="critical">緊急</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="mb-1 block text-xs text-text-muted">指派 Agent</label>
              <select
                v-model="newAssignedTo"
                class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary"
              >
                <option value="">不指派</option>
                <optgroup
                  v-for="[dept, deptAgents] in agentsStore.agentsByDepartment"
                  :key="dept"
                  :label="dept"
                >
                  <option v-for="a in deptAgents" :key="a.id" :value="a.id">
                    {{ agentsStore.agentIcon(a) }} {{ agentsStore.displayName(a) }} ({{ a.id }})
                  </option>
                </optgroup>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <BaseButton variant="ghost" size="sm" @click="showCreateModal = false">取消</BaseButton>
            <BaseButton variant="primary" size="sm" @click="handleCreateTask">建立</BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
