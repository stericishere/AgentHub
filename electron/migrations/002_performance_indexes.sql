-- Performance indexes for Phase 5
-- Sessions: status + started_at for active session queries
CREATE INDEX IF NOT EXISTS idx_sessions_status_started
ON claude_sessions (status, started_at DESC);

-- Sessions: project_id + status for project-scoped queries
CREATE INDEX IF NOT EXISTS idx_sessions_project_status
ON claude_sessions (project_id, status);

-- Audit logs: timestamp descending for recent activity
CREATE INDEX IF NOT EXISTS idx_audit_created_desc
ON audit_logs (created_at DESC);

-- Gates: project_id + status for gate pipeline queries
CREATE INDEX IF NOT EXISTS idx_gates_project_status
ON gates (project_id, status);
