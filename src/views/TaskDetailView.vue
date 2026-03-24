<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useIpc } from '../composables/useIpc';
import { useTasksStore, type TaskRecord, type TaskStatus } from '../stores/tasks';
import { useSessionsStore, type SessionRecord } from '../stores/sessions';
import { useAgentsStore } from '../stores/agents';
import { useProjectsStore } from '../stores/projects';
import { formatTokens } from '../utils/format-tokens';
import { useGitStore, type DiffEntry } from '../stores/git';
import BaseButton from '../components/common/BaseButton.vue';
import BaseTag from '../components/common/BaseTag.vue';
import SessionLauncher from '../components/session/SessionLauncher.vue';

const route = useRoute();
const router = useRouter();
const tasksStore = useTasksStore();
const sessionsStore = useSessionsStore();
const agentsStore = useAgentsStore();
const projectsStore = useProjectsStore();

const gitStore = useGitStore();

const ipc = useIpc();

const task = ref<TaskRecord | null>(null);
const loading = ref(true);
const taskSessions = ref<SessionRecord[]>([]);
const summaries = ref<Array<{ content: string; createdAt: string }>>([]);
const summariesExpanded = ref(false);

// Git section state
const gitExpanded = ref(false);
const gitLoading = ref(false);
const commitMessage = ref('');
const gitPushing = ref(false);
const gitCommitting = ref(false);
const gitStaging = ref(false);
const gitSuccess = ref('');
const gitError = ref('');

// Inline editing state
const editingTitle = ref(false);
const editTitle = ref('');
const editingDescription = ref(false);
const editDescription = ref('');
const editingEstimated = ref(false);
const editEstimated = ref('');
const editingActual = ref(false);
const editActual = ref('');

// New tag input
const showTagInput = ref(false);
const newTagValue = ref('');

// Add dependency modal
const showAddDep = ref(false);
const depSearchQuery = ref('');

// Add subtask modal
const showAddSubtask = ref(false);
const newSubtaskTitle = ref('');

// Session launcher
const showSessionLauncher = ref(false);

// Dependency tasks resolved
const depTasks = ref<TaskRecord[]>([]);

// Load task
async function loadTask() {
  const id = route.params.id as string;
  if (!id) return;
  loading.value = true;
  try {
    const result = await tasksStore.fetchById(id);
    task.value = result;
    if (result) {
      // Load sprints for the project
      if (result.projectId) {
        await projectsStore.fetchSprints(result.projectId);
      }
      // Load subtasks
      await tasksStore.fetchSubtasks(id, result.projectId);
      // Load sessions
      await sessionsStore.fetchByTask(id);
      taskSessions.value = sessionsStore.taskSessions;
      // Load summaries for associated sessions
      await loadSummaries();
      // Load dependency tasks
      await loadDependencies();
    }
  } finally {
    loading.value = false;
  }
}

async function loadDependencies() {
  if (!task.value || task.value.dependsOn.length === 0) {
    depTasks.value = [];
    return;
  }
  const results: TaskRecord[] = [];
  for (const depId of task.value.dependsOn) {
    const t = await tasksStore.fetchById(depId);
    if (t) results.push(t);
  }
  depTasks.value = results;
}

