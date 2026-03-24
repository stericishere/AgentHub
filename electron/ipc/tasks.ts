import { ipcMain } from 'electron';
import { taskManager } from '../services/task-manager';
import { IpcChannels } from '../types';
import type {
  TaskCreateParams,
  TaskUpdateParams,
  TaskTransitionParams,
  TaskFilters,
} from '../types';

export function registerTaskHandlers(): void {
  ipcMain.handle(IpcChannels.TASK_CREATE, (_e, params: TaskCreateParams) => {
    return taskManager.create(params);
  });

  ipcMain.handle(IpcChannels.TASK_LIST, (_e, filters?: TaskFilters) => {
    return taskManager.list(filters);
  });

  ipcMain.handle(IpcChannels.TASK_GET, (_e, id: string) => {
    return taskManager.getById(id);
  });

  ipcMain.handle(IpcChannels.TASK_UPDATE, (_e, id: string, params: TaskUpdateParams) => {
    return taskManager.update(id, params);
  });

  ipcMain.handle(IpcChannels.TASK_DELETE, (_e, id: string) => {
    taskManager.delete(id);
    return { success: true };
  });

  ipcMain.handle(IpcChannels.TASK_TRANSITION, (_e, params: TaskTransitionParams) => {
    return taskManager.transition(params);
  });

  ipcMain.handle(
    IpcChannels.TASK_ADD_DEPENDENCY,
    (_e, taskId: string, dependsOnId: string) => {
      taskManager.addDependency(taskId, dependsOnId);
      return { success: true };
    },
  );

  ipcMain.handle(
    IpcChannels.TASK_REMOVE_DEPENDENCY,
    (_e, taskId: string, dependsOnId: string) => {
      taskManager.removeDependency(taskId, dependsOnId);
      return { success: true };
    },
  );

  ipcMain.handle(IpcChannels.TASK_GET_READY, (_e, projectId: string) => {
    return taskManager.getReadyTasks(projectId);
  });

  ipcMain.handle(IpcChannels.TASK_GET_SESSION_COUNTS, (_e, taskIds: string[]) => {
    return taskManager.getSessionCountsByTask(taskIds);
  });
}
