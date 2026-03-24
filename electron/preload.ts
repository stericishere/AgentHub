import { contextBridge, ipcRenderer } from 'electron';

export interface MaestroApi {
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
    clearDatabase: () => Promise<{ deletedCounts: Record<string, number> }>;
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
    requestSummary: (sessionId: string) => Promise<string | null>;
    getSummaries: (sessionId: string) => Promise<Array<{ content: string; createdAt: string }>>;
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
      activeSprint: { name: string; progressPct: number } | null;
      latestGate: { type: string; status: string } | null;
    }>;
    initClaudeDir: (projectId: string) => Promise<{ success: boolean; created: string[]; error?: string }>;
    getClaudeDir: (projectId: string) => Promise<{ exists: boolean; files: Array<{ path: string; type: 'file' | 'dir' }> }>;
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
    schedulerStart: (intervalMs?: number) => Promise<{ success: boolean; enabled: boolean; interval: number }>;
    schedulerStop: () => Promise<{ success: boolean; enabled: boolean }>;
    queueFlush: () => Promise<{ processed: number; failed: number }>;
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
  browse: {
    start: () => Promise<{ port: number; token: string }>;
    stop: () => Promise<{ success: boolean }>;
    getStatus: () => Promise<{ running: boolean; port: number }>;
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
    gateStatusChanged: (callback: (data: unknown) => void) => void;
  };
}

