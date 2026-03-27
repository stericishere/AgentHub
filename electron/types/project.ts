export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  workDir: string | null;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCreateParams {
  name: string;
  description?: string;
  workDir?: string;
  template?: string;
}

export interface ProjectUpdateParams {
  name?: string;
  description?: string;
  status?: ProjectRecord['status'];
  workDir?: string;
}

export interface KnowledgeTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: KnowledgeTreeNode[];
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
