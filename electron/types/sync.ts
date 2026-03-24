// Notion 雲端同步型別定義

// Notion 連線資訊
export interface NotionConnection {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon: string | null;
  botId: string;
  accessToken: string;
  parentPageId: string;
  connectedAt: string;
}

// OAuth 結果
export interface NotionAuthResult {
  success: boolean;
  connection?: Omit<NotionConnection, 'accessToken'>;
  error?: string;
}

// 同步狀態
export type SyncConnectionStatus = 'disconnected' | 'connected' | 'syncing' | 'error';

export interface SyncStatus {
  connection: SyncConnectionStatus;
  workspaceName: string | null;
  workspaceIcon: string | null;
  lastSyncAt: string | null;
  pendingPush: number;
  pendingPull: number;
  databases: NotionDbInfo[];
}

export interface NotionDbInfo {
  tableName: string;
  displayName: string;
  notionDatabaseId: string | null;
  localRowCount: number;
  status: 'ok' | 'missing' | 'error';
  lastSyncedAt: string | null;
}

// 18 表映射定義（宣告式）
export interface TableMapping {
  tableName: string;
  displayName: string;
  notionTitle: string;
  properties: PropertyMapping[];
}

export interface PropertyMapping {
  column: string;
  notionName: string;
  notionType: 'title' | 'rich_text' | 'number' | 'select' | 'date' | 'checkbox' | 'url';
  isTitle?: boolean;
}

// 衝突策略
export type ConflictStrategy = 'lww' | 'local-first' | 'cloud-first';

// 同步選項
export interface SyncOptions {
  tableName?: string;
  conflictStrategy?: ConflictStrategy;
}

// 同步進度（Main → Renderer push event）
export interface SyncProgress {
  phase: 'push' | 'pull' | 'idle';
  currentTable: string;
  currentTableIndex: number;
  totalTables: number;
  processedRows: number;
  totalRows: number;
  errors: number;
  startedAt: string;
}

// 同步結果
export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
  durationMs: number;
}

// ── Phase 6D: 文件同步型別 ──────────────────────────────

export type DocSyncScope = 'knowledge' | 'docs' | 'project';

export type DocConflictStrategy = 'local-wins' | 'notion-wins' | 'skip';

export interface DocSyncMapping {
  id: string;
  scope: DocSyncScope;
  localPath: string;
  notionPageId: string | null;
  localHash: string | null;
  notionHash: string | null;
  lastSyncedAt: string | null;
}

export interface DocSyncStatus {
  scope: DocSyncScope;
  label: string;
  totalFiles: number;
  synced: number;
  pendingPush: number;
  rootPageId: string | null;
}

export interface DocSyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
  durationMs: number;
}

export interface DocSyncOptions {
  scope: DocSyncScope;
  conflictStrategy?: DocConflictStrategy;
  projectWorkDir?: string;
}
