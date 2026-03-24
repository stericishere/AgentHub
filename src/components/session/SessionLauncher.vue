<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseModal from '../common/BaseModal.vue';
import BaseButton from '../common/BaseButton.vue';
import BaseTag from '../common/BaseTag.vue';
import { useAgentsStore } from '../../stores/agents';
import { useSessionsStore } from '../../stores/sessions';
import { useTasksStore, type TaskRecord } from '../../stores/tasks';
import { useProjectsStore } from '../../stores/projects';
import { useIpc } from '../../composables/useIpc';

export interface RemixData {
  agentId: string;
  task: string;
  model: 'opus' | 'sonnet' | 'haiku';
  projectId?: string | null;
  taskId?: string | null;
}

const props = defineProps<{
  show: boolean;
  preselectedAgentId?: string;
  preselectedTaskId?: string;
  preselectedProjectId?: string;
  remixData?: RemixData | null;
  parentSessionId?: string;
}>();

const emit = defineEmits<{
  close: [];
  launched: [sessionId: string];
}>();

const agentsStore = useAgentsStore();
const sessionsStore = useSessionsStore();
const tasksStore = useTasksStore();
const projectsStore = useProjectsStore();
const ipc = useIpc();

const selectedAgentId = ref('');
const task = ref('');
const model = ref<'opus' | 'sonnet' | 'haiku'>('sonnet');
const maxTurns = ref(10);
const selectedTaskId = ref<string | null>(null);
const showPromptPreview = ref(false);
const promptPreview = ref('');
const launching = ref(false);
const availableTasks = ref<TaskRecord[]>([]);

const selectedProjectId = ref<string | null>(null);

// 9E: 內嵌專案建立
const showCreateProject = ref(false);
const newProjectName = ref('');
const newProjectWorkDir = ref('');
const newProjectTemplate = ref('web-app');
const creatingProject = ref(false);

const templateOptions = [
  { value: 'web-app', label: 'Web 應用' },
  { value: 'api-service', label: 'API 服務' },
  { value: 'mobile-app', label: '行動應用' },
  { value: 'library', label: '函式庫' },
];

const effectiveProjectId = computed(() =>
  props.preselectedProjectId || selectedProjectId.value || projectsStore.selectedProjectId || null,
);

/** Non-done tasks, flat list (used when a project is selected) */
const filteredTasks = computed(() =>
  availableTasks.value.filter((t) => t.status !== 'done'),
);

/** Non-done tasks grouped by project (used when no project is selected) */
const tasksByProject = computed(() => {
  const groups = new Map<string, TaskRecord[]>();
  for (const t of filteredTasks.value) {
    const pid = t.projectId || '__none__';
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid)!.push(t);
  }
  return groups;
});

function projectName(projectId: string): string {
  if (projectId === '__none__') return '未分配專案';
  const p = projectsStore.projects.find((p) => p.id === projectId);
  return p?.name || projectId.slice(0, 8);
}

const selectedAgent = computed(() =>
  selectedAgentId.value ? agentsStore.getById(selectedAgentId.value) : null,
);

const canLaunch = computed(() => selectedAgentId.value && task.value.trim().length > 0);

/** Agent is locked when pre-selected from agent page or remix */
const agentLocked = computed(() => !!(props.preselectedAgentId || props.remixData));

const modelOptions = [
  { value: 'opus', label: 'Opus', desc: '最強大' },
  { value: 'sonnet', label: 'Sonnet', desc: '平衡' },
  { value: 'haiku', label: 'Haiku', desc: '快速' },
];

watch(
  () => props.show,
  async (isShow) => {
    if (isShow) {
      // Remix prefill takes priority
      if (props.remixData) {
        selectedAgentId.value = props.remixData.agentId;
        task.value = props.remixData.task;
        model.value = props.remixData.model;
        selectedTaskId.value = props.remixData.taskId || null;
      } else if (props.preselectedAgentId) {
        selectedAgentId.value = props.preselectedAgentId;
        const agent = agentsStore.getById(props.preselectedAgentId);
        if (agent) model.value = agent.model;
        task.value = '';
        selectedTaskId.value = null;
      } else {
        selectedAgentId.value = '';
        task.value = '';
        selectedTaskId.value = null;
        selectedProjectId.value = null;
      }

      // Prefill from task
      if (props.preselectedTaskId) {
        selectedTaskId.value = props.preselectedTaskId;
        const t = tasksStore.tasks.find((t) => t.id === props.preselectedTaskId);
        if (t) {
          task.value = task.value || t.description || t.title;
        }
      }

      // Load available tasks — scoped to project if selected, otherwise all projects
      try {
        const pid = effectiveProjectId.value;
        const filters = pid ? { projectId: pid } : {};
        availableTasks.value = (await ipc.listTasks(filters)) as TaskRecord[];
      } catch { availableTasks.value = []; }

      showPromptPreview.value = false;
      promptPreview.value = '';
    }
  },
);

