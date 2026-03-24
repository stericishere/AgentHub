export interface CostOverview {
  todayTokens: number;
  thisWeekTokens: number;
  thisMonthTokens: number;
  avgTokensPerSession: number;
  todayUsd: number;
  thisWeekUsd: number;
  thisMonthUsd: number;
  avgUsdPerSession: number;
}

export interface CostBreakdownItem {
  label: string;
  tokens: number;
  costUsd: number;
}

export type BreakdownType = 'byAgent' | 'byModel' | 'daily';

export interface CostBreakdown {
  type: BreakdownType;
  items: CostBreakdownItem[];
}

export interface SetBudgetParams {
  projectId: string;
  dailyTokenLimit?: number;
  totalTokenLimit?: number;
  alertThreshold?: number;
}

export interface BudgetInfo {
  projectId: string;
  dailyTokenLimit: number;
  totalTokenLimit: number;
  alertThreshold: number;
  dailyTokensUsed: number;
  totalTokensUsed: number;
  dailyPct: number;
  totalPct: number;
  alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded';
}
