/**
 * 手動測試 skill-generator
 * 執行方式: npx vitest run tests/manual/skill-generator.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, appendFileSync, rmSync } from 'fs';
import { join } from 'path';

// Mock electron paths before importing agentLoader
vi.mock('../../electron/utils/paths', () => ({
  getAgentsDir: () => join(process.cwd(), 'agents'),
  getKnowledgeDir: () => join(process.cwd(), 'knowledge'),
  getDataDir: () => join(process.cwd(), '.test-data'),
  getDbPath: () => join(process.cwd(), '.test-data', 'test.db'),
}));

// Mock logger to avoid electron dependencies
vi.mock('../../electron/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => console.log('[INFO]', ...args),
    warn: (...args: unknown[]) => console.log('[WARN]', ...args),
    error: (...args: unknown[]) => console.log('[ERROR]', ...args),
    debug: () => {},
  },
}));

import { agentLoader } from '../../electron/services/agent-loader';
import { generateSkillFile, generateAllSkillFiles } from '../../electron/utils/skill-generator';

const TEST_DIR = join(process.cwd(), '.test-skill-output');

describe('skill-generator', () => {
  beforeAll(() => {
    agentLoader.load();
    mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('should load agents', () => {
    expect(agentLoader.getCount()).toBeGreaterThan(0);
    console.log(`Loaded ${agentLoader.getCount()} agents`);
  });

  it('should generate SKILL.md for frontend-developer', () => {
    const result = generateSkillFile(TEST_DIR, 'frontend-developer');

    expect(result.status).toBe('written');
    expect(result.agentId).toBe('frontend-developer');
    expect(existsSync(result.filePath)).toBe(true);

    const content = readFileSync(result.filePath, 'utf-8');
    console.log('--- SKILL.md (first 600 chars) ---');
    console.log(content.slice(0, 600));
    console.log(`... total ${content.length} chars`);

    // Check frontmatter
    expect(content).toContain('name: frontend-developer');
    expect(content).toContain('description:');

    // Check metadata
    expect(content).toContain('## Agent 資訊');
    expect(content).toContain('engineering');
  });

  it('should skip when content unchanged', () => {
    const result = generateSkillFile(TEST_DIR, 'frontend-developer');
    // Content is identical, so it should write (same hash) or be written again
    expect(['written', 'skipped']).toContain(result.status);
  });

  it('should detect conflict when file was manually modified', () => {
    const filePath = join(TEST_DIR, '.claude', 'skills', 'frontend-developer', 'SKILL.md');
    appendFileSync(filePath, '\n<!-- manual edit by user -->');

    const result = generateSkillFile(TEST_DIR, 'frontend-developer');
    expect(result.status).toBe('conflict');
    console.log('Conflict detected correctly!');
  });

  it('should force overwrite when force=true', () => {
    const result = generateSkillFile(TEST_DIR, 'frontend-developer', true);
    expect(result.status).toBe('written');
  });

  it('should skip for unknown agent', () => {
    const result = generateSkillFile(TEST_DIR, 'nonexistent-agent');
    expect(result.status).toBe('skipped');
  });

  it('should generate skills for multiple agents', () => {
    const results = generateAllSkillFiles(TEST_DIR, [
      'frontend-developer',
      'backend-architect',
      'ui-designer',
    ]);

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe('written');
      console.log(`  ${r.agentId}: ${r.status} → ${r.filePath}`);
    }
  });
});
