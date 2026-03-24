import { ipcMain } from 'electron';
import { IpcChannels } from '../types';
import { costTracker } from '../services/cost-tracker';

export function registerCostHandlers(): void {
  ipcMain.handle(IpcChannels.COST_GET_OVERVIEW, () => {
    return costTracker.getOverview();
  });

  ipcMain.handle(IpcChannels.COST_GET_BREAKDOWN, (_e, type) => {
    return costTracker.getBreakdown(type);
  });

  ipcMain.handle(IpcChannels.COST_GET_BUDGET, (_e, projectId) => {
    return costTracker.getBudget(projectId);
  });

  ipcMain.handle(IpcChannels.COST_SET_BUDGET, (_e, params) => {
    return costTracker.setBudget(params);
  });
}
