import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { agentLoader } from './agent-loader';
import { memoryManager } from './memory-manager';
import { communicationBus } from './communication-bus';
import { contextManager } from './context-manager';
import { database } from './database';
import { getKnowledgeDir } from '../utils/paths';
import { logger } from '../utils/logger';

interface AssembleOptions {
  parentSessionId?: string;
}

class PromptAssembler {
  /**
   * Assemble a complete system prompt for an agent.
   * Format: Role definition + Knowledge refs + Memory + Communication + Decisions + Previous session + Agent metadata
   */
  assemble(agentId: string, projectId?: string | null, options?: AssembleOptions): string {
    const agent = agentLoader.getById(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const sections: string[] = [];

    // 1. Role definition (from agent .md file) — wrapped in <important> to survive context compaction
    const systemPrompt = agentLoader.getSystemPrompt(agentId);
    if (systemPrompt) {
      sections.push(`<important>\n${systemPrompt}\n</important>`);
    }

    // 2. Resolve knowledge references (company:// and project://)
    const knowledgeRefs = this.extractKnowledgeRefs(systemPrompt);
    if (knowledgeRefs.length > 0) {
      const resolved = this.resolveKnowledgeRefs(knowledgeRefs, projectId);
      if (resolved) {
        sections.push('\n---\n\n## 參考知識\n\n' + resolved);
      }
    }

    // 3. Memory blocks
    const memory = memoryManager.getForPrompt(agentId, projectId);
    if (memory) {
      sections.push('\n---\n\n' + memory);
    }

    // 4. Communication context
    const commContext = communicationBus.getContextForAgent(
      agentId,
      projectId || undefined,
    );
    if (commContext) {
      sections.push('\n---\n\n' + commContext);
    }

    // 5. Decisions
    const decisions = contextManager.getDecisionsForPrompt(projectId || undefined);
    if (decisions) {
      sections.push('\n---\n\n' + decisions);
    }

    // 6. Previous session context (for continuation sessions)
    if (options?.parentSessionId) {
      try {
        const rows = database.prepare(
          'SELECT result_summary, task, agent_id FROM claude_sessions WHERE id = ?',
          [options.parentSessionId],
        );
        if (rows.length > 0 && rows[0].result_summary) {
          sections.push([
            '\n---\n',
            '## 前次工作階段摘要',
            '',
            `前一個工作階段（${rows[0].agent_id}）的工作紀錄：`,
            '',
            rows[0].result_summary,
          ].join('\n'));
        }
      } catch (err) {
        logger.warn('Failed to load parent session summary', err);
      }
    }

    // 7. Agent metadata context — wrapped in <important> for context survival
    const metaLines = [
      `\n---\n`,
      `<important>`,
      `## Agent 資訊`,
      `- **ID**: ${agent.id}`,
      `- **層級**: ${agent.level}`,
      `- **部門**: ${agent.department}`,
    ];

    if (agent.manages.length > 0) {
      metaLines.push(`- **管理**: ${agent.manages.join(', ')}`);
    }
    if (agent.reportsTo) {
      metaLines.push(`- **匯報給**: ${agent.reportsTo}`);
    }

    metaLines.push(`</important>`);
    sections.push(metaLines.join('\n'));

    // 8. Delegation instruction for L1 agents
    if (agent.level === 'L1' && agent.manages.length > 0) {
      sections.push(this.getDelegationInstructions(agent.manages));
    }

    return sections.join('\n');
  }

  /**
   * Preview the assembled prompt (for UI display)
   */
  preview(agentId: string, projectId?: string | null): string {
    try {
      return this.assemble(agentId, projectId);
    } catch {
      return `[無法組裝 Prompt: Agent "${agentId}" 不存在]`;
    }
  }

  private getDelegationInstructions(managedAgents: string[]): string {
    return [
      '\n---\n',
      '## 委派指令格式',
      '',
      '當你需要委派任務給下屬 Agent 時，請使用以下格式：',
      '',
      '```ai-studio:delegation',
      JSON.stringify(
        {
          targetAgent: '<agent-id>',
          task: '<具體任務描述>',
          priority: 'medium',
          context: '<背景資訊>',
        },
        null,
        2,
      ),
      '```',
      '',
      `可委派的 Agent: ${managedAgents.join(', ')}`,
      '',
      '你也可以記錄工作記憶：',
      '',
      '```ai-studio:memory',
      '你想記住的內容',
      '```',
    ].join('\n');
  }

  private extractKnowledgeRefs(content: string): string[] {
    const refs: string[] = [];
    const pattern = /(?:company|project):\/\/[\w/.*-]+/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      refs.push(match[0]);
    }
    return refs;
  }

  private resolveKnowledgeRefs(refs: string[], projectId?: string | null): string {
    const knowledgeDir = getKnowledgeDir();
    const resolved: string[] = [];

    for (const ref of refs) {
      try {
        let filePath: string;

        if (ref.startsWith('company://')) {
          const relPath = ref.replace('company://', '');
          filePath = join(knowledgeDir, 'company', relPath);
        } else if (ref.startsWith('project://')) {
          if (!projectId) continue;
          const relPath = ref.replace('project://', '');
          filePath = join(knowledgeDir, 'projects', projectId, relPath);
        } else {
          continue;
        }

        // Handle glob patterns by just noting the reference
        if (filePath.includes('*')) {
          resolved.push(`> 參考: ${ref}`);
          continue;
        }

        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          resolved.push(`### ${ref}\n\n${content}`);
        }
      } catch (err) {
        logger.warn(`Failed to resolve knowledge ref: ${ref}`, err);
      }
    }

    return resolved.join('\n\n');
  }
}

export const promptAssembler = new PromptAssembler();
