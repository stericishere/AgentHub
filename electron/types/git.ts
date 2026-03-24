export interface GitStatus {
  isRepo: boolean;
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
}

export interface DiffEntry {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  insertions: number;
  deletions: number;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

export interface GitBranchInfo {
  current: string;
  all: string[];
  branches: Record<string, { current: boolean; name: string; commit: string; label: string }>;
}

export interface GitCommitParams {
  cwd: string;
  message: string;
  files?: string[];
}

export interface GitCommitResult {
  hash: string;
  message: string;
  filesChanged: number;
}

export interface GitPushResult {
  success: boolean;
  branch: string;
  remote: string;
}

export interface GitPullResult {
  success: boolean;
  summary: string;
  filesChanged: number;
}
