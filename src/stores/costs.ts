import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useIpc } from '../composables/useIpc';

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

export interface CostBreakdown {
  type: string;
  items: CostBreakdownItem[];
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

const defaultOverview: CostOverview = {
  todayTokens: 0,
  thisWeekTokens: 0,
  thisMonthTokens: 0,
  avgTokensPerSession: 0,
  todayUsd: 0,
  thisWeekUsd: 0,
  thisMonthUsd: 0,
  avgUsdPerSession: 0,
};

export const useCostsStore = defineStore('costs', () => {
  const { getCostOverview, getCostBreakdown, getCostBudget, setCostBudget } = useIpc();

  const overview = ref<CostOverview>({ ...defaultOverview });
  const breakdownByAgent = ref<CostBreakdown>({ type: 'byAgent', items: [] });
  const breakdownByModel = ref<CostBreakdown>({ type: 'byModel', items: [] });
  const breakdownDaily = ref<CostBreakdown>({ type: 'daily', items: [] });
  const budget = ref<BudgetInfo | null>(null);
  const loading = ref(false);

  async function fetchOverview() {
    loading.value = true;
    try {
      overview.value = (await getCostOverview()) as CostOverview;
    } catch (e) {
      console.error('Failed to fetch cost overview', e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchBreakdown(type: 'byAgent' | 'byModel' | 'daily') {
    try {
      const data = (await getCostBreakdown(type)) as CostBreakdown;
      if (type === 'byAgent') breakdownByAgent.value = data;
      else if (type === 'byModel') breakdownByModel.value = data;
      else breakdownDaily.value = data;
    } catch (e) {
      console.error(`Failed to fetch breakdown: ${type}`, e);
    }
  }

  async function fetchAllBreakdowns() {
    await Promise.all([
      fetchBreakdown('byAgent'),
      fetchBreakdown('byModel'),
      fetchBreakdown('daily'),
    ]);
  }

  async function fetchBudget(projectId: string) {
    try {
      budget.value = (await getCostBudget(projectId)) as BudgetInfo;
    } catch (e) {
      console.error('Failed to fetch budget', e);
    }
  }

  async function updateBudget(params: {
    projectId: string;
    dailyTokenLimit?: number;
    totalTokenLimit?: number;
    alertThreshold?: number;
  }) {
    budget.value = (await setCostBudget(params)) as BudgetInfo;
    return budget.value;
  }

  return {
    overview,
    breakdownByAgent,
    breakdownByModel,
    breakdownDaily,
    budget,
    loading,
    fetchOverview,
    fetchBreakdown,
    fetchAllBreakdowns,
    fetchBudget,
    updateBudget,
  };
});
