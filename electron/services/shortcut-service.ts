import { globalShortcut, BrowserWindow } from 'electron';
import { logger } from '../utils/logger';

class ShortcutService {
  private mainWindow: BrowserWindow | null = null;

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Ctrl+Shift+M: Global toggle visibility (the only global shortcut)
    this.registerGlobal('Ctrl+Shift+M', () => {
      if (!this.mainWindow) return;
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    // Ctrl+K and Ctrl+N: App-level shortcuts via webContents beforeInput
    // These only fire when the app window is focused (not global)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (!input.control || input.type !== 'keyDown') return;

      if (input.key === 'k' && !input.shift && !input.alt) {
        event.preventDefault();
        mainWindow.webContents.send('shortcut:command-palette');
      }

      if (input.key === 'n' && !input.shift && !input.alt) {
        event.preventDefault();
        mainWindow.webContents.send('shortcut:new-session');
      }
    });

    logger.info('Shortcut service initialized');
  }

  private registerGlobal(accelerator: string, callback: () => void): void {
    try {
      const success = globalShortcut.register(accelerator, callback);
      if (!success) {
        logger.warn(`Failed to register global shortcut: ${accelerator}`);
      }
    } catch (err) {
      logger.error(`Error registering global shortcut ${accelerator}`, err);
    }
  }

  destroy(): void {
    globalShortcut.unregisterAll();
    this.mainWindow = null;
  }
}

export const shortcutService = new ShortcutService();