// Reload tasks when project selection changes
watch(selectedProjectId, async () => {
  if (!props.show) return;
  try {
    const pid = effectiveProjectId.value;
    const filters = pid ? { projectId: pid } : {};
    availableTasks.value = (await ipc.listTasks(filters)) as TaskRecord[];
  } catch { availableTasks.value = []; }
  selectedTaskId.value = null;
});

async function loadPromptPreview() {
  if (!selectedAgentId.value) return;
  try {
    promptPreview.value = await ipc.previewPrompt(selectedAgentId.value);
    showPromptPreview.value = true;
  } catch (err) {
    promptPreview.value = '無法載入 Prompt 預覽';
    showPromptPreview.value = true;
  }
}

function onTaskSelect() {
  if (!selectedTaskId.value) return;
  const t = availableTasks.value.find((t) => t.id === selectedTaskId.value);
  if (t) {
    // Auto-fill task description if empty
    if (!task.value.trim()) {
      task.value = t.description || t.title;
    }
    // Auto-fill project from task
    if (!props.preselectedProjectId && t.projectId) {
      selectedProjectId.value = t.projectId;
    }
    // Auto-fill agent if not locked and task has assignedTo
    if (!agentLocked.value && t.assignedTo) {
      const agent = agentsStore.getById(t.assignedTo);
      if (agent) {
        selectedAgentId.value = t.assignedTo;
        model.value = agent.model;
      }
    }
  }
}

async function launch() {
  if (!canLaunch.value) return;
  launching.value = true;
  try {
    const result = await sessionsStore.spawn({
      agentId: selectedAgentId.value,
      task: task.value.trim(),
      model: model.value,
      maxTurns: maxTurns.value,
      projectId: effectiveProjectId.value,
      taskId: selectedTaskId.value || null,
      interactive: true,
      ...(props.parentSessionId ? { parentSessionId: props.parentSessionId } : {}),
    });
    emit('launched', result.sessionId);
    emit('close');
  } catch (err) {
    console.error('Failed to launch session', err);
  } finally {
    launching.value = false;
  }
}

function onProjectSelectChange() {
  if (selectedProjectId.value === '__create__') {
    showCreateProject.value = true;
    selectedProjectId.value = null;
    newProjectName.value = '';
    newProjectWorkDir.value = '';
    newProjectTemplate.value = 'web-app';
  } else {
    showCreateProject.value = false;
  }
}

async function selectWorkDir() {
  const dir = await ipc.selectFolder();
  if (dir) newProjectWorkDir.value = dir;
}

async function createProject() {
  if (!newProjectName.value.trim() || !newProjectWorkDir.value.trim()) return;
  creatingProject.value = true;
  try {
    const project = (await ipc.createProject({
      name: newProjectName.value.trim(),
      workDir: newProjectWorkDir.value.trim(),
      template: newProjectTemplate.value,
    })) as { id: string };
    // 自動建立 Sprint 1
    try {
      await ipc.createSprint({
        projectId: project.id,
        name: 'Sprint 1',
        sprintType: 'full',
      });
    } catch { /* Sprint 建立失敗不阻塞 */ }
    // 刷新專案列表並選中新專案
    await projectsStore.fetchProjects();
    selectedProjectId.value = project.id;
    showCreateProject.value = false;
  } catch (err) {
    console.error('Failed to create project', err);
  } finally {
    creatingProject.value = false;
  }
}

function onAgentChange() {
  const agent = agentsStore.getById(selectedAgentId.value);
  if (agent) {
    model.value = agent.model;
  }
  showPromptPreview.value = false;
}

const departmentLabel: Record<string, string> = {
  engineering: '工程部',
  design: '設計部',
  product: '產品部',
  marketing: '行銷部',
  testing: '測試部',
  'project-management': '專案管理部',
  'studio-operations': '工作室營運',
  bonus: '特殊',
};
</script>

