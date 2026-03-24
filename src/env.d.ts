/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface MaestroApi {
  system: {
    getHealth: () => Promise<{
      version: string;
      claudeCodeAvailable: boolean;
      claudeCodeVersion: string | null;
      dbConnected: boolean;
      agentsLoaded: number;
      activeSessions: number;
    }>;
    selectFolder: () => Promise<string | null>;
  };
  sessions: {
    spawn: (params: {
      agentId: string;
      task: string;
      model?: string;
      maxTurns?: number;
      projectId?: string | null;
      taskId?: string | null;
      parentSessionId?: string;
      resumeSessionId?: string;
    }) => Promise<{ sessionId: string; ptyId: string }>;
    stop: (sessionId: string, force?: boolean) => Promise<{ success: boolean }>;
    list: (limit?: number) => Promise<unknown[]>;
    listByTask: (taskId: string) => Promise<unknown[]>;
    listByProject: (projectId: string) => Promise<unknown[]>;
    getActive: () => Promise<unknown[]>;
    getOutputBuffer: (ptyId: string) => Promise<string>;
    getLog: (sessionId: string) => Promise<string>;
    previewPrompt: (agentId: string, projectId?: string) => Promise<string>;
    assignTask: (params: {
      sessionId: string;
      taskId: string;
      taskTitle: string;
      taskDescription: string;
    }) => Promise<{ success: boolean }>;
    sendDelegation: (params: {
      sourceSessionId: string;
      targetSessionId: string;
      instruction: string;
    }) => Promise<unknown>;
    listDelegations: () => Promise<unknown[]>;
  };
  agents: {
    list: (filters?: {
      department?: string;
      level?: string;
      search?: string;
    }) => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    getDepartments: () => Promise<unknown[]>;
  };
  tasks: {
    create: (params: unknown) => Promise<unknown>;
    list: (filters?: unknown) => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    update: (id: string, params: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<{ success: boolean }>;
    transition: (params: { taskId: string; toStatus: string }) => Promise<unknown>;
    addDependency: (taskId: string, dependsOnId: string) => Promise<{ success: boolean }>;
    removeDependency: (taskId: string, dependsOnId: string) => Promise<{ success: boolean }>;
    getReady: (projectId: string) => Promise<unknown[]>;
    getSessionCounts: (taskIds: string[]) => Promise<Record<string, { total: number; active: number }>>;
  };
  sprints: {
    create: (params: { projectId: string; name: string; goal?: string; sprintType?: string }) => Promise<unknown>;
    list: (projectId: string) => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    start: (id: string) => Promise<unknown>;
    enterReview: (id: string) => Promise<unknown>;
    complete: (id: string) => Promise<unknown>;
    getStatus: (id: string) => Promise<unknown>;
  };
  projects: {
    create: (params: { name: string; description?: string; template?: string; workDir?: string }) => Promise<unknown>;
    list: () => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    update: (id: string, params: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getBudget: (projectId: string) => Promise<unknown>;
    getStats: (projectId: string) => Promise<{
      tasksDone: number;
      tasksInProgress: number;
      totalTokens: number;
      totalCostUsd: number;
      activeSprint: { name: string; progressPct: number; activeCount: number } | null;
      latestGate: { type: string; status: string } | null;
    }>;
  };
  knowledge: {
    listTree: () => Promise<unknown[]>;
    readFile: (path: string) => Promise<string | null>;
    search: (query: string) => Promise<unknown[]>;
  };
  gates: {
    create: (params: {
      projectId: string;
      sprintId?: string | null;
      gateType: string;
    }) => Promise<unknown>;
    list: (filters?: unknown) => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    submit: (params: {
      gateId: string;
      submittedBy: string;
      checklist: Record<string, boolean>;
    }) => Promise<unknown>;
    review: (params: {
      gateId: string;
      reviewer: string;
      decision: 'approved' | 'rejected';
      comment?: string;
      checklist?: Record<string, boolean>;
      itemReasons?: Record<string, string>;
    }) => Promise<unknown>;
    getChecklists: () => Promise<unknown[]>;
    initPipeline: (params: { projectId: string; sprintId: string }) => Promise<unknown[]>;
  };
  costs: {
    getOverview: () => Promise<unknown>;
    getBreakdown: (type: string) => Promise<unknown>;
    getBudget: (projectId: string) => Promise<unknown>;
    setBudget: (params: {
      projectId: string;
      dailyTokenLimit?: number;
      totalTokenLimit?: number;
      alertThreshold?: number;
    }) => Promise<unknown>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    update: (params: { key: string; value: string; category?: string }) => Promise<unknown>;
    getAll: () => Promise<Record<string, string>>;
  };
  objections: {
    list: () => Promise<unknown[]>;
    resolve: (params: {
      objectionId: string;
      resolution: string;
      resolvedBy: string;
    }) => Promise<unknown>;
  };
  audit: {
    query: (params?: unknown) => Promise<unknown[]>;
  };
  git: {
    getStatus: (cwd: string) => Promise<unknown>;
    getDiff: (cwd: string) => Promise<unknown[]>;
    getFileDiff: (cwd: string, filePath: string) => Promise<{ original: string; modified: string }>;
    getLog: (cwd: string, limit?: number) => Promise<unknown[]>;
    getBranches: (cwd: string) => Promise<unknown>;
    createWorktree: (cwd: string, branch: string, path: string) => Promise<unknown>;
    removeWorktree: (cwd: string, path: string) => Promise<unknown>;
    listWorktrees: (cwd: string) => Promise<unknown[]>;
    stage: (cwd: string, files?: string[]) => Promise<{ success: boolean }>;
    commit: (cwd: string, message: string, files?: string[]) => Promise<{ hash: string; message: string; filesChanged: number }>;
    push: (cwd: string, remote?: string, branch?: string, setUpstream?: boolean) => Promise<{ success: boolean; branch: string; remote: string }>;
    pull: (cwd: string, remote?: string, branch?: string) => Promise<{ success: boolean; summary: string; filesChanged: number }>;
    createBranch: (cwd: string, branchName: string, checkout?: boolean) => Promise<{ success: boolean }>;
    checkout: (cwd: string, branchName: string) => Promise<{ success: boolean }>;
    deleteBranch: (cwd: string, branchName: string, force?: boolean) => Promise<{ success: boolean }>;
  };
  auth: {
    login: () => Promise<{ success: boolean; user?: unknown; error?: string }>;
    logout: () => Promise<{ success: boolean }>;
    getProfile: () => Promise<unknown>;
    getStatus: () => Promise<{ authenticated: boolean; user?: unknown }>;
  };
  github: {
    createPR: (params: {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      head: string;
      base: string;
    }) => Promise<unknown>;
    listPRs: (owner: string, repo: string, state?: string) => Promise<unknown[]>;
    createIssue: (params: {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      labels?: string[];
    }) => Promise<unknown>;
    getRepos: (page?: number, perPage?: number) => Promise<unknown[]>;
  };
  notion: {
    login: () => Promise<unknown>;
    disconnect: () => Promise<{ success: boolean }>;
    getStatus: () => Promise<unknown>;
    verify: () => Promise<{ valid: boolean; error?: string }>;
    setParentPage: (pageId: string) => Promise<{ success: boolean }>;
    initDatabases: () => Promise<{ success: boolean; created: number; error?: string }>;
    getDbStatus: () => Promise<unknown[]>;
    syncPush: (tableName?: string) => Promise<unknown>;
    syncPull: (tableName?: string) => Promise<unknown>;
    syncAll: (options?: unknown) => Promise<unknown>;
  };
  docSync: {
    getStatus: (scope: string, projectWorkDir?: string) => Promise<unknown>;
    discover: (scope: string, projectWorkDir?: string) => Promise<string[]>;
    getMappings: (scope: string) => Promise<unknown[]>;
    setRootPage: (scope: string, pageId: string) => Promise<{ success: boolean }>;
    push: (options: unknown) => Promise<unknown>;
    pull: (options: unknown) => Promise<unknown>;
    syncAll: (options: unknown) => Promise<unknown>;
  };
  pty: {
    input: (ptyId: string, data: string) => void;
    resize: (ptyId: string, cols: number, rows: number) => void;
  };
  on: {
    sessionEvent: (callback: (data: unknown) => void) => void;
    sessionStatus: (callback: (data: unknown) => void) => void;
    ptyData: (callback: (data: { ptyId: string; data: string }) => void) => void;
    notification: (callback: (data: unknown) => void) => void;
    agentsReloaded: (callback: (data: unknown) => void) => void;
    delegationReport: (callback: (data: unknown) => void) => void;
    syncStatus: (callback: (data: unknown) => void) => void;
  };
}

interface Window {
  maestro: MaestroApi;
}
