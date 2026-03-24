# 系統架構

> **版本**: v1.0
> **最後更新**: 2026-03-24

---

## 架構核心

**每個 Agent = 一個 Claude Code Session**。AgentHub 不自建 Agent Runtime，而是透過 node-pty 啟動 Claude Code CLI 子程序，並在 xterm.js 中即時渲染輸出。

## 三層架構

```
┌─────────────────────────────────────────┐
│            Vue 3 Renderer               │
│  Views (5) → Components → Stores (7)   │
│         ↕ IPC (contextBridge)           │
├─────────────────────────────────────────┤
│          Electron Main Process          │
│  Services (~14) → IPC Handlers (~10)    │
│         ↕ node-pty / chokidar / sql.js  │
├─────────────────────────────────────────┤
│            系統層                        │
│  Claude Code CLI / 檔案系統 / SQLite    │
└─────────────────────────────────────────┘
```

## 服務清單（保留）

### 核心服務

| 服務 | 檔案 | 職責 |
|------|------|------|
| SessionManager | `session-manager.ts` | Session 生命週期、PTY 管理、輸出緩衝 |
| Database | `database.ts` | sql.js 初始化、migration、CRUD |
| AgentLoader | `agent-loader.ts` | 載入 Agent YAML 定義 |
| PromptAssembler | `prompt-assembler.ts` | 組裝 System Prompt |
| EventParser | `event-parser.ts` | 解析 Claude 輸出（tool calls、file edits）|
| EventBus | `event-bus.ts` | 事件發佈/訂閱（main → renderer 轉發）|

### 流程服務

| 服務 | 檔案 | 職責 |
|------|------|------|
| GateKeeper | `gate-keeper.ts` | Gate 生命週期、checklist、審核流程 |
| TaskManager | `task-manager.ts` | 任務 CRUD、狀態機、依賴管理 |
| SprintManager | `sprint-manager.ts` | Sprint 生命週期 |
| AuditLogger | `audit-logger.ts` | 操作稽核紀錄 |

### 工具服務

| 服務 | 檔案 | 職責 |
|------|------|------|
| GitManager | `git-manager.ts` | Git 操作（status, diff, log, commit）|
| KnowledgeReader | `knowledge-reader.ts` | 知識庫讀取和搜尋 |
| FileWatcher | `file-watcher.ts` | 檔案監控 |
| TrayService | `tray-service.ts` | 系統列圖示 |

### Sprint 2 新增

| 服務 | 檔案 | 職責 |
|------|------|------|
| HookManager | `hook-manager.ts` | Hook 腳本管理、自動注入 |
| SkillManager | `skill-manager.ts`* | Skill 模板管理、同步到子專案 |

### Sprint 3 新增

| 服務 | 檔案 | 職責 |
|------|------|------|
| ProjectSync | `project-sync.ts` | FileWatcher → DB 同步橋樑 |
| MarkdownParser | `markdown-parser.ts` | 解析 dev-plan 第 10 節 + .tasks/*.md |

> *SkillManager 可能擴充自現有的 `skill-generator.ts`

## 已移除服務

| 服務 | 原因 |
|------|------|
| SyncManager, NotionApi, DocSyncManager, MarkdownNotion, SyncScheduler | Notion 同步不需要 |
| AuthManager, GithubApi | GitHub OAuth 不需要，用 gh CLI |
| CommunicationBus, Orchestrator, DelegationParser | 不實用 |
| BrowseServer | Playwright 瀏覽器不需要 |
| CostTracker | 成本追蹤暫不需要 |
| MemoryManager, ContextManager, ErrorRecovery | 功能重疊或不需要 |
| NotificationService, UpdaterService, ShortcutService, CrashReporter | 精簡 |

## IPC 架構

### 保留的 IPC Handler 模組

| 模組 | 主要通道 |
|------|---------|
| sessions | SPAWN, STOP, LIST, GET_ACTIVE, PTY_INPUT/RESIZE |
| tasks | CREATE, LIST, GET, UPDATE, DELETE, TRANSITION |
| projects | CREATE, LIST, GET, UPDATE, DELETE, INIT_CLAUDE_DIR |
| gates | CREATE, LIST, SUBMIT, REVIEW, GET_CHECKLISTS |
| sprints | CREATE, LIST, GET, START, COMPLETE, GET_STATUS |
| agents | LIST, GET, GET_DEPARTMENTS |
| knowledge | LIST_TREE, READ_FILE, SEARCH |
| settings | GET, UPDATE, GET_ALL |
| git | GET_STATUS, GET_DIFF, GET_LOG, COMMIT, PUSH, PULL |
| system | GET_HEALTH, SELECT_FOLDER, CLEAR_DATABASE |

### 已移除 IPC 模組

sync, doc-sync, auth, browse, costs, objections

## DB Schema（保留）

| 表 | 用途 |
|----|------|
| projects | 專案元資料 |
| sprints | Sprint 生命週期 |
| tasks | 任務 CRUD + 狀態 |
| task_dependencies | 任務依賴關係 |
| gates | Gate 審核 + checklist |
| claude_sessions | Session 記錄 + token 統計 |
| session_events | Session 事件流 |
| decisions | 技術決策記錄 |
| audit_logs | 稽核日誌 |
| user_preferences | 使用者設定 |
| sprint_reviews | Sprint 回顧 |
| schema_migrations | DB 版本管理 |
