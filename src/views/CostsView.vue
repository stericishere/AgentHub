<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCostsStore } from '../stores/costs';
import { useProjectsStore } from '../stores/projects';
import { formatTokens } from '../utils/format-tokens';
import StatCard from '../components/common/StatCard.vue';
import CostBarChart from '../components/cost/CostBarChart.vue';
import BudgetCard from '../components/cost/BudgetCard.vue';

const costsStore = useCostsStore();
const projectsStore = useProjectsStore();

const activeTab = ref<'byAgent' | 'byModel' | 'daily'>('byAgent');
const budgetProjectId = ref<string | null>(null);

onMounted(async () => {
  await costsStore.fetchOverview();
  await costsStore.fetchAllBreakdowns();
  if (projectsStore.projects.length === 0) await projectsStore.fetchAll();
  if (projectsStore.projects.length > 0) {
    budgetProjectId.value = projectsStore.projects[0].id;
    await costsStore.fetchBudget(projectsStore.projects[0].id);
  }
});

function selectBudgetProject(id: string) {
  budgetProjectId.value = id;
  costsStore.fetchBudget(id);
}

const tabs = [
  { key: 'byAgent' as const, label: '依代理人' },
  { key: 'byModel' as const, label: '依模型' },
  { key: 'daily' as const, label: '每日趨勢' },
];

const tabColors: Record<string, string> = {
  byAgent: 'bg-accent',
  byModel: 'bg-cyan-500',
  daily: 'bg-emerald-500',
};
</script>

<template>
  <div>
    <h2 class="mb-6 text-xl font-semibold">用量分析</h2>

    <!-- Overview stat cards -->
    <div class="mb-6 grid grid-cols-4 gap-4">
      <StatCard
        label="今日"
        :value="formatTokens(costsStore.overview.todayTokens)"
        :change="`$${costsStore.overview.todayUsd.toFixed(4)}`"
      />
      <StatCard
        label="本週"
        :value="formatTokens(costsStore.overview.thisWeekTokens)"
        :change="`$${costsStore.overview.thisWeekUsd.toFixed(4)}`"
      />
      <StatCard
        label="本月"
        :value="formatTokens(costsStore.overview.thisMonthTokens)"
        :change="`$${costsStore.overview.thisMonthUsd.toFixed(4)}`"
      />
      <StatCard
        label="平均每次"
        :value="formatTokens(costsStore.overview.avgTokensPerSession)"
        :change="`$${costsStore.overview.avgUsdPerSession.toFixed(4)}`"
      />
    </div>

    <div class="grid grid-cols-3 gap-4">
      <!-- Breakdown charts (2 cols) -->
      <div class="col-span-2 rounded-xl border border-border-default bg-bg-card p-5">
        <!-- Tabs -->
        <div class="mb-4 flex gap-1 rounded-lg bg-bg-hover p-1">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            :class="
              activeTab === tab.key
                ? 'bg-bg-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            "
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Chart content -->
        <div v-show="activeTab === 'byAgent'">
          <CostBarChart :items="costsStore.breakdownByAgent.items" :color="tabColors.byAgent" />
        </div>
        <div v-show="activeTab === 'byModel'">
          <CostBarChart :items="costsStore.breakdownByModel.items" color="bg-cyan-500" />
        </div>
        <div v-show="activeTab === 'daily'">
          <CostBarChart :items="costsStore.breakdownDaily.items" color="bg-emerald-500" />
        </div>
      </div>

      <!-- Budget sidebar (1 col) -->
      <div class="space-y-4">
        <div class="rounded-xl border border-border-default bg-bg-card p-4">
          <h3 class="mb-3 text-sm font-semibold">預算監控</h3>
          <select
            :value="budgetProjectId"
            class="mb-3 w-full rounded-lg border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            @change="selectBudgetProject(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="project in projectsStore.projects"
              :key="project.id"
              :value="project.id"
            >
              {{ project.name }}
            </option>
          </select>

          <div v-if="costsStore.budget" class="space-y-3">
            <BudgetCard
              label="每日用量"
              :used="costsStore.budget.dailyTokensUsed"
              :limit="costsStore.budget.dailyTokenLimit"
              :pct="costsStore.budget.dailyPct"
              :alert-level="costsStore.budget.alertLevel"
              mode="tokens"
            />
            <BudgetCard
              label="總用量"
              :used="costsStore.budget.totalTokensUsed"
              :limit="costsStore.budget.totalTokenLimit"
              :pct="costsStore.budget.totalPct"
              :alert-level="costsStore.budget.alertLevel"
              mode="tokens"
            />
          </div>
          <div v-else class="py-4 text-center text-xs text-text-muted">
            選擇專案以查看預算
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
