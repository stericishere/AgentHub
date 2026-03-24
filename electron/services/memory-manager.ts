import { database } from './database';
import { logger } from '../utils/logger';
import type { MemoryBlock } from '../types';

const MAX_MEMORY_BLOCKS_FOR_PROMPT = 10;

class MemoryManager {
  save(
    agentId: string,
    content: string,
    blockType = 'note',
    projectId?: string | null,
    sourceSessionId?: string | null,
  ): MemoryBlock {
    const now = new Date().toISOString();

    database.run(
      `INSERT INTO memory_blocks (agent_id, project_id, block_type, content, source_session_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [agentId, projectId || null, blockType, content, sourceSessionId || null, now, now],
    );

    const rows = database.prepare(
      'SELECT * FROM memory_blocks WHERE agent_id = ? ORDER BY id DESC LIMIT 1',
      [agentId],
    );

    return this.rowToBlock(rows[0]);
  }

  getForAgent(agentId: string, projectId?: string | null, limit = 20): MemoryBlock[] {
    let sql = 'SELECT * FROM memory_blocks WHERE agent_id = ?';
    const params: unknown[] = [agentId];

    if (projectId) {
      sql += ' AND (project_id = ? OR project_id IS NULL)';
      params.push(projectId);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);

    const rows = database.prepare(sql, params);
    return rows.map((r: any) => this.rowToBlock(r));
  }

  /**
   * Get memory blocks formatted for injection into system prompt.
   */
  getForPrompt(agentId: string, projectId?: string | null): string {
    const blocks = this.getForAgent(agentId, projectId, MAX_MEMORY_BLOCKS_FOR_PROMPT);
    if (blocks.length === 0) return '';

    const lines = blocks.map((b) => `- [${b.blockType}] ${b.content}`);
    return `## 工作記憶\n\n${lines.join('\n')}`;
  }

  /**
   * Extract memory blocks from session output.
   * Looks for `ai-studio:memory` fenced blocks in the output.
   */
  extractFromSession(
    sessionOutput: string,
    agentId: string,
    projectId?: string | null,
    sessionId?: string | null,
  ): MemoryBlock[] {
    const results: MemoryBlock[] = [];
    const pattern = /```ai-studio:memory\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(sessionOutput)) !== null) {
      const content = match[1].trim();
      if (content) {
        try {
          // Try parsing as JSON first
          const parsed = JSON.parse(content);
          const block = this.save(
            agentId,
            typeof parsed.content === 'string' ? parsed.content : content,
            parsed.type || 'note',
            projectId,
            sessionId,
          );
          results.push(block);
        } catch {
          // Plain text memory
          const block = this.save(agentId, content, 'note', projectId, sessionId);
          results.push(block);
        }
      }
    }

    if (results.length > 0) {
      logger.info(`Extracted ${results.length} memory blocks from session for agent ${agentId}`);
    }

    return results;
  }

  deleteBlock(id: number): void {
    database.run('DELETE FROM memory_blocks WHERE id = ?', [id]);
  }

  private rowToBlock(row: any): MemoryBlock {
    return {
      id: row.id,
      agentId: row.agent_id,
      projectId: row.project_id || null,
      blockType: row.block_type,
      content: row.content,
      sourceSessionId: row.source_session_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const memoryManager = new MemoryManager();
