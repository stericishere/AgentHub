<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useIpc } from '../composables/useIpc';
import { useSessionsStore } from '../stores/sessions';
import { useAgentsStore } from '../stores/agents';
import { useProjectsStore } from '../stores/projects';
import { useTasksStore } from '../stores/tasks';
import { useGatesStore } from '../stores/gates';
import { useCostsStore } from '../stores/costs';
import { formatTokens } from '../utils/format-tokens';
import StatCard from '../components/common/StatCard.vue';
import StatusDot from '../components/common/StatusDot.vue';
import BaseTag from '../components/common/BaseTag.vue';
import BudgetCard from '../components/cost/BudgetCard.vue';
import ObjectionList from '../components/objection/ObjectionList.vue';

const router = useRouter();
const { getHealth, listSprints } = useIpc();
const sessionsStore = useSessionsStore();
const agentsStore = useAgentsStore();
const projectsStore = useProjectsStore();
const tasksStore = useTasksStore();
const gatesStore = useGatesStore();
const costsStore = useCostsStore();

const health = ref<Record<string, unknown> | null>(null);

// 儀表板用：所有專案的 sprints 加總
import type { SprintRecord } from '../stores/projects';
const allSprints = ref<SprintRecord[]>([]);

onMounted(async () => {
  try {
    health.value = await getHealth();
  } catch (e) {
    console.error('Failed to get health', e);
  }
  if (projectsStore.projects.length === 0) await projectsStore.fetchAll();

  // 載入所有專案的 sprints
  const sprintResults = await Promise.all(
    projectsStore.projects.map((p) => listSprints(p.id).catch(() => [])),
  );
  allSprints.value = sprintResults.flat() as SprintRecord[];

  // Gates: 全部專案（無 filter）
  await gatesStore.fetchGates();

  // Tasks: 用第一個專案的 active sprint 做預覽
  if (projectsStore.projects.length > 0) {
    const firstProject = projectsStore.projects[0];
    await projectsStore.selectProject(firstProject.id);
    const firstActiveSprint = projectsStore.activeSprint;
    tasksStore.setContext(firstProject.id, firstActiveSprint?.id ?? null);
    await tasksStore.fetchTasks();
    costsStore.fetchBudget(firstProject.id);
  }
  costsStore.fetchOverview();
});

const firstPendingProjectId = computed(() => gatesStore.actionableGates[0]?.projectId);

const todayTokensDisplay = computed(() => formatTokens(costsStore.overview.todayTokens));
const todayUsdDisplay = computed(() => `$${costsStore.overview.todayUsd.toFixed(4)}`);

const activeSprints = computed(() =>
  allSprints.value.filter((s) => s.status === 'active'),
);

const sprintGateProgress = computed(() => {
  const map: Record<string, { approved: number; total: number; pct: number }> = {};
  for (const sprint of activeSprints.value) {
    const gates = gatesStore.gates.filter((g) => g.sprintId === sprint.id);
    const approved = gates.filter((g) => g.status === 'approved').length;
    const total = gates.length || 6;
    map[sprint.id] = { approved, total, pct: Math.round((approved / total) * 100) };
  }
  return map;
});

const statusLabel: Record<string, string> = {
  starting: '啟動中',
  running: '執行中',
  thinking: '思考中',
  executing_tool: '執行工具',
  awaiting_approval: '等待核准',
  waiting_input: '等待輸入',
  completed: '已完成',
  failed: '失敗',
  stopped: '已停止',
};

const gateTypeLabel: Record<string, string> = {
  G0: '需求確認',
  G1: '圖稿審核',
  G2: '程式碼審查',
  G3: '測試驗收',
  G4: '文件審查',
  G5: '部署就緒',
  G6: '正式發佈',
};

const pendingTasks = computed(() =>
  tasksStore.tasks
    .filter((t) => ['created', 'assigned', 'in_progress'].includes(t.status))
    .slice(0, 5),
);

const taskStatusLabel: Record<string, string> = {
  created: '待處理',
  assigned: '已分配',
  in_progress: '進行中',
  in_review: '審查中',
  blocked: '阻塞',
  done: '完成',
};

