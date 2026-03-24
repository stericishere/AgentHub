<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectsStore } from '../stores/projects';
import { useTasksStore } from '../stores/tasks';
import { useSessionsStore } from '../stores/sessions';
import { useGatesStore } from '../stores/gates';
import { useGitStore, type GitStatus } from '../stores/git';
import { useSettingsStore } from '../stores/settings';
import { useIpc } from '../composables/useIpc';
import { formatTokens } from '../utils/format-tokens';
import type { ProjectRecord } from '../stores/projects';
import BaseButton from '../components/common/BaseButton.vue';
import BaseTag from '../components/common/BaseTag.vue';

const route = useRoute();
const router = useRouter();
const projectsStore = useProjectsStore();
const tasksStore = useTasksStore();
const sessionsStore = useSessionsStore();
const gatesStore = useGatesStore();

const gitStore = useGitStore();
const settingsStore = useSettingsStore();
const ipc = useIpc();

const projectId = computed(() => route.params.id as string);
const project = ref<ProjectRecord | null>(null);
const sprintSessionCounts = ref<Record<string, number>>({});
const sprintGateProgress = ref<Record<string, { approved: number; total: number }>>({});
const showSprintModal = ref(false);

// Git overview state
const gitSummary = ref<GitStatus | null>(null);
const gitExpanded = ref(false);
const gitLoading = ref(false);
const gitError = ref(false);
const newSprintName = ref('');
const newSprintGoal = ref('');
const newSprintType = ref<'full' | 'feature' | 'bugfix' | 'release'>('full');
const editingInfo = ref(false);
const editName = ref('');
const editDescription = ref('');

// .claude/ directory state
const claudeDirExists = ref(false);
const claudeDirFiles = ref<Array<{ path: string; type: 'file' | 'dir' }>>([]);
const claudeDirLoading = ref(false);
const claudeDirExpanded = ref(false);
const skillSyncEnabled = ref(false);

const claudeDirError = ref('');

async function loadClaudeDir() {
  claudeDirLoading.value = true;
  claudeDirError.value = '';
  try {
    console.log('[ClaudeDir] Loading for project:', projectId.value);
    const result = await ipc.getClaudeDir(projectId.value);
    console.log('[ClaudeDir] Result:', JSON.stringify(result));
    claudeDirExists.value = result.exists;
    claudeDirFiles.value = result.files;
  } catch (err) {
    console.error('[ClaudeDir] loadClaudeDir failed:', err);
    claudeDirError.value = String(err);
  }
  claudeDirLoading.value = false;
}

async function handleInitClaudeDir() {
  claudeDirLoading.value = true;
  claudeDirError.value = '';
  try {
    console.log('[ClaudeDir] Initializing for project:', projectId.value);
    const result = await ipc.initClaudeDir(projectId.value);
    console.log('[ClaudeDir] Init result:', JSON.stringify(result));
    if (result.success) {
      await loadClaudeDir();
    } else {
      claudeDirError.value = result.error || '初始化失敗';
    }
  } catch (err) {
    console.error('[ClaudeDir] handleInitClaudeDir failed:', err);
    claudeDirError.value = String(err);
  }
  claudeDirLoading.value = false;
}

async function loadSkillSyncSetting() {
  const prefs = settingsStore.preferences;
  const key = `project.${projectId.value}.skill-sync`;
  skillSyncEnabled.value = prefs[key] === 'true';
}

async function toggleSkillSync() {
  skillSyncEnabled.value = !skillSyncEnabled.value;
  await settingsStore.update(
    `project.${projectId.value}.skill-sync`,
    String(skillSyncEnabled.value),
    'skills',
  );
}

// Claude permission settings
type PermissionMode = '' | 'default' | 'acceptEdits' | 'bypassPermissions' | 'auto';
const permissionMode = ref<PermissionMode>('');
const allowedTools = ref<string[]>([]);
const newToolInput = ref('');

