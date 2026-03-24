import { ipcMain } from 'electron';
import { IpcChannels } from '../types';
import { communicationBus } from '../services/communication-bus';
import { logger } from '../utils/logger';

export function registerObjectionHandlers(): void {
  ipcMain.handle(IpcChannels.OBJECTION_LIST, async () => {
    try {
      return communicationBus.getOpenObjections();
    } catch (err) {
      logger.error('Failed to list objections', err);
      return [];
    }
  });

  ipcMain.handle(
    IpcChannels.OBJECTION_RESOLVE,
    async (_event, params: { objectionId: string; resolution: string; resolvedBy: string }) => {
      try {
        return communicationBus.resolveObjection(
          params.objectionId,
          params.resolution,
          params.resolvedBy,
        );
      } catch (err) {
        logger.error('Failed to resolve objection', err);
        throw err;
      }
    },
  );
}
