-- Migration 013: Add started_at / completed_at to tasks
-- Reason: Enable actual work hours calculation from task lifecycle timestamps
-- These are populated by project-sync when parsing task files with 開始時間/完工時間 metadata

ALTER TABLE tasks ADD COLUMN started_at TEXT;
ALTER TABLE tasks ADD COLUMN completed_at TEXT;
