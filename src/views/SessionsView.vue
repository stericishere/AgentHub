<script lang="ts">
export default { name: 'SessionsView' };
</script>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, defineAsyncComponent } from 'vue';
import {
  useSessionsStore,
  type LayoutMode,
  type ActiveSession,
  type SessionRecord,
  type SessionGroup,
} from '../stores/sessions';
import type { SessionGroupMode } from '../stores/ui';
import { useTasksStore } from '../stores/tasks';
import { useUiStore } from '../stores/ui';
import { useRouter, useRoute } from 'vue-router';
import { formatTokens } from '../utils/format-tokens';
import { useIpc } from '../composables/useIpc';
import BaseButton from '../components/common/BaseButton.vue';
import SessionGrid from '../components/session/SessionGrid.vue';
import SessionTerminal from '../components/session/SessionTerminal.vue';
import { type RemixData } from '../components/session/SessionLauncher.vue';
const SessionLauncher = defineAsyncComponent(() => import('../components/session/SessionLauncher.vue'));
const SidePanel = defineAsyncComponent(() => import('../components/session/SidePanel.vue'));
const GateReviewBanner = defineAsyncComponent(() => import('../components/gate/GateReviewBanner.vue'));
import VirtualList from '../components/common/VirtualList.vue';

const sessionsStore = useSessionsStore();
const tasksStore = useTasksStore();
const uiStore = useUiStore();
const router = useRouter();
const route = useRoute();
const ipc = useIpc();

const scrollContainer = ref<HTMLElement | null>(null);
const collapsedGroups = ref<Set<string>>(new Set());

const groupOptions: { value: SessionGroupMode; label: string }[] = [
  { value: 'none', label: '不分組' },
  { value: 'project', label: '按專案' },
  { value: 'department', label: '按部門' },
];

function toggleGroupCollapse(key: string) {
  if (collapsedGroups.value.has(key)) {
    collapsedGroups.value.delete(key);
  } else {
    collapsedGroups.value.add(key);
  }
}

const showTaskAssigner = ref(false);
const assignTargetSession = ref<ActiveSession | null>(null);

const showDelegation = ref(false);
const delegationSource = ref<ActiveSession | null>(null);
const delegationInstruction = ref('');
const delegationTargetId = ref<string | null>(null);

type ViewTab = 'active' | 'history';
const activeViewTab = ref<ViewTab>('active');

const showLauncher = ref(false);
const remixData = ref<RemixData | null>(null);
const sidePanelSession = ref<ActiveSession | null>(null);
const historyPanelSession = ref<SessionRecord | null>(null);

// Auto-select session from query param (e.g. /sessions?id=xxx)
onMounted(() => {
  const queryId = route.query.id as string | undefined;
  if (queryId) {
    const active = sessionsStore.activeSessions.find((s) => s.sessionId === queryId);
    if (active) {
      sessionsStore.selectSession(queryId);
    }
  }
  // Restore scroll position
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = uiStore.getScrollPosition('/sessions');
    }
  });
});

onBeforeUnmount(() => {
  if (scrollContainer.value) {
    uiStore.saveScrollPosition('/sessions', scrollContainer.value.scrollTop);
  }
});

// Load history when switching to history tab
watch(activeViewTab, (tab) => {
  if (tab === 'history') {
    sessionsStore.fetchHistory();
  }
});

function getTaskTitle(taskId: string | null): string | null {
  if (!taskId) return null;
  const task = tasksStore.tasks.find((t) => t.id === taskId);
  return task?.title || null;
}

function navigateToTask(taskId: string) {
  router.push(`/tasks/${taskId}`);
}