const taskStatusColor: Record<string, 'purple' | 'blue' | 'yellow' | 'green' | 'red'> = {
  created: 'purple',
  assigned: 'blue',
  in_progress: 'yellow',
  in_review: 'blue',
  blocked: 'red',
  done: 'green',
};
</script>

<template>
  <div>
    <h2 class="mb-6 text-xl font-semibold">儀表板</h2>

    <!-- Stat cards -->
    <div class="mb-6 grid grid-cols-4 gap-4">
      <StatCard
        label="代理人"
        :value="agentsStore.agentCount"
      />
      <StatCard
        label="執行中"
        :value="sessionsStore.activeCount"
        :change="sessionsStore.activeCount > 0 ? '運行中' : undefined"
        change-color="green"
      />
      <StatCard
        label="專案"
        :value="projectsStore.projectCount"
        :change="projectsStore.activeProjects.length > 0 ? `${projectsStore.activeProjects.length} 進行中` : undefined"
        change-color="blue"
      />
      <StatCard
        label="今日用量"
        :value="todayTokensDisplay"
        :change="todayUsdDisplay"
        change-color="muted"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- Left column -->
      <div class="space-y-4">
        <!-- Active Sprints -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">進行中 Sprint</h3>
            <button
              class="cursor-pointer border-none bg-transparent text-xs text-accent-light hover:underline"
              @click="router.push({ name: 'projects' })"
            >
              查看全部
            </button>
          </div>
          <div v-if="activeSprints.length === 0" class="py-4 text-center text-xs text-text-muted">
            無進行中的 Sprint
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="sprint in activeSprints"
              :key="sprint.id"
              class="cursor-pointer rounded-lg border border-border-default bg-bg-primary px-3 py-2.5 transition-colors hover:border-border-light"
              @click="router.push({ name: 'project-detail', params: { id: sprint.projectId } })"
            >
              <div class="mb-1 flex items-center justify-between">
                <span class="text-xs font-medium">{{ sprint.name }}</span>
                <span v-if="sprintGateProgress[sprint.id]" class="text-[11px] text-text-muted">
                  {{ sprintGateProgress[sprint.id].approved }}/{{ sprintGateProgress[sprint.id].total }} 關卡
                </span>
              </div>
              <div v-if="sprint.goal" class="mb-1.5 truncate text-[11px] text-text-muted">
                {{ sprint.goal }}
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-bg-hover">
                <div
                  class="h-full rounded-full bg-emerald-500 transition-all"
                  :style="{ width: `${sprintGateProgress[sprint.id]?.pct ?? 0}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Pending tasks -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">待處理任務</h3>
            <button
              class="cursor-pointer border-none bg-transparent text-xs text-accent-light hover:underline"
              @click="router.push({ name: 'tasks' })"
            >
              查看全部
            </button>
          </div>

          <div v-if="pendingTasks.length === 0" class="py-4 text-center text-xs text-text-muted">
            無待處理任務
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="task in pendingTasks"
              :key="task.id"
              class="flex items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs"
            >
              <span
                class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                :class="{
                  'bg-danger': task.priority === 'critical',
                  'bg-warning': task.priority === 'high',
                  'bg-info': task.priority === 'medium',
                  'bg-text-muted': task.priority === 'low',
                }"
              />
              <span class="min-w-0 flex-1 truncate font-medium">{{ task.title }}</span>
              <BaseTag :color="taskStatusColor[task.status]" class="!text-[10px]">
                {{ taskStatusLabel[task.status] }}
              </BaseTag>
            </div>
          </div>
        </div>

        <!-- Recent history (moved to left bottom) -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">最近活動</h3>
            <button
              class="cursor-pointer border-none bg-transparent text-xs text-accent-light hover:underline"
              @click="router.push({ name: 'sessions' })"
            >
              查看全部
            </button>
          </div>
          <div v-if="sessionsStore.history.length === 0" class="py-4 text-center text-xs text-text-muted">
            尚無歷史紀錄
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="record in sessionsStore.history.slice(0, 5)"
              :key="record.id"
              class="flex items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs"
            >
              <span
                class="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                :class="{
                  'bg-success': record.status === 'completed',
                  'bg-danger': record.status === 'failed',
                  'bg-text-muted': record.status === 'stopped',
                }"
              />
              <span class="font-medium">{{ record.agent_id }}</span>
              <span class="min-w-0 flex-1 truncate text-text-muted">{{ record.task }}</span>
              <span class="text-text-muted">{{ formatTokens((record.input_tokens || 0) + (record.output_tokens || 0)) }} tok</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="space-y-4">
        <!-- Active sessions -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">活躍工作階段</h3>
            <button
              class="cursor-pointer border-none bg-transparent text-xs text-accent-light hover:underline"
              @click="router.push({ name: 'sessions' })"
            >
              查看全部
            </button>
          </div>

          <div v-if="sessionsStore.activeSessions.length === 0" class="py-4 text-center text-xs text-text-muted">
            尚無執行中的工作階段
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="session in sessionsStore.activeSessions"
              :key="session.sessionId"
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-border-default bg-bg-primary px-3 py-2 transition-colors hover:border-border-light"
              @click="router.push({ name: 'sessions' })"
            >
              <StatusDot
                :status="
                  session.status === 'thinking' || session.status === 'starting'
                    ? 'thinking'
                    : session.status === 'executing_tool'
                      ? 'running'
                      : session.status === 'failed'
                        ? 'error'
                        : 'idle'
                "
              />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium">{{ session.agentName }}</div>
                <div class="truncate text-[11px] text-text-muted">{{ session.task }}</div>
              </div>
              <div class="flex flex-col items-end gap-0.5">
                <span class="text-[11px] text-text-muted">{{ statusLabel[session.status] || session.status }}</span>
                <span class="text-[10px] text-text-muted">{{ formatTokens(session.inputTokens + session.outputTokens) }} tok</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Gate status card -->
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">審核關卡</h3>
            <button
              class="cursor-pointer border-none bg-transparent text-xs text-accent-light hover:underline"
              @click="router.push({ name: 'gates', query: firstPendingProjectId ? { projectId: firstPendingProjectId } : {} })"
            >
              查看全部
            </button>
          </div>
          <div v-if="gatesStore.pendingCount > 0" class="mb-2 flex items-center gap-2 text-xs">
            <span class="inline-block h-2 w-2 rounded-full bg-warning" />
            <span class="text-text-secondary">{{ gatesStore.pendingCount }} 個待處理關卡</span>
          </div>
          <div v-else class="text-xs text-text-muted">所有關卡已通過</div>
          <div v-if="gatesStore.actionableGates.length > 0" class="mt-2 space-y-1.5">
            <div
              v-for="gate in gatesStore.actionableGates.slice(0, 4)"
              :key="gate.id"
              class="flex cursor-pointer items-center gap-2 text-[11px]"
              @click="router.push({ name: 'gates', query: { projectId: gate.projectId } })"
            >
              <span class="font-semibold text-accent-light">{{ gate.gateType }}</span>
              <span class="text-text-secondary">{{ gateTypeLabel[gate.gateType] || gate.gateType }}</span>
              <span class="flex-1 truncate text-text-muted">{{ gate.sprintName || gate.projectName }}</span>
              <BaseTag
                :color="gate.status === 'rejected' ? 'red' : gate.status === 'submitted' ? 'blue' : 'yellow'"
                class="!text-[9px]"
              >
                {{ gate.status === 'pending' ? '待處理' : gate.status === 'submitted' ? '已提交' : '已退回' }}
              </BaseTag>
            </div>
          </div>
        </div>

        <!-- Budget alert -->
        <div v-if="costsStore.budget" class="space-y-2">
          <BudgetCard
            label="今日用量"
            :used="costsStore.budget.dailyTokensUsed"
            :limit="costsStore.budget.dailyTokenLimit"
            :pct="costsStore.budget.dailyPct"
            :alert-level="costsStore.budget.alertLevel"
            mode="tokens"
          />
        </div>

        <!-- Objections -->
        <ObjectionList />
      </div>
    </div>
  </div>
</template>
