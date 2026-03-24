import simpleGit, { type SimpleGit, type StatusResult, type DiffResult } from 'simple-git';
import { readFileSync } from 'fs';
import { logger } from '../utils/logger';
import type {
  GitStatus, DiffEntry, WorktreeInfo, CommitInfo, GitBranchInfo,
  GitCommitParams, GitCommitResult, GitPushResult, GitPullResult,
} from '../types';

class GitManager {
  private getGit(cwd: string): SimpleGit {
    return simpleGit({ baseDir: cwd });
  }

  async getStatus(cwd: string): Promise<GitStatus> {
    const git = this.getGit(cwd);
    try {
      const status: StatusResult = await git.status();
      return {
        isRepo: true,
        branch: status.current || 'HEAD',
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
        conflicted: status.conflicted,
      };
    } catch {
      return {
        isRepo: false,
        branch: '',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
        conflicted: [],
      };
    }
  }

  async getDiff(cwd: string): Promise<DiffEntry[]> {
    const git = this.getGit(cwd);
    try {
      const diff: DiffResult = await git.diffSummary(['HEAD']);
      return diff.files.map((f) => ({
        file: f.file,
        status: f.binary
          ? 'modified'
          : (f as any).status === 'A'
            ? 'added'
            : (f as any).status === 'D'
              ? 'deleted'
              : (f as any).status?.startsWith('R')
                ? 'renamed'
                : 'modified',
        insertions: f.insertions,
        deletions: f.deletions,
      }));
    } catch (err) {
      logger.warn('Failed to get diff', err);
      return [];
    }
  }

  async getFileDiff(
    cwd: string,
    filePath: string,
  ): Promise<{ original: string; modified: string }> {
    const git = this.getGit(cwd);
    try {
      let original = '';
      try {
        original = await git.show([`HEAD:${filePath}`]);
      } catch {
        // New file, no HEAD version
      }

      let modified = '';
      try {
        const fullPath = require('path').join(cwd, filePath);
        modified = readFileSync(fullPath, 'utf-8');
      } catch {
        // Deleted file
      }

      return { original, modified };
    } catch (err) {
      logger.warn(`Failed to get file diff for ${filePath}`, err);
      return { original: '', modified: '' };
    }
  }

  async getLog(cwd: string, limit = 20): Promise<CommitInfo[]> {
    const git = this.getGit(cwd);
    try {
      const log = await git.log({ maxCount: limit });
      return log.all.map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author_name,
        date: c.date,
        refs: c.refs,
      }));
    } catch (err) {
      logger.warn('Failed to get git log', err);
      return [];
    }
  }

  async getBranches(cwd: string): Promise<GitBranchInfo> {
    const git = this.getGit(cwd);
    try {
      const result = await git.branch();
      return {
        current: result.current,
        all: result.all,
        branches: result.branches as any,
      };
    } catch (err) {
      logger.warn('Failed to get branches', err);
      return { current: '', all: [], branches: {} };
    }
  }

  async stage(cwd: string, files?: string[]): Promise<void> {
    const git = this.getGit(cwd);
    try {
      if (files && files.length > 0) {
        await git.add(files);
      } else {
        await git.add('.');
      }
    } catch (err) {
      logger.error('Git stage failed', err);
      throw err;
    }
  }

  async commit(params: GitCommitParams): Promise<GitCommitResult> {
    const git = this.getGit(params.cwd);
    try {
      if (params.files && params.files.length > 0) {
        await git.add(params.files);
      }
      const result = await git.commit(params.message);
      return {
        hash: result.commit || '',
        message: params.message,
        filesChanged: result.summary.changes,
      };
    } catch (err) {
      logger.error('Git commit failed', err);
      throw err;
    }
  }

  async push(cwd: string, remote = 'origin', branch?: string, setUpstream = false): Promise<GitPushResult> {
    const git = this.getGit(cwd);
    try {
      const currentBranch = branch || (await git.branch()).current;
      const args = setUpstream ? ['--set-upstream', remote, currentBranch] : [remote, currentBranch];
      await git.push(args);
      return { success: true, branch: currentBranch, remote };
    } catch (err) {
      logger.error('Git push failed', err);
      throw err;
    }
  }

  async pull(cwd: string, remote = 'origin', branch?: string): Promise<GitPullResult> {
    const git = this.getGit(cwd);
    try {
      const result = await git.pull(remote, branch);
      return {
        success: true,
        summary: result.summary.changes
          ? `${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`
          : 'Already up to date',
        filesChanged: result.files.length,
      };
    } catch (err) {
      logger.error('Git pull failed', err);
      throw err;
    }
  }

  async createBranch(cwd: string, branchName: string, checkout = true): Promise<void> {
    const git = this.getGit(cwd);
    try {
      if (checkout) {
        await git.checkoutLocalBranch(branchName);
      } else {
        await git.branch([branchName]);
      }
      logger.info(`Created branch ${branchName}${checkout ? ' (checked out)' : ''}`);
    } catch (err) {
      logger.error(`Failed to create branch ${branchName}`, err);
      throw err;
    }
  }

  async checkout(cwd: string, branchName: string): Promise<void> {
    const git = this.getGit(cwd);
    try {
      await git.checkout(branchName);
      logger.info(`Checked out branch ${branchName}`);
    } catch (err) {
      logger.error(`Failed to checkout branch ${branchName}`, err);
      throw err;
    }
  }

  async deleteBranch(cwd: string, branchName: string, force = false): Promise<void> {
    const git = this.getGit(cwd);
    try {
      await git.branch([force ? '-D' : '-d', branchName]);
      logger.info(`Deleted branch ${branchName}`);
    } catch (err) {
      logger.error(`Failed to delete branch ${branchName}`, err);
      throw err;
    }
  }

  async createWorktree(cwd: string, branch: string, path: string): Promise<void> {
    const git = this.getGit(cwd);
    try {
      await git.raw(['worktree', 'add', path, '-b', branch]);
      logger.info(`Created worktree at ${path} with branch ${branch}`);
    } catch (err) {
      logger.error('Failed to create worktree', err);
      throw err;
    }
  }

  async removeWorktree(cwd: string, path: string): Promise<void> {
    const git = this.getGit(cwd);
    try {
      await git.raw(['worktree', 'remove', path, '--force']);
      logger.info(`Removed worktree at ${path}`);
    } catch (err) {
      logger.error('Failed to remove worktree', err);
      throw err;
    }
  }

  async listWorktrees(cwd: string): Promise<WorktreeInfo[]> {
    const git = this.getGit(cwd);
    try {
      const raw = await git.raw(['worktree', 'list', '--porcelain']);
      const worktrees: WorktreeInfo[] = [];
      let current: Partial<WorktreeInfo> = {};

      for (const line of raw.split('\n')) {
        if (line.startsWith('worktree ')) {
          if (current.path) worktrees.push(current as WorktreeInfo);
          current = { path: line.slice(9).trim(), isMain: false };
        } else if (line.startsWith('HEAD ')) {
          current.head = line.slice(5).trim();
        } else if (line.startsWith('branch ')) {
          current.branch = line.slice(7).trim().replace('refs/heads/', '');
        } else if (line.trim() === '') {
          if (current.path) {
            worktrees.push({
              path: current.path,
              branch: current.branch || 'detached',
              head: current.head || '',
              isMain: worktrees.length === 0,
            });
            current = {};
          }
        }
      }

      return worktrees;
    } catch (err) {
      logger.warn('Failed to list worktrees', err);
      return [];
    }
  }
}

export const gitManager = new GitManager();
