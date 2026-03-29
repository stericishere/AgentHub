<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
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

const templateOptions = computed(() => [
  { value: 'web-app', label: t('projects.modal.templateWebApp') },
  { value: 'api-service', label: t('projects.modal.templateApiService') },
  { value: 'mobile-app', label: t('projects.modal.templateMobileApp') },
  { value: 'library', label: t('projects.modal.templateLibrary') },
]);

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
  if (projectId === '__none__') return t('sessions.launcher.unassignedProject');
  const p = projectsStore.projects.find((p) => p.id === projectId);
  return p?.name || projectId.slice(0, 8);
}

const selectedAgent = computed(() =>
  selectedAgentId.value ? agentsStore.getById(selectedAgentId.value) : null,
);

const canLaunch = computed(() => !!selectedAgentId.value);

/** Agent is locked when pre-selected from agent page or remix */
const agentLocked = computed(() => !!(props.preselectedAgentId || props.remixData));

const modelOptions = computed(() => [
  { value: 'opus', label: 'Opus', desc: t('sessions.launcher.modelOpus') },
  { value: 'sonnet', label: 'Sonnet', desc: t('sessions.launcher.modelSonnet') },
  { value: 'haiku', label: 'Haiku', desc: t('sessions.launcher.modelHaiku') },
]);

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
    promptPreview.value = t('sessions.launcher.promptPreviewError');
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

const departmentLabel = computed<Record<string, string>>(() => ({
  engineering: t('agents.departments.engineering'),
  design: t('agents.departments.design'),
  product: t('agents.departments.product'),
  marketing: t('agents.departments.marketing'),
  testing: t('agents.departments.testing'),
  'project-management': t('agents.departments.projectManagement'),
  'studio-operations': t('agents.departments.studioOperations'),
  company: t('agents.departments.company'),
  bonus: t('agents.departments.bonus'),
}));
</script>

