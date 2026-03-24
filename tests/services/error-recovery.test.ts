import { errorRecovery } from '../../electron/services/error-recovery';

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

const makeFailureRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'failure-1',
  session_id: 'session-42',
  agent_id: 'backend-engineer',
  error_type: 'TIMEOUT',
  error_message: 'Session timed out after 30s',
  retry_count: 0,
  max_retries: 3,
  status: 'open',
  resolution: null,
  created_at: '2026-01-01T00:00:00Z',
  resolved_at: null,
  ...overrides,
});

describe('ErrorRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordFailure', () => {
    it('inserts a failure record with required fields', () => {
      const result = errorRecovery.recordFailure({
        sessionId: 'session-42',
        agentId: 'backend-engineer',
        errorType: 'TIMEOUT',
        errorMessage: 'Session timed out after 30s',
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_failures'),
        expect.arrayContaining([
          'session-42',
          'backend-engineer',
          'TIMEOUT',
          'Session timed out after 30s',
        ]),
      );
      expect(result.status).toBe('open');
      expect(result.retryCount).toBe(0);
      expect(result.maxRetries).toBe(3);
    });

    it('uses default maxRetries of 3 when not specified', () => {
      const result = errorRecovery.recordFailure({
        errorType: 'CRASH',
        errorMessage: 'Process crashed',
      });

      expect(result.maxRetries).toBe(3);
    });

    it('respects custom maxRetries', () => {
      const result = errorRecovery.recordFailure({
        errorType: 'RATE_LIMIT',
        errorMessage: 'API rate limited',
        maxRetries: 5,
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5]),
      );
      expect(result.maxRetries).toBe(5);
    });

    it('records failure with null sessionId and agentId when omitted', () => {
      const result = errorRecovery.recordFailure({
        errorType: 'UNKNOWN',
        errorMessage: 'Unknown error',
      });

      expect(result.sessionId).toBeNull();
      expect(result.agentId).toBeNull();
    });
  });

  describe('getFailures', () => {
    it('returns all failures without status filter', () => {
      mockDb.prepare.mockReturnValueOnce([makeFailureRow(), makeFailureRow({ id: 'failure-2' })]);

      const result = errorRecovery.getFailures();

      expect(result).toHaveLength(2);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE'),
        [],
      );
    });

    it('filters failures by status', () => {
      mockDb.prepare.mockReturnValueOnce([makeFailureRow()]);

      const result = errorRecovery.getFailures('open');

      expect(result).toHaveLength(1);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = ?'),
        ['open'],
      );
    });

    it('maps rows to FailureRecord objects correctly', () => {
      mockDb.prepare.mockReturnValueOnce([makeFailureRow()]);

      const result = errorRecovery.getFailures();

      expect(result[0].errorType).toBe('TIMEOUT');
      expect(result[0].errorMessage).toBe('Session timed out after 30s');
      expect(result[0].sessionId).toBe('session-42');
    });
  });

  describe('resolveManually', () => {
    it('updates failure to resolved status', () => {
      mockDb.prepare.mockReturnValueOnce([
        makeFailureRow({ status: 'resolved', resolution: 'Restarted session manually' }),
      ]);

      const result = errorRecovery.resolveManually('failure-1', 'Restarted session manually');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'resolved'"),
        expect.arrayContaining(['Restarted session manually', 'failure-1']),
      );
      expect(result.status).toBe('resolved');
    });

    it('throws if failure record is not found after update', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      expect(() =>
        errorRecovery.resolveManually('nonexistent', 'some resolution'),
      ).toThrow('Failure not found: nonexistent');
    });
  });
});
