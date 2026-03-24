import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useIpc } from '../composables/useIpc';

export interface SyncStatus {
  connection: 'disconnected' | 'connected' | 'syncing' | 'error';
  workspaceName: string | null;
  workspaceIcon: string | null;
  lastSyncAt: string | null;
  pendingPush: number;
  pendingPull: number;
  databases: NotionDbInfo[];
}

export interface NotionDbInfo {
  tableName: string;
  displayName: string;
  notionDatabaseId: string | null;
  localRowCount: number;
  status: 'ok' | 'missing' | 'error';
  lastSyncedAt: string | null;
}

const DEFAULT_STATUS: SyncStatus = {
  connection: 'disconnected',
  workspaceName: null,
  workspaceIcon: null,
  lastSyncAt: null,
  pendingPush: 0,
  pendingPull: 0,
  databases: [],
};

export interface SyncProgress {
  phase: 'push' | 'pull' | 'idle';
  currentTable: string;
  currentTableIndex: number;
  totalTables: number;
  processedRows: number;
  totalRows: number;
  errors: number;
  startedAt: string;
}

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
  durationMs: number;
}

export interface DocSyncStatus {
  scope: string;
  label: string;
  totalFiles: number;
  synced: number;
  pendingPush: number;
  rootPageId: string | null;
}

export interface DocSyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
  durationMs: number;
}