<template>
  <BaseModal :show="show" :title="$t('sessions.launcher.title')" @close="emit('close')">
    <div class="launcher">
      <!-- Agent Selection -->
      <div class="launcher__field">
        <label class="launcher__label">{{ $t('sessions.launcher.selectAgent') }}</label>
        <div v-if="agentLocked && selectedAgent" class="launcher__agent-locked">
          <span class="launcher__agent-locked-name">{{ agentsStore.displayName(selectedAgent) }}</span>
          <span class="launcher__agent-locked-id">({{ selectedAgent.id }})</span>
        </div>
        <select
          v-else
          v-model="selectedAgentId"
          class="launcher__select"
          @change="onAgentChange"
        >
          <option value="" disabled>{{ $t('sessions.launcher.selectAgentPlaceholder') }}</option>
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
      <div v-if="selectedAgent" class="launcher__agent-info">
        <BaseTag :color="selectedAgent.color as any">{{ selectedAgent.level }}</BaseTag>
        <BaseTag>{{ departmentLabel[selectedAgent.department] || selectedAgent.department }}</BaseTag>
        <span class="launcher__agent-model">{{ selectedAgent.model }}</span>
      </div>

      <!-- Project Selection -->
      <div v-if="!props.preselectedProjectId" class="launcher__field">
        <label class="launcher__label">{{ $t('sessions.launcher.project') }}</label>
        <select
          v-model="selectedProjectId"
          class="launcher__select"
          @change="onProjectSelectChange"
        >
          <option :value="null">{{ $t('sessions.launcher.allProjects') }}</option>
          <option v-for="p in projectsStore.projects" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
          <option value="__create__">+ {{ $t('projects.newProject') }}</option>
        </select>

        <!-- 9E: 內嵌專案建立表單 -->
        <div v-if="showCreateProject" class="launcher__create-project">
          <div class="launcher__field">
            <label class="launcher__label launcher__label--sm">{{ $t('projects.modal.nameLabel') }}</label>
            <input
              v-model="newProjectName"
              type="text"
              :placeholder="$t('projects.modal.namePlaceholder')"
              class="launcher__input launcher__input--sm"
            />
          </div>
          <div class="launcher__field">
            <label class="launcher__label launcher__label--sm">{{ $t('projects.modal.workDirLabel') }}</label>
            <div class="launcher__workdir-row">
              <input
                v-model="newProjectWorkDir"
                type="text"
                readonly
                :placeholder="$t('sessions.launcher.selectFolder')"
                class="launcher__input launcher__input--sm launcher__input--flex"
              />
              <BaseButton size="sm" @click="selectWorkDir">{{ $t('common.browse') }}</BaseButton>
            </div>
          </div>
          <div class="launcher__field">
            <label class="launcher__label launcher__label--sm">{{ $t('projects.modal.selectTemplate') }}</label>
            <select v-model="newProjectTemplate" class="launcher__select launcher__select--sm">
              <option v-for="t in templateOptions" :key="t.value" :value="t.value">
                {{ t.label }}
              </option>
            </select>
          </div>
          <div class="launcher__create-project-actions">
            <BaseButton
              size="sm"
              variant="primary"
              :disabled="!newProjectName.trim() || !newProjectWorkDir.trim() || creatingProject"
              @click="createProject"
            >
              {{ creatingProject ? $t('sessions.launcher.creating') : $t('projects.modal.create') }}
            </BaseButton>
            <BaseButton size="sm" variant="ghost" @click="showCreateProject = false">
              {{ $t('common.cancel') }}
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Associated Task (optional) -->
      <div class="launcher__field">
        <label class="launcher__label">{{ $t('sessions.launcher.associatedTask') }}</label>
        <select
          v-model="selectedTaskId"
          class="launcher__select"
          @change="onTaskSelect"
        >
          <option :value="null">{{ $t('sessions.launcher.noTask') }}</option>
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
      <div class="launcher__field">
        <label class="launcher__label">{{ $t('sessions.launcher.taskDesc') }}</label>
        <textarea
          v-model="task"
          rows="2"
          class="launcher__textarea"
          :placeholder="$t('sessions.launcher.taskPlaceholder')"
        />
      </div>

      <!-- Model + Max Turns -->
      <div class="launcher__grid-2">
        <div class="launcher__field">
          <label class="launcher__label">{{ $t('sessions.launcher.model') }}</label>
          <select v-model="model" class="launcher__select">
            <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }} - {{ opt.desc }}
            </option>
          </select>
        </div>
        <div class="launcher__field">
          <label class="launcher__label">{{ $t('sessions.launcher.maxTurns') }}</label>
          <input
            v-model.number="maxTurns"
            type="number"
            min="1"
            max="100"
            class="launcher__input"
          />
        </div>
      </div>

      <!-- Prompt Preview -->
      <div class="launcher__field">
        <button class="launcher__preview-btn" @click="loadPromptPreview">
          {{ showPromptPreview ? $t('sessions.launcher.hidePrompt') : $t('sessions.launcher.previewPrompt') }}
        </button>
        <div v-if="showPromptPreview" class="launcher__prompt-preview">
          <pre class="launcher__prompt-pre">{{ promptPreview }}</pre>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="launcher__footer">
        <BaseButton variant="ghost" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton variant="primary" :disabled="!canLaunch || launching" @click="launch">
          {{ launching ? $t('sessions.launcher.launching') : $t('sessions.launcher.launch') }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
/* ── Launcher form shell ── */
.launcher {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Field + label ── */
.launcher__field {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.launcher__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.launcher__label--sm {
  font-size: 11px;
}

/* ── Inputs ── */
.launcher__input {
  width: 100%;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-hover);
  padding: 8px 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  outline: none;
  box-sizing: border-box;
  transition: border-color 150ms ease;
}

.launcher__input--sm {
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: 12px;
}

.launcher__input--flex {
  flex: 1;
  min-width: 0;
}

.launcher__input::placeholder {
  color: var(--color-text-muted);
}

.launcher__input:focus {
  border-color: var(--color-accent);
}

.launcher__select {
  width: 100%;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-hover);
  padding: 8px 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  outline: none;
  box-sizing: border-box;
  transition: border-color 150ms ease;
}

.launcher__select--sm {
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: 12px;
}

.launcher__select:focus {
  border-color: var(--color-accent);
}

.launcher__textarea {
  width: 100%;
  resize: none;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-hover);
  padding: 8px 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  outline: none;
  box-sizing: border-box;
  transition: border-color 150ms ease;
}

.launcher__textarea::placeholder {
  color: var(--color-text-muted);
}

.launcher__textarea:focus {
  border-color: var(--color-accent);
}

/* ── Agent locked display ── */
.launcher__agent-locked {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(108, 92, 231, 0.3);
  background-color: rgba(108, 92, 231, 0.05);
  padding: 8px 12px;
}

.launcher__agent-locked-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.launcher__agent-locked-id {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ── Agent info tags row ── */
.launcher__agent-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.launcher__agent-model {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ── Create project inline form ── */
.launcher__create-project {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(108, 92, 231, 0.3);
  background-color: rgba(108, 92, 231, 0.05);
  padding: 12px;
}

.launcher__workdir-row {
  display: flex;
  gap: 6px;
}

.launcher__create-project-actions {
  display: flex;
  gap: 6px;
}

/* ── Two-column grid ── */
.launcher__grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* ── Prompt preview ── */
.launcher__preview-btn {
  cursor: pointer;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--color-accent-light);
  padding: 0;
  text-align: left;
}

.launcher__preview-btn:hover {
  text-decoration: underline;
}

.launcher__prompt-preview {
  margin-top: 8px;
  max-height: 400px;
  overflow-y: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-base);
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.launcher__prompt-pre {
  white-space: pre-wrap;
}

/* ── Footer ── */
.launcher__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
</style>
