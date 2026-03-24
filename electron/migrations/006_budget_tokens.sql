-- Migration 006: Add token-based budget columns
-- Claude Max users pay a fixed monthly fee, so USD budgets are meaningless.
-- Add token-based budget limits alongside existing USD columns (preserved for reference).

ALTER TABLE project_budgets ADD COLUMN daily_token_limit INTEGER DEFAULT 500000;
ALTER TABLE project_budgets ADD COLUMN total_token_limit INTEGER DEFAULT 10000000;

-- Migrate existing USD limits to approximate token equivalents ($1 ≈ 100K tokens)
UPDATE project_budgets
SET daily_token_limit = CAST(daily_limit * 100000 AS INTEGER),
    total_token_limit = CAST(total_limit * 100000 AS INTEGER);
