import { ipcMain } from 'electron';
import { sprintManager } from '../services/sprint-manager';
import { gateKeeper } from '../services/gate-keeper';
import { IpcChannels } from '../types';
import type { SprintCreateParams } from '../types';

export function registerSprintHandlers(): void {
  ipcMain.handle(IpcChannels.SPRINT_CREATE, (_e, params: SprintCreateParams) => {
    const sprint = sprintManager.create(params);
    gateKeeper.initializePipeline(params.projectId, sprint.id, params.sprintType || 'full');
    return sprint;
  });

  ipcMain.handle(IpcChannels.SPRINT_LIST, (_e, projectId: string) => {
    return sprintManager.list(projectId);
  });

  ipcMain.handle(IpcChannels.SPRINT_GET, (_e, id: string) => {
    return sprintManager.getById(id);
  });

  ipcMain.handle(IpcChannels.SPRINT_START, (_e, id: string) => {
    return sprintManager.start(id);
  });

  ipcMain.handle(IpcChannels.SPRINT_ENTER_REVIEW, (_e, id: string) => {
    return sprintManager.enterReview(id);
  });

  ipcMain.handle(IpcChannels.SPRINT_COMPLETE, (_e, id: string) => {
    return sprintManager.complete(id);
  });

  ipcMain.handle(IpcChannels.SPRINT_GET_STATUS, (_e, id: string) => {
    return sprintManager.getStatus(id);
  });
}
