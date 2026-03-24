// Doc Sync IPC Handlers — Phase 6D
// Markdown ↔ Notion 文件同步

import { ipcMain } from 'electron';
import { IpcChannels } from '../types';
import { docSyncManager } from '../services/doc-sync-manager';
import { logger } from '../utils/logger';
import type { DocSyncScope, DocSyncOptions } from '../types/sync';

export function registerDocSyncHandlers(): void {
  // 取得指定 scope 的同步狀態
  ipcMain.handle(
    IpcChannels.DOC_SYNC_GET_STATUS,
    (_event, scope: DocSyncScope, projectWorkDir?: string) => {
      try {
        return docSyncManager.getStatus(scope, projectWorkDir);
      } catch (err) {
        logger.error('[IPC] doc-sync:get-status 失敗', err);
        throw err;
      }
    },
  );

  // 探索檔案清單
  ipcMain.handle(
    IpcChannels.DOC_SYNC_DISCOVER,
    (_event, scope: DocSyncScope, projectWorkDir?: string) => {
      try {
        return docSyncManager.discoverFiles(scope, projectWorkDir);
      } catch (err) {
        logger.error('[IPC] doc-sync:discover 失敗', err);
        throw err;
      }
    },
  );

  // 取得映射列表
  ipcMain.handle(IpcChannels.DOC_SYNC_GET_MAPPINGS, (_event, scope: DocSyncScope) => {
    try {
      return docSyncManager.getMappings(scope);
    } catch (err) {
      logger.error('[IPC] doc-sync:get-mappings 失敗', err);
      throw err;
    }
  });

  // 設定根頁面 ID
  ipcMain.handle(
    IpcChannels.DOC_SYNC_SET_ROOT_PAGE,
    (_event, scope: DocSyncScope, pageId: string) => {
      try {
        docSyncManager.setRootPageId(scope, pageId);
        return { success: true };
      } catch (err) {
        logger.error('[IPC] doc-sync:set-root-page 失敗', err);
        throw err;
      }
    },
  );

  // Push 推送
  ipcMain.handle(IpcChannels.DOC_SYNC_PUSH, async (_event, options: DocSyncOptions) => {
    try {
      return await docSyncManager.push(options);
    } catch (err) {
      logger.error('[IPC] doc-sync:push 失敗', err);
      throw err;
    }
  });

  // Pull 拉取
  ipcMain.handle(IpcChannels.DOC_SYNC_PULL, async (_event, options: DocSyncOptions) => {
    try {
      return await docSyncManager.pull(options);
    } catch (err) {
      logger.error('[IPC] doc-sync:pull 失敗', err);
      throw err;
    }
  });

  // 同步全部（push + pull）
  ipcMain.handle(IpcChannels.DOC_SYNC_SYNC_ALL, async (_event, options: DocSyncOptions) => {
    try {
      return await docSyncManager.syncAll(options);
    } catch (err) {
      logger.error('[IPC] doc-sync:sync-all 失敗', err);
      throw err;
    }
  });
}
