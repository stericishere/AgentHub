import { randomUUID } from 'crypto';
import { database } from './database';
import { logger } from '../utils/logger';

export interface FailureRecord {
  id: string;
  sessionId: string | null;
  agentId: string | null;
  errorType: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  status: 'open' | 'retrying' | 'resolved' | 'failed';
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

function rowToFailure(row: any): FailureRecord {
  return {
    id: row.id,
    sessionId: row.session_id || null,
    agentId: row.agent_id || null,
    errorType: row.error_type,
    errorMessage: row.error_message,
    retryCount: row.retry_count || 0,
    maxRetries: row.max_retries || 3,
    status: row.status || 'open',
    resolution: row.resolution || null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
  };
}

class ErrorRecovery {
  recordFailure(params: {
    sessionId?: string;
    agentId?: string;
    errorType: string;
    errorMessage: string;
    maxRetries?: number;
  }): FailureRecord {
    const id = randomUUID();
    const now = new Date().toISOString();

    database.run(
      `INSERT INTO execution_failures
       (id, session_id, agent_id, error_type, error_message, retry_count, max_retries, status, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, 'open', ?)`,
      [
        id,
        params.sessionId || null,
        params.agentId || null,
        params.errorType,
        params.errorMessage,
        params.maxRetries ?? 3,
        now,
      ],
    );

    logger.warn(`Failure recorded: ${params.errorType} — ${params.errorMessage}`);

    return {
      id,
      sessionId: params.sessionId || null,
      agentId: params.agentId || null,
      errorType: params.errorType,
      errorMessage: params.errorMessage,
      retryCount: 0,
      maxRetries: params.maxRetries ?? 3,
      status: 'open',
      resolution: null,
      createdAt: now,
      resolvedAt: null,
    };
  }

  getFailures(status?: string): FailureRecord[] {
    let sql = 'SELECT * FROM execution_failures';
    const params: unknown[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';
    return database.prepare(sql, params).map(rowToFailure);
  }

  resolveManually(failureId: string, resolution: string): FailureRecord {
    const now = new Date().toISOString();

    database.run(
      `UPDATE execution_failures
       SET status = 'resolved', resolution = ?, resolved_at = ?
       WHERE id = ?`,
      [resolution, now, failureId],
    );

    logger.info(`Failure resolved: ${failureId}`);

    const rows = database.prepare('SELECT * FROM execution_failures WHERE id = ?', [failureId]);
    if (rows.length === 0) throw new Error(`Failure not found: ${failureId}`);
    return rowToFailure(rows[0]);
  }
}

export const errorRecovery = new ErrorRecovery();
