// GitHub OAuth 認證管理器
// 負責 OAuth 流程、Token 加密存儲與使用者資料取得

import { BrowserWindow, safeStorage } from 'electron';
import http from 'http';
import { database } from './database';
import { logger } from '../utils/logger';
import type { GitHubUser, AuthResult, AuthStatus } from '../types/auth';

import { getEnv } from '../utils/env';

const GITHUB_CLIENT_ID = getEnv('GITHUB_CLIENT_ID', 'Ov23lioPYqTNCDadEMwE');
const GITHUB_CLIENT_SECRET = getEnv('GITHUB_CLIENT_SECRET', 'e4560cf2c1b4aa4cd8141c8c0332c429695a0066');
const GITHUB_OAUTH_SCOPE = 'repo read:user';
const REDIRECT_PORT = 17239;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const PREF_KEY = 'github_token';
const PREF_CATEGORY = 'auth';

// ---- 資料庫存取輔助函式 ----------------------------------------

function getPreference(key: string): string | null {
  const rows = database.prepare('SELECT value FROM user_preferences WHERE key = ?', [key]);
  return rows.length > 0 ? (rows[0] as { value: string }).value : null;
}

function setPreference(key: string, value: string, category: string = 'general'): void {
  const existing = database.prepare('SELECT key FROM user_preferences WHERE key = ?', [key]);
  if (existing.length > 0) {
    database.run('UPDATE user_preferences SET value = ? WHERE key = ?', [value, key]);
  } else {
    database.run('INSERT INTO user_preferences (key, value, category) VALUES (?, ?, ?)', [
      key,
      value,
      category,
    ]);
  }
}

function deletePreference(key: string): void {
  database.run('DELETE FROM user_preferences WHERE key = ?', [key]);
}

// ---- AuthManager ------------------------------------------------

class AuthManager {
  // 追蹤進行中的 callback server，確保同一時間只有一個
  private callbackServer: http.Server | null = null;

  // Token 加密後存入資料庫；若平台不支援 safeStorage 則以明文存入（降級）
  private encryptToken(token: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      return encrypted.toString('base64');
    }
    // 平台不支援時降級存儲，加上前綴以區分
    logger.warn('[AuthManager] safeStorage 不可用，token 將以明文存入資料庫');
    return `plain:${token}`;
  }

  private decryptToken(stored: string): string {
    if (stored.startsWith('plain:')) {
      return stored.slice(6);
    }
    const buffer = Buffer.from(stored, 'base64');
    return safeStorage.decryptString(buffer);
  }

  // 確保關閉前一個 callback server（避免 EADDRINUSE）
  private closeCallbackServer(): void {
    if (this.callbackServer) {
      try {
        this.callbackServer.close();
      } catch {
        // 忽略已關閉的 server
      }
      this.callbackServer = null;
    }
  }

  // 用 authorization code 向 GitHub 交換 access token
  private async exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Maestro-Agent-Hub',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub token 交換失敗：HTTP ${response.status}`);
    }

    const data = (await response.json()) as { access_token?: string; error?: string };

    if (data.error) {
      throw new Error(`GitHub 回傳錯誤：${data.error}`);
    }

    if (!data.access_token) {
      throw new Error('GitHub 未回傳 access_token');
    }

    return data.access_token;
  }

  // 啟動 GitHub OAuth 授權流程
  async startOAuthFlow(): Promise<AuthResult> {
    // 先清理可能殘留的 server
    this.closeCallbackServer();

    const authUrl =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${GITHUB_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(GITHUB_OAUTH_SCOPE)}`;

    const win = new BrowserWindow({
      width: 600,
      height: 700,
      title: 'GitHub 登入',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // 建立 callback server，生命週期由本方法統一管理
    const codePromise = new Promise<string>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (!req.url?.startsWith('/callback')) {
          res.writeHead(404);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<html><body><h2>登入成功，請關閉此視窗返回 Maestro。</h2></body></html>',
        );

        if (error) {
          reject(new Error(`GitHub OAuth 錯誤：${error}`));
        } else if (code) {
          resolve(code);
        } else {
          reject(new Error('未收到 authorization code'));
        }
      });

      server.on('error', (err) => {
        reject(new Error(`本機 callback server 啟動失敗：${err.message}`));
      });

      server.listen(REDIRECT_PORT, '127.0.0.1', () => {
        logger.info(`[AuthManager] OAuth callback server 監聽於 port ${REDIRECT_PORT}`);
      });

      this.callbackServer = server;
    });

    win.loadURL(authUrl);

    // 使用者關閉視窗時取消等待
    const cancelPromise = new Promise<never>((_resolve, reject) => {
      win.on('closed', () => reject(new Error('使用者關閉了登入視窗')));
    });

    // 120 秒逾時保護
    const timeoutId = setTimeout(() => {
      this.closeCallbackServer();
      if (!win.isDestroyed()) win.close();
    }, 120_000);

    try {
      const code = await Promise.race([codePromise, cancelPromise]);

      if (!win.isDestroyed()) win.close();

      const token = await this.exchangeCodeForToken(code);
      const encryptedToken = this.encryptToken(token);
      setPreference(PREF_KEY, encryptedToken, PREF_CATEGORY);

      const user = await this.getUserProfile();
      logger.info(`[AuthManager] 使用者 ${user.login} 登入成功`);

      return { success: true, user };
    } catch (err) {
      if (!win.isDestroyed()) win.close();
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[AuthManager] OAuth 流程失敗', err);
      return { success: false, error: message };
    } finally {
      // 無論成功或失敗，一律清理 server 和 timeout
      clearTimeout(timeoutId);
      this.closeCallbackServer();
    }
  }

  // 從資料庫取得並解密 token
  getToken(): string | null {
    try {
      const stored = getPreference(PREF_KEY);
      if (!stored) return null;
      return this.decryptToken(stored);
    } catch (err) {
      logger.error('[AuthManager] Token 解密失敗', err);
      return null;
    }
  }

  // 判斷是否已有有效 token
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  // 登出，清除已存儲的 token
  logout(): void {
    deletePreference(PREF_KEY);
    logger.info('[AuthManager] 已登出，token 清除完成');
  }

  // 用 token 取得 GitHub 使用者資料
  async getUserProfile(): Promise<GitHubUser> {
    const token = this.getToken();
    if (!token) {
      throw new Error('尚未登入，無法取得使用者資料');
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'Maestro-Agent-Hub',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`取得使用者資料失敗：HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      id: number;
      login: string;
      name: string | null;
      email: string | null;
      avatar_url: string;
      html_url: string;
    };

    return {
      id: data.id,
      login: data.login,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url,
    };
  }

  // 取得目前認證狀態
  async getStatus(): Promise<AuthStatus> {
    if (!this.isAuthenticated()) {
      return { authenticated: false };
    }
    try {
      const user = await this.getUserProfile();
      return { authenticated: true, user };
    } catch (err) {
      logger.warn('[AuthManager] 取得狀態時 token 可能已失效', err);
      return { authenticated: false };
    }
  }
}

export const authManager = new AuthManager();
