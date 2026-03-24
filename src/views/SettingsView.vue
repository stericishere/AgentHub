<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '../stores/settings';
import { useAuthStore } from '../stores/auth';
import { useSyncStore } from '../stores/sync';
import { useIpc } from '../composables/useIpc';
import BaseButton from '../components/common/BaseButton.vue';
import BaseToggle from '../components/common/BaseToggle.vue';

const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const syncStore = useSyncStore();
const route = useRoute();
const { onSyncStatus } = useIpc();

const activeTab = ref('general');
const saveMessage = ref('');
const parentPageInput = ref('');
const initMessage = ref('');
const docSyncRootPages = ref<Record<string, string>>({});
const docConflictStrategy = ref('local-wins');
const autoSyncIntervalMs = ref(syncStore.schedulerInterval);

const tabs = [
  { key: 'account', label: '帳號' },
  { key: 'sync', label: '同步' },
  { key: 'general', label: '一般' },
  { key: 'claude', label: 'Claude 命令列' },
  { key: 'session', label: '工作階段' },
  { key: 'budget', label: '預算' },
  { key: 'notification', label: '通知' },
  { key: 'shortcuts', label: '快捷鍵' },
  { key: 'permissions', label: '權限' },
];

// Local form state
const form = ref({
  // General
  language: 'zh-TW',
  projectRoot: '',
  // Claude Code
  cliPath: 'claude',
  defaultModel: 'sonnet',
  maxTurns: '25',
  // Session
  autoSave: 'true',
  terminalFontSize: '13',
  // Budget (token limits)
  dailyTokenLimit: '500000',
  totalTokenLimit: '10000000',
  alertThreshold: '80',
  // Notification
  notifySessionComplete: 'true',
  notifySessionFailed: 'true',
  notifyBudgetWarning: 'true',
  notifyGateSubmit: 'true',
});

// --- Permissions / Auto-approve rules ---
interface AutoApproveRule {
  id: string;
  name: string;
  enabled: boolean;
  gateTypes: string[];
  projectIds?: string[];
}

const autoApproveRules = ref<AutoApproveRule[]>([]);
const showNewRuleForm = ref(false);
const newRuleName = ref('');
const newRuleGateTypes = ref<string[]>([]);
const availableGateTypes = ['G0', 'G1', 'G2', 'G3', 'G4'];

async function loadAutoApproveRules() {
  const prefs = settingsStore.preferences;
  const raw = prefs['gate.auto-approve-rules'];
  if (raw) {
    try {
      autoApproveRules.value = JSON.parse(raw);
    } catch {
      autoApproveRules.value = [];
    }
  }
}

async function saveAutoApproveRules() {
  await settingsStore.update(
    'gate.auto-approve-rules',
    JSON.stringify(autoApproveRules.value),
    'permissions',
  );
}

function addAutoApproveRule() {
  if (!newRuleName.value.trim() || newRuleGateTypes.value.length === 0) return;
  autoApproveRules.value.push({
    id: `rule-${Date.now()}`,
    name: newRuleName.value.trim(),
    enabled: true,
    gateTypes: [...newRuleGateTypes.value],
  });
  newRuleName.value = '';
  newRuleGateTypes.value = [];
  showNewRuleForm.value = false;
  saveAutoApproveRules();
}

function toggleRuleEnabled(rule: AutoApproveRule) {
  rule.enabled = !rule.enabled;
  saveAutoApproveRules();
}

function deleteRule(id: string) {
  autoApproveRules.value = autoApproveRules.value.filter((r) => r.id !== id);
  saveAutoApproveRules();
}

function toggleGateType(type: string) {
  const idx = newRuleGateTypes.value.indexOf(type);
  if (idx >= 0) {
    newRuleGateTypes.value.splice(idx, 1);
  } else {
    newRuleGateTypes.value.push(type);
  }
}

const clearing = ref(false);
const clearMessage = ref('');
const clearError = ref('');

async function handleClearDatabase() {
  const confirmed = window.confirm(
    '警告：此操作將永久刪除所有業務資料，包含所有專案、任務、衝刺、工作階段記錄、審計日誌等。\n\n資料庫結構（schema_migrations）將保留，應用程式不會損壞。\n\n此操作無法復原，請確認後繼續。',
  );
  if (!confirmed) return;

  clearing.value = true;
  clearMessage.value = '';
  clearError.value = '';
  try {
    const result = await window.maestro.system.clearDatabase();
    const totalDeleted = Object.values(result.deletedCounts).reduce((a, b) => a + b, 0);
    clearMessage.value = `已清除完成，共刪除 ${totalDeleted} 筆資料。`;
    setTimeout(() => { clearMessage.value = ''; }, 5000);
  } catch (err: unknown) {
    clearError.value = err instanceof Error ? err.message : '清除失敗，請稍後再試。';
    setTimeout(() => { clearError.value = ''; }, 5000);
  } finally {
    clearing.value = false;
  }
}

