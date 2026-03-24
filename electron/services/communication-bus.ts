import { database } from './database';
import { agentLoader } from './agent-loader';
import { logger } from '../utils/logger';
import type {
  MessageRecord,
  SendMessageParams,
  MessageType,
  ObjectionRecord,
} from '../types';

/**
 * Communication direction rules:
 * Boss (L0) → L1: command, notify
 * L1 → Boss (L0): report, proposal, objection
 * L1 → L2: command, notify
 * L2 → L1: report, proposal, objection
 * L1 ↔ L1: coordinate, notify
 * L2 ↔ L2: coordinate, notify (same department)
 */

const BOSS_ID = 'boss';

class CommunicationBus {
  send(params: SendMessageParams): MessageRecord {
    // Validate direction
    this.validateDirection(params.fromAgent, params.toAgent, params.messageType);

    database.run(
      `INSERT INTO messages (project_id, task_id, from_agent, to_agent, message_type, content, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.projectId || null,
        params.taskId || null,
        params.fromAgent,
        params.toAgent,
        params.messageType,
        params.content,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );

    // Get the inserted message
    const rows = database.prepare(
      'SELECT * FROM messages WHERE from_agent = ? AND to_agent = ? ORDER BY id DESC LIMIT 1',
      [params.fromAgent, params.toAgent],
    );

    const msg = this.rowToMessage(rows[0]);
    logger.info(`Message sent: ${params.fromAgent} → ${params.toAgent} [${params.messageType}]`);

    // If it's an objection, track it
    if (params.messageType === 'objection') {
      this.createObjection(msg, params.content);
    }

    return msg;
  }

  getMessages(filters: {
    projectId?: string;
    taskId?: string;
    agentId?: string;
    messageType?: MessageType;
    limit?: number;
  }): MessageRecord[] {
    let sql = 'SELECT * FROM messages WHERE 1=1';
    const params: unknown[] = [];

    if (filters.projectId) {
      sql += ' AND project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.taskId) {
      sql += ' AND task_id = ?';
      params.push(filters.taskId);
    }
    if (filters.agentId) {
      sql += ' AND (from_agent = ? OR to_agent = ?)';
      params.push(filters.agentId, filters.agentId);
    }
    if (filters.messageType) {
      sql += ' AND message_type = ?';
      params.push(filters.messageType);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(filters.limit || 50);

    const rows = database.prepare(sql, params);
    return rows.map((r: any) => this.rowToMessage(r));
  }

  /**
   * Get communication context for an agent (recent messages to include in prompt).
   */
  getContextForAgent(agentId: string, projectId?: string, limit = 10): string {
    const messages = this.getMessages({ agentId, projectId, limit });
    if (messages.length === 0) return '';

    const lines = messages.map((m) => {
      const direction = m.fromAgent === agentId ? '→' : '←';
      const other = m.fromAgent === agentId ? m.toAgent : m.fromAgent;
      return `[${m.messageType}] ${direction} ${other}: ${m.content.slice(0, 200)}`;
    });

    return `## 近期溝通記錄\n\n${lines.join('\n')}`;
  }

  /**
   * Get open objections.
   */
  getOpenObjections(projectId?: string): ObjectionRecord[] {
    let sql = 'SELECT * FROM objections WHERE status = ?';
    const params: unknown[] = ['open'];

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = database.prepare(sql, params);
    return rows.map((r: any) => this.rowToObjection(r));
  }

  /**
   * Resolve an objection.
   */
  resolveObjection(
    objectionId: number,
    resolvedBy: string,
    resolution: string,
    status: 'accepted' | 'rejected' | 'resolved' = 'resolved',
  ): void {
    database.run(
      `UPDATE objections SET status = ?, resolved_by = ?, resolution = ?, resolved_at = ? WHERE id = ?`,
      [status, resolvedBy, resolution, new Date().toISOString(), objectionId],
    );
  }

  private validateDirection(from: string, to: string, type: MessageType): void {
    const fromLevel = this.getLevel(from);
    const toLevel = this.getLevel(to);

    // Boss can send command/notify to L1
    if (fromLevel === 'L0' && toLevel === 'L1') {
      if (!['command', 'notify'].includes(type)) {
        throw new Error(`Boss can only send command/notify to L1. Got: ${type}`);
      }
      return;
    }

    // L1 can send report/proposal/objection to Boss
    if (fromLevel === 'L1' && toLevel === 'L0') {
      if (!['report', 'proposal', 'objection'].includes(type)) {
        throw new Error(`L1 can only send report/proposal/objection to Boss. Got: ${type}`);
      }
      return;
    }

    // L1 can send command/notify to L2
    if (fromLevel === 'L1' && toLevel === 'L2') {
      if (!['command', 'notify'].includes(type)) {
        throw new Error(`L1 can only send command/notify to L2. Got: ${type}`);
      }
      return;
    }

    // L2 can send report/proposal/objection to L1
    if (fromLevel === 'L2' && toLevel === 'L1') {
      if (!['report', 'proposal', 'objection'].includes(type)) {
        throw new Error(`L2 can only send report/proposal/objection to L1. Got: ${type}`);
      }
      return;
    }

    // Same level: coordinate/notify
    if (fromLevel === toLevel) {
      if (!['coordinate', 'notify'].includes(type)) {
        throw new Error(`Same-level agents can only coordinate/notify. Got: ${type}`);
      }
      return;
    }

    // Default: allow (in case of unknown level combinations)
    logger.warn(`Unvalidated communication direction: ${from}(${fromLevel}) → ${to}(${toLevel}) [${type}]`);
  }

  private getLevel(agentId: string): string {
    if (agentId === BOSS_ID) return 'L0';
    const agent = agentLoader.getById(agentId);
    return agent?.level || 'L2';
  }

  private createObjection(message: MessageRecord, reason: string): void {
    database.run(
      `INSERT INTO objections (message_id, project_id, raised_by, target, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [message.id, message.projectId, message.fromAgent, message.toAgent, reason],
    );
  }

  private rowToMessage(row: any): MessageRecord {
    return {
      id: row.id,
      projectId: row.project_id || null,
      taskId: row.task_id || null,
      fromAgent: row.from_agent,
      toAgent: row.to_agent,
      messageType: row.message_type,
      content: row.content,
      metadata: row.metadata || null,
      createdAt: row.created_at,
    };
  }

  private rowToObjection(row: any): ObjectionRecord {
    return {
      id: row.id,
      messageId: row.message_id,
      projectId: row.project_id || null,
      raisedBy: row.raised_by,
      target: row.target,
      reason: row.reason,
      status: row.status,
      resolvedBy: row.resolved_by || null,
      resolution: row.resolution || null,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at || null,
    };
  }
}

export const communicationBus = new CommunicationBus();
