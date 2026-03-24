// GitHub REST API 服務
// 封裝常用 GitHub API 呼叫，token 由 authManager 提供

import { authManager } from './auth-manager';
import { logger } from '../utils/logger';
import type {
  GitHubPR,
  GitHubIssue,
  GitHubRepo,
  CreatePRParams,
  CreateIssueParams,
} from '../types/auth';

const GITHUB_API_BASE = 'https://api.github.com';

// GitHub API 回傳的原始 snake_case 型別

interface RawGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
}

interface RawGitHubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  created_at: string;
  merged_at: string | null;
}

interface RawGitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
}

// snake_case → camelCase 轉換輔助函式

function mapRepo(raw: RawGitHubRepo): GitHubRepo {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    private: raw.private,
    htmlUrl: raw.html_url,
    cloneUrl: raw.clone_url,
    defaultBranch: raw.default_branch,
  };
}

function mapPR(raw: RawGitHubPR): GitHubPR {
  // GitHub 不回傳 "merged" state，需透過 merged_at 判斷
  const state: 'open' | 'closed' | 'merged' =
    raw.merged_at ? 'merged' : (raw.state as 'open' | 'closed');

  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    body: raw.body,
    state,
    htmlUrl: raw.html_url,
    head: raw.head,
    base: raw.base,
    createdAt: raw.created_at,
  };
}

function mapIssue(raw: RawGitHubIssue): GitHubIssue {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    body: raw.body,
    state: raw.state as 'open' | 'closed',
    htmlUrl: raw.html_url,
    createdAt: raw.created_at,
  };
}

// ---- GitHubApiService ------------------------------------------

class GitHubApiService {
  // 取得授權 Header，若未登入則拋出錯誤
  private getHeaders(): Record<string, string> {
    const token = authManager.getToken();
    if (!token) {
      throw new Error('尚未登入 GitHub，請先完成 OAuth 認證');
    }
    return {
      Authorization: `token ${token}`,
      'User-Agent': 'Maestro-Agent-Hub',
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  // 通用 GET 請求
  private async get<T>(path: string): Promise<T> {
    const url = `${GITHUB_API_BASE}${path}`;
    logger.debug(`[GitHubApi] GET ${url}`);

    const response = await fetch(url, { headers: this.getHeaders() });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`GitHub API 錯誤 [GET ${path}]：HTTP ${response.status} ${body}`);
    }

    return response.json() as Promise<T>;
  }

  // 通用 POST 請求
  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${GITHUB_API_BASE}${path}`;
    logger.debug(`[GitHubApi] POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      throw new Error(`GitHub API 錯誤 [POST ${path}]：HTTP ${response.status} ${responseBody}`);
    }

    return response.json() as Promise<T>;
  }

  // 建立 Pull Request
  async createPR(params: CreatePRParams): Promise<GitHubPR> {
    const { owner, repo, title, body, head, base } = params;
    logger.info(`[GitHubApi] 建立 PR：${owner}/${repo} - ${title}`);

    const raw = await this.post<RawGitHubPR>(`/repos/${owner}/${repo}/pulls`, {
      title,
      body: body ?? '',
      head,
      base,
    });

    return mapPR(raw);
  }

  // 列出 PR（可依狀態過濾：open / closed / all）
  async listPRs(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
  ): Promise<GitHubPR[]> {
    logger.info(`[GitHubApi] 列出 PR：${owner}/${repo} (state=${state})`);
    const rawList = await this.get<RawGitHubPR[]>(
      `/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`,
    );
    return rawList.map(mapPR);
  }

  // 建立 Issue
  async createIssue(params: CreateIssueParams): Promise<GitHubIssue> {
    const { owner, repo, title, body, labels } = params;
    logger.info(`[GitHubApi] 建立 Issue：${owner}/${repo} - ${title}`);

    const raw = await this.post<RawGitHubIssue>(`/repos/${owner}/${repo}/issues`, {
      title,
      body: body ?? '',
      labels: labels ?? [],
    });

    return mapIssue(raw);
  }

  // 取得單一 Repository 資訊
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    logger.info(`[GitHubApi] 取得 Repo：${owner}/${repo}`);
    const raw = await this.get<RawGitHubRepo>(`/repos/${owner}/${repo}`);
    return mapRepo(raw);
  }

  // 取得目前登入使用者的 Repo 列表（含分頁）
  async getUserRepos(page: number = 1, perPage: number = 30): Promise<GitHubRepo[]> {
    logger.info(`[GitHubApi] 取得使用者 Repo 列表（page=${page}, perPage=${perPage}）`);
    const rawList = await this.get<RawGitHubRepo[]>(
      `/user/repos?page=${page}&per_page=${perPage}&sort=updated`,
    );
    return rawList.map(mapRepo);
  }
}

export const githubApi = new GitHubApiService();
