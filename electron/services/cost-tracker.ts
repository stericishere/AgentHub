import { database } from './database';
import { logger } from '../utils/logger';
import type {
  CostOverview,
  CostBreakdown,
  BreakdownType,
  SetBudgetParams,
  BudgetInfo,
} from '../types';

class CostTracker {
  getOverview(): CostOverview {
    const todayRows = database.prepare(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
              COALESCE(SUM(cost_usd), 0) as total_usd
       FROM claude_sessions WHERE started_at >= date('now')`,
    );
    const weekRows = database.prepare(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
              COALESCE(SUM(cost_usd), 0) as total_usd
       FROM claude_sessions WHERE started_at >= date('now', '-7 days')`,
    );
    const monthRows = database.prepare(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
              COALESCE(SUM(cost_usd), 0) as total_usd
       FROM claude_sessions WHERE started_at >= date('now', 'start of month')`,
    );
    const avgRows = database.prepare(
      `SELECT COALESCE(AVG(input_tokens + output_tokens), 0) as avg_tokens,
              COALESCE(AVG(cost_usd), 0) as avg_usd
       FROM claude_sessions WHERE cost_usd > 0 OR input_tokens > 0`,
    );

    return {
      todayTokens: todayRows[0]?.total_tokens || 0,
      thisWeekTokens: weekRows[0]?.total_tokens || 0,
      thisMonthTokens: monthRows[0]?.total_tokens || 0,
      avgTokensPerSession: Math.round(avgRows[0]?.avg_tokens || 0),
      todayUsd: todayRows[0]?.total_usd || 0,
      thisWeekUsd: weekRows[0]?.total_usd || 0,
      thisMonthUsd: monthRows[0]?.total_usd || 0,
      avgUsdPerSession: avgRows[0]?.avg_usd || 0,
    };
  }

  getBreakdown(type: BreakdownType): CostBreakdown {
    let rows: any[];

    switch (type) {
      case 'byAgent':
        rows = database.prepare(
          `SELECT agent_id as label,
                  COALESCE(SUM(input_tokens + output_tokens), 0) as tokens,
                  COALESCE(SUM(cost_usd), 0) as cost_usd
           FROM claude_sessions
           WHERE cost_usd > 0 OR input_tokens > 0
           GROUP BY agent_id
           ORDER BY tokens DESC
           LIMIT 15`,
        );
        break;
      case 'byModel':
        rows = database.prepare(
          `SELECT model as label,
                  COALESCE(SUM(input_tokens + output_tokens), 0) as tokens,
                  COALESCE(SUM(cost_usd), 0) as cost_usd
           FROM claude_sessions
           WHERE cost_usd > 0 OR input_tokens > 0
           GROUP BY model
           ORDER BY tokens DESC`,
        );
        break;
      case 'daily':
        rows = database.prepare(
          `SELECT date(started_at) as label,
                  COALESCE(SUM(input_tokens + output_tokens), 0) as tokens,
                  COALESCE(SUM(cost_usd), 0) as cost_usd
           FROM claude_sessions
           WHERE started_at >= date('now', '-14 days')
           GROUP BY date(started_at)
           ORDER BY label ASC`,
        );
        break;
      default:
        rows = [];
    }

    return {
      type,
      items: rows.map((r) => ({
        label: r.label || 'unknown',
        tokens: r.tokens || 0,
        costUsd: r.cost_usd || 0,
      })),
    };
  }

  getBudget(projectId: string): BudgetInfo {
    const budgetRows = database.prepare(
      `SELECT * FROM project_budgets WHERE project_id = ?`,
      [projectId],
    );

    let dailyTokenLimit = 500000;
    let totalTokenLimit = 10000000;
    let alertThreshold = 0.8;

    if (budgetRows.length > 0) {
      dailyTokenLimit = budgetRows[0].daily_token_limit || 500000;
      totalTokenLimit = budgetRows[0].total_token_limit || 10000000;
      alertThreshold = budgetRows[0].alert_threshold || 0.8;
    }

    const dailyUsedRows = database.prepare(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total FROM claude_sessions
       WHERE project_id = ? AND started_at >= date('now')`,
      [projectId],
    );
    const totalUsedRows = database.prepare(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total FROM claude_sessions
       WHERE project_id = ?`,
      [projectId],
    );

    const dailyTokensUsed = dailyUsedRows[0]?.total || 0;
    const totalTokensUsed = totalUsedRows[0]?.total || 0;
    const dailyPct = dailyTokenLimit > 0 ? (dailyTokensUsed / dailyTokenLimit) * 100 : 0;
    const totalPct = totalTokenLimit > 0 ? (totalTokensUsed / totalTokenLimit) * 100 : 0;

    const maxPct = Math.max(dailyPct, totalPct) / 100;
    let alertLevel: BudgetInfo['alertLevel'] = 'normal';
    if (maxPct >= 1) alertLevel = 'exceeded';
    else if (maxPct >= 0.9) alertLevel = 'critical';
    else if (maxPct >= alertThreshold) alertLevel = 'warning';

    return {
      projectId,
      dailyTokenLimit,
      totalTokenLimit,
      alertThreshold,
      dailyTokensUsed,
      totalTokensUsed,
      dailyPct,
      totalPct,
      alertLevel,
    };
  }

  setBudget(params: SetBudgetParams): BudgetInfo {
    const existing = database.prepare(
      `SELECT * FROM project_budgets WHERE project_id = ?`,
      [params.projectId],
    );

    if (existing.length > 0) {
      const updates: string[] = [];
      const values: unknown[] = [];
      if (params.dailyTokenLimit !== undefined) {
        updates.push('daily_token_limit = ?');
        values.push(params.dailyTokenLimit);
      }
      if (params.totalTokenLimit !== undefined) {
        updates.push('total_token_limit = ?');
        values.push(params.totalTokenLimit);
      }
      if (params.alertThreshold !== undefined) {
        updates.push('alert_threshold = ?');
        values.push(params.alertThreshold);
      }
      if (updates.length > 0) {
        values.push(params.projectId);
        database.run(
          `UPDATE project_budgets SET ${updates.join(', ')} WHERE project_id = ?`,
          values,
        );
      }
    } else {
      database.run(
        `INSERT INTO project_budgets (project_id, daily_token_limit, total_token_limit, alert_threshold)
         VALUES (?, ?, ?, ?)`,
        [
          params.projectId,
          params.dailyTokenLimit ?? 500000,
          params.totalTokenLimit ?? 10000000,
          params.alertThreshold ?? 0.8,
        ],
      );
    }

    logger.info(`Budget updated for project ${params.projectId}`);
    return this.getBudget(params.projectId);
  }
}

export const costTracker = new CostTracker();
