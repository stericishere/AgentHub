<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAgentsStore } from '../stores/agents';
import AgentCard from '../components/agent/AgentCard.vue';
import SessionLauncher from '../components/session/SessionLauncher.vue';

const router = useRouter();
const agentsStore = useAgentsStore();

const showLauncher = ref(false);
const launchAgentId = ref<string | undefined>(undefined);

const departmentLabel: Record<string, string> = {
  engineering: '工程部',
  design: '設計部',
  product: '產品部',
  marketing: '行銷部',
  testing: '測試部',
  'project-management': '專案管理部',
  'studio-operations': '工作室營運',
  bonus: '特殊',
};

function handleLaunch(agentId: string) {
  launchAgentId.value = agentId;
  showLauncher.value = true;
}

function handleDetail(agentId: string) {
  router.push({ name: 'agent-detail', params: { id: agentId } });
}

function selectDepartment(dept: string | null) {
  agentsStore.setFilterDepartment(dept);
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center gap-3">
      <h2 class="text-xl font-semibold">代理人</h2>
      <span class="text-sm text-text-muted">{{ agentsStore.agentCount }} 個</span>
    </div>

    <!-- Department filter chips -->
    <div class="mb-5 flex flex-wrap gap-2">
      <button
        class="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="
          !agentsStore.filterDepartment
            ? 'border-accent bg-accent/20 text-accent-light'
            : 'border-border-default bg-transparent text-text-muted hover:border-border-light hover:text-text-primary'
        "
        @click="selectDepartment(null)"
      >
        全部
      </button>
      <button
        v-for="dept in agentsStore.departments"
        :key="dept.id"
        class="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="
          agentsStore.filterDepartment === dept.id
            ? 'border-accent bg-accent/20 text-accent-light'
            : 'border-border-default bg-transparent text-text-muted hover:border-border-light hover:text-text-primary'
        "
        @click="selectDepartment(dept.id)"
      >
        {{ dept.name }} ({{ dept.agentCount }})
      </button>
    </div>

    <!-- Grouped agent cards -->
    <div v-for="[dept, agents] in agentsStore.agentsByDepartment" :key="dept" class="mb-6">
      <h3 class="mb-3 text-sm font-semibold text-text-secondary">
        {{ departmentLabel[dept] || dept }}
        <span class="ml-1 text-text-muted">({{ agents.length }})</span>
      </h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AgentCard
          v-for="agent in agents"
          :key="agent.id"
          :agent="agent"
          @launch="handleLaunch"
          @detail="handleDetail"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="agentsStore.filteredAgents.length === 0"
      class="rounded-xl border border-border-default bg-bg-card p-8 text-center text-text-muted"
    >
      {{ agentsStore.loading ? '載入中...' : '找不到符合條件的代理人' }}
    </div>

    <SessionLauncher
      :show="showLauncher"
      :preselected-agent-id="launchAgentId"
      @close="showLauncher = false"
      @launched="showLauncher = false"
    />
  </div>
</template>
