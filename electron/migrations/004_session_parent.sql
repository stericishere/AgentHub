ALTER TABLE claude_sessions ADD COLUMN parent_session_id TEXT REFERENCES claude_sessions(id);
