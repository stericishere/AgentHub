import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useIpc } from '../composables/useIpc';
import { useUiStore } from './ui';

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

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
}

export interface GitBranchInfo {
  current: string;
  all: string[];
}

export const useGitStore = defineStore('git', () => {
  const ipc = useIpc();
  const uiStore = useUiStore();

  const status = ref<GitStatus | null>(null);
  const diffEntries = ref<DiffEntry[]>([]);
  const fileDiff = ref<{ original: string; modified: string } | null>(null);
  const selectedFile = ref<string | null>(null);
  const branches = ref<GitBranchInfo | null>(null);
  const worktrees = ref<WorktreeInfo[]>([]);
  const commits = ref<CommitInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentCwd = ref('');

  async function fetchStatus(cwd: string) {
    currentCwd.value = cwd;
    loading.value = true;
    try {
      status.value = (await ipc.gitGetStatus(cwd)) as GitStatus;
    } catch (err) {
      console.error('Failed to fetch git status', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchDiff(cwd: string) {
    try {
      diffEntries.value = (await ipc.gitGetDiff(cwd)) as DiffEntry[];
    } catch (err) {
      console.error('Failed to fetch diff', err);
    }
  }

  async function fetchFileDiff(cwd: string, file: string) {
    selectedFile.value = file;
    try {
      fileDiff.value = await ipc.gitGetFileDiff(cwd, file);
    } catch (err) {
      console.error('Failed to fetch file diff', err);
    }
  }

  async function fetchLog(cwd: string, limit?: number) {
    try {
      commits.value = (await ipc.gitGetLog(cwd, limit)) as CommitInfo[];
    } catch (err) {
      console.error('Failed to fetch git log', err);
    }
  }

  async function fetchBranches(cwd: string) {
    try {
      branches.value = (await ipc.gitGetBranches(cwd)) as GitBranchInfo;
    } catch (err) {
      console.error('Failed to fetch branches', err);
    }
  }

  async function fetchWorktrees(cwd: string) {
    try {
      worktrees.value = (await ipc.gitListWorktrees(cwd)) as WorktreeInfo[];
    } catch (err) {
      console.error('Failed to fetch worktrees', err);
    }
  }

  async function createWorktree(cwd: string, branch: string, path: string) {
    try {
      await ipc.gitCreateWorktree(cwd, branch, path);
      await fetchWorktrees(cwd);
    } catch (err) {
      console.error('Failed to create worktree', err);
      throw err;
    }
  }

  async function removeWorktree(cwd: string, path: string) {
    try {
      await ipc.gitRemoveWorktree(cwd, path);
      await fetchWorktrees(cwd);
    } catch (err) {
      console.error('Failed to remove worktree', err);
      throw err;
    }
  }

  async function stage(cwd: string, files?: string[]) {
    error.value = null;
    try {
      await ipc.gitStage(cwd, files);
      await fetchStatus(cwd);
      uiStore.addToast('已暫存變更', 'success');
    } catch (err: any) {
      error.value = err.message || 'Stage failed';
      uiStore.addToast(err.message || '暫存失敗', 'error', '暫存錯誤');
      throw err;
    }
  }

  async function commit(cwd: string, message: string, files?: string[]) {
    error.value = null;
    loading.value = true;
    try {
      const result = await ipc.gitCommit(cwd, message, files);
      await fetchStatus(cwd);
      await fetchLog(cwd);
      await fetchDiff(cwd);
      uiStore.addToast(`已提交: ${message}`, 'success');
      return result;
    } catch (err: any) {
      error.value = err.message || 'Commit failed';
      uiStore.addToast(err.message || '提交失敗', 'error', '提交錯誤');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function push(cwd: string, remote?: string, branch?: string, setUpstream?: boolean) {
    error.value = null;
    loading.value = true;
    try {
      const result = await ipc.gitPush(cwd, remote, branch, setUpstream);
      await fetchStatus(cwd);
      uiStore.addToast('已推送到遠端', 'success');
      return result;
    } catch (err: any) {
      error.value = err.message || 'Push failed';
      uiStore.addToast(err.message || '推送失敗', 'error', '推送錯誤');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function pull(cwd: string, remote?: string, branch?: string) {
    error.value = null;
    loading.value = true;
    try {
      const result = await ipc.gitPull(cwd, remote, branch);
      await fetchStatus(cwd);
      await fetchDiff(cwd);
      uiStore.addToast('已拉取更新', 'success');
      return result;
    } catch (err: any) {
      error.value = err.message || 'Pull failed';
      uiStore.addToast(err.message || '拉取失敗', 'error', '拉取錯誤');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createBranch(cwd: string, branchName: string, checkout = true) {
    error.value = null;
    try {
      await ipc.gitCreateBranch(cwd, branchName, checkout);
      await fetchBranches(cwd);
      await fetchStatus(cwd);
    } catch (err: any) {
      error.value = err.message || 'Create branch failed';
      throw err;
    }
  }

  async function checkoutBranch(cwd: string, branchName: string) {
    error.value = null;
    try {
      await ipc.gitCheckout(cwd, branchName);
      await fetchBranches(cwd);
      await fetchStatus(cwd);
      await fetchDiff(cwd);
    } catch (err: any) {
      error.value = err.message || 'Checkout failed';
      throw err;
    }
  }

  async function deleteBranch(cwd: string, branchName: string, force = false) {
    error.value = null;
    try {
      await ipc.gitDeleteBranch(cwd, branchName, force);
      await fetchBranches(cwd);
    } catch (err: any) {
      error.value = err.message || 'Delete branch failed';
      throw err;
    }
  }

  return {
    status,
    diffEntries,
    fileDiff,
    selectedFile,
    branches,
    worktrees,
    commits,
    loading,
    error,
    currentCwd,
    fetchStatus,
    fetchDiff,
    fetchFileDiff,
    fetchLog,
    fetchBranches,
    fetchWorktrees,
    createWorktree,
    removeWorktree,
    stage,
    commit,
    push,
    pull,
    createBranch,
    checkoutBranch,
    deleteBranch,
  };
});