const permissionModeOptions: { value: PermissionMode; label: string; desc: string }[] = [
  { value: '', label: '不指定', desc: '使用 Claude Code 預設行為' },
  { value: 'default', label: '預設', desc: '每次操作都詢問' },
  { value: 'acceptEdits', label: '自動接受編輯', desc: '檔案編輯自動通過，其他詢問' },
  { value: 'auto', label: '自動', desc: '大部分操作自動通過' },
  { value: 'bypassPermissions', label: '跳過所有權限', desc: '不詢問任何權限（僅限安全環境）' },
];

async function loadPermissionSettings() {
  const prefs = settingsStore.preferences;
  const pid = projectId.value;
  const modeKey = `project.${pid}.permission-mode`;
  const toolsKey = `project.${pid}.allowed-tools`;
  if (prefs[modeKey]) permissionMode.value = prefs[modeKey] as PermissionMode;
  if (prefs[toolsKey]) {
    try { allowedTools.value = JSON.parse(prefs[toolsKey]); } catch { /* ignore */ }
  }
}

async function savePermissionMode() {
  await settingsStore.update(
    `project.${projectId.value}.permission-mode`,
    permissionMode.value,
    'permissions',
  );
}

async function addAllowedTool() {
  const tool = newToolInput.value.trim();
  if (!tool || allowedTools.value.includes(tool)) return;
  allowedTools.value.push(tool);
  newToolInput.value = '';
  await saveAllowedTools();
}

async function removeAllowedTool(tool: string) {
  allowedTools.value = allowedTools.value.filter((t) => t !== tool);
  await saveAllowedTools();
}

async function saveAllowedTools() {
  await settingsStore.update(
    `project.${projectId.value}.allowed-tools`,
    JSON.stringify(allowedTools.value),
    'permissions',
  );
}

onMounted(async () => {
  const id = projectId.value;

  // Load project
  const found = projectsStore.projects.find((p) => p.id === id);
  if (found) {
    project.value = found;
  } else {
    await projectsStore.fetchAll();
    project.value = projectsStore.projects.find((p) => p.id === id) || null;
  }

  if (!project.value) return;

  // Load related data in parallel
  await Promise.all([
    projectsStore.fetchSprints(id),
    projectsStore.fetchBudget(id),
    projectsStore.fetchStats(id),
    loadTasks(id),
    settingsStore.fetchAll().then(() => {
      loadPermissionSettings();
      loadSkillSyncSetting();
    }),
    loadClaudeDir(),
  ]);

  // Load gate progress per sprint
  await loadSprintGateProgress();

  // Load git overview if workDir exists
  if (project.value?.workDir) {
    await loadGitSummary(project.value.workDir);
  }
});

async function loadGitSummary(workDir: string) {
  gitLoading.value = true;
  gitError.value = false;
  try {
    await gitStore.fetchStatus(workDir);
    await gitStore.fetchLog(workDir, 1);
    gitSummary.value = gitStore.status;
  } catch {
    gitError.value = true;
  } finally {
    gitLoading.value = false;
  }
}

