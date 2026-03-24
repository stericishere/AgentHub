import { delegationParser } from '../../electron/services/delegation-parser';

vi.mock('../../electron/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../electron/services/agent-loader', () => ({
  agentLoader: {
    getById: vi.fn((id: string) => {
      const knownAgents: Record<string, { id: string; level: string }> = {
        'frontend-engineer': { id: 'frontend-engineer', level: 'L2' },
        'backend-engineer': { id: 'backend-engineer', level: 'L2' },
        'qa-engineer': { id: 'qa-engineer', level: 'L2' },
        'tech-lead': { id: 'tech-lead', level: 'L1' },
        'devops-engineer': { id: 'devops-engineer', level: 'L2' },
      };
      return knownAgents[id] || null;
    }),
  },
}));

const makeDelegationBlock = (json: object) =>
  `\`\`\`ai-studio:delegation\n${JSON.stringify(json)}\n\`\`\``;

describe('DelegationParser', () => {
  describe('parse', () => {
    it('returns empty array for output with no delegation blocks', () => {
      const output = 'I have completed the analysis. No tasks to delegate.';
      const result = delegationParser.parse(output);
      expect(result).toEqual([]);
    });

    it('parses a single valid delegation command', () => {
      const output = makeDelegationBlock({
        targetAgent: 'frontend-engineer',
        task: 'Build the login page',
        priority: 'high',
        context: 'Use Tailwind CSS',
      });

      const result = delegationParser.parse(output);

      expect(result).toHaveLength(1);
      expect(result[0].targetAgent).toBe('frontend-engineer');
      expect(result[0].task).toBe('Build the login page');
      expect(result[0].priority).toBe('high');
      expect(result[0].context).toBe('Use Tailwind CSS');
    });

    it('parses multiple delegation commands from single output', () => {
      const output = [
        makeDelegationBlock({ targetAgent: 'frontend-engineer', task: 'Build UI' }),
        makeDelegationBlock({ targetAgent: 'backend-engineer', task: 'Build API' }),
        makeDelegationBlock({ targetAgent: 'qa-engineer', task: 'Write tests' }),
      ].join('\n\n');

      const result = delegationParser.parse(output);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.targetAgent)).toEqual([
        'frontend-engineer',
        'backend-engineer',
        'qa-engineer',
      ]);
    });

    it('defaults priority to medium when not specified', () => {
      const output = makeDelegationBlock({
        targetAgent: 'backend-engineer',
        task: 'Set up database migrations',
      });

      const result = delegationParser.parse(output);

      expect(result[0].priority).toBe('medium');
    });

    it('defaults priority to medium for unknown priority values', () => {
      const output = makeDelegationBlock({
        targetAgent: 'backend-engineer',
        task: 'Fix the bug',
        priority: 'super-urgent',
      });

      const result = delegationParser.parse(output);

      expect(result[0].priority).toBe('medium');
    });

    it('accepts all valid priority levels', () => {
      const priorities = ['low', 'medium', 'high', 'critical'] as const;

      for (const priority of priorities) {
        const output = makeDelegationBlock({
          targetAgent: 'frontend-engineer',
          task: 'A task',
          priority,
        });

        const result = delegationParser.parse(output);
        expect(result[0].priority).toBe(priority);
      }
    });

    it('skips blocks with missing targetAgent', () => {
      const output = makeDelegationBlock({
        task: 'Build something',
        priority: 'high',
      });

      const result = delegationParser.parse(output);

      expect(result).toEqual([]);
    });

    it('skips blocks with missing task', () => {
      const output = makeDelegationBlock({
        targetAgent: 'frontend-engineer',
        priority: 'medium',
      });

      const result = delegationParser.parse(output);

      expect(result).toEqual([]);
    });

    it('skips blocks targeting an unknown agent', () => {
      const output = makeDelegationBlock({
        targetAgent: 'non-existent-agent',
        task: 'Do something',
      });

      const result = delegationParser.parse(output);

      expect(result).toEqual([]);
    });

    it('skips blocks with invalid JSON', () => {
      const output = '```ai-studio:delegation\n{ invalid json here }\n```';

      const result = delegationParser.parse(output);

      expect(result).toEqual([]);
    });

    it('context is optional and undefined when not provided', () => {
      const output = makeDelegationBlock({
        targetAgent: 'devops-engineer',
        task: 'Deploy to staging',
      });

      const result = delegationParser.parse(output);

      expect(result[0].context).toBeUndefined();
    });

    it('handles mixed valid and invalid blocks in same output', () => {
      const output = [
        makeDelegationBlock({ targetAgent: 'frontend-engineer', task: 'Valid task' }),
        '```ai-studio:delegation\n{ bad json\n```',
        makeDelegationBlock({ targetAgent: 'non-existent', task: 'Unknown agent' }),
        makeDelegationBlock({ targetAgent: 'backend-engineer', task: 'Another valid task' }),
      ].join('\n\n');

      const result = delegationParser.parse(output);

      expect(result).toHaveLength(2);
      expect(result[0].targetAgent).toBe('frontend-engineer');
      expect(result[1].targetAgent).toBe('backend-engineer');
    });
  });
});