const syncProgressPct = computed(() => {
  const p = syncStore.syncProgress;
  if (!p || p.totalTables === 0) return 0;
  const tableWeight = (p.currentTableIndex - 1) / p.totalTables;
  const rowWeight = p.totalRows > 0 ? p.processedRows / p.totalRows / p.totalTables : 0;
  return Math.min(100, Math.round((tableWeight + rowWeight) * 100));
});

const syncProgressText = computed(() => {
  const p = syncStore.syncProgress;
  if (!p || p.phase === 'idle') return '';
  const phaseLabel = p.phase === 'push' ? '推送中' : '拉取中';
  return `${phaseLabel}：${p.currentTable} (${p.currentTableIndex}/${p.totalTables})`;
});

onMounted(async () => {
  await settingsStore.fetchAll();
  await authStore.checkStatus();
  await syncStore.checkStatus();
  // Populate form from stored preferences
  const prefs = settingsStore.preferences;
  for (const key of Object.keys(form.value) as Array<keyof typeof form.value>) {
    if (prefs[key] !== undefined) {
      form.value[key] = prefs[key];
    }
  }
  // Handle ?tab= query
  if (route.query.tab === 'account') {
    activeTab.value = 'account';
  } else if (route.query.tab === 'sync') {
    activeTab.value = 'sync';
  }
  // 註冊同步進度事件
  onSyncStatus((data) => syncStore.handleSyncProgress(data));
  // 載入文件同步狀態
  await syncStore.refreshDocSyncStatus();
  // 載入自動審核規則
  await loadAutoApproveRules();

  // 還原自動同步排程偏好
  const savedAutoSyncEnabled = prefs['autoSyncEnabled'];
  const savedAutoSyncInterval = prefs['autoSyncInterval'];
  if (savedAutoSyncInterval) {
    autoSyncIntervalMs.value = Number(savedAutoSyncInterval);
  }
  if (savedAutoSyncEnabled === 'true' && syncStore.isConnected) {
    await syncStore.startScheduler(autoSyncIntervalMs.value);
  }
});

async function save() {
  const entries = Object.entries(form.value);
  for (const [key, value] of entries) {
    const category = getCategoryForKey(key);
    await settingsStore.update(key, String(value), category);
  }
  saveMessage.value = '設定已儲存';
  setTimeout(() => { saveMessage.value = ''; }, 2000);
}

function getCategoryForKey(key: string): string {
  if (['language', 'projectRoot'].includes(key)) return 'general';
  if (['cliPath', 'defaultModel', 'maxTurns'].includes(key)) return 'claude';
  if (['autoSave', 'terminalFontSize'].includes(key)) return 'session';
  if (['dailyTokenLimit', 'totalTokenLimit', 'alertThreshold'].includes(key)) return 'budget';
  return 'notification';
}

const models = [
  { value: 'opus', label: 'Claude Opus' },
  { value: 'sonnet', label: 'Claude Sonnet' },
  { value: 'haiku', label: 'Claude Haiku' },
];

// Sync helpers
async function saveParentPage() {
  if (parentPageInput.value.trim()) {
    await syncStore.setParentPage(parentPageInput.value.trim());
  }
}

async function handleInitDatabases() {
  initMessage.value = '';
  const result = await syncStore.initDatabases();
  if (result.success) {
    initMessage.value = `${result.created} 個 Database 初始化完成`;
    setTimeout(() => { initMessage.value = ''; }, 3000);
  }
}

function formatSyncTime(dateStr: string | null): string {
  if (!dateStr) return '尚未同步';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '剛才';
    if (diffMin < 60) return `${diffMin} 分鐘前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小時前`;
    return `${Math.floor(diffHr / 24)} 天前`;
  } catch {
    return dateStr;
  }
}

function dbStatusIcon(status: string): string {
  if (status === 'ok') return '\u2713';
  if (status === 'error') return '!';
  return '\u2717';
}

function dbStatusColor(status: string): string {
  if (status === 'ok') return 'text-success';
  if (status === 'error') return 'text-danger';
  return 'text-text-muted';
}

async function saveDocSyncRootPage(scope: string) {
  const pageId = docSyncRootPages.value[scope]?.trim();
  if (pageId) {
    await syncStore.setDocSyncRootPage(scope, pageId);
  }
}