<template>
  <BaseModal :show="show" title="啟動工作階段" @close="emit('close')">
    <div class="space-y-4">
      <!-- Agent Selection -->
      <div>
        <label class="mb-1.5 block text-xs text-text-muted">選擇代理人</label>
        <div v-if="agentLocked && selectedAgent" class="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
          <span class="text-sm font-medium text-text-primary">{{ agentsStore.displayName(selectedAgent) }}</span>
          <span class="text-xs text-text-muted">({{ selectedAgent.id }})</span>
        </div>
        <select
          v-else
          v-model="selectedAgentId"
          class="w-full rounded-lg border border-border-default bg-bg-hover px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          @change="onAgentChange"
        >
          <option value="" disabled>請選擇代理人...</option>
          <optgroup
            v-for="[dept, agents] in agentsStore.agentsByDepartment"
            :key="dept"
            :label="departmentLabel[dept] || dept"
          >
            <option v-for="agent in agents" :key="agent.id" :value="agent.id">
              {{ agentsStore.displayName(agent) }} ({{ agent.level }})
            </option>
          </optgroup>
        </select>
      </div>

      <!-- Selected agent info -->
      <div v-if="selectedAgent" class="flex items-center gap-2">
        <BaseTag :color="selectedAgent.color as any">{{ selectedAgent.level }}</BaseTag>
        <BaseTag>{{ departmentLabel[selectedAgent.department] || selectedAgent.department }}</BaseTag>
        <span class="text-xs text-text-muted">{{ selectedAgent.model }}</span>
      </div>

      <!-- Project Selection -->
      <div v-if="!props.preselectedProjectId">
        <label class="mb-1.5 block text-xs text-text-muted">專案</label>
        <select
          v-model="selectedProjectId"
          class="w-full rounded-lg border border-border-default bg-bg-hover px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          @change="onProjectSelectChange"
        >
          <option :value="null">所有專案</option>
          <option v-for="p in projectsStore.projects" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
          <option value="__create__">+ 新專案</option>
        </select>

        <!-- 9E: 內嵌專案建立表單 -->
        <div
          v-if="showCreateProject"
          class="mt-2 space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3"
        >
          <div>
            <label class="mb-1 block text-[11px] text-text-muted">專案名稱</label>
            <input
              v-model="newProjectName"
              type="text"
              placeholder="例：我的新專案"
              class="w-full rounded border border-border-default bg-bg-hover px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div>
            <label class="mb-1 block text-[11px] text-text-muted">工作目錄</label>
            <div class="flex gap-1.5">
              <input
                v-model="newProjectWorkDir"
                type="text"
                readonly
                placeholder="選擇資料夾..."
                class="min-w-0 flex-1 rounded border border-border-default bg-bg-hover px-2.5 py-1.5 text-xs text-text-primary outline-none"
              />
              <BaseButton size="sm" @click="selectWorkDir">瀏覽</BaseButton>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-[11px] text-text-muted">模板</label>
            <select
              v-model="newProjectTemplate"
              class="w-full rounded border border-border-default bg-bg-hover px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option v-for="t in templateOptions" :key="t.value" :value="t.value">
                {{ t.label }}
              </option>
            </select>
          </div>
          <div class="flex gap-1.5">
            <BaseButton
              size="sm"
              variant="primary"
              :disabled="!newProjectName.trim() || !newProjectWorkDir.trim() || creatingProject"
              @click="createProject"
            >
              {{ creatingProject ? '建立中...' : '建立專案' }}
            </BaseButton>
            <BaseButton size="sm" variant="ghost" @click="showCreateProject = false">
              取消
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Associated Task (optional) -->
      <div>
        <label class="mb-1.5 block text-xs text-text-muted">關聯任務（選填）</label>
        <select
          v-model="selectedTaskId"
          class="w-full rounded-lg border border-border-default bg-bg-hover px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          @change="onTaskSelect"
        >
          <option :value="null">不綁定任務</option>
          <!-- 已選專案：直接列出該專案的任務 -->
          <template v-if="effectiveProjectId">
            <option v-for="t in filteredTasks" :key="t.id" :value="t.id">
              {{ t.title }} ({{ t.status }})
            </option>
          </template>
          <!-- 未選專案：按專案分組顯示全部 -->
          <template v-else>
            <optgroup
              v-for="[pid, tasks] in tasksByProject"
              :key="pid"
              :label="projectName(pid)"
            >
              <option v-for="t in tasks" :key="t.id" :value="t.id">
                {{ t.title }} ({{ t.status }})
              </option>
            </optgroup>
          </template>
        </select>
      </div>

      <!-- Task -->
      <div>
        <label class="mb-1.5 block text-xs text-text-muted">任務描述</label>
        <textarea
          v-model="task"
          rows="3"
          class="w-full resize-none rounded-lg border border-border-default bg-bg-hover px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          placeholder="請描述要交給代理人的任務..."
        />
      </div>

      <!-- Model + Max Turns -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1.5 block text-xs text-text-muted">模型</label>
          <select
            v-model="model"
            class="w-full rounded-lg border border-border-default bg-bg-hover px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }} - {{ opt.desc }}
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs text-text-muted">最大回合數</label>
          <input
            v-model.number="maxTurns"
            type="number"
            min="1"
            max="100"
            class="w-full rounded-lg border border-border-default bg-bg-hover px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
      </div>

      <!-- Prompt Preview -->
      <div>
        <button
          class="cursor-pointer border-none bg-transparent text-xs text-accent-light hover:underline"
          @click="loadPromptPreview"
        >
          {{ showPromptPreview ? '隱藏' : '預覽' }}系統提示詞
        </button>
        <div
          v-if="showPromptPreview"
          class="mt-2 max-h-[400px] overflow-y-auto rounded-lg border border-border-default bg-bg-primary p-3 font-mono text-xs text-text-secondary"
        >
          <pre class="whitespace-pre-wrap">{{ promptPreview }}</pre>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
        <BaseButton variant="primary" :disabled="!canLaunch || launching" @click="launch">
          {{ launching ? '啟動中...' : '啟動' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
