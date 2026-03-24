-- Add task text column to claude_sessions for storing task description
ALTER TABLE claude_sessions ADD COLUMN task TEXT;
