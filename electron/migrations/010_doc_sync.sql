-- Migration 010: 文件同步映射表（Phase 6D）
-- Markdown ↔ Notion Page 雙向同步用

CREATE TABLE IF NOT EXISTS doc_sync_mapping (
  id              TEXT PRIMARY KEY,
  scope           TEXT NOT NULL,           -- 'knowledge' | 'docs' | 'project'
  local_path      TEXT NOT NULL UNIQUE,    -- 相對路徑，如 knowledge/company/sop/code-review.md
  notion_page_id  TEXT,                    -- Notion Page ID
  local_hash      TEXT,                    -- 本地檔案 SHA-256 前 16 碼
  notion_hash     TEXT,                    -- 上次同步時 Notion blocks 的 hash
  last_synced_at  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doc_sync_folders (
  id              TEXT PRIMARY KEY,
  scope           TEXT NOT NULL,
  local_dir       TEXT NOT NULL UNIQUE,    -- 相對目錄路徑
  notion_page_id  TEXT NOT NULL,           -- 對應的 Notion 子頁面 ID
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_doc_sync_scope ON doc_sync_mapping(scope);
CREATE INDEX IF NOT EXISTS idx_doc_sync_notion ON doc_sync_mapping(notion_page_id);