const api: MaestroApi = {
  system: {
    getHealth: () => ipcRenderer.invoke('system:get-health'),
    selectFolder: () => ipcRenderer.invoke('system:select-folder'),
    clearDatabase: () => ipcRenderer.invoke('system:clear-database'),
  },
  sessions: {
    spawn: (params) => ipcRenderer.invoke('session:spawn', params),
    stop: (sessionId, force) => ipcRenderer.invoke('session:stop', { sessionId, force }),
    list: (limit) => ipcRenderer.invoke('session:list', limit),
    listByTask: (taskId) => ipcRenderer.invoke('session:list-by-task', taskId),
    listByProject: (projectId) => ipcRenderer.invoke('session:list-by-project', projectId),
    getActive: () => ipcRenderer.invoke('session:get-active'),
    getOutputBuffer: (ptyId: string) => ipcRenderer.invoke('session:get-output-buffer', ptyId),
    getLog: (sessionId: string) => ipcRenderer.invoke('session:get-log', sessionId),
    previewPrompt: (agentId, projectId) =>
      ipcRenderer.invoke('session:preview-prompt', agentId, projectId),
    assignTask: (params) => ipcRenderer.invoke('session:assign-task', params),
    sendDelegation: (params) => ipcRenderer.invoke('session:send-delegation', params),
    listDelegations: () => ipcRenderer.invoke('session:list-delegations'),
    requestSummary: (sessionId) => ipcRenderer.invoke('session:request-summary', sessionId),
    getSummaries: (sessionId) => ipcRenderer.invoke('session:get-summaries', sessionId),
  },
  agents: {
    list: (filters) => ipcRenderer.invoke('agent:list', filters),
    get: (id) => ipcRenderer.invoke('agent:get', id),
    getDepartments: () => ipcRenderer.invoke('agent:get-departments'),
  },
  tasks: {
    create: (params) => ipcRenderer.invoke('task:create', params),
    list: (filters) => ipcRenderer.invoke('task:list', filters),
    get: (id) => ipcRenderer.invoke('task:get', id),
    update: (id, params) => ipcRenderer.invoke('task:update', id, params),
    delete: (id) => ipcRenderer.invoke('task:delete', id),
    transition: (params) => ipcRenderer.invoke('task:transition', params),
    addDependency: (taskId, dependsOnId) =>
      ipcRenderer.invoke('task:add-dependency', taskId, dependsOnId),
    removeDependency: (taskId, dependsOnId) =>
      ipcRenderer.invoke('task:remove-dependency', taskId, dependsOnId),
    getReady: (projectId) => ipcRenderer.invoke('task:get-ready', projectId),
    getSessionCounts: (taskIds) => ipcRenderer.invoke('task:get-session-counts', taskIds),
  },
  sprints: {
    create: (params) => ipcRenderer.invoke('sprint:create', params),
    list: (projectId) => ipcRenderer.invoke('sprint:list', projectId),
    get: (id) => ipcRenderer.invoke('sprint:get', id),
    start: (id) => ipcRenderer.invoke('sprint:start', id),
    enterReview: (id) => ipcRenderer.invoke('sprint:enter-review', id),
    complete: (id) => ipcRenderer.invoke('sprint:complete', id),
    getStatus: (id) => ipcRenderer.invoke('sprint:get-status', id),
  },
  projects: {
    create: (params) => ipcRenderer.invoke('project:create', params),
    list: () => ipcRenderer.invoke('project:list'),
    get: (id) => ipcRenderer.invoke('project:get', id),
    update: (id, params) => ipcRenderer.invoke('project:update', id, params),
    delete: (id) => ipcRenderer.invoke('project:delete', id),
    getBudget: (projectId) => ipcRenderer.invoke('project:get-budget', projectId),
    getStats: (projectId) => ipcRenderer.invoke('project:get-stats', projectId),
    initClaudeDir: (projectId) => ipcRenderer.invoke('project:init-claude-dir', projectId),
    getClaudeDir: (projectId) => ipcRenderer.invoke('project:get-claude-dir', projectId),
  },
  knowledge: {
    listTree: () => ipcRenderer.invoke('knowledge:list-tree'),
    readFile: (path) => ipcRenderer.invoke('knowledge:read-file', path),
    search: (query) => ipcRenderer.invoke('knowledge:search', query),
  },
  gates: {
    create: (params) => ipcRenderer.invoke('gate:create', params),
    list: (filters) => ipcRenderer.invoke('gate:list', filters),
    get: (id) => ipcRenderer.invoke('gate:get', id),
    submit: (params) => ipcRenderer.invoke('gate:submit', params),
    review: (params) => ipcRenderer.invoke('gate:review', params),
    getChecklists: () => ipcRenderer.invoke('gate:get-checklists'),
    initPipeline: (params) => ipcRenderer.invoke('gate:init-pipeline', params),
  },
  costs: {
    getOverview: () => ipcRenderer.invoke('cost:get-overview'),
    getBreakdown: (type) => ipcRenderer.invoke('cost:get-breakdown', type),
    getBudget: (projectId) => ipcRenderer.invoke('cost:get-budget', projectId),
    setBudget: (params) => ipcRenderer.invoke('cost:set-budget', params),
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    update: (params) => ipcRenderer.invoke('settings:update', params),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
  },
  objections: {
    list: () => ipcRenderer.invoke('objection:list'),
    resolve: (params) => ipcRenderer.invoke('objection:resolve', params),
  },
  audit: {
    query: (params) => ipcRenderer.invoke('audit:query', params),
  },
  git: {
    getStatus: (cwd) => ipcRenderer.invoke('git:get-status', cwd),
    getDiff: (cwd) => ipcRenderer.invoke('git:get-diff', cwd),
    getFileDiff: (cwd, filePath) => ipcRenderer.invoke('git:get-file-diff', cwd, filePath),
    getLog: (cwd, limit) => ipcRenderer.invoke('git:get-log', cwd, limit),
    getBranches: (cwd) => ipcRenderer.invoke('git:get-branches', cwd),
    createWorktree: (cwd, branch, path) =>
      ipcRenderer.invoke('git:create-worktree', cwd, branch, path),
    removeWorktree: (cwd, path) => ipcRenderer.invoke('git:remove-worktree', cwd, path),
    listWorktrees: (cwd) => ipcRenderer.invoke('git:list-worktrees', cwd),
    stage: (cwd, files?) => ipcRenderer.invoke('git:stage', cwd, files),
    commit: (cwd, message, files?) => ipcRenderer.invoke('git:commit', cwd, message, files),
    push: (cwd, remote?, branch?, setUpstream?) =>
      ipcRenderer.invoke('git:push', cwd, remote, branch, setUpstream),
    pull: (cwd, remote?, branch?) => ipcRenderer.invoke('git:pull', cwd, remote, branch),
    createBranch: (cwd, branchName, checkout?) =>
      ipcRenderer.invoke('git:create-branch', cwd, branchName, checkout),
    checkout: (cwd, branchName) => ipcRenderer.invoke('git:checkout', cwd, branchName),
    deleteBranch: (cwd, branchName, force?) =>
      ipcRenderer.invoke('git:delete-branch', cwd, branchName, force),
  },
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getProfile: () => ipcRenderer.invoke('auth:get-profile'),
    getStatus: () => ipcRenderer.invoke('auth:get-status'),
  },
  github: {
    createPR: (params) => ipcRenderer.invoke('github:create-pr', params),
    listPRs: (owner, repo, state) => ipcRenderer.invoke('github:list-prs', owner, repo, state),
    createIssue: (params) => ipcRenderer.invoke('github:create-issue', params),
    getRepos: (page, perPage) => ipcRenderer.invoke('github:get-repos', page, perPage),
  },
  notion: {
    login: () => ipcRenderer.invoke('notion:login'),
    disconnect: () => ipcRenderer.invoke('notion:disconnect'),
    getStatus: () => ipcRenderer.invoke('notion:get-status'),
    verify: () => ipcRenderer.invoke('notion:verify'),
    setParentPage: (pageId) => ipcRenderer.invoke('notion:set-parent-page', pageId),
    initDatabases: () => ipcRenderer.invoke('notion:init-databases'),
    getDbStatus: () => ipcRenderer.invoke('notion:get-db-status'),
    syncPush: (tableName?: string) => ipcRenderer.invoke('notion:sync-push', tableName),
    syncPull: (tableName?: string) => ipcRenderer.invoke('notion:sync-pull', tableName),
    syncAll: (options?: unknown) => ipcRenderer.invoke('notion:sync-all', options),
    schedulerStart: (intervalMs?: number) => ipcRenderer.invoke('sync:scheduler-start', intervalMs),
    schedulerStop: () => ipcRenderer.invoke('sync:scheduler-stop'),
    queueFlush: () => ipcRenderer.invoke('sync:queue-flush'),
  },
  docSync: {
    getStatus: (scope: string, projectWorkDir?: string) =>
      ipcRenderer.invoke('doc-sync:get-status', scope, projectWorkDir),
    discover: (scope: string, projectWorkDir?: string) =>
      ipcRenderer.invoke('doc-sync:discover', scope, projectWorkDir),
    getMappings: (scope: string) => ipcRenderer.invoke('doc-sync:get-mappings', scope),
    setRootPage: (scope: string, pageId: string) =>
      ipcRenderer.invoke('doc-sync:set-root-page', scope, pageId),
    push: (options: unknown) => ipcRenderer.invoke('doc-sync:push', options),
    pull: (options: unknown) => ipcRenderer.invoke('doc-sync:pull', options),
    syncAll: (options: unknown) => ipcRenderer.invoke('doc-sync:sync-all', options),
  },
  browse: {
    start: () => ipcRenderer.invoke('browse:start'),
    stop: () => ipcRenderer.invoke('browse:stop'),
    getStatus: () => ipcRenderer.invoke('browse:status'),
  },
  pty: {
    input: (ptyId, data) => ipcRenderer.send('pty:input', { ptyId, data }),
    resize: (ptyId, cols, rows) => ipcRenderer.send('pty:resize', { ptyId, cols, rows }),
  },
  on: {
    sessionEvent: (callback) => {
      ipcRenderer.on('session:event', (_e, data) => callback(data));
    },
    sessionStatus: (callback) => {
      ipcRenderer.on('session:status', (_e, data) => callback(data));
    },
    ptyData: (callback) => {
      ipcRenderer.on('pty:data', (_e, data) => callback(data));
    },
    notification: (callback) => {
      ipcRenderer.on('notification', (_e, data) => callback(data));
    },
    agentsReloaded: (callback) => {
      ipcRenderer.on('agents:reloaded', (_e, data) => callback(data));
    },
    delegationReport: (callback) => {
      ipcRenderer.on('delegation:report', (_e, data) => callback(data));
    },
    syncStatus: (callback) => {
      ipcRenderer.on('sync:status', (_e, data) => callback(data));
    },
    gateStatusChanged: (callback) => {
      ipcRenderer.on('gate:status-changed', (_e, data) => callback(data));
    },
  },
};

contextBridge.exposeInMainWorld('maestro', api);
