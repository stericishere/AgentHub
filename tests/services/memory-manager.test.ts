import { memoryManager } from '../../electron/services/memory-manager';

vi.mock('../../electron/services/database', () => ({
  database: {
    run: vi.fn(),
    prepare: vi.fn(() => []),
    get: vi.fn(),
  },
}));

vi.mock('../../electron/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { database } from '../../electron/services/database';

const mockDb = database as { run: ReturnType<typeof vi.fn>; prepare: ReturnType<typeof vi.fn> };

const makeMemoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  agent_id: 'tech-lead',
  project_id: 'proj-1',
  block_type: 'note',
  content: 'Remember to check API rate limits',
  source_session_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('MemoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('inserts a memory block and returns the saved record', () => {
      mockDb.prepare.mockReturnValueOnce([makeMemoryRow()]);

      const result = memoryManager.save('tech-lead', 'Remember to check API rate limits', 'note', 'proj-1');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memory_blocks'),
        expect.arrayContaining(['tech-lead', 'proj-1', 'note', 'Remember to check API rate limits']),
      );
      expect(result.agentId).toBe('tech-lead');
      expect(result.content).toBe('Remember to check API rate limits');
      expect(result.blockType).toBe('note');
    });

    it('uses default block type of note', () => {
      mockDb.prepare.mockReturnValueOnce([makeMemoryRow()]);

      memoryManager.save('tech-lead', 'Some content');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['note']),
      );
    });

    it('stores null for optional projectId and sourceSessionId when omitted', () => {
      mockDb.prepare.mockReturnValueOnce([makeMemoryRow({ project_id: null, source_session_id: null })]);

      const result = memoryManager.save('tech-lead', 'Global note');

      expect(result.projectId).toBeNull();
      expect(result.sourceSessionId).toBeNull();
    });

    it('saves memory with source session reference', () => {
      mockDb.prepare.mockReturnValueOnce([
        makeMemoryRow({ source_session_id: 'session-99' }),
      ]);

      memoryManager.save('backend-engineer', 'Discovered a bug', 'note', 'proj-1', 'session-99');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['session-99']),
      );
    });
  });

  describe('getForAgent', () => {
    it('returns empty array when agent has no memory blocks', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      const result = memoryManager.getForAgent('new-agent');

      expect(result).toEqual([]);
    });

    it('returns memory blocks for an agent', () => {
      mockDb.prepare.mockReturnValueOnce([makeMemoryRow(), makeMemoryRow({ id: 2, content: 'Another note' })]);

      const result = memoryManager.getForAgent('tech-lead', 'proj-1');

      expect(result).toHaveLength(2);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('agent_id = ?'),
        expect.arrayContaining(['tech-lead']),
      );
    });

    it('includes project-specific and global blocks when projectId is provided', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      memoryManager.getForAgent('tech-lead', 'proj-1');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('project_id = ? OR project_id IS NULL'),
        expect.arrayContaining(['proj-1']),
      );
    });

    it('respects custom limit', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      memoryManager.getForAgent('tech-lead', null, 5);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        expect.arrayContaining([5]),
      );
    });
  });

  describe('getForPrompt', () => {
    it('returns empty string when no memory blocks exist', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      const result = memoryManager.getForPrompt('tech-lead');

      expect(result).toBe('');
    });

    it('formats memory blocks as a prompt section', () => {
      mockDb.prepare.mockReturnValueOnce([
        makeMemoryRow({ content: 'Sprint deadline is Friday', block_type: 'note' }),
        makeMemoryRow({ id: 2, content: 'User prefers dark mode', block_type: 'preference' }),
      ]);

      const result = memoryManager.getForPrompt('tech-lead', 'proj-1');

      expect(result).toContain('## 工作記憶');
      expect(result).toContain('[note] Sprint deadline is Friday');
      expect(result).toContain('[preference] User prefers dark mode');
    });
  });

  describe('extractFromSession', () => {
    it('extracts plain text memory blocks from session output', () => {
      mockDb.prepare.mockReturnValue([makeMemoryRow()]);

      const output = `
Some output text.

\`\`\`ai-studio:memory
Remember to update the changelog
\`\`\`

More output.
      `;

      const results = memoryManager.extractFromSession(output, 'tech-lead', 'proj-1');

      expect(results).toHaveLength(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memory_blocks'),
        expect.arrayContaining(['Remember to update the changelog', 'note']),
      );
    });

    it('extracts JSON memory blocks with custom type', () => {
      mockDb.prepare.mockReturnValue([makeMemoryRow({ block_type: 'decision' })]);

      const output = `
\`\`\`ai-studio:memory
{"type": "decision", "content": "Use PostgreSQL for production"}
\`\`\`
      `;

      const results = memoryManager.extractFromSession(output, 'tech-lead');

      expect(results).toHaveLength(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['decision', 'Use PostgreSQL for production']),
      );
    });

    it('returns empty array when no memory blocks are found', () => {
      const output = 'Normal output with no memory markers.';
      const results = memoryManager.extractFromSession(output, 'tech-lead');

      expect(results).toEqual([]);
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('deleteBlock', () => {
    it('deletes a memory block by id', () => {
      memoryManager.deleteBlock(42);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM memory_blocks WHERE id = ?',
        [42],
      );
    });
  });
});