const layoutOptions: { value: LayoutMode; label: string; svg: string }[] = [
  { value: 'list', label: '清單', svg: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2" rx="0.5"/><rect x="0" y="6" width="14" height="2" rx="0.5"/><rect x="0" y="11" width="14" height="2" rx="0.5"/></svg>' },
  { value: 'single', label: '單欄', svg: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="12" height="12" rx="1"/></svg>' },
  { value: 'dual', label: '雙欄', svg: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="5" height="12" rx="1"/><rect x="8" y="1" width="5" height="12" rx="1"/></svg>' },
  { value: 'triple', label: '三欄', svg: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="1" width="3.5" height="12" rx="1"/><rect x="5.25" y="1" width="3.5" height="12" rx="1"/><rect x="10" y="1" width="3.5" height="12" rx="1"/></svg>' },
];

const selectedSession = computed(() => sessionsStore.selectedSession);

function handleStop(sessionId: string) {
  const session = sessionsStore.activeSessions.find((s) => s.sessionId === sessionId);
  const force = session?.status === 'summarizing';
  sessionsStore.stop(sessionId, force);
}

function handleSelect(sessionId: string) {
  sessionsStore.selectSession(sessionId);
}

function handleLaunched() {
  showLauncher.value = false;
  remixData.value = null;
}

function handleRemix(session: ActiveSession) {
  remixData.value = {
    agentId: session.agentId,
    task: session.task,
    model: session.model as 'opus' | 'sonnet' | 'haiku',
  };
  showLauncher.value = true;
}

function handleOpenDiff(session: ActiveSession) {
  sidePanelSession.value = session;
}

function openTaskAssigner(session: ActiveSession) {
  assignTargetSession.value = session;
  // Load tasks for the session's project
  if (session.projectId) {
    tasksStore.fetchTasks(session.projectId);
  }
  showTaskAssigner.value = true;
}

async function handleAssignTask(taskId: string) {
  if (!assignTargetSession.value) return;
  const task = tasksStore.tasks.find((t) => t.id === taskId);
  if (!task) return;
  try {
    await sessionsStore.assignTask(
      assignTargetSession.value.sessionId,
      taskId,
      task.title,
      task.description || task.title,
    );
  } catch (err) {
    console.error('Failed to assign task', err);
  }
  showTaskAssigner.value = false;
  assignTargetSession.value = null;
}

const assignableTasks = computed(() => {
  return tasksStore.tasks.filter((t) =>
    !['done', 'rejected'].includes(t.status),
  );
});

// --- Delegation ---
const delegationTargets = computed(() => {
  if (!delegationSource.value) return [];
  const src = delegationSource.value;
  return sessionsStore.activeSessions.filter(
    (s) => s.sessionId !== src.sessionId && s.projectId === src.projectId,
  );
});

function openDelegation(session: ActiveSession) {
  delegationSource.value = session;
  delegationInstruction.value = '';
  delegationTargetId.value = null;
  showDelegation.value = true;
}

async function handleSendDelegation() {
  if (!delegationSource.value || !delegationTargetId.value || !delegationInstruction.value.trim())
    return;
  try {
    await sessionsStore.sendDelegation(
      delegationSource.value.sessionId,
      delegationTargetId.value,
      delegationInstruction.value.trim(),
    );
  } catch (err) {
    console.error('Failed to send delegation', err);
  }
  showDelegation.value = false;
  delegationSource.value = null;
  delegationInstruction.value = '';
  delegationTargetId.value = null;
}

function openHistoryDetail(item: SessionRecord) {
  historyPanelSession.value = item;
}

async function handleResume(item: SessionRecord) {
  try {
    await sessionsStore.resume(item);
    activeViewTab.value = 'active';
  } catch (err) {
    console.error('Failed to resume session', err);
  }
}

function formatDuration(ms: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function handleRequestSummary(session: ActiveSession) {
  try {
    const result = await ipc.requestSummary(session.sessionId);
    if (result) {
      uiStore.addToast(`${session.agentName} 的摘要已成功產生並儲存。`, 'success', '摘要已儲存');
    } else {
      uiStore.addToast('摘要間隔過短，請稍後再試。', 'info', '摘要跳過');
    }
  } catch (err) {
    uiStore.addToast(`無法產生 ${session.agentName} 的摘要。`, 'error', '摘要失敗');
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="mb-4 flex items-center gap-3">
      <h2 class="text-xl font-semibold">工作階段</h2>

      <!-- Tab switcher -->
      <div class="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-hover p-0.5">
        <button
          class="cursor-pointer rounded-md border-none px-3 py-1 text-xs font-medium transition-colors"
          :class="activeViewTab === 'active' ? 'bg-accent text-white' : 'bg-transparent text-text-muted hover:text-text-primary'"
          @click="activeViewTab = 'active'"
        >
          執行中
          <span
            v-if="sessionsStore.activeCount > 0"
            class="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
            :class="activeViewTab === 'active' ? 'bg-white/20 text-white' : 'bg-accent/15 text-accent-light'"
          >{{ sessionsStore.activeCount }}</span>
        </button>
        <button
          class="cursor-pointer rounded-md border-none px-3 py-1 text-xs font-medium transition-colors"
          :class="activeViewTab === 'history' ? 'bg-accent text-white' : 'bg-transparent text-text-muted hover:text-text-primary'"
          @click="activeViewTab = 'history'"
        >
          歷史紀錄
          <span
            v-if="sessionsStore.history.length > 0"
            class="ml-1 text-[10px] opacity-60"
          >{{ sessionsStore.history.length }}</span>
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <!-- Group mode toggle (only show for active tab) -->
        <div
          v-if="activeViewTab === 'active'"
          class="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-hover p-0.5"
        >
          <button
            v-for="opt in groupOptions"
            :key="opt.value"
            class="cursor-pointer rounded-md border-none px-2 py-1 text-xs font-medium transition-colors"
            :class="
              uiStore.sessionGroupMode === opt.value
                ? 'bg-accent text-white'
                : 'bg-transparent text-text-muted hover:text-text-primary'
            "
            @click="uiStore.setSessionGroupMode(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- Layout toggle (only show for active tab) -->
        <div
          v-if="activeViewTab === 'active'"
          class="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-hover p-0.5"
        >
          <button
            v-for="opt in layoutOptions"
            :key="opt.value"
            class="flex cursor-pointer items-center justify-center rounded-md border-none px-2 py-1.5 transition-colors"
            :class="
              sessionsStore.layoutMode === opt.value
                ? 'bg-accent text-white'
                : 'bg-transparent text-text-muted hover:text-text-primary'
            "
            :title="opt.label"
            @click="sessionsStore.setLayout(opt.value)"
            v-html="opt.svg"
          />
        </div>

        <BaseButton variant="primary" @click="showLauncher = true">
          + 新增工作階段
        </BaseButton>
      </div>
    </div>

    <!-- 9D: Gate 審核 Banner -->
    <GateReviewBanner />

    <!-- ===== Active sessions tab ===== -->
    <div v-if="activeViewTab === 'active'" class="flex flex-1 gap-4 overflow-hidden">
      <!-- Session grid / list -->
      <div ref="scrollContainer" class="min-w-0 flex-1 overflow-y-auto">
        <!-- Ungrouped view -->
        <template v-if="uiStore.sessionGroupMode === 'none'">
          <SessionGrid
            :sessions="sessionsStore.activeSessions"
            :layout="sessionsStore.layoutMode"
            :selected-session-id="sessionsStore.selectedSessionId"
            @select="handleSelect"
            @stop="handleStop"
            @remix="handleRemix"
            @open-diff="handleOpenDiff"
            @navigate-to-task="navigateToTask"
            @delegation="openDelegation"
            @assign-task="openTaskAssigner"
            @request-summary="handleRequestSummary"
          />
        </template>

        <!-- Grouped view -->
        <div v-else>
          <div
            v-for="group in sessionsStore.groupedSessions"
            :key="group.key"
            class="mb-4"
          >
            <button
              class="mb-2 flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-1 text-left"
              @click="toggleGroupCollapse(group.key)"
            >
              <span
                class="inline-block text-xs text-text-muted transition-transform"
                :class="collapsedGroups.has(group.key) ? '' : 'rotate-90'"
              >▶</span>
              <span class="text-sm font-semibold text-text-primary">{{ group.label }}</span>
              <span class="rounded-full bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-muted">{{ group.sessions.length }}</span>
            </button>
            <SessionGrid
              v-show="!collapsedGroups.has(group.key)"
              :sessions="group.sessions"
              :layout="sessionsStore.layoutMode"
              :selected-session-id="sessionsStore.selectedSessionId"
              @select="handleSelect"
              @stop="handleStop"
              @remix="handleRemix"
              @open-diff="handleOpenDiff"
              @navigate-to-task="navigateToTask"
              @delegation="openDelegation"
              @assign-task="openTaskAssigner"
              @request-summary="handleRequestSummary"
            />
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="sessionsStore.activeSessions.length === 0"
          class="flex flex-col items-center justify-center py-20 text-text-muted"
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-3 opacity-30">
            <rect x="2" y="3" width="20" height="18" rx="2"/>
            <path d="M8 7h8M8 11h5"/>
          </svg>
          <p class="text-sm">目前沒有執行中的工作階段</p>
          <button
            class="mt-2 cursor-pointer border-none bg-transparent text-xs text-accent-light hover:underline"
            @click="showLauncher = true"
          >
            啟動新的工作階段
          </button>
        </div>
      </div>

      <!-- Side panel: selected session detail terminal -->
      <div
        v-if="selectedSession && sessionsStore.layoutMode === 'list'"
        class="flex w-[480px] min-w-[360px] flex-col overflow-hidden rounded-xl border border-border-default bg-bg-card"
      >
        <div class="flex items-center justify-between border-b border-border-default px-4 py-2.5">
          <div>
            <div class="text-sm font-medium">{{ selectedSession.agentName }}</div>
            <div class="text-xs text-text-muted">{{ selectedSession.task }}</div>
          </div>
          <button
            class="cursor-pointer border-none bg-transparent text-text-muted hover:text-text-primary"
            @click="sessionsStore.selectSession(null)"
          >
            ✕
          </button>
        </div>
        <div class="flex-1 bg-bg-primary">
          <SessionTerminal :key="selectedSession.ptyId" :pty-id="selectedSession.ptyId" :active="true" />
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-default px-4 py-2 text-[11px] text-text-muted">
          <span class="font-medium text-text-secondary">{{ formatTokens(selectedSession.inputTokens + selectedSession.outputTokens) }} tok</span>
          <span>T{{ selectedSession.turnsCount }}</span>
          <div v-if="selectedSession.projectId && !['completed','failed','stopped'].includes(selectedSession.status)" class="ml-auto flex items-center gap-1.5">
            <button
              class="cursor-pointer rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-light transition-colors hover:bg-accent/20"
              @click="openDelegation(selectedSession)"
            >
              傳送指令
            </button>
            <button
              class="cursor-pointer rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-light transition-colors hover:bg-accent/20"
              @click="openTaskAssigner(selectedSession)"
            >
              指派任務
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== History tab ===== -->
    <div v-if="activeViewTab === 'history'" class="flex flex-1 gap-4 overflow-hidden">
      <div class="min-w-0 flex-1 overflow-y-auto">
        <!-- Empty state -->
        <div
          v-if="sessionsStore.history.length === 0"
          class="flex flex-col items-center justify-center py-20 text-text-muted"
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-3 opacity-30">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <p class="text-sm">尚無歷史紀錄</p>
        </div>

        <!-- History list -->
        <VirtualList
          v-else
          :items="sessionsStore.history"
          :item-height="56"
          class="h-full"
        >
          <template #default="{ item }: { item: any }">
            <div
              class="mb-1.5 flex cursor-pointer items-center gap-3 rounded-lg border bg-bg-card px-4 py-3 text-sm transition-colors"
              :class="historyPanelSession?.id === item.id ? 'border-accent shadow-[0_0_12px_rgba(108,92,231,0.1)]' : 'border-border-default hover:border-accent/40'"
              style="height: 56px"
              @click="openHistoryDetail(item)"
            >
              <!-- Status dot -->
              <span
                class="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                :class="{
                  'bg-success': item.status === 'completed',
                  'bg-danger': item.status === 'failed',
                  'bg-text-muted': item.status === 'stopped',
                }"
              />

              <!-- Agent + task -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ item.agent_id }}</span>
                  <span
                    v-if="item.parent_session_id"
                    class="flex-shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-[10px] text-info"
                  >接續</span>
                </div>
                <div class="truncate text-xs text-text-muted">{{ item.task }}</div>
              </div>

              <!-- Linked task -->
              <span
                v-if="item.task_id && item.task_title"
                class="max-w-[120px] cursor-pointer truncate text-xs text-accent-light hover:underline"
                @click.stop="navigateToTask(item.task_id)"
              >
                {{ item.task_title }}
              </span>

              <!-- Resume button (only if Claude conversation ID was captured) -->
              <button
                v-if="item.claude_conversation_id"
                class="flex-shrink-0 cursor-pointer rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-light transition-colors hover:bg-accent/20"
                title="繼續此工作階段"
                @click.stop="handleResume(item)"
              >
                繼續
              </button>

              <!-- Meta -->
              <span class="text-xs text-text-muted">{{ formatTokens((item.input_tokens || 0) + (item.output_tokens || 0)) }} tok</span>
              <span class="w-12 text-right text-xs text-text-muted">{{ formatDuration(item.duration_ms) }}</span>
              <span class="rounded-md bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-muted uppercase">{{ item.model }}</span>
              <span class="w-[72px] text-right text-[11px] text-text-muted">{{ formatTime(item.started_at) }}</span>
            </div>
          </template>
        </VirtualList>
      </div>

      <!-- History detail SidePanel -->
      <SidePanel
        v-if="historyPanelSession"
        :session="historyPanelSession"
        @close="historyPanelSession = null"
      />
    </div>

    <!-- Side panel for diff/details (active sessions) -->
    <SidePanel
      v-if="sidePanelSession"
      :session="sidePanelSession"
      @close="sidePanelSession = null"
    />

    <!-- Launcher modal -->
    <SessionLauncher
      :show="showLauncher"
      :remix-data="remixData"
      @close="showLauncher = false; remixData = null"
      @launched="handleLaunched"
    />

    <!-- Task assigner modal -->
    <Teleport to="body">
      <div
        v-if="showTaskAssigner && assignTargetSession"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showTaskAssigner = false"
      >
        <div class="w-[420px] rounded-xl border border-border-default bg-bg-secondary p-6">
          <h3 class="mb-1 text-base font-semibold">指派任務</h3>
          <p class="mb-4 text-xs text-text-muted">
            將任務指派給 {{ assignTargetSession.agentName }}
          </p>
          <div v-if="assignableTasks.length === 0" class="py-4 text-center text-xs text-text-muted">
            此專案沒有可指派的任務
          </div>
          <div v-else class="max-h-[300px] space-y-1.5 overflow-y-auto">
            <button
              v-for="task in assignableTasks"
              :key="task.id"
              class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-left text-sm transition-colors hover:border-accent/40"
              @click="handleAssignTask(task.id)"
            >
              <span
                class="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                :class="{
                  'bg-text-muted': task.status === 'created',
                  'bg-info': task.status === 'assigned',
                  'bg-warning': task.status === 'in_progress',
                  'bg-accent': task.status === 'in_review',
                  'bg-danger': task.status === 'blocked',
                }"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{{ task.title }}</div>
                <div v-if="task.description" class="truncate text-[11px] text-text-muted">
                  {{ task.description }}
                </div>
              </div>
              <span class="flex-shrink-0 text-[10px] uppercase text-text-muted">{{ task.status }}</span>
            </button>
          </div>
          <div class="mt-4 flex justify-end">
            <BaseButton variant="ghost" size="sm" @click="showTaskAssigner = false">
              取消
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delegation modal -->
    <Teleport to="body">
      <div
        v-if="showDelegation && delegationSource"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDelegation = false"
      >
        <div class="w-[480px] rounded-xl border border-border-default bg-bg-secondary p-6">
          <h3 class="mb-1 text-base font-semibold">傳送指令給其他 Session</h3>
          <p class="mb-4 text-xs text-text-muted">
            從 <span class="font-medium text-text-primary">{{ delegationSource.agentName }}</span>
            傳送指令，目標完成後結果會自動回傳
          </p>

          <!-- Target session picker -->
          <div class="mb-3">
            <label class="mb-1.5 block text-xs font-medium text-text-muted">選擇目標 Session</label>
            <div
              v-if="delegationTargets.length === 0"
              class="rounded-lg border border-border-default bg-bg-primary px-3 py-4 text-center text-xs text-text-muted"
            >
              同專案內沒有其他執行中的 Session
            </div>
            <div v-else class="max-h-[180px] space-y-1.5 overflow-y-auto">
              <button
                v-for="target in delegationTargets"
                :key="target.sessionId"
                class="flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                :class="
                  delegationTargetId === target.sessionId
                    ? 'border-accent bg-accent/10'
                    : 'border-border-default bg-bg-primary hover:border-accent/40'
                "
                @click="delegationTargetId = target.sessionId"
              >
                <span
                  class="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                  :class="{
                    'bg-success': target.status === 'running',
                    'bg-info': target.status === 'thinking',
                    'bg-warning': target.status === 'awaiting_approval',
                    'bg-accent': target.status === 'executing_tool',
                    'bg-text-muted': true,
                  }"
                />
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium">{{ target.agentName }}</div>
                  <div class="truncate text-[11px] text-text-muted">{{ target.task }}</div>
                </div>
                <span class="flex-shrink-0 text-[10px] uppercase text-text-muted">{{ target.status }}</span>
              </button>
            </div>
          </div>

          <!-- Instruction input -->
          <div class="mb-4">
            <label class="mb-1.5 block text-xs font-medium text-text-muted">指令內容</label>
            <textarea
              v-model="delegationInstruction"
              rows="3"
              class="w-full resize-none rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent"
              placeholder="例如：請幫我完成 login 頁面的 UI 實作..."
            />
          </div>

          <div class="flex justify-end gap-2">
            <BaseButton variant="ghost" size="sm" @click="showDelegation = false">
              取消
            </BaseButton>
            <BaseButton
              variant="primary"
              size="sm"
              :disabled="!delegationTargetId || !delegationInstruction.trim()"
              @click="handleSendDelegation"
            >
              傳送
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
