import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IpcChannels } from '../types';
import { database } from '../services/database';
import { agentLoader } from '../services/agent-loader';
import { sessionManager } from '../services/session-manager';
import { logger } from '../utils/logger';

export function registerSystemHandlers(): void {
  ipcMain.handle(IpcChannels.SYSTEM_GET_HEALTH, () => {
    try {
      let dbConnected = false;
      try {
        database.prepare('SELECT 1');
        dbConnected = true;
      } catch {
        dbConnected = false;
      }

      return {
        version: '0.1.0',
        claudeCodeAvailable: sessionManager.isClaudeAvailable(),
        claudeCodeVersion: null,
        dbConnected,
        agentsLoaded: agentLoader.getCount(),
        activeSessions: sessionManager.getActiveCount(),
      };
    } catch (err) {
      logger.error('Failed to get health status', err);
      throw err;
    }
  });

  ipcMain.handle(IpcChannels.SYSTEM_CLEAR_DATABASE, () => {
    try {
      const activeCount = sessionManager.getActiveCount();
      if (activeCount > 0) {
        throw new Error(`無法清除資料：目前有 ${activeCount} 個工作階段執行中，請先停止所有工作階段。`);
      }
      const result = database.clearAllData();
      logger.info('Database cleared via IPC', result.deletedCounts);
      return result;
    } catch (err) {
      logger.error('Failed to clear database', err);
      throw err;
    }
  });

  ipcMain.handle(IpcChannels.SYSTEM_SELECT_FOLDER, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      title: '選擇專案工作目錄',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