function connectionDotClass(connection: string): string {
  if (connection === 'connected') return 'bg-success animate-pulse';
  if (connection === 'syncing') return 'bg-warning animate-pulse';
  if (connection === 'error') return 'bg-danger';
  return 'bg-text-muted';
}

function connectionLabel(connection: string): string {
  if (connection === 'connected') return '已連線';
  if (connection === 'syncing') return '同步中...';
  if (connection === 'error') return '錯誤';
  return '未連線';
}

async function toggleAutoSync(enabled: boolean) {
  if (enabled) {
    await syncStore.startScheduler(autoSyncIntervalMs.value);
    await settingsStore.update('autoSyncEnabled', 'true', 'sync');
    await settingsStore.update('autoSyncInterval', String(autoSyncIntervalMs.value), 'sync');
  } else {
    await syncStore.stopScheduler();
    await settingsStore.update('autoSyncEnabled', 'false', 'sync');
  }
}

async function changeAutoSyncInterval(ms: number) {
  autoSyncIntervalMs.value = ms;
  if (syncStore.schedulerEnabled) {
    // 重新啟動排程以套用新間隔
    await syncStore.startScheduler(ms);
  }
  await settingsStore.update('autoSyncInterval', String(ms), 'sync');
}
</script>

<template>
  <div>
    <!-- Horizontal tab bar -->
    <div class="mb-6 flex items-center gap-1 border-b border-border-default">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="cursor-pointer border-b-2 px-4 py-2.5 text-sm font-medium transition-all"
        :class="
          activeTab === tab.key
            ? 'border-accent text-accent-light'
            : 'border-transparent text-text-secondary hover:text-text-primary'
        "
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Content -->
    <div class="max-w-[640px]">
      <div class="rounded-xl border border-border-default bg-bg-card p-6">
        <!-- Account -->
        <div v-show="activeTab === 'account'" class="space-y-5">
          <h3 class="text-sm font-semibold">帳號連結</h3>
          <p class="text-xs text-text-muted">管理第三方服務的連結與授權。</p>

          <div class="rounded-xl border border-border-default bg-bg-primary p-5">
            <!-- Header -->
            <div class="mb-4 flex items-center gap-2 text-sm font-semibold">
              <svg class="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </div>

            <!-- 已連線 -->
            <div v-if="authStore.isAuthenticated" class="space-y-4">
              <div class="flex items-center gap-4">
                <img :src="authStore.user?.avatarUrl" class="h-14 w-14 rounded-full" />
                <div class="flex-1">
                  <div class="text-base font-semibold">{{ authStore.user?.login }}</div>
                  <div class="text-xs text-text-muted">{{ authStore.user?.email || '—' }}</div>
                  <div class="mt-1.5 flex items-center gap-3">
                    <span class="flex items-center gap-1 text-xs text-success">
                      <span class="inline-block h-1.5 w-1.5 rounded-full bg-success"></span>
                      已連線
                    </span>
                    <span class="rounded bg-bg-hover px-1.5 py-0.5 font-mono text-[10px] text-text-muted">repo</span>
                    <span class="rounded bg-bg-hover px-1.5 py-0.5 font-mono text-[10px] text-text-muted">read:user</span>
                  </div>
                </div>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  class="!text-danger"
                  :loading="authStore.loading"
                  @click="authStore.logout()"
                >
                  登出
                </BaseButton>
              </div>

              <div
                class="flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-3 py-2.5 text-[11px] text-text-muted"
              >
                <span>&#128274;</span>
                <span>Token 已透過 Electron safeStorage 加密儲存。</span>
              </div>
            </div>

            <!-- 未連線 -->
            <div v-else class="py-4 text-center">
              <p class="mb-4 text-sm text-text-secondary">連結 GitHub 帳號以啟用：</p>
              <div class="mx-auto mb-5 max-w-[280px] space-y-2 text-left">
                <div class="flex items-center gap-2.5 text-xs text-text-secondary">
                  <span class="flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-[10px] text-accent-light">&#8593;</span>
                  Git push / pull 認證
                </div>
                <div class="flex items-center gap-2.5 text-xs text-text-secondary">
                  <span class="flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-[10px] text-accent-light">&#8644;</span>
                  建立 Pull Request
                </div>
                <div class="flex items-center gap-2.5 text-xs text-text-secondary">
                  <span class="flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-[10px] text-accent-light">&#9888;</span>
                  建立 Issue
                </div>
                <div class="flex items-center gap-2.5 text-xs text-text-secondary">
                  <span class="flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-[10px] text-accent-light">&#128193;</span>
                  存取私有 Repository
                </div>
              </div>
              <button
                class="inline-flex items-center gap-2.5 rounded-lg bg-[#24292f] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#32383f]"
                :disabled="authStore.loading"
                @click="authStore.login()"
              >
                <svg class="h-5 w-5" viewBox="0 0 16 16" fill="white">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                {{ authStore.loading ? '連線中...' : '以 GitHub 登入' }}
              </button>
              <p v-if="authStore.error" class="mt-3 text-xs text-danger">{{ authStore.error }}</p>
            </div>
          </div>
        </div>

        <!-- Sync -->
        <div v-show="activeTab === 'sync'" class="space-y-5">
          <h3 class="text-sm font-semibold">雲端同步</h3>
          <p class="text-xs text-text-muted">使用 Notion 作為雲端後端，實現跨裝置同步專案資料。</p>

          <!-- 未連線狀態 -->
          <div v-if="!syncStore.isConnected" class="rounded-xl border border-dashed border-border-default p-8 text-center">
            <div class="mb-3 text-4xl opacity-40">&#9729;</div>
            <div class="mb-1.5 text-sm font-semibold">尚未設定雲端同步</div>
            <div class="mb-5 text-xs leading-relaxed text-text-muted">
              連結 Notion 後可以：<br />
              跨裝置同步專案資料 &middot; 雲端備份 &middot; 團隊協作共享
            </div>
            <button
              class="inline-flex items-center gap-2.5 rounded-lg bg-[#000000] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a]"
              :disabled="syncStore.loading"
              @click="syncStore.login()"
            >
              <span class="text-base">&#9729;</span>
              {{ syncStore.loading ? '連線中...' : '以 Notion 連結' }}
            </button>
            <p v-if="syncStore.error" class="mt-3 text-xs text-danger">{{ syncStore.error }}</p>
          </div>

          <!-- 已連線狀態 -->
          <template v-else>
            <!-- 1. 連線資訊 -->
            <div class="space-y-4">
              <div class="text-xs font-semibold">連線設定</div>

              <div class="flex items-center justify-between border-b border-border-default py-3.5">
                <div class="flex-1">
                  <div class="text-sm font-medium">Notion Workspace</div>
                  <div class="text-xs text-text-muted">{{ syncStore.status.workspaceName || '—' }}</div>
                </div>
                <div class="flex gap-2">
                  <BaseButton variant="ghost" size="sm" :loading="syncStore.loading" @click="syncStore.verify()">
                    驗證
                  </BaseButton>
                  <BaseButton
                    variant="ghost"
                    size="sm"
                    class="!text-danger"
                    :loading="syncStore.loading"
                    @click="syncStore.disconnect()"
                  >
                    斷開
                  </BaseButton>
                </div>
              </div>

              <div class="flex items-center justify-between border-b border-border-default py-3.5">
                <div class="flex-1">
                  <div class="text-sm font-medium">Notion 父頁面 ID</div>
                  <div class="text-xs text-text-muted">所有 Database 將建立在此頁面下</div>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    v-model="parentPageInput"
                    type="text"
                    placeholder="a1b2c3d4-e5f6-7890-abcd"
                    class="w-[220px] rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 font-mono text-[11px] text-text-primary outline-none focus:border-accent"
                  />
                  <BaseButton variant="ghost" size="sm" @click="saveParentPage">儲存</BaseButton>
                </div>
              </div>
            </div>

            <!-- 2. 同步狀態卡片 -->
            <div class="my-1 h-px bg-border-default"></div>
            <div class="text-xs font-semibold">同步狀態</div>

            <div class="rounded-xl border border-border-default bg-bg-card p-5">
              <div class="mb-4 flex items-center gap-2.5">
                <span class="inline-block h-2.5 w-2.5 rounded-full" :class="connectionDotClass(syncStore.status.connection)"></span>
                <span class="text-sm font-semibold">{{ connectionLabel(syncStore.status.connection) }}</span>
                <span class="ml-auto text-[11px] text-text-muted">
                  {{ formatSyncTime(syncStore.status.lastSyncAt) }}
                </span>
              </div>

              <div class="mb-4 grid grid-cols-2 gap-3">
                <div class="rounded-lg bg-bg-secondary p-3 text-center">
                  <div class="text-2xl font-bold text-success">{{ syncStore.status.pendingPush }}</div>
                  <div class="text-[11px] text-text-muted">&#8593; 待推送</div>
                </div>
                <div class="rounded-lg bg-bg-secondary p-3 text-center">
                  <div class="text-2xl font-bold text-info">{{ syncStore.status.pendingPull }}</div>
                  <div class="text-[11px] text-text-muted">&#8595; 待拉取</div>
                </div>
              </div>

              <!-- 進度條 -->
              <div class="mb-4">
                <div class="mb-1.5 h-1.5 overflow-hidden rounded-full bg-bg-hover">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-accent to-cyan-400 transition-all duration-300"
                    :style="{ width: `${syncStore.syncing ? syncProgressPct : 0}%` }"
                  ></div>
                </div>
                <div class="flex justify-between text-[11px] text-text-muted">
                  <span>{{ syncStore.syncing ? syncProgressText : '就緒' }}</span>
                  <span>{{ syncStore.syncing ? `${syncProgressPct}%` : '—' }}</span>
                </div>
              </div>

              <!-- 立即同步按鈕 -->
              <button
                class="w-full rounded-lg border border-border-default bg-bg-primary py-2 text-sm transition-colors hover:bg-bg-hover"
                :class="syncStore.syncing ? 'text-text-muted' : 'text-text-primary'"
                :disabled="syncStore.syncing"
                @click="syncStore.syncAll()"
              >
                <template v-if="syncStore.syncing">
                  <span class="mr-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-muted border-t-transparent align-middle"></span>
                  同步中...
                </template>
                <template v-else>
                  &#8635; 立即同步
                </template>
              </button>
            </div>

            <!-- 3. Notion 資料庫 -->
            <div class="my-1 h-px bg-border-default"></div>
            <div class="mb-1.5 text-xs font-semibold">Notion 資料庫</div>
            <div class="mb-3 text-[11px] text-text-muted">18 個 Database 對應本地 SQLite 表。</div>

            <div class="mb-4 grid grid-cols-2 gap-2">
              <div
                v-for="db in syncStore.status.databases"
                :key="db.tableName"
                class="flex items-center gap-2 rounded-lg border border-border-default bg-bg-card px-3 py-2 text-xs"
              >
                <span class="flex-shrink-0 text-sm" :class="dbStatusColor(db.status)">{{ dbStatusIcon(db.status) }}</span>
                <span class="flex-1 truncate">{{ db.displayName }}</span>
                <span class="font-mono text-[10px] text-text-muted">{{ db.localRowCount }}</span>
              </div>
            </div>

            <button
              class="w-full rounded-lg border border-border-default bg-bg-primary py-2 text-sm transition-colors hover:bg-bg-hover"
              :disabled="syncStore.loading"
              @click="handleInitDatabases"
            >
              {{ syncStore.loading ? '初始化中...' : '&#128736; 初始化 Notion Database' }}
            </button>
            <div class="mt-1.5 text-center text-[11px] text-text-muted">
              首次使用時建立 18 個 Database（約需 6 秒）
            </div>
            <p v-if="initMessage" class="mt-2 text-center text-xs text-success">{{ initMessage }}</p>
            <p v-if="syncStore.error && !initMessage" class="mt-2 text-center text-xs text-danger">{{ syncStore.error }}</p>

            <!-- 4. 知識庫/文件同步（6D） -->
            <div class="my-1 h-px bg-border-default"></div>
            <div class="mb-1.5 text-xs font-semibold">知識庫/文件同步</div>
            <div class="mb-3 text-[11px] text-text-muted">
              將 Markdown 檔案同步到 Notion 頁面，支援雙向同步。
            </div>

            <div class="space-y-3">
              <div
                v-for="ds in syncStore.docSyncStatuses"
                :key="ds.scope"
                class="rounded-lg border border-border-default bg-bg-primary p-4"
              >
                <div class="mb-2 flex items-center justify-between">
                  <div class="text-sm font-medium">{{ ds.label }}</div>
                  <div class="text-[11px] text-text-muted">
                    {{ ds.totalFiles }} 檔案 | 已同步: {{ ds.synced }} | 待推送: {{ ds.pendingPush }}
                  </div>
                </div>

                <div class="mb-3 flex items-center gap-2">
                  <input
                    v-model="docSyncRootPages[ds.scope]"
                    type="text"
                    :placeholder="ds.rootPageId || 'Notion 根頁面 ID'"
                    class="flex-1 rounded-lg border border-border-default bg-bg-secondary px-3 py-1.5 font-mono text-[11px] text-text-primary outline-none focus:border-accent"
                  />
                  <BaseButton variant="ghost" size="sm" @click="saveDocSyncRootPage(ds.scope)">
                    設定
                  </BaseButton>
                </div>

                <div class="flex gap-2">
                  <button
                    class="flex-1 rounded-lg border border-border-default bg-bg-secondary py-1.5 text-xs transition-colors hover:bg-bg-hover"
                    :disabled="syncStore.docSyncing || !ds.rootPageId"
                    :class="!ds.rootPageId ? 'opacity-40' : ''"
                    @click="syncStore.pushDocSync(ds.scope)"
                  >
                    &#8593; 推送
                  </button>
                  <button
                    class="flex-1 rounded-lg border border-border-default bg-bg-secondary py-1.5 text-xs transition-colors hover:bg-bg-hover"
                    :disabled="syncStore.docSyncing || !ds.rootPageId"
                    :class="!ds.rootPageId ? 'opacity-40' : ''"
                    @click="syncStore.pullDocSync(ds.scope, docConflictStrategy)"
                  >
                    &#8595; 拉取
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-3 flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs">
                <span class="text-text-secondary">衝突策略:</span>
                <select
                  v-model="docConflictStrategy"
                  class="rounded-lg border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none"
                >
                  <option value="local-wins">本地優先</option>
                  <option value="notion-wins">Notion 優先</option>
                  <option value="skip">跳過衝突</option>
                </select>
              </div>
              <button
                class="rounded-lg border border-border-default bg-bg-primary px-4 py-1.5 text-xs transition-colors hover:bg-bg-hover"
                :disabled="syncStore.docSyncing"
                @click="syncStore.syncAllDocs(docConflictStrategy)"
              >
                <template v-if="syncStore.docSyncing">
                  <span class="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-text-muted border-t-transparent align-middle"></span>
                  同步中...
                </template>
                <template v-else>
                  &#8635; 同步全部
                </template>
              </button>
            </div>

            <p v-if="syncStore.docSyncError" class="mt-2 text-xs text-danger">{{ syncStore.docSyncError }}</p>

            <!-- 5. 自動同步設定 -->
            <div class="my-1 h-px bg-border-default"></div>
            <div class="mb-3 text-xs font-semibold">自動同步</div>

            <div>
              <div class="flex items-center justify-between border-b border-border-default py-3.5">
                <div>
                  <div class="text-sm font-medium">啟用自動同步</div>
                  <div class="text-xs text-text-muted">定期自動同步本地變更到 Notion</div>
                </div>
                <BaseToggle
                  :model-value="syncStore.schedulerEnabled"
                  @update:model-value="toggleAutoSync"
                />
              </div>

              <div class="flex items-center justify-between border-b border-border-default py-3.5">
                <div>
                  <div class="text-sm font-medium">同步間隔</div>
                  <div class="text-xs text-text-muted">自動同步的時間間隔</div>
                </div>
                <select
                  :value="autoSyncIntervalMs"
                  class="rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                  @change="changeAutoSyncInterval(Number(($event.target as HTMLSelectElement).value))"
                >
                  <option :value="1 * 60 * 1000">1 分鐘</option>
                  <option :value="5 * 60 * 1000">5 分鐘</option>
                  <option :value="15 * 60 * 1000">15 分鐘</option>
                  <option :value="30 * 60 * 1000">30 分鐘</option>
                  <option :value="60 * 60 * 1000">60 分鐘</option>
                </select>
              </div>

              <div class="flex items-center justify-between py-3.5">
                <div>
                  <div class="text-sm font-medium">衝突策略</div>
                  <div class="text-xs text-text-muted">當本地與雲端資料衝突時的處理方式</div>
                </div>
                <select
                  class="rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="lww">Last-Write-Wins</option>
                </select>
              </div>
            </div>

            <!-- 離線佇列回放 -->
            <div class="mt-2 flex items-center justify-between rounded-lg border border-border-default bg-bg-primary px-4 py-3">
              <div>
                <div class="text-sm font-medium">離線佇列回放</div>
                <div class="text-xs text-text-muted">
                  回放所有待同步的離線操作（{{ syncStore.status.pendingPush }} 筆待推送）
                </div>
              </div>
              <BaseButton
                variant="ghost"
                size="sm"
                :loading="syncStore.syncing"
                :disabled="syncStore.status.pendingPush === 0"
                @click="syncStore.flushQueue()"
              >
                立即回放
              </BaseButton>
            </div>

            <!-- 5. 資訊框 -->
            <div class="mt-4 flex items-start gap-2 rounded-lg border border-border-default bg-bg-secondary px-3.5 py-3 text-[11px] leading-relaxed text-text-muted">
              <span class="mt-0.5 flex-shrink-0 text-sm">&#9432;</span>
              <div>
                <strong>離線模式</strong><br />
                無網路時本地 SQLite 正常運作，所有變更會記錄到 sync_queue。恢復連線後自動推送待同步資料。<br /><br />
                <strong>Rate Limit</strong><br />
                Notion API 限制 3 req/s，批次操作已內建佇列與自動重試。
              </div>
            </div>
          </template>
        </div>

        <!-- General -->
        <div v-show="activeTab === 'general'" class="space-y-5">
          <h3 class="text-sm font-semibold">一般設定</h3>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">語言</label>
            <select
              v-model="form.language"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">專案根目錄</label>
            <input
              v-model="form.projectRoot"
              type="text"
              placeholder="C:\projects"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          <!-- Danger Zone -->
          <div class="rounded-xl border border-danger/40 bg-danger/5 p-5">
            <div class="mb-1 text-sm font-semibold text-danger">危險區域</div>
            <p class="mb-4 text-xs leading-relaxed text-text-muted">
              以下操作具有不可復原的風險，請謹慎使用。資料庫結構（schema_migrations）將保留，應用程式不會損壞。
            </p>
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium">清除所有資料</div>
                <div class="text-xs text-text-muted">刪除所有專案、任務、衝刺、工作階段等業務資料</div>
              </div>
              <button
                class="rounded-lg border border-danger bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="clearing"
                @click="handleClearDatabase"
              >
                <template v-if="clearing">
                  <span class="mr-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-danger border-t-transparent align-middle"></span>
                  清除中...
                </template>
                <template v-else>
                  清除所有資料
                </template>
              </button>
            </div>
            <p v-if="clearMessage" class="mt-3 text-xs text-success">{{ clearMessage }}</p>
            <p v-if="clearError" class="mt-3 text-xs text-danger">{{ clearError }}</p>
          </div>
        </div>

        <!-- Claude Code -->
        <div v-show="activeTab === 'claude'" class="space-y-5">
          <h3 class="text-sm font-semibold">Claude 命令列設定</h3>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">CLI 路徑</label>
            <input
              v-model="form.cliPath"
              type="text"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">預設 Model</label>
            <select
              v-model="form.defaultModel"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
              <option v-for="m in models" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">最大回合數</label>
            <input
              v-model="form.maxTurns"
              type="number"
              min="1"
              max="100"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
        </div>

        <!-- Session -->
        <div v-show="activeTab === 'session'" class="space-y-5">
          <h3 class="text-sm font-semibold">工作階段設定</h3>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">自動儲存</div>
              <div class="text-xs text-text-muted">Session 結束後自動儲存記錄</div>
            </div>
            <BaseToggle
              :model-value="form.autoSave === 'true'"
              @update:model-value="form.autoSave = $event ? 'true' : 'false'"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">終端字體大小</label>
            <input
              v-model="form.terminalFontSize"
              type="number"
              min="10"
              max="24"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
        </div>

        <!-- Budget -->
        <div v-show="activeTab === 'budget'" class="space-y-5">
          <h3 class="text-sm font-semibold">預算設定</h3>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">每日 Token 限額</label>
            <input
              v-model="form.dailyTokenLimit"
              type="number"
              min="0"
              step="50000"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">總 Token 限額</label>
            <input
              v-model="form.totalTokenLimit"
              type="number"
              min="0"
              step="1000000"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-text-secondary">警示閾值 (%)</label>
            <input
              v-model="form.alertThreshold"
              type="number"
              min="50"
              max="100"
              class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
        </div>

        <!-- Notification -->
        <div v-show="activeTab === 'notification'" class="space-y-5">
          <h3 class="text-sm font-semibold">通知設定</h3>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">工作階段完成</div>
              <div class="text-xs text-text-muted">代理人完成任務時通知</div>
            </div>
            <BaseToggle
              :model-value="form.notifySessionComplete === 'true'"
              @update:model-value="form.notifySessionComplete = $event ? 'true' : 'false'"
            />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">工作階段失敗</div>
              <div class="text-xs text-text-muted">代理人執行失敗時通知</div>
            </div>
            <BaseToggle
              :model-value="form.notifySessionFailed === 'true'"
              @update:model-value="form.notifySessionFailed = $event ? 'true' : 'false'"
            />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">預算警告</div>
              <div class="text-xs text-text-muted">預算超過閾值時通知</div>
            </div>
            <BaseToggle
              :model-value="form.notifyBudgetWarning === 'true'"
              @update:model-value="form.notifyBudgetWarning = $event ? 'true' : 'false'"
            />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">關卡提交</div>
              <div class="text-xs text-text-muted">審核關卡提交時通知</div>
            </div>
            <BaseToggle
              :model-value="form.notifyGateSubmit === 'true'"
              @update:model-value="form.notifyGateSubmit = $event ? 'true' : 'false'"
            />
          </div>
        </div>

        <!-- Shortcuts -->
        <div v-show="activeTab === 'shortcuts'" class="space-y-5">
          <h3 class="text-sm font-semibold">全域快捷鍵</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between rounded-lg border border-border-default bg-bg-primary px-4 py-3">
              <div>
                <div class="text-sm font-medium">顯示/隱藏視窗</div>
                <div class="text-xs text-text-muted">在任何地方切換 Maestro 視窗</div>
              </div>
              <kbd class="rounded border border-border-light bg-bg-hover px-2.5 py-1 font-mono text-xs text-text-secondary">
                Ctrl+Shift+M
              </kbd>
            </div>
            <div class="flex items-center justify-between rounded-lg border border-border-default bg-bg-primary px-4 py-3">
              <div>
                <div class="text-sm font-medium">命令面板</div>
                <div class="text-xs text-text-muted">搜尋並執行快速命令</div>
              </div>
              <kbd class="rounded border border-border-light bg-bg-hover px-2.5 py-1 font-mono text-xs text-text-secondary">
                Ctrl+K
              </kbd>
            </div>
            <div class="flex items-center justify-between rounded-lg border border-border-default bg-bg-primary px-4 py-3">
              <div>
                <div class="text-sm font-medium">新增工作階段</div>
                <div class="text-xs text-text-muted">快速啟動新的工作階段</div>
              </div>
              <kbd class="rounded border border-border-light bg-bg-hover px-2.5 py-1 font-mono text-xs text-text-secondary">
                Ctrl+N
              </kbd>
            </div>
          </div>
        </div>

        <!-- ===== Permissions tab ===== -->
        <div v-show="activeTab === 'permissions'" class="space-y-5">
          <h3 class="text-sm font-semibold">自動審核規則</h3>
          <p class="text-xs text-text-muted">
            符合規則的 Gate 將自動通過審核，無需人工介入。
          </p>

          <!-- Rules list -->
          <div v-if="autoApproveRules.length > 0" class="space-y-2">
            <div
              v-for="rule in autoApproveRules"
              :key="rule.id"
              class="flex items-center gap-3 rounded-lg border border-border-default bg-bg-primary px-4 py-3"
            >
              <BaseToggle :model-value="rule.enabled" @update:model-value="toggleRuleEnabled(rule)" />
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium">{{ rule.name }}</div>
                <div class="text-xs text-text-muted">
                  適用：{{ rule.gateTypes.join(', ') }}
                </div>
              </div>
              <button
                class="cursor-pointer border-none bg-transparent text-xs text-danger hover:underline"
                @click="deleteRule(rule.id)"
              >
                刪除
              </button>
            </div>
          </div>
          <div v-else class="rounded-lg border border-border-default bg-bg-primary px-4 py-6 text-center text-xs text-text-muted">
            尚無自動審核規則
          </div>

          <!-- New rule form -->
          <div v-if="showNewRuleForm" class="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted">規則名稱</label>
              <input
                v-model="newRuleName"
                type="text"
                class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                placeholder="例如：自動通過需求確認"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted">適用 Gate 類型</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="gt in availableGateTypes"
                  :key="gt"
                  class="cursor-pointer rounded-md border px-3 py-1 text-xs font-medium transition-colors"
                  :class="
                    newRuleGateTypes.includes(gt)
                      ? 'border-accent bg-accent/15 text-accent-light'
                      : 'border-border-default bg-bg-primary text-text-muted hover:border-accent/40'
                  "
                  @click="toggleGateType(gt)"
                >
                  {{ gt }}
                </button>
              </div>
            </div>
            <div class="flex gap-2">
              <BaseButton variant="primary" size="sm" :disabled="!newRuleName.trim() || newRuleGateTypes.length === 0" @click="addAutoApproveRule">
                儲存規則
              </BaseButton>
              <BaseButton variant="ghost" size="sm" @click="showNewRuleForm = false">
                取消
              </BaseButton>
            </div>
          </div>

          <BaseButton v-if="!showNewRuleForm" variant="secondary" size="sm" @click="showNewRuleForm = true">
            + 新增規則
          </BaseButton>

          <!-- G4/G5 warning -->
          <div class="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
            <p class="text-xs font-medium text-warning">
              G5（部署就緒）和 G6（正式發佈）始終需要手動審核，無法設定自動通過。
            </p>
          </div>
        </div>

        <!-- Save button -->
        <div v-if="activeTab !== 'sync' && activeTab !== 'permissions'" class="mt-6 flex items-center gap-3 border-t border-border-default pt-4">
          <BaseButton @click="save">儲存設定</BaseButton>
          <span v-if="saveMessage" class="text-xs text-success">{{ saveMessage }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
