// Auth IPC Handlers
// 處理 GitHub OAuth 認證及 GitHub API 相關的 IPC 呼叫

import { ipcMain } from 'electron';
import { IpcChannels } from '../types';
import { authManager } from '../services/auth-manager';
import { githubApi } from '../services/github-api';
import { logger } from '../utils/logger';
import type { CreatePRParams, CreateIssueParams } from '../types/auth';

export function registerAuthHandlers(): void {
  // ---- 認證相關 Handlers ----------------------------------------

  // 啟動 GitHub OAuth 登入流程
  ipcMain.handle(IpcChannels.AUTH_LOGIN, async () => {
    try {
      return await authManager.startOAuthFlow();
    } catch (err) {
      logger.error('[IPC] auth:login 失敗', err);
      throw err;
    }
  });

  // 登出，清除已存儲的 token
  ipcMain.handle(IpcChannels.AUTH_LOGOUT, () => {
    try {
      authManager.logout();
      return { success: true };
    } catch (err) {
      logger.error('[IPC] auth:logout 失敗', err);
      throw err;
    }
  });

  // 取得目前登入使用者的 GitHub 個人資料
  ipcMain.handle(IpcChannels.AUTH_GET_PROFILE, async () => {
    try {
      return await authManager.getUserProfile();
    } catch (err) {
      logger.error('[IPC] auth:get-profile 失敗', err);
      throw err;
    }
  });

  // 取得目前認證狀態（是否已登入、使用者資料）
  ipcMain.handle(IpcChannels.AUTH_GET_STATUS, async () => {
    try {
      return await authManager.getStatus();
    } catch (err) {
      logger.error('[IPC] auth:get-status 失敗', err);
      throw err;
    }
  });

  // ---- GitHub API Handlers -------------------------------------

  // 建立 Pull Request
  ipcMain.handle(IpcChannels.GITHUB_CREATE_PR, async (_event, params: CreatePRParams) => {
    try {
      return await githubApi.createPR(params);
    } catch (err) {
      logger.error('[IPC] github:create-pr 失敗', err);
      throw err;
    }
  });

  // 列出 Pull Requests
  ipcMain.handle(
    IpcChannels.GITHUB_LIST_PRS,
    async (_event, owner: string, repo: string, state?: 'open' | 'closed' | 'all') => {
      try {
        return await githubApi.listPRs(owner, repo, state);
      } catch (err) {
        logger.error('[IPC] github:list-prs 失敗', err);
        throw err;
      }
    },
  );

  // 建立 Issue
  ipcMain.handle(IpcChannels.GITHUB_CREATE_ISSUE, async (_event, params: CreateIssueParams) => {
    try {
      return await githubApi.createIssue(params);
    } catch (err) {
      logger.error('[IPC] github:create-issue 失敗', err);
      throw err;
    }
  });

  // 取得使用者的 Repository 列表
  ipcMain.handle(
    IpcChannels.GITHUB_GET_REPOS,
    async (_event, page?: number, perPage?: number) => {
      try {
        return await githubApi.getUserRepos(page, perPage);
      } catch (err) {
        logger.error('[IPC] github:get-repos 失敗', err);
        throw err;
      }
    },
  );
}
