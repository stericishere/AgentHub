import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { logger } from '../utils/logger';

class UpdaterService {
  private mainWindow: BrowserWindow | null = null;

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      logger.info(`Update available: ${info.version}`);
      this.sendToRenderer('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on('update-not-available', () => {
      logger.info('No update available');
    });

    autoUpdater.on('download-progress', (progress) => {
      this.sendToRenderer('update:progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info(`Update downloaded: ${info.version}`);
      this.sendToRenderer('update:downloaded', {
        version: info.version,
      });
    });

    autoUpdater.on('error', (err) => {
      logger.error('Auto-updater error', err);
    });

    // Check for updates (silently, don't block startup)
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000);
  }

  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      logger.warn('Failed to check for updates', err);
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      logger.error('Failed to download update', err);
    }
  }

  installAndRestart(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  private sendToRenderer(channel: string, data: unknown): void {
    this.mainWindow?.webContents.send(channel, data);
  }
}

export const updaterService = new UpdaterService();
