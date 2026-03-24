import { Notification, BrowserWindow } from 'electron';
import { IpcChannels } from '../types';
import { eventBus } from './event-bus';
import { logger } from '../utils/logger';

class NotificationService {
  private mainWindow: BrowserWindow | null = null;

  initialize(win: BrowserWindow): void {
    this.mainWindow = win;
    this.setupListeners();
    logger.info('Notification service initialized');
  }

  private setupListeners(): void {
    // Session completed
    eventBus.onSessionStatus((change) => {
      if (change.status === 'completed') {
        this.send(
          'Session 完成',
          `${change.agentId} 已完成任務`,
          'session.completed',
        );
      } else if (change.status === 'failed') {
        this.send(
          'Session 失敗',
          `${change.agentId} 執行失敗${change.error ? `: ${change.error}` : ''}`,
          'session.failed',
        );
      }
    });
  }

  send(title: string, body: string, eventType: string): void {
    // Show OS notification if supported
    if (Notification.isSupported()) {
      const notification = new Notification({ title, body });
      notification.show();
    }

    // Also push to renderer
    this.mainWindow?.webContents.send(IpcChannels.NOTIFICATION, {
      type: eventType,
      title,
      body,
      timestamp: new Date().toISOString(),
    });
  }

  notifyBudgetWarning(pct: number): void {
    this.send('預算警告', `今日預算已使用 ${Math.round(pct)}%`, 'budget.warning');
  }

  notifyGateSubmitted(gateType: string): void {
    this.send('Gate 提交', `${gateType} 審核已提交`, 'gate.submitted');
  }
}

export const notificationService = new NotificationService();
