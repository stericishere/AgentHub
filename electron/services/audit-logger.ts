import { database } from './database';
import { logger } from '../utils/logger';

export interface AuditEntry {
  id: string;
  eventType: string;
  actor: string;
  target: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditQueryParams {
  eventType?: string;
  actor?: string;
  limit?: number;
  offset?: number;
}

function rowToAudit(row: any): AuditEntry {
  return {
    id: String(row.id),
    eventType: row.event_type,
    actor: row.actor,
    target: row.target || null,
    details: row.details ? JSON.parse(row.details) : null,
    createdAt: row.created_at,
  };
}

class AuditLogger {
  log(
    eventType: string,
    actor: string,
    target?: string,
    details?: Record<string, unknown>,
    projectId?: string,
  ): void {
    const now = new Date().toISOString();

    try {
      database.run(
        `INSERT INTO audit_logs (event_type, actor, target, details, project_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          eventType,
          actor,
          target || '',
          details ? JSON.stringify(details) : null,
          projectId || null,
          now,
        ],
      );
    } catch (err) {
      logger.error(`Audit log failed: ${eventType}`, err);
    }

    logger.debug(`Audit: ${eventType} by ${actor} → ${target || '-'}`);
  }

  query(params?: AuditQueryParams): AuditEntry[] {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const values: unknown[] = [];

    if (params?.eventType) {
      sql += ' AND event_type = ?';
      values.push(params.eventType);
    }
    if (params?.actor) {
      sql += ' AND actor = ?';
      values.push(params.actor);
    }

    sql += ' ORDER BY created_at DESC';

    const limit = params?.limit || 100;
    const offset = params?.offset || 0;
    sql += ' LIMIT ? OFFSET ?';
    values.push(limit, offset);

    return database.prepare(sql, values).map(rowToAudit);
  }
}

export const auditLogger = new AuditLogger();