async function loadSummaries() {
  summaries.value = [];
  for (const s of taskSessions.value) {
    try {
      const results = await ipc.getSessionSummaries(s.id);
      if (results && results.length > 0) {
        for (const r of results) {
          summaries.value.push({ content: r.content, createdAt: r.createdAt || r.created_at });
        }
      }
    } catch {
      // ignore fetch errors
    }
  }
  summaries.value.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

onMounted(async () => {
  if (agentsStore.agents.length === 0) await agentsStore.fetchAll();
  if (projectsStore.projects.length === 0) await projectsStore.fetchAll();
  await loadTask();
});

watch(() => route.params.id, () => loadTask());

// --- Computed ---
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

const priorityLabel: Record<string, string> = {
  critical: '緊急',
  high: '高',
  medium: '中',
  low: '低',
};

const availableTransitions = computed((): { status: TaskStatus; label: string }[] => {
  if (!task.value) return [];
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
  return map[task.value.status] || [];
});

const tags = computed(() => {
  if (!task.value?.tags) return [];
  return task.value.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
});

const sprintName = computed(() => {
  if (!task.value?.sprintId) return null;
  const sprint = projectsStore.sprints.find((s) => s.id === task.value!.sprintId);
  return sprint?.name ?? null;
});

// Dependency search: filter existing tasks excluding self and already-added
const depSearchResults = computed(() => {
  if (!task.value) return [];
  const q = depSearchQuery.value.toLowerCase().trim();
  return tasksStore.tasks.filter(
    (t) =>
      t.id !== task.value!.id &&
      !task.value!.dependsOn.includes(t.id) &&
      (q === '' || t.title.toLowerCase().includes(q) || t.id.includes(q)),
  );
});

// --- Inline edit handlers ---
function startEditTitle() {
  if (!task.value) return;
  editTitle.value = task.value.title;
  editingTitle.value = true;
}

async function saveTitle() {
  editingTitle.value = false;
  if (!task.value || editTitle.value.trim() === task.value.title) return;
  const result = await tasksStore.update(task.value.id, { title: editTitle.value.trim() });
  task.value = result;
}

function startEditDescription() {
  if (!task.value) return;
  editDescription.value = task.value.description;
  editingDescription.value = true;
}

async function saveDescription() {
  editingDescription.value = false;
  if (!task.value || editDescription.value === task.value.description) return;
  const result = await tasksStore.update(task.value.id, { description: editDescription.value });
  task.value = result;
}

async function updatePriority(ev: Event) {
  if (!task.value) return;
  const val = (ev.target as HTMLSelectElement).value;
  const result = await tasksStore.update(task.value.id, { priority: val });
  task.value = result;
}

async function updateAssignedTo(ev: Event) {
  if (!task.value) return;
  const val = (ev.target as HTMLSelectElement).value || null;
  const result = await tasksStore.update(task.value.id, { assignedTo: val });
  task.value = result;
}

async function updateSprint(ev: Event) {
  if (!task.value) return;
  const val = (ev.target as HTMLSelectElement).value || null;
  const result = await tasksStore.update(task.value.id, { sprintId: val });
  task.value = result;
}

function startEditEstimated() {
  if (!task.value) return;
  editEstimated.value = task.value.estimatedHours?.toString() ?? '';
  editingEstimated.value = true;
}

async function saveEstimated() {
  editingEstimated.value = false;
  if (!task.value) return;
  const val = editEstimated.value.trim() ? parseFloat(editEstimated.value) : null;
  if (val === task.value.estimatedHours) return;
  const result = await tasksStore.update(task.value.id, { estimatedHours: val });
  task.value = result;
}

function startEditActual() {
  if (!task.value) return;
  editActual.value = task.value.actualHours?.toString() ?? '';
  editingActual.value = true;
}

async function saveActual() {
  editingActual.value = false;
  if (!task.value) return;
  const val = editActual.value.trim() ? parseFloat(editActual.value) : null;
  if (val === task.value.actualHours) return;
  const result = await tasksStore.update(task.value.id, { actualHours: val });
  task.value = result;
}

// --- Tags ---
async function addTag() {
  if (!task.value || !newTagValue.value.trim()) return;
  const current = tags.value;
  const newTag = newTagValue.value.trim();
  if (current.includes(newTag)) {
    newTagValue.value = '';
    return;
  }
  const newTags = [...current, newTag].join(',');
  const result = await tasksStore.update(task.value.id, { tags: newTags });
  task.value = result;
  newTagValue.value = '';
  showTagInput.value = false;
}

async function removeTag(tag: string) {
  if (!task.value) return;
  const newTags = tags.value.filter((t) => t !== tag).join(',') || null;
  const result = await tasksStore.update(task.value.id, { tags: newTags });
  task.value = result;
}

// --- Dependencies ---
async function handleAddDependency(depId: string) {
  if (!task.value) return;
  await tasksStore.addDependency(task.value.id, depId);
  task.value = await tasksStore.fetchById(task.value.id);
  await loadDependencies();
  showAddDep.value = false;
  depSearchQuery.value = '';
}

async function handleRemoveDependency(depId: string) {
  if (!task.value) return;
  await tasksStore.removeDependency(task.value.id, depId);
  task.value = await tasksStore.fetchById(task.value.id);
  await loadDependencies();
}

// --- Subtasks ---
async function handleCreateSubtask() {
  if (!task.value || !newSubtaskTitle.value.trim()) return;
  const { createTask } = useIpc();
  const sub = (await createTask({
    projectId: task.value.projectId,
    parentTaskId: task.value.id,
    title: newSubtaskTitle.value.trim(),
    sprintId: task.value.sprintId || undefined,
  })) as TaskRecord;
  tasksStore.subtasks.push(sub);
  newSubtaskTitle.value = '';
  showAddSubtask.value = false;
}

// --- Status transition ---
async function handleTransition(toStatus: TaskStatus) {
  if (!task.value) return;
  try {
    const result = await tasksStore.transition(task.value.id, toStatus);
    task.value = result;
  } catch (e: any) {
    alert(`狀態轉換失敗: ${e.message || e}`);
  }
}

// --- Delete ---
async function handleDelete() {
  if (!task.value) return;
  if (confirm('確定要刪除此任務？')) {
    await tasksStore.remove(task.value.id);
    router.push('/tasks');
  }
}

// --- Navigation ---
function goBack() {
  router.push('/tasks');
}

function navigateToTask(id: string) {
  router.push(`/tasks/${id}`);
}

function navigateToSession(sessionId: string) {
  router.push({ path: '/sessions', query: { id: sessionId } });
}

// --- Sessions ---
const sessionStatusDot = (status: string) => {
  if (['completed'].includes(status)) return 'bg-success';
  if (['thinking', 'starting'].includes(status)) return 'bg-info';
  if (['running', 'executing_tool'].includes(status)) return 'bg-warning';
  if (status === 'failed') return 'bg-danger';
  return 'bg-text-muted';
};

function formatSessionDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function handleSessionLaunched() {
  showSessionLauncher.value = false;
  if (task.value) {
    await sessionsStore.fetchByTask(task.value.id);
    taskSessions.value = sessionsStore.taskSessions;
  }
}

// --- Git ---
const projectWorkDir = computed(() => {
  if (!task.value?.projectId) return null;
  const project = projectsStore.projects.find((p) => p.id === task.value!.projectId);
  return project?.workDir ?? null;
});

const allChangedFiles = computed(() => {
  const s = gitStore.status;
  if (!s) return [];
  const files: { file: string; type: string }[] = [];
  for (const f of s.staged) files.push({ file: f, type: 'staged' });
  for (const f of s.modified) files.push({ file: f, type: 'modified' });
  for (const f of s.untracked) files.push({ file: f, type: 'untracked' });
  return files;
});

const defaultCommitMessage = computed(() => {
  if (!task.value) return '';
  return `[${task.value.title}] `;
});

async function loadGitStatus() {
  if (!projectWorkDir.value) return;
  gitLoading.value = true;
  gitError.value = '';
  try {
    await gitStore.fetchStatus(projectWorkDir.value);
    await gitStore.fetchDiff(projectWorkDir.value);
    await gitStore.fetchLog(projectWorkDir.value, 5);
    if (!commitMessage.value) {
      commitMessage.value = defaultCommitMessage.value;
    }
  } catch (e: any) {
    gitError.value = e.message || 'Git 載入失敗';
  } finally {
    gitLoading.value = false;
  }
}

async function toggleGitSection() {
  gitExpanded.value = !gitExpanded.value;
  if (gitExpanded.value) {
    await loadGitStatus();
  }
}

async function handleStageAll() {
  if (!projectWorkDir.value) return;
  gitStaging.value = true;
  gitError.value = '';
  try {
    await gitStore.stage(projectWorkDir.value);
    gitSuccess.value = '已暫存所有變更';
    setTimeout(() => (gitSuccess.value = ''), 2000);
  } catch (e: any) {
    gitError.value = e.message || 'Stage 失敗';
  } finally {
    gitStaging.value = false;
  }
}

async function handleCommit() {
  if (!projectWorkDir.value || !commitMessage.value.trim()) return;
  gitCommitting.value = true;
  gitError.value = '';
  try {
    await gitStore.commit(projectWorkDir.value, commitMessage.value.trim());
    gitSuccess.value = 'Commit 成功';
    commitMessage.value = defaultCommitMessage.value;
    setTimeout(() => (gitSuccess.value = ''), 2000);
  } catch (e: any) {
    gitError.value = e.message || 'Commit 失敗';
  } finally {
    gitCommitting.value = false;
  }
}

async function handlePush() {
  if (!projectWorkDir.value) return;
  gitPushing.value = true;
  gitError.value = '';
  try {
    await gitStore.push(projectWorkDir.value, 'origin', undefined, true);
    gitSuccess.value = 'Push 成功';
    setTimeout(() => (gitSuccess.value = ''), 2000);
  } catch (e: any) {
    gitError.value = e.message || 'Push 失敗';
  } finally {
    gitPushing.value = false;
  }
}

function diffStatusIcon(type: string) {
  if (type === 'staged') return '●';
  if (type === 'modified') return '○';
  return '+';
}

function diffStatusColor(type: string) {
  if (type === 'staged') return 'text-success';
  if (type === 'modified') return 'text-warning';
  return 'text-info';
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="mb-4 flex items-center gap-3">
      <button
        class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-default bg-bg-hover px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-active hover:text-text-primary"
        @click="goBack"
      >
        <span class="text-sm">&larr;</span> 返回看板
      </button>
      <h2 class="text-xl font-semibold">任務詳情</h2>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center text-sm text-text-muted"
    >
      載入中...
    </div>

    <!-- Not found -->
    <div
      v-else-if="!task"
      class="flex flex-1 items-center justify-center text-sm text-text-muted"
    >
      找不到此任務
    </div>

    <!-- Content -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-[800px] space-y-6 pb-8">
        <!-- Title + Status -->
        <div>
          <div class="mb-2 flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <!-- Title: inline editable -->
              <input
                v-if="editingTitle"
                ref="titleInput"
                v-model="editTitle"
                class="w-full rounded-lg border border-accent bg-bg-primary px-3 py-1.5 text-lg font-semibold text-text-primary outline-none"
                @blur="saveTitle"
                @keydown.enter="saveTitle"
                @keydown.escape="editingTitle = false"
                @vue:mounted="($event.el as HTMLInputElement).focus()"
              />
              <h3
                v-else
                class="cursor-pointer rounded-lg px-3 py-1.5 text-lg font-semibold transition-colors hover:bg-bg-hover"
                @click="startEditTitle"
              >
                {{ task.title }}
              </h3>
            </div>
            <BaseTag :color="statusColor[task.status]" class="mt-1.5 flex-shrink-0">
              {{ statusLabel[task.status] }}
            </BaseTag>
          </div>

          <!-- Description: inline editable -->
          <div>
            <textarea
              v-if="editingDescription"
              v-model="editDescription"
              class="w-full resize-none rounded-lg border border-accent bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none"
              rows="4"
              @blur="saveDescription"
              @keydown.escape="editingDescription = false"
              @vue:mounted="($event.el as HTMLTextAreaElement).focus()"
            />
            <div
              v-else
              class="cursor-pointer rounded-lg px-3 py-2 text-sm transition-colors hover:bg-bg-hover"
              :class="task.description ? 'text-text-secondary' : 'text-text-muted italic'"
              @click="startEditDescription"
            >
              {{ task.description || '點擊新增描述...' }}
            </div>
          </div>
        </div>

        <!-- Basic info -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <h4 class="mb-3 text-xs font-semibold text-text-muted">基本資訊</h4>
          <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <!-- Priority -->
            <div class="flex items-center justify-between">
              <span class="text-text-muted">優先級</span>
              <select
                class="rounded-md border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                :value="task.priority"
                @change="updatePriority"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="critical">緊急</option>
              </select>
            </div>

            <!-- Assigned to -->
            <div class="flex items-center justify-between">
              <span class="text-text-muted">指派</span>
              <select
                class="max-w-[180px] rounded-md border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                :value="task.assignedTo || ''"
                @change="updateAssignedTo"
              >
                <option value="">未指派</option>
                <optgroup
                  v-for="[dept, deptAgents] in agentsStore.agentsByDepartment"
                  :key="dept"
                  :label="dept"
                >
                  <option v-for="a in deptAgents" :key="a.id" :value="a.id">
                    {{ agentsStore.agentIcon(a) }} {{ agentsStore.displayName(a) }}
                  </option>
                </optgroup>
              </select>
            </div>

            <!-- Sprint -->
            <div class="flex items-center justify-between">
              <span class="text-text-muted">Sprint</span>
              <select
                class="max-w-[180px] rounded-md border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                :value="task.sprintId || ''"
                @change="updateSprint"
              >
                <option value="">無</option>
                <option v-for="s in projectsStore.sprints" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select>
            </div>

            <!-- Created by -->
            <div class="flex items-center justify-between">
              <span class="text-text-muted">建立者</span>
              <span class="text-xs">{{ task.createdBy || '-' }}</span>
            </div>

            <!-- Estimated hours -->
            <div class="flex items-center justify-between">
              <span class="text-text-muted">預估</span>
              <div v-if="editingEstimated" class="flex items-center gap-1">
                <input
                  v-model="editEstimated"
                  type="number"
                  step="0.5"
                  min="0"
                  class="w-16 rounded-md border border-accent bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none"
                  @blur="saveEstimated"
                  @keydown.enter="saveEstimated"
                  @keydown.escape="editingEstimated = false"
                  @vue:mounted="($event.el as HTMLInputElement).focus()"
                />
                <span class="text-xs text-text-muted">h</span>
              </div>
              <span
                v-else
                class="cursor-pointer rounded-md px-2 py-1 text-xs transition-colors hover:bg-bg-hover"
                @click="startEditEstimated"
              >
                {{ task.estimatedHours != null ? task.estimatedHours + ' h' : '-' }}
              </span>
            </div>

            <!-- Actual hours -->
            <div class="flex items-center justify-between">
              <span class="text-text-muted">實際</span>
              <div v-if="editingActual" class="flex items-center gap-1">
                <input
                  v-model="editActual"
                  type="number"
                  step="0.5"
                  min="0"
                  class="w-16 rounded-md border border-accent bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none"
                  @blur="saveActual"
                  @keydown.enter="saveActual"
                  @keydown.escape="editingActual = false"
                  @vue:mounted="($event.el as HTMLInputElement).focus()"
                />
                <span class="text-xs text-text-muted">h</span>
              </div>
              <span
                v-else
                class="cursor-pointer rounded-md px-2 py-1 text-xs transition-colors hover:bg-bg-hover"
                @click="startEditActual"
              >
                {{ task.actualHours != null ? task.actualHours + ' h' : '-' }}
              </span>
            </div>

            <!-- Tags -->
            <div class="col-span-2 flex items-start gap-2">
              <span class="mt-0.5 text-text-muted">標籤</span>
              <div class="flex flex-1 flex-wrap gap-1.5">
                <span
                  v-for="tag in tags"
                  :key="tag"
                  class="inline-flex items-center gap-1 rounded-md bg-bg-hover px-2 py-0.5 text-xs text-text-secondary"
                >
                  {{ tag }}
                  <button
                    class="cursor-pointer border-none bg-transparent p-0 text-text-muted hover:text-danger"
                    @click="removeTag(tag)"
                  >&times;</button>
                </span>
                <div v-if="showTagInput" class="flex items-center gap-1">
                  <input
                    v-model="newTagValue"
                    class="w-24 rounded-md border border-accent bg-bg-primary px-2 py-0.5 text-xs text-text-primary outline-none"
                    placeholder="標籤名稱"
                    @keydown.enter="addTag"
                    @keydown.escape="showTagInput = false"
                    @blur="addTag"
                    @vue:mounted="($event.el as HTMLInputElement).focus()"
                  />
                </div>
                <button
                  v-else
                  class="cursor-pointer rounded-md border border-dashed border-border-default bg-transparent px-2 py-0.5 text-xs text-text-muted hover:border-accent hover:text-accent-light"
                  @click="showTagInput = true"
                >+ 新增</button>
              </div>
            </div>

            <!-- Dates -->
            <div class="flex items-center justify-between">
              <span class="text-text-muted">建立</span>
              <span class="text-xs">{{ formatDate(task.createdAt) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-text-muted">更新</span>
              <span class="text-xs">{{ formatDate(task.updatedAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Associated Sessions -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-xs font-semibold text-text-muted">
              關聯工作階段
              <span v-if="taskSessions.length > 0" class="ml-1 opacity-60">
                ({{ taskSessions.length }})
              </span>
            </h4>
            <button
              class="cursor-pointer rounded-md border border-dashed border-border-default bg-transparent px-2 py-0.5 text-xs text-text-muted hover:border-accent hover:text-accent-light"
              @click="showSessionLauncher = true"
            >+ 啟動 Session</button>
          </div>

          <div v-if="taskSessions.length === 0" class="py-2 text-center text-xs text-text-muted">
            尚無關聯工作階段
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="s in taskSessions"
              :key="s.id"
              class="flex cursor-pointer items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm transition-colors hover:border-accent/40"
              @click="navigateToSession(s.id)"
            >
              <span
                class="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                :class="sessionStatusDot(s.status)"
              />
              <span class="font-medium">{{ s.agent_id }}</span>
              <span class="ml-auto text-xs text-text-muted">
                {{ formatTokens((s.input_tokens || 0) + (s.output_tokens || 0)) }} tok
              </span>
              <span class="text-xs text-text-muted">
                {{ formatSessionDuration(s.duration_ms) }}
              </span>
            </div>
          </div>
        </div>


        <!-- Task Summaries -->
        <div
          v-if="summaries.length > 0"
          class="rounded-xl border border-border-default bg-bg-card p-4"
        >
          <div
            class="flex cursor-pointer items-center justify-between"
            @click="summariesExpanded = !summariesExpanded"
          >
            <h4 class="text-xs font-semibold text-text-muted">
              任務摘要
              <span class="ml-1 opacity-60">({{ summaries.length }})</span>
            </h4>
            <span class="text-xs text-text-muted">{{ summariesExpanded ? '▼' : '▶' }}</span>
          </div>
          <div v-if="summariesExpanded" class="mt-3 space-y-2">
            <div
              v-for="(s, idx) in summaries"
              :key="idx"
              class="rounded-lg border border-border-default bg-bg-primary p-3"
            >
              <div class="mb-1 text-xs text-text-muted">
                {{ new Date(s.createdAt).toLocaleString('zh-TW') }}
              </div>
              <div class="whitespace-pre-wrap text-sm text-text-primary">{{ s.content }}</div>
            </div>
          </div>
        </div>

        <!-- Session Launcher -->
        <SessionLauncher
          :show="showSessionLauncher"
          :preselected-agent-id="task.assignedTo || undefined"
          :preselected-task-id="task.id"
          :preselected-project-id="task.projectId"
          @close="showSessionLauncher = false"
          @launched="handleSessionLaunched"
        />


        <!-- Git Changes -->
        <div v-if="projectWorkDir" class="rounded-xl border border-border-default bg-bg-card p-4">
          <div
            class="flex cursor-pointer items-center justify-between"
            @click="toggleGitSection"
          >
            <h4 class="text-xs font-semibold text-text-muted">
              Git 變更
              <span v-if="gitStore.status" class="ml-1 opacity-60">
                ({{ (gitStore.status.staged?.length || 0) + (gitStore.status.modified?.length || 0) + (gitStore.status.untracked?.length || 0) }} 個檔案)
              </span>
            </h4>
            <span class="text-xs text-text-muted">{{ gitExpanded ? '▼' : '▶' }}</span>
          </div>

          <div v-if="gitExpanded" class="mt-3 space-y-3">
            <!-- Loading -->
            <div v-if="gitLoading" class="py-2 text-center text-xs text-text-muted">
              載入 Git 狀態中...
            </div>

            <!-- Not a git repo -->
            <div v-else-if="gitStore.status && !gitStore.status.isRepo" class="py-2 text-center text-xs text-text-muted">
              此專案目錄不是 Git 儲存庫
            </div>

            <template v-else-if="gitStore.status">
              <!-- Branch info -->
              <div class="flex items-center gap-2 text-xs">
                <span class="rounded-md bg-bg-hover px-2 py-0.5 font-mono text-text-secondary">
                  {{ gitStore.status.branch }}
                </span>
                <span v-if="gitStore.status.ahead > 0" class="text-warning">
                  ↑{{ gitStore.status.ahead }} 待推送
                </span>
                <span v-if="gitStore.status.behind > 0" class="text-info">
                  ↓{{ gitStore.status.behind }} 待拉取
                </span>
                <button
                  class="ml-auto cursor-pointer rounded-md border-none bg-transparent px-1 text-text-muted hover:text-text-primary"
                  title="重新整理"
                  @click.stop="loadGitStatus"
                >↻</button>
              </div>

              <!-- Changed files -->
              <div v-if="allChangedFiles.length > 0" class="space-y-1">
                <div class="text-xs font-medium text-text-muted">變更檔案</div>
                <div class="max-h-[200px] overflow-y-auto rounded-lg border border-border-default bg-bg-primary">
                  <div
                    v-for="f in allChangedFiles"
                    :key="f.file + f.type"
                    class="flex items-center gap-2 border-b border-border-default px-3 py-1.5 text-xs last:border-b-0"
                  >
                    <span :class="diffStatusColor(f.type)" class="w-3 text-center">{{ diffStatusIcon(f.type) }}</span>
                    <span class="flex-1 truncate font-mono text-text-secondary">{{ f.file }}</span>
                    <span class="text-[10px] text-text-muted">
                      {{ f.type === 'staged' ? '已暫存' : f.type === 'modified' ? '已修改' : '未追蹤' }}
                    </span>
                  </div>
                </div>

                <!-- Stage all -->
                <BaseButton
                  v-if="gitStore.status.modified.length > 0 || gitStore.status.untracked.length > 0"
                  variant="secondary"
                  size="sm"
                  :disabled="gitStaging"
                  @click="handleStageAll"
                >
                  {{ gitStaging ? '暫存中...' : '全部暫存' }}
                </BaseButton>
              </div>

              <div v-else class="py-1 text-xs text-text-muted">
                無未提交的變更
              </div>

              <!-- Commit -->
              <div v-if="gitStore.status.staged.length > 0" class="space-y-2">
                <div class="text-xs font-medium text-text-muted">提交訊息</div>
                <input
                  v-model="commitMessage"
                  class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  placeholder="輸入 commit message..."
                  @keydown.enter="handleCommit"
                />
                <div class="flex gap-2">
                  <BaseButton
                    variant="primary"
                    size="sm"
                    :disabled="gitCommitting || !commitMessage.trim()"
                    @click="handleCommit"
                  >
                    {{ gitCommitting ? '提交中...' : 'Commit' }}
                  </BaseButton>
                </div>
              </div>

              <!-- Push -->
              <div v-if="gitStore.status.ahead > 0" class="flex items-center gap-2">
                <BaseButton
                  variant="secondary"
                  size="sm"
                  :disabled="gitPushing"
                  @click="handlePush"
                >
                  {{ gitPushing ? '推送中...' : `Push (${gitStore.status.ahead} commits)` }}
                </BaseButton>
              </div>

              <!-- Recent commits -->
              <div v-if="gitStore.commits.length > 0">
                <div class="text-xs font-medium text-text-muted">最近提交</div>
                <div class="mt-1 space-y-1">
                  <div
                    v-for="c in gitStore.commits.slice(0, 5)"
                    :key="c.hash"
                    class="flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                  >
                    <span class="font-mono text-accent">{{ c.hash.slice(0, 7) }}</span>
                    <span class="flex-1 truncate text-text-secondary">{{ c.message }}</span>
                    <span class="flex-shrink-0 text-text-muted">{{ c.author }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Success/Error messages -->
            <div v-if="gitSuccess" class="rounded-lg bg-success/10 px-3 py-1.5 text-xs text-success">
              {{ gitSuccess }}
            </div>
            <div v-if="gitError" class="rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">
              {{ gitError }}
            </div>
          </div>
        </div>


        <!-- Subtasks -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-xs font-semibold text-text-muted">
              子任務
              <span v-if="tasksStore.subtasks.length > 0" class="ml-1 opacity-60">
                ({{ tasksStore.subtasks.length }})
              </span>
            </h4>
            <button
              class="cursor-pointer rounded-md border border-dashed border-border-default bg-transparent px-2 py-0.5 text-xs text-text-muted hover:border-accent hover:text-accent-light"
              @click="showAddSubtask = true"
            >+ 新增子任務</button>
          </div>

          <div v-if="tasksStore.subtasks.length === 0 && !showAddSubtask" class="py-2 text-center text-xs text-text-muted">
            尚無子任務
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="sub in tasksStore.subtasks"
              :key="sub.id"
              class="flex cursor-pointer items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm transition-colors hover:border-accent/40"
              @click="navigateToTask(sub.id)"
            >
              <span class="text-base">{{ sub.status === 'done' ? '\u2611' : '\u2610' }}</span>
              <span class="flex-1 truncate">{{ sub.title }}</span>
              <BaseTag :color="statusColor[sub.status]" class="text-[10px]">
                {{ statusLabel[sub.status] }}
              </BaseTag>
            </div>
          </div>

          <!-- Add subtask inline -->
          <div v-if="showAddSubtask" class="mt-2 flex items-center gap-2">
            <input
              v-model="newSubtaskTitle"
              class="flex-1 rounded-lg border border-accent bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none"
              placeholder="子任務標題"
              @keydown.enter="handleCreateSubtask"
              @keydown.escape="showAddSubtask = false"
              @vue:mounted="($event.el as HTMLInputElement).focus()"
            />
            <BaseButton variant="primary" size="sm" @click="handleCreateSubtask">建立</BaseButton>
            <BaseButton variant="ghost" size="sm" @click="showAddSubtask = false">取消</BaseButton>
          </div>
        </div>


        <!-- Dependencies -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-xs font-semibold text-text-muted">
              依賴任務
              <span v-if="task.dependsOn.length > 0" class="ml-1 opacity-60">
                ({{ task.dependsOn.length }})
              </span>
            </h4>
            <button
              class="cursor-pointer rounded-md border border-dashed border-border-default bg-transparent px-2 py-0.5 text-xs text-text-muted hover:border-accent hover:text-accent-light"
              @click="showAddDep = true"
            >+ 新增依賴</button>
          </div>

          <div v-if="depTasks.length === 0 && !showAddDep" class="py-2 text-center text-xs text-text-muted">
            無依賴任務
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="dep in depTasks"
              :key="dep.id"
              class="flex items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm"
            >
              <span class="text-base">{{ dep.status === 'done' ? '\u2611' : '\u2610' }}</span>
              <span
                class="flex-1 cursor-pointer truncate hover:text-accent-light"
                @click="navigateToTask(dep.id)"
              >{{ dep.title }}</span>
              <BaseTag :color="statusColor[dep.status]" class="text-[10px]">
                {{ statusLabel[dep.status] }}
              </BaseTag>
              <button
                class="cursor-pointer border-none bg-transparent p-0.5 text-text-muted hover:text-danger"
                title="移除依賴"
                @click="handleRemoveDependency(dep.id)"
              >&times;</button>
            </div>
          </div>
        </div>


        <!-- Add dependency modal -->
        <Teleport to="body">
          <div
            v-if="showAddDep"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            @click.self="showAddDep = false"
          >
            <div class="w-[480px] rounded-xl border border-border-default bg-bg-secondary p-6">
              <h3 class="mb-3 text-base font-semibold">新增依賴任務</h3>
              <input
                v-model="depSearchQuery"
                class="mb-3 w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                placeholder="搜尋任務標題或 ID..."
                @vue:mounted="($event.el as HTMLInputElement).focus()"
              />
              <div class="max-h-[300px] space-y-1.5 overflow-y-auto">
                <div
                  v-for="t in depSearchResults.slice(0, 20)"
                  :key="t.id"
                  class="flex cursor-pointer items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm transition-colors hover:border-accent/40"
                  @click="handleAddDependency(t.id)"
                >
                  <span class="flex-1 truncate">{{ t.title }}</span>
                  <BaseTag :color="statusColor[t.status]" class="text-[10px]">
                    {{ statusLabel[t.status] }}
                  </BaseTag>
                </div>
                <div v-if="depSearchResults.length === 0" class="py-4 text-center text-xs text-text-muted">
                  找不到可新增的任務
                </div>
              </div>
              <div class="mt-4 flex justify-end">
                <BaseButton variant="ghost" size="sm" @click="showAddDep = false">取消</BaseButton>
              </div>
            </div>
          </div>
        </Teleport>


        <!-- Status actions -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <h4 class="mb-3 text-xs font-semibold text-text-muted">狀態操作</h4>
          <div class="flex items-center justify-between">
            <div class="flex flex-wrap gap-2">
              <BaseButton
                v-for="t in availableTransitions"
                :key="t.status"
                :variant="t.status === 'done' ? 'primary' : 'secondary'"
                size="sm"
                @click="handleTransition(t.status)"
              >
                {{ t.label }}
              </BaseButton>
              <span v-if="availableTransitions.length === 0" class="text-xs text-text-muted">
                此狀態無可用操作
              </span>
            </div>
            <BaseButton variant="ghost" size="sm" class="text-danger" @click="handleDelete">
              刪除任務
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
