import { auditLogger } from '../../electron/services/audit-logger';

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

const makeAuditRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'audit-1',
  event_type: 'task.created',
  actor: 'tech-lead',
  target: 'task-42',
  details: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('AuditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('inserts an audit entry with all fields', () => {
      auditLogger.log('task.created', 'tech-lead', 'task-42', { title: 'New feature' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'task.created',
          'tech-lead',
          'task-42',
          JSON.stringify({ title: 'New feature' }),
        ]),
      );
    });

    it('inserts an audit entry without target or details', () => {
      auditLogger.log('session.started', 'system');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['session.started', 'system', null, null]),
      );
    });

    it('generates a unique id for each log entry', () => {
      auditLogger.log('event.a', 'actor-1');
      auditLogger.log('event.b', 'actor-1');

      const firstCall = mockDb.run.mock.calls[0][1] as unknown[];
      const secondCall = mockDb.run.mock.calls[1][1] as unknown[];

      expect(firstCall[0]).not.toBe(secondCall[0]);
    });
  });

  describe('query', () => {
    it('returns empty array when no logs match', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      const result = auditLogger.query();

      expect(result).toEqual([]);
    });

    it('maps database rows to AuditEntry objects', () => {
      mockDb.prepare.mockReturnValueOnce([
        makeAuditRow({ details: '{"taskId":"t-1"}' }),
      ]);

      const result = auditLogger.query();

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe('task.created');
      expect(result[0].actor).toBe('tech-lead');
      expect(result[0].details).toEqual({ taskId: 't-1' });
    });

    it('filters by eventType', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      auditLogger.query({ eventType: 'gate.approved' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('event_type = ?'),
        expect.arrayContaining(['gate.approved']),
      );
    });

    it('filters by actor', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      auditLogger.query({ actor: 'boss' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('actor = ?'),
        expect.arrayContaining(['boss']),
      );
    });

    it('applies limit and offset for pagination', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      auditLogger.query({ limit: 25, offset: 50 });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([25, 50]),
      );
    });

    it('uses default limit of 100 when not specified', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      auditLogger.query({});

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([100, 0]),
      );
    });
  });
});
