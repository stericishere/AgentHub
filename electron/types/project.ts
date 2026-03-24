export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  workDir: string | null;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface BudgetStatus {
  dailyTokensUsed: number;
  dailyTokenLimit: number;
  dailyPct: number;
  totalTokensUsed: number;
  totalTokenLimit: number;
  totalPct: number;
  alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded';
}
