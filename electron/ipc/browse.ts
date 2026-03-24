import { ipcMain } from 'electron';
import { IpcChannels } from '../types';

export function registerBrowseHandlers(): void {
  ipcMain.handle(IpcChannels.BROWSE_START, async () => {
    const browseServer = await import('../services/browse-server');
    return browseServer.start();
  });

  ipcMain.handle(IpcChannels.BROWSE_STOP, async () => {
    const browseServer = await import('../services/browse-server');
    await browseServer.stop();
    return { success: true };
  });

  ipcMain.handle(IpcChannels.BROWSE_STATUS, async () => {
    const browseServer = await import('../services/browse-server');
    return browseServer.getStatus();
  });
}
