import { agentLoader } from './agent-loader';
import { logger } from '../utils/logger';
import type { DelegationCommand } from '../types';

class DelegationParser {
  /**
   * Parse delegation commands from session output.
   * Looks for ```ai-studio:delegation fenced blocks containing JSON.
   */
  parse(output: string): DelegationCommand[] {
    const results: DelegationCommand[] = [];
    const pattern = /```ai-studio:delegation\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(output)) !== null) {
      const raw = match[1].trim();
      try {
        const parsed = JSON.parse(raw);
        const cmd = this.validate(parsed);
        if (cmd) {
          results.push(cmd);
        }
      } catch (err) {
        logger.warn(`Failed to parse delegation command: ${raw}`, err);
      }
    }

    if (results.length > 0) {
      logger.info(`Parsed ${results.length} delegation commands`);
    }

    return results;
  }

  /**
   * Validate a parsed delegation command.
   */
  private validate(parsed: any): DelegationCommand | null {
    if (!parsed.targetAgent || typeof parsed.targetAgent !== 'string') {
      logger.warn('Delegation missing targetAgent');
      return null;
    }

    if (!parsed.task || typeof parsed.task !== 'string') {
      logger.warn('Delegation missing task');
      return null;
    }

    // Check target agent exists
    const agent = agentLoader.getById(parsed.targetAgent);
    if (!agent) {
      logger.warn(`Delegation target agent not found: ${parsed.targetAgent}`);
      return null;
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    const priority = validPriorities.includes(parsed.priority) ? parsed.priority : 'medium';

    return {
      targetAgent: parsed.targetAgent,
      task: parsed.task,
      priority,
      context: parsed.context || undefined,
    };
  }
}

export const delegationParser = new DelegationParser();
