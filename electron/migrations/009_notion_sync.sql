-- Notion 雲端同步相關表

-- Notion 連線資訊（單例）
CREATE TABLE IF NOT EXISTS notion_connection (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  workspace_id    TEXT NOT NULL,
  workspace_name  TEXT,
  workspace_icon  TEXT,
  bot_id          TEXT,
  parent_page_id  TEXT,
  connected_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 已初始化的 Notion Database 登記
CREATE TABLE IF NOT EXISTS notion_databases (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name          TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  notion_database_id  TEXT NOT NULL,
  last_synced_at      TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
);

-- 同步映射：local row <-> Notion page
CREATE TABLE IF NOT EXISTS sync_mapping (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name        TEXT NOT NULL,
  local_id          TEXT NOT NULL,
  notion_page_id    TEXT NOT NULL,
  local_updated_at  TEXT,
  notion_updated_at TEXT,
  last_synced_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(table_name, local_id)
);
CREATE INDEX IF NOT EXISTS idx_sync_mapping_table ON sync_mapping(table_name);

-- 離線變更佇列（6C-2 使用，先建表）
CREATE TABLE IF NOT EXISTS sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT NOT NULL,
  local_id    TEXT NOT NULL,
  operation   TEXT NOT NULL,
  payload     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);

-- 同步歷史紀錄
CREATE TABLE IF NOT EXISTS sync_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type     TEXT NOT NULL,
  status        TEXT NOT NULL,
  pushed_count  INTEGER DEFAULT 0,
  pulled_count  INTEGER DEFAULT 0,
  error_message TEXT,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);
