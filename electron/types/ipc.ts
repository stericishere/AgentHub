export const IpcChannels = {
  // System
  SYSTEM_GET_HEALTH: 'system:get-health',
  SYSTEM_SELECT_FOLDER: 'system:select-folder',
  SYSTEM_CLEAR_DATABASE: 'system:clear-database',

  // Sessions
  SESSION_SPAWN: 'session:spawn',
  SESSION_STOP: 'session:stop',
  SESSION_LIST: 'session:list',
  SESSION_LIST_BY_TASK: 'session:list-by-task',
  SESSION_LIST_BY_PROJECT: 'session:list-by-project',
  SESSION_GET_ACTIVE: 'session:get-active',
  SESSION_GET_OUTPUT_BUFFER: 'session:get-output-buffer',
  SESSION_GET_LOG: 'session:get-log',
  SESSION_PREVIEW_PROMPT: 'session:preview-prompt',
  SESSION_ASSIGN_TASK: 'session:assign-task',
  SESSION_SEND_DELEGATION: 'session:send-delegation',
  SESSION_LIST_DELEGATIONS: 'session:list-delegations',
  SESSION_REQUEST_SUMMARY: 'session:request-summary',
  SESSION_GET_SUMMARIES: 'session:get-summaries',

  // Agents
  AGENT_LIST: 'agent:list',
  AGENT_GET: 'agent:get',
  AGENT_GET_DEPARTMENTS: 'agent:get-departments',

  // Tasks
  TASK_CREATE: 'task:create',
  TASK_LIST: 'task:list',
  TASK_GET: 'task:get',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_TRANSITION: 'task:transition',
  TASK_ADD_DEPENDENCY: 'task:add-dependency',
  TASK_REMOVE_DEPENDENCY: 'task:remove-dependency',
  TASK_GET_READY: 'task:get-ready',
  TASK_GET_SESSION_COUNTS: 'task:get-session-counts',

  // Sprints
  SPRINT_CREATE: 'sprint:create',
  SPRINT_LIST: 'sprint:list',
  SPRINT_GET: 'sprint:get',
  SPRINT_START: 'sprint:start',
  SPRINT_ENTER_REVIEW: 'sprint:enter-review',
  SPRINT_COMPLETE: 'sprint:complete',
  SPRINT_GET_STATUS: 'sprint:get-status',

  // Projects
  PROJECT_CREATE: 'project:create',
  PROJECT_LIST: 'project:list',
  PROJECT_GET: 'project:get',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_GET_BUDGET: 'project:get-budget',
  PROJECT_GET_STATS: 'project:get-stats',
  PROJECT_INIT_CLAUDE_DIR: 'project:init-claude-dir',
  PROJECT_GET_CLAUDE_DIR: 'project:get-claude-dir',

  // Knowledge
  KNOWLEDGE_LIST_TREE: 'knowledge:list-tree',
  KNOWLEDGE_READ_FILE: 'knowledge:read-file',
  KNOWLEDGE_SEARCH: 'knowledge:search',

  // Gates
  GATE_CREATE: 'gate:create',
  GATE_LIST: 'gate:list',
  GATE_GET: 'gate:get',
  GATE_SUBMIT: 'gate:submit',
  GATE_REVIEW: 'gate:review',
  GATE_GET_CHECKLISTS: 'gate:get-checklists',
  GATE_INIT_PIPELINE: 'gate:init-pipeline',

  // Costs
  COST_GET_OVERVIEW: 'cost:get-overview',
  COST_GET_BREAKDOWN: 'cost:get-breakdown',
  COST_GET_BUDGET: 'cost:get-budget',
  COST_SET_BUDGET: 'cost:set-budget',

  // Audit
  AUDIT_QUERY: 'audit:query',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_GET_ALL: 'settings:get-all',

  // Objections
  OBJECTION_LIST: 'objection:list',
  OBJECTION_RESOLVE: 'objection:resolve',

  // Git
  GIT_GET_STATUS: 'git:get-status',
  GIT_GET_DIFF: 'git:get-diff',
  GIT_GET_FILE_DIFF: 'git:get-file-diff',
  GIT_GET_LOG: 'git:get-log',
  GIT_GET_BRANCHES: 'git:get-branches',
  GIT_CREATE_WORKTREE: 'git:create-worktree',
  GIT_REMOVE_WORKTREE: 'git:remove-worktree',
  GIT_LIST_WORKTREES: 'git:list-worktrees',
  GIT_STAGE: 'git:stage',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_CREATE_BRANCH: 'git:create-branch',
  GIT_CHECKOUT: 'git:checkout',
  GIT_DELETE_BRANCH: 'git:delete-branch',

  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_PROFILE: 'auth:get-profile',
  AUTH_GET_STATUS: 'auth:get-status',

  // GitHub API
  GITHUB_CREATE_PR: 'github:create-pr',
  GITHUB_LIST_PRS: 'github:list-prs',
  GITHUB_CREATE_ISSUE: 'github:create-issue',
  GITHUB_GET_REPOS: 'github:get-repos',

  // Orchestration
  ORCH_EXECUTE_TASK: 'orch:execute-task',

  // PTY
  PTY_INPUT: 'pty:input',
  PTY_RESIZE: 'pty:resize',

  // Notion Sync
  NOTION_LOGIN: 'notion:login',
  NOTION_DISCONNECT: 'notion:disconnect',
  NOTION_GET_STATUS: 'notion:get-status',
  NOTION_VERIFY: 'notion:verify',
  NOTION_SET_PARENT_PAGE: 'notion:set-parent-page',
  NOTION_INIT_DATABASES: 'notion:init-databases',
  NOTION_GET_DB_STATUS: 'notion:get-db-status',
  NOTION_SYNC_PUSH: 'notion:sync-push',
  NOTION_SYNC_PULL: 'notion:sync-pull',
  NOTION_SYNC_ALL: 'notion:sync-all',
  SYNC_SCHEDULER_START: 'sync:scheduler-start',
  SYNC_SCHEDULER_STOP: 'sync:scheduler-stop',
  SYNC_QUEUE_FLUSH: 'sync:queue-flush',

  // Doc Sync (Phase 6D)
  DOC_SYNC_GET_STATUS: 'doc-sync:get-status',
  DOC_SYNC_PUSH: 'doc-sync:push',
  DOC_SYNC_PULL: 'doc-sync:pull',
  DOC_SYNC_SET_ROOT_PAGE: 'doc-sync:set-root-page',
  DOC_SYNC_DISCOVER: 'doc-sync:discover',
  DOC_SYNC_GET_MAPPINGS: 'doc-sync:get-mappings',
  DOC_SYNC_SYNC_ALL: 'doc-sync:sync-all',

  // Browse (Phase 9F)
  BROWSE_START: 'browse:start',
  BROWSE_STOP: 'browse:stop',
  BROWSE_STATUS: 'browse:status',

  // Push events (Main → Renderer)
  GATE_STATUS_CHANGED: 'gate:status-changed',
  SESSION_EVENT: 'session:event',
  SESSION_STATUS: 'session:status',
  PTY_DATA: 'pty:data',
  NOTIFICATION: 'notification',
  AGENTS_RELOADED: 'agents:reloaded',
  DELEGATION_REPORT: 'delegation:report',
  SYNC_STATUS: 'sync:status',
} as const;

export interface IpcError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