export const useSyncStore = defineStore('sync', () => {
  const {
    notionLogin,
    notionDisconnect,
    notionGetStatus,
    notionVerify,
    notionSetParentPage,
    notionInitDatabases,
    notionGetDbStatus,
    notionSyncPush,
    notionSyncPull,
    notionSyncAll,
    notionSchedulerStart,
    notionSchedulerStop,
    notionQueueFlush,
    docSyncGetStatus,
    docSyncSetRootPage,
    docSyncPush,
    docSyncPull,
    docSyncSyncAll,
  } = useIpc();

  const status = ref<SyncStatus>({ ...DEFAULT_STATUS });
  const loading = ref(false);
  const error = ref<string | null>(null);
  const syncing = ref(false);
  const syncProgress = ref<SyncProgress | null>(null);

  // 排程器狀態
  const schedulerEnabled = ref(false);
  const schedulerInterval = ref(5 * 60 * 1000); // 預設 5 分鐘

  const isConnected = computed(() => status.value.connection !== 'disconnected');

  async function checkStatus() {
    try {
      const result = (await notionGetStatus()) as SyncStatus;
      status.value = result;
    } catch {
      status.value = { ...DEFAULT_STATUS };
    }
  }

  async function login() {
    loading.value = true;
    error.value = null;
    try {
      const result = (await notionLogin()) as {
        success: boolean;
        connection?: unknown;
        error?: string;
      };
      if (result.success) {
        await checkStatus();
      } else {
        error.value = result.error || '連結失敗';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '連結失敗';
    } finally {
      loading.value = false;
    }
  }

  async function disconnect() {
    loading.value = true;
    error.value = null;
    try {
      await notionDisconnect();
      status.value = { ...DEFAULT_STATUS };
    } catch (err) {
      error.value = err instanceof Error ? err.message : '斷開連線失敗';
    } finally {
      loading.value = false;
    }
  }

  async function verify() {
    loading.value = true;
    error.value = null;
    try {
      const result = await notionVerify();
      if (!result.valid) {
        error.value = result.error || '連線驗證失敗';
      }
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '驗證失敗';
      return { valid: false, error: error.value };
    } finally {
      loading.value = false;
    }
  }

  async function setParentPage(pageId: string) {
    error.value = null;
    try {
      await notionSetParentPage(pageId);
      await checkStatus();
    } catch (err) {
      error.value = err instanceof Error ? err.message : '設定父頁面失敗';
    }
  }

  async function initDatabases() {
    loading.value = true;
    error.value = null;
    try {
      const result = await notionInitDatabases();
      if (!result.success) {
        error.value = result.error || '初始化 Database 失敗';
      }
      await checkStatus();
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化 Database 失敗';
      return { success: false, created: 0, error: error.value };
    } finally {
      loading.value = false;
    }
  }

  async function refreshDbStatus() {
    try {
      const dbs = (await notionGetDbStatus()) as NotionDbInfo[];
      status.value.databases = dbs;
    } catch {
      // 靜默失敗
    }
  }

  async function push(tableName?: string) {
    syncing.value = true;
    error.value = null;
    try {
      const result = (await notionSyncPush(tableName)) as SyncResult;
      if (!result.success) {
        error.value = result.errors.join('; ');
      }
      await checkStatus();
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '推送失敗';
      return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: [error.value], durationMs: 0 };
    } finally {
      syncing.value = false;
      syncProgress.value = null;
    }
  }

  async function pull(tableName?: string) {
    syncing.value = true;
    error.value = null;
    try {
      const result = (await notionSyncPull(tableName)) as SyncResult;
      if (!result.success) {
        error.value = result.errors.join('; ');
      }
      await checkStatus();
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '拉取失敗';
      return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: [error.value], durationMs: 0 };
    } finally {
      syncing.value = false;
      syncProgress.value = null;
    }
  }

  async function syncAll(options?: unknown) {
    syncing.value = true;
    error.value = null;
    try {
      const result = (await notionSyncAll(options)) as SyncResult;
      if (!result.success) {
        error.value = result.errors.join('; ');
      }
      await checkStatus();
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '同步失敗';
      return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: [error.value], durationMs: 0 };
    } finally {
      syncing.value = false;
      syncProgress.value = null;
    }
  }

  async function startScheduler(intervalMs?: number) {
    error.value = null;
    try {
      const result = await notionSchedulerStart(intervalMs ?? schedulerInterval.value) as {
        success: boolean;
        enabled: boolean;
        interval: number;
      };
      schedulerEnabled.value = result.enabled;
      schedulerInterval.value = result.interval;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '啟動排程失敗';
    }
  }

  async function stopScheduler() {
    error.value = null;
    try {
      await notionSchedulerStop();
      schedulerEnabled.value = false;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '停止排程失敗';
    }
  }

  async function flushQueue() {
    error.value = null;
    try {
      const result = await notionQueueFlush() as { processed: number; failed: number };
      await checkStatus();
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '佇列回放失敗';
      return { processed: 0, failed: 0 };
    }
  }

  function handleSyncProgress(data: unknown) {
    syncProgress.value = data as SyncProgress;
    if ((data as SyncProgress).phase === 'idle') {
      syncing.value = false;
    }
  }

  // ── Doc Sync (Phase 6D) ──────────────────────────────

  const docSyncStatuses = ref<DocSyncStatus[]>([]);
  const docSyncing = ref(false);
  const docSyncError = ref<string | null>(null);

  async function refreshDocSyncStatus() {
    try {
      const knowledge = (await docSyncGetStatus('knowledge')) as DocSyncStatus;
      const docs = (await docSyncGetStatus('docs')) as DocSyncStatus;
      docSyncStatuses.value = [knowledge, docs];
    } catch {
      // 靜默失敗（可能 migration 尚未執行）
    }
  }

  async function setDocSyncRootPage(scope: string, pageId: string) {
    docSyncError.value = null;
    try {
      await docSyncSetRootPage(scope, pageId);
      await refreshDocSyncStatus();
    } catch (err) {
      docSyncError.value = err instanceof Error ? err.message : '設定根頁面失敗';
    }
  }

  async function pushDocSync(scope: string) {
    docSyncing.value = true;
    docSyncError.value = null;
    try {
      const result = (await docSyncPush({ scope })) as DocSyncResult;
      if (!result.success) {
        docSyncError.value = result.errors.join('; ');
      }
      await refreshDocSyncStatus();
      return result;
    } catch (err) {
      docSyncError.value = err instanceof Error ? err.message : '推送失敗';
      return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: [docSyncError.value!], durationMs: 0 };
    } finally {
      docSyncing.value = false;
    }
  }

  async function pullDocSync(scope: string, conflictStrategy?: string) {
    docSyncing.value = true;
    docSyncError.value = null;
    try {
      const result = (await docSyncPull({ scope, conflictStrategy })) as DocSyncResult;
      if (!result.success) {
        docSyncError.value = result.errors.join('; ');
      }
      await refreshDocSyncStatus();
      return result;
    } catch (err) {
      docSyncError.value = err instanceof Error ? err.message : '拉取失敗';
      return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: [docSyncError.value!], durationMs: 0 };
    } finally {
      docSyncing.value = false;
    }
  }

  async function syncAllDocs(conflictStrategy?: string) {
    docSyncing.value = true;
    docSyncError.value = null;
    try {
      const results: DocSyncResult[] = [];
      for (const s of docSyncStatuses.value) {
        const result = (await docSyncSyncAll({
          scope: s.scope,
          conflictStrategy,
        })) as DocSyncResult;
        results.push(result);
      }
      const merged: DocSyncResult = {
        success: results.every((r) => r.success),
        pushed: results.reduce((sum, r) => sum + r.pushed, 0),
        pulled: results.reduce((sum, r) => sum + r.pulled, 0),
        conflicts: results.reduce((sum, r) => sum + r.conflicts, 0),
        errors: results.flatMap((r) => r.errors),
        durationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
      };
      if (!merged.success) {
        docSyncError.value = merged.errors.join('; ');
      }
      await refreshDocSyncStatus();
      return merged;
    } catch (err) {
      docSyncError.value = err instanceof Error ? err.message : '同步失敗';
      return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: [docSyncError.value!], durationMs: 0 };
    } finally {
      docSyncing.value = false;
    }
  }

  return {
    status,
    loading,
    error,
    syncing,
    syncProgress,
    isConnected,
    schedulerEnabled,
    schedulerInterval,
    checkStatus,
    login,
    disconnect,
    verify,
    setParentPage,
    initDatabases,
    refreshDbStatus,
    push,
    pull,
    syncAll,
    startScheduler,
    stopScheduler,
    flushQueue,
    handleSyncProgress,
    // Doc Sync (Phase 6D)
    docSyncStatuses,
    docSyncing,
    docSyncError,
    refreshDocSyncStatus,
    setDocSyncRootPage,
    pushDocSync,
    pullDocSync,
    syncAllDocs,
  };
});
