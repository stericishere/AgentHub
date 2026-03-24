// Notion Sync IPC Handlers
// 處理 Notion OAuth 認證及同步相關的 IPC 呼叫

import { ipcMain } from 'electron';
import { IpcChannels } from '../types';
import { syncManager } from '../services/sync-manager';
import { syncScheduler } from '../services/sync-scheduler';
import { logger } from '../utils/logger';

export function registerSyncHandlers(): void {
  // 啟動 Notion OAuth 登入流程
  ipcMain.handle(IpcChannels.NOTION_LOGIN, async () => {
    try {
      return await syncManager.startOAuthFlow();
    } catch (err) {
      logger.error('[IPC] notion:login 失敗', err);
      throw err;
    }
  });

  // 斷開 Notion 連線
  ipcMain.handle(IpcChannels.NOTION_DISCONNECT, () => {
    try {
      syncManager.disconnect();
      return { success: true };
    } catch (err) {
      logger.error('[IPC] notion:disconnect 失敗', err);
      throw err;
    }
  });

  // 取得同步狀態
  ipcMain.handle(IpcChannels.NOTION_GET_STATUS, () => {
    try {
      return syncManager.getStatus();
    } catch (err) {
      logger.error('[IPC] notion:get-status 失敗', err);
      throw err;
    }
  });

  // 驗證連線
  ipcMain.handle(IpcChannels.NOTION_VERIFY, async () => {
    try {
      return await syncManager.verifyConnection();
    } catch (err) {
      logger.error('[IPC] notion:verify 失敗', err);
      throw err;
    }
  });

  // 設定父頁面 ID
  ipcMain.handle(IpcChannels.NOTION_SET_PARENT_PAGE, (_event, pageId: string) => {
    try {
      syncManager.setParentPageId(pageId);
      return { success: true };
    } catch (err) {
      logger.error('[IPC] notion:set-parent-page 失敗', err);
      throw err;
    }
  });

  // 初始化 Notion Databases
  ipcMain.handle(IpcChannels.NOTION_INIT_DATABASES, async () => {
    try {
      return await syncManager.initializeDatabases();
    } catch (err) {
      logger.error('[IPC] notion:init-databases 失敗', err);
      throw err;
    }
  });

  // 取得 Database 狀態
  ipcMain.handle(IpcChannels.NOTION_GET_DB_STATUS, () => {
    try {
      return syncManager.getDatabaseStatus();
    } catch (err) {
      logger.error('[IPC] notion:get-db-status 失敗', err);
      throw err;
    }
  });

  // 推送本地資料到 Notion
  ipcMain.handle(IpcChannels.NOTION_SYNC_PUSH, async (_event, tableName?: string) => {
    try {
      return await syncManager.push(tableName);
    } catch (err) {
      logger.error('[IPC] notion:sync-push 失敗', err);
      throw err;
    }
  });

  // 從 Notion 拉取資料到本地
  ipcMain.handle(IpcChannels.NOTION_SYNC_PULL, async (_event, tableName?: string) => {
    try {
      return await syncManager.pull(tableName);
    } catch (err) {
      logger.error('[IPC] notion:sync-pull 失敗', err);
      throw err;
    }
  });

  // 雙向同步（push → pull）
  ipcMain.handle(IpcChannels.NOTION_SYNC_ALL, async (_event, options?: unknown) => {
    try {
      return await syncManager.syncAll(options as any);
    } catch (err) {
      logger.error('[IPC] notion:sync-all 失敗', err);
      throw err;
    }
  });

  // 啟動自動同步排程
  ipcMain.handle(IpcChannels.SYNC_SCHEDULER_START, (_event, intervalMs?: number) => {
    try {
      syncScheduler.configure(() => syncManager.syncAll().then(() => undefined));
      syncScheduler.start(intervalMs);
      return { success: true, enabled: true, interval: syncScheduler.interval };
    } catch (err) {
      logger.error('[IPC] sync:scheduler-start 失敗', err);
      throw err;
    }
  });

  // 停止自動同步排程
  ipcMain.handle(IpcChannels.SYNC_SCHEDULER_STOP, () => {
    try {
      syncScheduler.stop();
      return { success: true, enabled: false };
    } catch (err) {
      logger.error('[IPC] sync:scheduler-stop 失敗', err);
      throw err;
    }
  });

  // 回放離線佇列
  ipcMain.handle(IpcChannels.SYNC_QUEUE_FLUSH, async () => {
    try {
      return await syncManager.flushQueue();
    } catch (err) {
      logger.error('[IPC] sync:queue-flush 失敗', err);
      throw err;
    }
  });
}
