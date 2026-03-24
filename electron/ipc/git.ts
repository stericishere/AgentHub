import { ipcMain } from 'electron';
import { IpcChannels } from '../types';
import { gitManager } from '../services/git-manager';
import { logger } from '../utils/logger';

export function registerGitHandlers(): void {
  ipcMain.handle(IpcChannels.GIT_GET_STATUS, async (_event, cwd: string) => {
    try {
      return await gitManager.getStatus(cwd);
    } catch (err) {
      logger.error('Git getStatus failed', err);
      throw err;
    }
  });

  ipcMain.handle(IpcChannels.GIT_GET_DIFF, async (_event, cwd: string) => {
    try {
      return await gitManager.getDiff(cwd);
    } catch (err) {
      logger.error('Git getDiff failed', err);
      throw err;
    }
  });

  ipcMain.handle(
    IpcChannels.GIT_GET_FILE_DIFF,
    async (_event, cwd: string, filePath: string) => {
      try {
        return await gitManager.getFileDiff(cwd, filePath);
      } catch (err) {
        logger.error('Git getFileDiff failed', err);
        throw err;
      }
    },
  );

  ipcMain.handle(IpcChannels.GIT_GET_LOG, async (_event, cwd: string, limit?: number) => {
    try {
      return await gitManager.getLog(cwd, limit);
    } catch (err) {
      logger.error('Git getLog failed', err);
      throw err;
    }
  });

  ipcMain.handle(IpcChannels.GIT_GET_BRANCHES, async (_event, cwd: string) => {
    try {
      return await gitManager.getBranches(cwd);
    } catch (err) {
      logger.error('Git getBranches failed', err);
      throw err;
    }
  });

  ipcMain.handle(
    IpcChannels.GIT_CREATE_WORKTREE,
    async (_event, cwd: string, branch: string, path: string) => {
      try {
        await gitManager.createWorktree(cwd, branch, path);
        return { success: true };
      } catch (err) {
        logger.error('Git createWorktree failed', err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    IpcChannels.GIT_REMOVE_WORKTREE,
    async (_event, cwd: string, path: string) => {
      try {
        await gitManager.removeWorktree(cwd, path);
        return { success: true };
      } catch (err) {
        logger.error('Git removeWorktree failed', err);
        throw err;
      }
    },
  );

  ipcMain.handle(IpcChannels.GIT_LIST_WORKTREES, async (_event, cwd: string) => {
    try {
      return await gitManager.listWorktrees(cwd);
    } catch (err) {
      logger.error('Git listWorktrees failed', err);
      throw err;
    }
  });

  ipcMain.handle(IpcChannels.GIT_STAGE, async (_event, cwd: string, files?: string[]) => {
    try {
      await gitManager.stage(cwd, files);
      return { success: true };
    } catch (err) {
      logger.error('Git stage failed', err);
      throw err;
    }
  });

  ipcMain.handle(
    IpcChannels.GIT_COMMIT,
    async (_event, cwd: string, message: string, files?: string[]) => {
      try {
        return await gitManager.commit({ cwd, message, files });
      } catch (err) {
        logger.error('Git commit failed', err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    IpcChannels.GIT_PUSH,
    async (_event, cwd: string, remote?: string, branch?: string, setUpstream?: boolean) => {
      try {
        return await gitManager.push(cwd, remote, branch, setUpstream);
      } catch (err) {
        logger.error('Git push failed', err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    IpcChannels.GIT_PULL,
    async (_event, cwd: string, remote?: string, branch?: string) => {
      try {
        return await gitManager.pull(cwd, remote, branch);
      } catch (err) {
        logger.error('Git pull failed', err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    IpcChannels.GIT_CREATE_BRANCH,
    async (_event, cwd: string, branchName: string, checkout?: boolean) => {
      try {
        await gitManager.createBranch(cwd, branchName, checkout);
        return { success: true };
      } catch (err) {
        logger.error('Git createBranch failed', err);
        throw err;
      }
    },
  );

  ipcMain.handle(IpcChannels.GIT_CHECKOUT, async (_event, cwd: string, branchName: string) => {
    try {
      await gitManager.checkout(cwd, branchName);
      return { success: true };
    } catch (err) {
      logger.error('Git checkout failed', err);
      throw err;
    }
  });

  ipcMain.handle(
    IpcChannels.GIT_DELETE_BRANCH,
    async (_event, cwd: string, branchName: string, force?: boolean) => {
      try {
        await gitManager.deleteBranch(cwd, branchName, force);
        return { success: true };
      } catch (err) {
        logger.error('Git deleteBranch failed', err);
        throw err;
      }
    },
  );
}
