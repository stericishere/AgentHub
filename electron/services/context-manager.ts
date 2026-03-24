import { database } from './database';
import { logger } from '../utils/logger';
import type { ConversationRecord, DecisionRecord } from '../types';

const MAX_DECISIONS_FOR_PROMPT = 5;
const MAX_CONVERSATIONS_FOR_CONTEXT = 10;

class ContextManager {
  /**
   * Save a conversation turn.
   */
  saveConversation(
    agentId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    projectId?: string | null,
    sessionId?: string | null,
  ): ConversationRecord {
    database.run(
      `INSERT INTO conversations (project_id, agent_id, session_id, role, content)
       VALUES (?, ?, ?, ?, ?)`,
      [projectId || null, agentId, sessionId || null, role, content],
    );

    const rows = database.prepare(
      'SELECT * FROM conversations WHERE agent_id = ? ORDER BY id DESC LIMIT 1',
      [agentId],
    );
    return this.rowToConversation(rows[0]);
  }

  /**
   * Record a decision.
   */
  recordDecision(
    title: string,
    content: string,
    category: string,
    reason?: string,
    decidedBy?: string,
    projectId?: string | null,
  ): DecisionRecord {
    database.run(
      `INSERT INTO decisions (project_id, title, content, reason, category, decided_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId || null, title, content, reason || null, category, decidedBy || null],
    );

    const rows = database.prepare('SELECT * FROM decisions ORDER BY id DESC LIMIT 1');
    logger.info(`Decision recorded: ${title}`);
    return this.rowToDecision(rows[0]);
  }

  /**
   * Get active decisions for a project.
   */
  getDecisions(projectId?: string, category?: string): DecisionRecord[] {
    let sql = "SELECT * FROM decisions WHERE status = 'active'";
    const params: unknown[] = [];

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = database.prepare(sql, params);
    return rows.map((r: any) => this.rowToDecision(r));
  }

  /**
   * Get decisions formatted for system prompt injection.
   */
  getDecisionsForPrompt(projectId?: string): string {
    const decisions = this.getDecisions(projectId).slice(0, MAX_DECISIONS_FOR_PROMPT);
    if (decisions.length === 0) return '';

    const lines = decisions.map(
      (d) => `- **${d.title}** [${d.category}]: ${d.content.slice(0, 150)}`,
    );
    return `## 已做決策\n\n${lines.join('\n')}`;
  }

  /**
   * Get recent conversation history for an agent.
   */
  getConversations(
    agentId: string,
    projectId?: string | null,
    limit = MAX_CONVERSATIONS_FOR_CONTEXT,
  ): ConversationRecord[] {
    let sql = 'SELECT * FROM conversations WHERE agent_id = ?';
    const params: unknown[] = [agentId];

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = database.prepare(sql, params);
    return rows.map((r: any) => this.rowToConversation(r)).reverse();
  }

  /**
   * Build full context for a session (memory + comm + decisions).
   */
  getContextForSession(agentId: string, projectId?: string): string {
    const sections: string[] = [];

    const decisions = this.getDecisionsForPrompt(projectId);
    if (decisions) sections.push(decisions);

    return sections.join('\n\n');
  }

  /**
   * Supersede a decision.
   */
  supersedeDecision(id: number): void {
    database.run(
      "UPDATE decisions SET status = 'superseded', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id],
    );
  }

  private rowToConversation(row: any): ConversationRecord {
    return {
      id: row.id,
      projectId: row.project_id || null,
      agentId: row.agent_id,
      sessionId: row.session_id || null,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  private rowToDecision(row: any): DecisionRecord {
    return {
      id: row.id,
      projectId: row.project_id || null,
      title: row.title,
      content: row.content,
      reason: row.reason || null,
      category: row.category,
      status: row.status,
      decidedBy: row.decided_by || null,
      createdAt: row.created_at,
    };
  }
}

export const contextManager = new ContextManager();
