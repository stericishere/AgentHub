import { costTracker } from '../../electron/services/cost-tracker';

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

describe('CostTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOverview', () => {
    it('returns zero totals when no sessions exist', () => {
      mockDb.prepare.mockReturnValue([]);

      const overview = costTracker.getOverview();

      expect(overview.todayTokens).toBe(0);
      expect(overview.thisWeekTokens).toBe(0);
      expect(overview.thisMonthTokens).toBe(0);
      expect(overview.avgTokensPerSession).toBe(0);
      expect(overview.todayUsd).toBe(0);
      expect(overview.thisWeekUsd).toBe(0);
      expect(overview.thisMonthUsd).toBe(0);
      expect(overview.avgUsdPerSession).toBe(0);
    });

    it('returns aggregated costs from database rows', () => {
      mockDb.prepare
        .mockReturnValueOnce([{ total_tokens: 15000, total_usd: 1.5 }])
        .mockReturnValueOnce([{ total_tokens: 82500, total_usd: 8.25 }])
        .mockReturnValueOnce([{ total_tokens: 220000, total_usd: 22.0 }])
        .mockReturnValueOnce([{ avg_tokens: 7500, avg_usd: 0.75 }]);

      const overview = costTracker.getOverview();

      expect(overview.todayTokens).toBe(15000);
      expect(overview.thisWeekTokens).toBe(82500);
      expect(overview.thisMonthTokens).toBe(220000);
      expect(overview.avgTokensPerSession).toBe(7500);
      expect(overview.todayUsd).toBe(1.5);
      expect(overview.thisWeekUsd).toBe(8.25);
      expect(overview.thisMonthUsd).toBe(22.0);
      expect(overview.avgUsdPerSession).toBe(0.75);
    });

    it('queries four separate time windows', () => {
      mockDb.prepare.mockReturnValue([]);
      costTracker.getOverview();

      expect(mockDb.prepare).toHaveBeenCalledTimes(4);
    });
  });

  describe('getBreakdown', () => {
    it('returns byAgent breakdown with items', () => {
      mockDb.prepare.mockReturnValueOnce([
        { label: 'frontend-engineer', tokens: 32000, cost_usd: 3.2 },
        { label: 'backend-engineer', tokens: 18000, cost_usd: 1.8 },
      ]);

      const breakdown = costTracker.getBreakdown('byAgent');

      expect(breakdown.type).toBe('byAgent');
      expect(breakdown.items).toHaveLength(2);
      expect(breakdown.items[0].label).toBe('frontend-engineer');
      expect(breakdown.items[0].tokens).toBe(32000);
      expect(breakdown.items[0].costUsd).toBe(3.2);
    });

    it('returns byModel breakdown', () => {
      mockDb.prepare.mockReturnValueOnce([
        { label: 'claude-opus-4-5', tokens: 105000, cost_usd: 10.5 },
        { label: 'claude-sonnet-4-5', tokens: 42000, cost_usd: 4.2 },
      ]);

      const breakdown = costTracker.getBreakdown('byModel');

      expect(breakdown.type).toBe('byModel');
      expect(breakdown.items[0].label).toBe('claude-opus-4-5');
    });

    it('returns daily breakdown for last 14 days', () => {
      mockDb.prepare.mockReturnValueOnce([
        { label: '2026-02-28', tokens: 21000, cost_usd: 2.1 },
        { label: '2026-03-01', tokens: 35000, cost_usd: 3.5 },
      ]);

      const breakdown = costTracker.getBreakdown('daily');

      expect(breakdown.type).toBe('daily');
      expect(breakdown.items).toHaveLength(2);
    });

    it('returns empty items for unknown breakdown type', () => {
      const breakdown = costTracker.getBreakdown('unknown' as any);

      expect(breakdown.items).toEqual([]);
    });
  });

  describe('getBudget', () => {
    it('returns default budget limits when no budget row exists', () => {
      mockDb.prepare.mockReturnValue([]);

      const budget = costTracker.getBudget('proj-1');

      expect(budget.dailyTokenLimit).toBe(500000);
      expect(budget.totalTokenLimit).toBe(10000000);
      expect(budget.alertThreshold).toBe(0.8);
      expect(budget.alertLevel).toBe('normal');
    });

    it('returns exceeded alert level when usage surpasses limit', () => {
      mockDb.prepare
        .mockReturnValueOnce([{ daily_token_limit: 500000, total_token_limit: 10000000, alert_threshold: 0.8 }])
        .mockReturnValueOnce([{ total: 600000 }])   // dailyTokensUsed > dailyTokenLimit
        .mockReturnValueOnce([{ total: 1000000 }]);

      const budget = costTracker.getBudget('proj-1');

      expect(budget.alertLevel).toBe('exceeded');
    });
  });

  describe('setBudget', () => {
    it('inserts a new budget row when none exists', () => {
      mockDb.prepare.mockReturnValue([]);

      costTracker.setBudget({ projectId: 'proj-1', dailyTokenLimit: 1000000, totalTokenLimit: 20000000 });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO project_budgets'),
        expect.arrayContaining(['proj-1', 1000000, 20000000]),
      );
    });

    it('updates existing budget when row already exists', () => {
      mockDb.prepare
        .mockReturnValueOnce([{ daily_token_limit: 500000, total_token_limit: 10000000, alert_threshold: 0.8 }])
        .mockReturnValue([]);

      costTracker.setBudget({ projectId: 'proj-1', dailyTokenLimit: 2000000 });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE project_budgets'),
        expect.arrayContaining([2000000, 'proj-1']),
      );
    });
  });
});
