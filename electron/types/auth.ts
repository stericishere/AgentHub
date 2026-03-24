// GitHub OAuth 認證相關型別定義

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface AuthResult {
  success: boolean;
  user?: GitHubUser;
  error?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: GitHubUser;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  htmlUrl: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  createdAt: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  htmlUrl: string;
  createdAt: string;
}

export interface CreatePRParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  head: string;
  base: string;
}

export interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}
