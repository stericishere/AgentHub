import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { agentLoader } from '../services/agent-loader';
import { logger } from './logger';

export interface SkillGenerateResult {
  status: 'written' | 'skipped' | 'conflict';
  filePath: string;
  agentId: string;
}

/**
 * Convert an Agent definition into a Claude Code SKILL.md format.
 */
function agentToSkillContent(agentId: string): string {
  const agent = agentLoader.getById(agentId);
  if (!agent) return '';

  const systemPrompt = agentLoader.getSystemPrompt(agentId);
  const description = agent.description || `${agent.name} Agent`;

  const lines: string[] = [
    '---',
    `name: ${agentId}`,
    `description: >`,
    `  ${description}`,
    '---',
    '',
  ];

  // Extract and reformat system prompt sections
  if (systemPrompt) {
    // Split system prompt into logical sections
    const sections = systemPrompt.split(/^##\s+/m).filter(Boolean);

    for (const section of sections) {
      const firstLine = section.split('\n')[0].trim();
      const body = section.slice(firstLine.length).trim();

      if (firstLine) {
        lines.push(`## ${firstLine}`);
        lines.push('');
        if (body) {
          lines.push(body);
          lines.push('');
        }
      }
    }
  }

  // Add metadata footer
  lines.push('## Agent 資訊');
  lines.push('');
  lines.push(`- **部門**: ${agent.department}`);
  lines.push(`- **層級**: ${agent.level}`);
  if (agent.manages && agent.manages.length > 0) {
    lines.push(`- **管轄**: ${agent.manages.join(', ')}`);
  }
  if (agent.reportsTo) {
    lines.push(`- **上級**: ${agent.reportsTo}`);
  }
  lines.push('');

  // Add reference to .knowledge/ files
  lines.push('## 參考文件');
  lines.push('');
  lines.push('需要時讀取以下文件：');
  lines.push('- `.knowledge/` — 專案技術文件');
  lines.push('- `CLAUDE.md` — 專案索引與規範');
  lines.push('');

  return lines.join('\n');
}

/**
 * Check if an existing SKILL.md was manually modified (different from generated content).
 */
function wasManuallyModified(filePath: string, newContent: string): boolean {
  if (!existsSync(filePath)) return false;

  const existing = readFileSync(filePath, 'utf-8');
  const existingHash = createHash('md5').update(existing.trim()).digest('hex');
  const newHash = createHash('md5').update(newContent.trim()).digest('hex');

  return existingHash !== newHash;
}

/**
 * Generate SKILL.md for an agent in the project's .claude/skills/ directory.
 */
export function generateSkillFile(
  workDir: string,
  agentId: string,
  force = false,
): SkillGenerateResult {
  const skillsDir = join(workDir, '.claude', 'skills', agentId);
  const filePath = join(skillsDir, 'SKILL.md');

  const content = agentToSkillContent(agentId);
  if (!content) {
    return { status: 'skipped', filePath, agentId };
  }

  // Check for manual modifications
  if (existsSync(filePath) && !force) {
    if (wasManuallyModified(filePath, content)) {
      logger.info(`Skill file conflict: ${filePath} was manually modified`);
      return { status: 'conflict', filePath, agentId };
    }
  }

  // Write the file
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  writeFileSync(filePath, content, 'utf-8');
  logger.info(`Skill file generated: ${filePath}`);
  return { status: 'written', filePath, agentId };
}

/**
 * Generate SKILL.md files for all agents used in a project.
 * Returns results for each agent.
 */
export function generateAllSkillFiles(
  workDir: string,
  agentIds?: string[],
): SkillGenerateResult[] {
  const ids = agentIds || agentLoader.getAll().map((a) => a.id);
  return ids.map((id) => generateSkillFile(workDir, id));
}