async function toggleGitCard() {
  gitExpanded.value = !gitExpanded.value;
  if (gitExpanded.value && !gitSummary.value && project.value?.workDir) {
    await loadGitSummary(project.value.workDir);
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

async function loadTasks(id: string) {
  tasksStore.setProject(id);
  await tasksStore.fetchTasks(id);
  await tasksStore.fetchSessionCounts();
  await computeSprintSessionCounts(id);
}

async function computeSprintSessionCounts(pid: string) {
  const sessions = await sessionsStore.fetchByProject(pid);
  const counts: Record<string, number> = {};
  for (const s of sessions as any[]) {
    if (s.task_id) {
      const task = tasksStore.tasks.find((t) => t.id === s.task_id);
      if (task?.sprintId) {
        counts[task.sprintId] = (counts[task.sprintId] || 0) + 1;
      }
    }
  }
  sprintSessionCounts.value = counts;
}

async function loadSprintGateProgress() {
  const progress: Record<string, { approved: number; total: number }> = {};
  for (const sprint of projectsStore.sprints) {
    await gatesStore.fetchGates(projectId.value, sprint.id);
    const gates = gatesStore.gates;
    const approved = gates.filter((g) => g.status === 'approved').length;
    progress[sprint.id] = { approved, total: gates.length || 1 };
  }
  sprintGateProgress.value = progress;
}

function startEditInfo() {
  if (!project.value) return;
  editName.value = project.value.name;
  editDescription.value = project.value.description;
  editingInfo.value = true;
}

async function saveInfo() {
  if (!project.value || !editName.value.trim()) return;
  const updated = await projectsStore.update(project.value.id, {
    name: editName.value.trim(),
    description: editDescription.value.trim(),
  });
  if (updated) {
    project.value = updated;
  }
  editingInfo.value = false;
}

const sprintTypeOptions: { value: 'full' | 'feature' | 'bugfix' | 'release'; label: string; gates: string }[] = [
  { value: 'full', label: '完整 Sprint', gates: 'G0 → G1 → G2 → G3 → G4 → G5' },
  { value: 'feature', label: '功能開發', gates: 'G0 → G2 → G3 → G4' },
  { value: 'bugfix', label: '修復', gates: 'G2 → G3 → G4' },
  { value: 'release', label: '發佈', gates: 'G4 → G5' },
];

async function handleCreateSprint() {
  if (!newSprintName.value.trim() || !projectId.value) return;
  await projectsStore.addSprint({
    projectId: projectId.value,
    name: newSprintName.value.trim(),
    goal: newSprintGoal.value.trim() || undefined,
    sprintType: newSprintType.value,
  });
  newSprintName.value = '';
  newSprintGoal.value = '';
  newSprintType.value = 'full';
  showSprintModal.value = false;
  await loadSprintGateProgress();
}

const stats = computed(() => projectsStore.projectStats[projectId.value] ?? null);

const statusLabel: Record<string, string> = {
  planning: '規劃中',
  active: '進行中',
  paused: '暫停',
  completed: '已完成',
  archived: '已封存',
};

const statusColor: Record<string, 'purple' | 'green' | 'yellow' | 'red' | 'blue'> = {
  planning: 'purple',
  active: 'green',
  paused: 'yellow',
  completed: 'blue',
  archived: 'red',
};

const sprintStatusLabel: Record<string, string> = {
  planning: '規劃中',
  active: '進行中',
  review: '審查中',
  completed: '已完成',
};

const sprintStatusColor: Record<string, 'purple' | 'green' | 'yellow' | 'blue'> = {
  planning: 'purple',
  active: 'green',
  review: 'yellow',
  completed: 'blue',
};

const budgetBarColor = (pct: number) => {
  if (pct >= 100) return 'bg-danger';
  if (pct >= 80) return 'bg-warning';
  return 'bg-accent';
};

type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived';

const availableStatusTransitions = computed((): { status: ProjectStatus; label: string }[] => {
  if (!project.value) return [];
  const map: Record<string, { status: ProjectStatus; label: string }[]> = {
    planning: [{ status: 'active', label: '啟動專案' }],
    active: [
      { status: 'paused', label: '暫停' },
      { status: 'completed', label: '完成' },
    ],
    paused: [
      { status: 'active', label: '恢復' },
      { status: 'archived', label: '封存' },
    ],
    completed: [{ status: 'archived', label: '封存' }],
    archived: [],
  };
  return map[project.value.status] || [];
});

async function changeProjectStatus(newStatus: ProjectStatus) {
  if (!project.value) return;
  const updated = await projectsStore.update(project.value.id, { status: newStatus });
  if (updated) {
    project.value = updated;
  }
}
</script>

<template>
  <div v-if="!project" class="flex h-full items-center justify-center text-sm text-text-muted">
    專案不存在
  </div>

  <div v-else class="space-y-4">
    <!-- Back button + title -->
    <div class="flex items-center gap-3">
      <BaseButton variant="ghost" size="sm" @click="router.push('/projects')">
        &larr; 返回
      </BaseButton>
      <h2 class="text-xl font-semibold">{{ project.name }}</h2>
      <BaseTag :color="statusColor[project.status] || 'purple'">
        {{ statusLabel[project.status] || project.status }}
      </BaseTag>
      <BaseButton
        v-for="t in availableStatusTransitions"
        :key="t.status"
        :variant="t.status === 'active' ? 'primary' : t.status === 'completed' ? 'success' : 'ghost'"
        size="sm"
        @click="changeProjectStatus(t.status)"
      >
        {{ t.label }}
      </BaseButton>
    </div>

    <!-- Stats cards row -->
    <div v-if="stats" class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-xl border border-border-default bg-bg-card p-4 text-center">
        <div class="text-2xl font-bold">{{ stats.tasksDone }}</div>
        <div class="text-xs text-text-muted">已完成任務</div>
      </div>
      <div class="rounded-xl border border-border-default bg-bg-card p-4 text-center">
        <div class="text-2xl font-bold">{{ stats.tasksInProgress }}</div>
        <div class="text-xs text-text-muted">進行中任務</div>
      </div>
      <div class="rounded-xl border border-border-default bg-bg-card p-4 text-center">
        <div class="text-2xl font-bold">{{ formatTokens(stats.totalTokens) }}</div>
        <div class="text-xs text-text-muted">總用量</div>
      </div>
      <div class="rounded-xl border border-border-default bg-bg-card p-4 text-center">
        <div v-if="stats.activeSprint" class="text-2xl font-bold">
          {{ stats.activeSprint.progressPct }}%
        </div>
        <div v-else class="text-2xl font-bold text-text-muted">--</div>
        <div class="text-xs text-text-muted">Sprint 進度</div>
      </div>
    </div>

    <!-- Project info -->
    <div class="rounded-xl border border-border-default bg-bg-card p-5">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold">專案資訊</h3>
        <BaseButton v-if="!editingInfo" variant="ghost" size="sm" @click="startEditInfo">
          編輯
        </BaseButton>
      </div>
      <template v-if="editingInfo">
        <div class="mb-2">
          <label class="mb-1 block text-[11px] text-text-muted">名稱</label>
          <input
            v-model="editName"
            class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div class="mb-3">
          <label class="mb-1 block text-[11px] text-text-muted">描述</label>
          <textarea
            v-model="editDescription"
            class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
            rows="3"
          />
        </div>
        <div class="flex gap-2">
          <BaseButton variant="primary" size="sm" @click="saveInfo">儲存</BaseButton>
          <BaseButton variant="ghost" size="sm" @click="editingInfo = false">取消</BaseButton>
        </div>
      </template>
      <template v-else>
        <p v-if="project.description" class="whitespace-pre-wrap text-xs text-text-muted">
          {{ project.description }}
        </p>
        <p v-else class="text-xs text-text-muted">尚無描述</p>
      </template>
    </div>

    <!-- Budget -->
    <div v-if="projectsStore.budget" class="rounded-xl border border-border-default bg-bg-card p-4">
      <h4 class="mb-3 text-sm font-semibold">預算</h4>
      <div class="space-y-3">
        <div>
          <div class="mb-1 flex items-center justify-between text-xs">
            <span class="text-text-muted">今日用量</span>
            <span>
              {{ formatTokens(projectsStore.budget.dailyTokensUsed) }} /
              {{ formatTokens(projectsStore.budget.dailyTokenLimit) }}
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-bg-hover">
            <div
              class="h-full rounded-full transition-all"
              :class="budgetBarColor(projectsStore.budget.dailyPct)"
              :style="{ width: `${Math.min(projectsStore.budget.dailyPct, 100)}%` }"
            />
          </div>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between text-xs">
            <span class="text-text-muted">總用量</span>
            <span>
              {{ formatTokens(projectsStore.budget.totalTokensUsed) }} /
              {{ formatTokens(projectsStore.budget.totalTokenLimit) }}
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-bg-hover">
            <div
              class="h-full rounded-full transition-all"
              :class="budgetBarColor(projectsStore.budget.totalPct)"
              :style="{ width: `${Math.min(projectsStore.budget.totalPct, 100)}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Git Overview -->
    <div v-if="project.workDir" class="rounded-xl border border-border-default bg-bg-card p-4">
      <div
        class="flex cursor-pointer select-none items-center justify-between"
        @click="toggleGitCard"
      >
        <h4 class="text-sm font-semibold">Git 狀態</h4>
        <span class="text-xs text-text-muted">{{ gitExpanded ? '▼' : '▶' }}</span>
      </div>

      <div v-if="gitExpanded" class="mt-3">
        <!-- Loading -->
        <div v-if="gitLoading" class="py-2 text-center text-xs text-text-muted">
          載入中...
        </div>

        <!-- Error -->
        <div v-else-if="gitError" class="py-2 text-center text-xs text-text-muted">
          無法取得 Git 狀態
        </div>

        <!-- Data -->
        <div v-else-if="gitSummary" class="space-y-2 text-xs">
          <!-- Branch + ahead/behind -->
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5">
              <span class="text-text-muted">分支:</span>
              <span class="rounded-md bg-bg-hover px-2 py-0.5 font-mono text-text-primary">
                {{ gitSummary.branch || 'unknown' }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-text-muted">Ahead:</span>
              <span :class="gitSummary.ahead > 0 ? 'text-warning' : 'text-text-secondary'">
                {{ gitSummary.ahead }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-text-muted">Behind:</span>
              <span :class="gitSummary.behind > 0 ? 'text-info' : 'text-text-secondary'">
                {{ gitSummary.behind }}
              </span>
            </div>
          </div>

          <!-- File counts -->
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1.5">
              <span class="text-text-muted">暫存:</span>
              <span :class="gitSummary.staged.length > 0 ? 'text-success font-medium' : 'text-text-secondary'">
                {{ gitSummary.staged.length }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-text-muted">修改:</span>
              <span :class="gitSummary.modified.length > 0 ? 'text-warning font-medium' : 'text-text-secondary'">
                {{ gitSummary.modified.length }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-text-muted">未追蹤:</span>
              <span :class="gitSummary.untracked.length > 0 ? 'text-info font-medium' : 'text-text-secondary'">
                {{ gitSummary.untracked.length }}
              </span>
            </div>
          </div>

          <!-- Latest commit -->
          <div v-if="gitStore.commits.length > 0" class="flex items-center gap-1.5">
            <span class="text-text-muted">最近提交:</span>
            <span class="truncate text-text-secondary">{{ gitStore.commits[0].message }}</span>
            <span class="flex-shrink-0 text-text-muted">
              ({{ formatRelativeTime(gitStore.commits[0].date) }})
            </span>
          </div>
        </div>

        <!-- Not a git repo -->
        <div v-else class="py-2 text-center text-xs text-text-muted">
          此目錄不是 Git 儲存庫
        </div>
      </div>
    </div>

    <!-- Claude Permission Settings -->
    <div class="rounded-xl border border-border-default bg-bg-card p-4">
      <h4 class="mb-3 text-sm font-semibold">Claude 權限設定</h4>
      <p class="mb-3 text-xs text-text-muted">
        此專案的 Session 啟動時自動套用以下權限設定
      </p>

      <!-- Permission Mode -->
      <div class="mb-4">
        <label class="mb-1.5 block text-xs font-medium text-text-muted">權限模式</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in permissionModeOptions"
            :key="opt.value"
            class="cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors"
            :class="
              permissionMode === opt.value
                ? 'border-accent bg-accent/10'
                : 'border-border-default bg-bg-primary hover:border-accent/40'
            "
            @click="permissionMode = opt.value; savePermissionMode()"
          >
            <div class="text-xs font-medium">{{ opt.label }}</div>
            <div class="text-[10px] text-text-muted">{{ opt.desc }}</div>
          </button>
        </div>
      </div>

      <!-- Allowed Tools -->
      <div>
        <label class="mb-1.5 block text-xs font-medium text-text-muted">預設允許工具</label>
        <div v-if="allowedTools.length > 0" class="mb-2 flex flex-wrap gap-1.5">
          <span
            v-for="tool in allowedTools"
            :key="tool"
            class="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-xs text-accent-light"
          >
            {{ tool }}
            <button
              class="cursor-pointer border-none bg-transparent text-accent-light/60 hover:text-accent-light"
              @click="removeAllowedTool(tool)"
            >&times;</button>
          </span>
        </div>
        <div class="flex gap-2">
          <input
            v-model="newToolInput"
            class="flex-1 rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            placeholder="例如：Bash(git:*), Edit, Read, Write"
            @keydown.enter="addAllowedTool"
          />
          <BaseButton variant="ghost" size="sm" :disabled="!newToolInput.trim()" @click="addAllowedTool">
            新增
          </BaseButton>
        </div>
        <p class="mt-1.5 text-[10px] text-text-muted">
          格式同 Claude Code --allowedTools，如 Bash(git:*), Edit, Read
        </p>
      </div>
    </div>

    <!-- .claude/ Directory Management (8A-1) -->
    <div v-if="project.workDir" class="rounded-xl border border-border-default bg-bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h4 class="text-sm font-semibold">Claude Code 整合</h4>
        <div class="flex items-center gap-2">
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors"
            :class="skillSyncEnabled
              ? 'border-accent bg-accent/10 text-accent-light'
              : 'border-border-default bg-bg-primary text-text-muted hover:border-accent/40'"
            @click="toggleSkillSync"
          >
            <span class="inline-block h-2 w-2 rounded-full" :class="skillSyncEnabled ? 'bg-accent' : 'bg-text-muted/30'" />
            Skill 同步
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="claudeDirError" class="mb-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
        {{ claudeDirError }}
      </div>

      <!-- Not initialized -->
      <div v-if="!claudeDirExists && !claudeDirLoading">
        <p class="mb-2 text-xs text-text-muted">
          尚未建立 .claude/ 目錄。初始化後可同步 Agent 定義為 Claude Code Skills。
        </p>
        <BaseButton variant="primary" size="sm" @click="handleInitClaudeDir">
          初始化 .claude/
        </BaseButton>
      </div>

      <!-- Loading -->
      <div v-else-if="claudeDirLoading" class="py-2 text-center text-xs text-text-muted">
        載入中...
      </div>

      <!-- Initialized -->
      <div v-else>
        <div
          class="flex cursor-pointer select-none items-center gap-2 text-xs text-text-muted"
          @click="claudeDirExpanded = !claudeDirExpanded"
        >
          <span>{{ claudeDirExpanded ? '▼' : '▶' }}</span>
          <span>.claude/ 目錄</span>
          <span class="rounded-full bg-bg-hover px-1.5 py-0.5 text-[10px]">
            {{ claudeDirFiles.length }} 個項目
          </span>
        </div>
        <div v-if="claudeDirExpanded" class="mt-2 space-y-0.5">
          <div
            v-for="f in claudeDirFiles"
            :key="f.path"
            class="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs"
          >
            <span class="text-text-muted">{{ f.type === 'dir' ? '📁' : '📄' }}</span>
            <span class="font-mono text-text-secondary">{{ f.path }}</span>
          </div>
          <div v-if="claudeDirFiles.length === 0" class="px-2 py-1 text-xs text-text-muted">
            目錄為空
          </div>
        </div>
      </div>
    </div>

    <!-- Sprints -->
    <div class="rounded-xl border border-border-default bg-bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h4 class="text-sm font-semibold">Sprints</h4>
        <BaseButton variant="ghost" size="sm" @click="showSprintModal = true">
          新增 Sprint
        </BaseButton>
      </div>

      <div
        v-if="projectsStore.sprints.length === 0"
        class="py-4 text-center text-xs text-text-muted"
      >
        尚無 Sprint
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="sprint in projectsStore.sprints"
          :key="sprint.id"
          class="rounded-lg border border-border-default bg-bg-primary px-3 py-2.5"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs font-medium">{{ sprint.name }}</div>
              <div v-if="sprint.goal" class="text-[11px] text-text-muted">{{ sprint.goal }}</div>
            </div>
            <div class="flex items-center gap-2">
              <span
                v-if="sprint.sprintType && sprint.sprintType !== 'full'"
                class="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-light"
              >
                {{ { feature: '功能', bugfix: '修復', release: '發佈' }[sprint.sprintType] || sprint.sprintType }}
              </span>
              <span
                v-if="sprintSessionCounts[sprint.id]"
                class="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-light"
              >
                {{ sprintSessionCounts[sprint.id] }} 個 Session
              </span>
              <BaseTag :color="sprintStatusColor[sprint.status]">
                {{ sprintStatusLabel[sprint.status] }}
              </BaseTag>
              <BaseButton
                v-if="sprint.status === 'planning'"
                variant="ghost"
                size="sm"
                @click="projectsStore.doStartSprint(sprint.id)"
              >
                啟動
              </BaseButton>
            </div>
          </div>
          <!-- Gate progress bar -->
          <div v-if="sprintGateProgress[sprint.id]" class="mt-2">
            <div class="mb-0.5 flex items-center justify-between text-[10px] text-text-muted">
              <span>關卡進度</span>
              <span>{{ sprintGateProgress[sprint.id].approved }}/{{ sprintGateProgress[sprint.id].total }}</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-bg-hover">
              <div
                class="h-full rounded-full bg-emerald-500 transition-all"
                :style="{ width: `${Math.round((sprintGateProgress[sprint.id].approved / sprintGateProgress[sprint.id].total) * 100)}%` }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tasks summary -->
    <div class="rounded-xl border border-border-default bg-bg-card p-4">
      <h4 class="mb-3 text-sm font-semibold">任務 ({{ tasksStore.totalCount }})</h4>
      <div
        v-if="tasksStore.totalCount === 0"
        class="py-4 text-center text-xs text-text-muted"
      >
        尚無任務，可到任務看板建立
      </div>
      <div v-else class="flex gap-4 text-xs">
        <div v-for="col in tasksStore.columns" :key="col.key" class="text-center">
          <div class="text-lg font-bold">
            {{ (tasksStore.tasksByStatus[col.key] || []).length }}
          </div>
          <div class="text-text-muted">{{ col.label }}</div>
        </div>
      </div>
    </div>

    <!-- Create Sprint Modal -->
    <Teleport to="body">
      <div
        v-if="showSprintModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showSprintModal = false"
      >
        <div class="w-[420px] rounded-xl border border-border-default bg-bg-secondary p-6">
          <h3 class="mb-4 text-base font-semibold">新增 Sprint</h3>
          <div class="mb-3">
            <label class="mb-1 block text-xs text-text-muted">名稱</label>
            <input
              v-model="newSprintName"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="Sprint 1"
              @keydown.enter="handleCreateSprint"
            />
          </div>
          <div class="mb-3">
            <label class="mb-1 block text-xs text-text-muted">類型</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="opt in sprintTypeOptions"
                :key="opt.value"
                class="cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors"
                :class="newSprintType === opt.value
                  ? 'border-accent bg-accent/10 text-text-primary'
                  : 'border-border-default bg-bg-primary text-text-secondary hover:border-accent/40'"
                @click="newSprintType = opt.value"
              >
                <div class="text-xs font-medium">{{ opt.label }}</div>
                <div class="text-[10px] text-text-muted">{{ opt.gates }}</div>
              </button>
            </div>
          </div>
          <div class="mb-4">
            <label class="mb-1 block text-xs text-text-muted">目標</label>
            <input
              v-model="newSprintGoal"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="Sprint 目標（選填）"
            />
          </div>
          <div class="flex justify-end gap-2">
            <BaseButton variant="ghost" size="sm" @click="showSprintModal = false">
              取消
            </BaseButton>
            <BaseButton variant="primary" size="sm" @click="handleCreateSprint">
              建立
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
