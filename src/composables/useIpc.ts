export function useIpc() {
  const maestro = window.maestro;

  // System
  async function getHealth() {
    return maestro.system.getHealth();
  }

  // Sessions
  async function spawnSession(params: {
    agentId: string;
    task: string;
    model?: string;
    maxTurns?: number;
    projectId?: string | null;
    taskId?: string | null;
    interactive?: boolean;
    resumeSessionId?: string;
  }) {
    return maestro.sessions.spawn(params);
  }

  async function stopSession(sessionId: string, force?: boolean) {
    return maestro.sessions.stop(sessionId, force);
  }

  async function listSessions(limit?: number) {
    return maestro.sessions.list(limit);
  }

  async function listSessionsByTask(taskId: string) {
    return maestro.sessions.listByTask(taskId);
  }

  async function listSessionsByProject(projectId: string) {
    return maestro.sessions.listByProject(projectId);
  }

  async function getActiveSessions() {
    return maestro.sessions.getActive();
  }

  async function getOutputBuffer(ptyId: string) {
    return maestro.sessions.getOutputBuffer(ptyId);
  }

  async function getSessionLog(sessionId: string) {
    return maestro.sessions.getLog(sessionId);
  }

  async function previewPrompt(agentId: string, projectId?: string) {
    return maestro.sessions.previewPrompt(agentId, projectId);
  }

  async function assignTaskToSession(params: {
    sessionId: string;
    taskId: string;
    taskTitle: string;
    taskDescription: string;
  }) {
    return maestro.sessions.assignTask(params);
  }

  async function sendDelegation(params: {
    sourceSessionId: string;
    targetSessionId: string;
    instruction: string;
  }) {
    return maestro.sessions.sendDelegation(params);
  }

  async function listDelegations() {
    return maestro.sessions.listDelegations();
  }

  async function requestSummary(sessionId: string) {
    return maestro.sessions.requestSummary(sessionId);
  }

  async function getSessionSummaries(sessionId: string) {
    return maestro.sessions.getSummaries(sessionId);
  }

  // Agents
  async function listAgents(filters?: { department?: string; level?: string; search?: string }) {
    return maestro.agents.list(filters);
  }

  async function getAgent(id: string) {
    return maestro.agents.get(id);
  }

  async function getDepartments() {
    return maestro.agents.getDepartments();
  }

  // Tasks
  async function createTask(params: unknown) {
    return maestro.tasks.create(params);
  }

  async function listTasks(filters?: unknown) {
    return maestro.tasks.list(filters);
  }

  async function getTask(id: string) {
    return maestro.tasks.get(id);
  }

  async function updateTask(id: string, params: unknown) {
    return maestro.tasks.update(id, params);
  }

  async function deleteTask(id: string) {
    return maestro.tasks.delete(id);
  }

  async function transitionTask(taskId: string, toStatus: string) {
    return maestro.tasks.transition({ taskId, toStatus });
  }

  async function addTaskDependency(taskId: string, dependsOnId: string) {
    return maestro.tasks.addDependency(taskId, dependsOnId);
  }

  async function removeTaskDependency(taskId: string, dependsOnId: string) {
    return maestro.tasks.removeDependency(taskId, dependsOnId);
  }

  async function getReadyTasks(projectId: string) {
    return maestro.tasks.getReady(projectId);
  }

  async function getTaskSessionCounts(taskIds: string[]) {
    return maestro.tasks.getSessionCounts(taskIds);
  }

  // Sprints
  async function createSprint(params: { projectId: string; name: string; goal?: string; sprintType?: string }) {
    return maestro.sprints.create(params);
  }

  async function listSprints(projectId: string) {
    return maestro.sprints.list(projectId);
  }

  async function getSprint(id: string) {
    return maestro.sprints.get(id);
  }

  async function startSprint(id: string) {
    return maestro.sprints.start(id);
  }

  async function enterSprintReview(id: string) {
    return maestro.sprints.enterReview(id);
  }

  async function completeSprint(id: string) {
    return maestro.sprints.complete(id);
  }

  async function getSprintStatus(id: string) {
    return maestro.sprints.getStatus(id);
  }

  // Projects
  async function createProject(params: { name: string; description?: string; template?: string; workDir?: string }) {
    return maestro.projects.create(params);
  }

  async function selectFolder() {
    return maestro.system.selectFolder();
  }

  async function listProjects() {
    return maestro.projects.list();
  }

  async function getProject(id: string) {
    return maestro.projects.get(id);
  }

  async function updateProject(id: string, params: unknown) {
    return maestro.projects.update(id, params);
  }

  async function deleteProject(id: string) {
    return maestro.projects.delete(id);
  }

  async function getProjectBudget(projectId: string) {
    return maestro.projects.getBudget(projectId);
  }

  async function getProjectStats(projectId: string) {
    return maestro.projects.getStats(projectId);
  }

  async function initClaudeDir(projectId: string) {
    return maestro.projects.initClaudeDir(projectId);
  }

  async function getClaudeDir(projectId: string) {
    return maestro.projects.getClaudeDir(projectId);
  }

  // Knowledge
  async function knowledgeListTree() {
    return maestro.knowledge.listTree();
  }

  async function knowledgeReadFile(path: string) {
    return maestro.knowledge.readFile(path);
  }

  async function knowledgeSearch(query: string) {
    return maestro.knowledge.search(query);
  }

  // Gates
  async function createGate(params: {
    projectId: string;
    sprintId?: string | null;
    gateType: string;
  }) {
    return maestro.gates.create(params);
  }

  async function listGates(filters?: unknown) {
    return maestro.gates.list(filters);
  }

  async function getGate(id: string) {
    return maestro.gates.get(id);
  }

  async function submitGate(params: {
    gateId: string;
    submittedBy: string;
    checklist: Record<string, boolean>;
  }) {
    return maestro.gates.submit(params);
  }

  async function reviewGate(params: {
    gateId: string;
    reviewer: string;
    decision: 'approved' | 'rejected';
    comment?: string;
    checklist?: Record<string, boolean>;
    itemReasons?: Record<string, string>;
  }) {
    return maestro.gates.review(params);
  }

  async function getGateChecklists() {
    return maestro.gates.getChecklists();
  }

  async function initGatePipeline(projectId: string, sprintId: string) {
    return maestro.gates.initPipeline({ projectId, sprintId });
  }

  // Costs
  async function getCostOverview() {
    return maestro.costs.getOverview();
  }

  async function getCostBreakdown(type: string) {
    return maestro.costs.getBreakdown(type);
  }

  async function getCostBudget(projectId: string) {
    return maestro.costs.getBudget(projectId);
  }

  async function setCostBudget(params: {
    projectId: string;
    dailyTokenLimit?: number;
    totalTokenLimit?: number;
    alertThreshold?: number;
  }) {
    return maestro.costs.setBudget(params);
  }

  // Settings
  async function getSetting(key: string) {
    return maestro.settings.get(key);
  }

  async function updateSetting(params: { key: string; value: string; category?: string }) {
    return maestro.settings.update(params);
  }

  async function getAllSettings() {
    return maestro.settings.getAll();
  }

  // Objections
  async function listObjections() {
    return maestro.objections.list();
  }

  async function resolveObjection(params: {
    objectionId: string;
    resolution: string;
    resolvedBy: string;
  }) {
    return maestro.objections.resolve(params);
  }

  // Git
  async function gitGetStatus(cwd: string) {
    return maestro.git.getStatus(cwd);
  }

  async function gitGetDiff(cwd: string) {
    return maestro.git.getDiff(cwd);
  }

  async function gitGetFileDiff(cwd: string, filePath: string) {
    return maestro.git.getFileDiff(cwd, filePath);
  }

  async function gitGetLog(cwd: string, limit?: number) {
    return maestro.git.getLog(cwd, limit);
  }

  async function gitGetBranches(cwd: string) {
    return maestro.git.getBranches(cwd);
  }

  async function gitCreateWorktree(cwd: string, branch: string, path: string) {
    return maestro.git.createWorktree(cwd, branch, path);
  }

  async function gitRemoveWorktree(cwd: string, path: string) {
    return maestro.git.removeWorktree(cwd, path);
  }

  async function gitListWorktrees(cwd: string) {
    return maestro.git.listWorktrees(cwd);
  }

  async function gitStage(cwd: string, files?: string[]) {
    return maestro.git.stage(cwd, files);
  }

  async function gitCommit(cwd: string, message: string, files?: string[]) {
    return maestro.git.commit(cwd, message, files);
  }

  async function gitPush(cwd: string, remote?: string, branch?: string, setUpstream?: boolean) {
    return maestro.git.push(cwd, remote, branch, setUpstream);
  }

  async function gitPull(cwd: string, remote?: string, branch?: string) {
    return maestro.git.pull(cwd, remote, branch);
  }

  async function gitCreateBranch(cwd: string, branchName: string, checkout?: boolean) {
    return maestro.git.createBranch(cwd, branchName, checkout);
  }

  async function gitCheckout(cwd: string, branchName: string) {
    return maestro.git.checkout(cwd, branchName);
  }

  async function gitDeleteBranch(cwd: string, branchName: string, force?: boolean) {
    return maestro.git.deleteBranch(cwd, branchName, force);
  }

  // Auth
  async function authLogin() {
    return maestro.auth.login();
  }

  async function authLogout() {
    return maestro.auth.logout();
  }

  async function authGetProfile() {
    return maestro.auth.getProfile();
  }

  async function authGetStatus() {
    return maestro.auth.getStatus();
  }

  // GitHub
  async function githubCreatePR(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    head: string;
    base: string;
  }) {
    return maestro.github.createPR(params);
  }

  async function githubListPRs(owner: string, repo: string, state?: string) {
    return maestro.github.listPRs(owner, repo, state);
  }

  async function githubCreateIssue(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
  }) {
    return maestro.github.createIssue(params);
  }

  async function githubGetRepos(page?: number, perPage?: number) {
    return maestro.github.getRepos(page, perPage);
  }

  // Audit
  async function queryAuditLogs(params?: unknown) {
    return maestro.audit.query(params);
  }

  // Notion Sync
  async function notionLogin() {
    return maestro.notion.login();
  }

  async function notionDisconnect() {
    return maestro.notion.disconnect();
  }

  async function notionGetStatus() {
    return maestro.notion.getStatus();
  }

  async function notionVerify() {
    return maestro.notion.verify();
  }

  async function notionSetParentPage(pageId: string) {
    return maestro.notion.setParentPage(pageId);
  }

  async function notionInitDatabases() {
    return maestro.notion.initDatabases();
  }

  async function notionGetDbStatus() {
    return maestro.notion.getDbStatus();
  }

  async function notionSyncPush(tableName?: string) {
    return maestro.notion.syncPush(tableName);
  }

  async function notionSyncPull(tableName?: string) {
    return maestro.notion.syncPull(tableName);
  }

  async function notionSyncAll(options?: unknown) {
    return maestro.notion.syncAll(options);
  }

  async function notionSchedulerStart(intervalMs?: number) {
    return maestro.notion.schedulerStart(intervalMs);
  }

  async function notionSchedulerStop() {
    return maestro.notion.schedulerStop();
  }

  async function notionQueueFlush() {
    return maestro.notion.queueFlush();
  }

  function onSyncStatus(callback: (data: unknown) => void) {
    maestro.on.syncStatus(callback);
  }

  // Doc Sync (Phase 6D)
  async function docSyncGetStatus(scope: string, projectWorkDir?: string) {
    return maestro.docSync.getStatus(scope, projectWorkDir);
  }

  async function docSyncDiscover(scope: string, projectWorkDir?: string) {
    return maestro.docSync.discover(scope, projectWorkDir);
  }

  async function docSyncGetMappings(scope: string) {
    return maestro.docSync.getMappings(scope);
  }

  async function docSyncSetRootPage(scope: string, pageId: string) {
    return maestro.docSync.setRootPage(scope, pageId);
  }

  async function docSyncPush(options: unknown) {
    return maestro.docSync.push(options);
  }

  async function docSyncPull(options: unknown) {
    return maestro.docSync.pull(options);
  }

  async function docSyncSyncAll(options: unknown) {
    return maestro.docSync.syncAll(options);
  }

  // PTY
  function ptyInput(ptyId: string, data: string) {
    maestro.pty.input(ptyId, data);
  }

  function ptyResize(ptyId: string, cols: number, rows: number) {
    maestro.pty.resize(ptyId, cols, rows);
  }

  // Event listeners
  function onSessionEvent(callback: (data: unknown) => void) {
    maestro.on.sessionEvent(callback);
  }

  function onSessionStatus(callback: (data: unknown) => void) {
    maestro.on.sessionStatus(callback);
  }

  function onPtyData(callback: (data: { ptyId: string; data: string }) => void) {
    maestro.on.ptyData(callback);
  }

  function onNotification(callback: (data: unknown) => void) {
    maestro.on.notification(callback);
  }

  function onAgentsReloaded(callback: (data: unknown) => void) {
    maestro.on.agentsReloaded(callback);
  }

  function onDelegationReport(callback: (data: unknown) => void) {
    maestro.on.delegationReport(callback);
  }

  return {
    // System
    getHealth,
    // Sessions
    spawnSession,
    stopSession,
    listSessions,
    listSessionsByTask,
    listSessionsByProject,
    getActiveSessions,
    getOutputBuffer,
    getSessionLog,
    previewPrompt,
    assignTaskToSession,
    sendDelegation,
    listDelegations,
    requestSummary,
    getSessionSummaries,
    // Agents
    listAgents,
    getAgent,
    getDepartments,
    // Tasks
    createTask,
    listTasks,
    getTask,
    updateTask,
    deleteTask,
    transitionTask,
    addTaskDependency,
    removeTaskDependency,
    getReadyTasks,
    getTaskSessionCounts,
    // Sprints
    createSprint,
    listSprints,
    getSprint,
    startSprint,
    enterSprintReview,
    completeSprint,
    getSprintStatus,
    // Projects
    createProject,
    listProjects,
    selectFolder,
    getProject,
    updateProject,
    deleteProject,
    getProjectBudget,
    getProjectStats,
    initClaudeDir,
    getClaudeDir,
    // Knowledge
    knowledgeListTree,
    knowledgeReadFile,
    knowledgeSearch,
    // PTY
    ptyInput,
    ptyResize,
    // Gates
    createGate,
    listGates,
    getGate,
    submitGate,
    reviewGate,
    getGateChecklists,
    initGatePipeline,
    // Costs
    getCostOverview,
    getCostBreakdown,
    getCostBudget,
    setCostBudget,
    // Settings
    getSetting,
    updateSetting,
    getAllSettings,
    // Objections
    listObjections,
    resolveObjection,
    // Git
    gitGetStatus,
    gitGetDiff,
    gitGetFileDiff,
    gitGetLog,
    gitGetBranches,
    gitCreateWorktree,
    gitRemoveWorktree,
    gitListWorktrees,
    gitStage,
    gitCommit,
    gitPush,
    gitPull,
    gitCreateBranch,
    gitCheckout,
    gitDeleteBranch,
    // Auth
    authLogin,
    authLogout,
    authGetProfile,
    authGetStatus,
    // GitHub
    githubCreatePR,
    githubListPRs,
    githubCreateIssue,
    githubGetRepos,
    // Audit
    queryAuditLogs,
    // Notion Sync
    notionLogin,
    notionDisconnect,
    notionGetStatus,
    notionVerify,
    notionSetParentPage,
    notionInitDatabases,
    notionGetDbStatus,
    notionSyncPush,
    notionSyncPull,
    notionSyncAll,
    notionSchedulerStart,
    notionSchedulerStop,
    notionQueueFlush,
    // Events
    onSessionEvent,
    onSessionStatus,
    onPtyData,
    onNotification,
    onAgentsReloaded,
    onDelegationReport,
    onSyncStatus,
    // Doc Sync
    docSyncGetStatus,
    docSyncDiscover,
    docSyncGetMappings,
    docSyncSetRootPage,
    docSyncPush,
    docSyncPull,
    docSyncSyncAll,
  };
}
