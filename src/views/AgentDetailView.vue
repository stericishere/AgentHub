<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAgentsStore, type AgentDetail } from '../stores/agents';
import BaseButton from '../components/common/BaseButton.vue';
import BaseTag from '../components/common/BaseTag.vue';
import BaseCard from '../components/common/BaseCard.vue';
import SessionLauncher from '../components/session/SessionLauncher.vue';

const route = useRoute();
const router = useRouter();
const agentsStore = useAgentsStore();

const agent = ref<AgentDetail | null>(null);
const loading = ref(true);
const showLauncher = ref(false);
const showPrompt = ref(false);

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

async function loadAgent() {
  loading.value = true;
  const id = route.params.id as string;
  agent.value = await agentsStore.getDetail(id);
  loading.value = false;
}

watch(() => route.params.id, loadAgent);
onMounted(loadAgent);
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="rounded-xl border border-border-default bg-bg-card p-8 text-center text-text-muted">
      載入中...
    </div>

    <!-- Not found -->
    <div v-else-if="!agent" class="rounded-xl border border-border-default bg-bg-card p-8 text-center text-text-muted">
      找不到此代理人
      <div class="mt-3">
        <BaseButton variant="ghost" @click="router.push({ name: 'agents' })">
          返回代理人列表
        </BaseButton>
      </div>
    </div>

    <!-- Agent detail -->
    <div v-else>
      <!-- Header -->
      <div class="mb-6 flex items-start gap-4">
        <div
          class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-accent/20 text-2xl"
        >
          {{ agentsStore.agentIcon(agent.id) }}
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-xl font-semibold">{{ agentsStore.displayName(agent.id) }}</h2>
          <p class="mt-1 text-sm text-text-muted">{{ agent.description }}</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <BaseTag :color="agent.color as any">{{ agent.level }}</BaseTag>
            <BaseTag>{{ departmentLabel[agent.department] || agent.department }}</BaseTag>
            <BaseTag :color="agent.model === 'opus' ? 'red' : agent.model === 'haiku' ? 'green' : 'blue'">
              {{ agent.model }}
            </BaseTag>
          </div>
        </div>
        <BaseButton variant="primary" @click="showLauncher = true">
          啟動工作階段
        </BaseButton>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- Organization info -->
        <BaseCard title="組織關係">
          <div class="space-y-3 text-sm">
            <div v-if="agent.reportsTo">
              <span class="text-text-muted">匯報給：</span>
              <span
                v-if="agent.reportsTo !== 'boss'"
                class="cursor-pointer text-accent-light hover:underline"
                @click="router.push({ name: 'agent-detail', params: { id: agent.reportsTo } })"
              >
                {{ agent.reportsTo }}
              </span>
              <span v-else>Boss</span>
            </div>
            <div v-if="agent.manages.length > 0">
              <span class="text-text-muted">管理：</span>
              <div class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="sub in agent.manages"
                  :key="sub"
                  class="cursor-pointer rounded-md bg-bg-hover px-2 py-0.5 text-xs hover:bg-bg-active"
                  @click="router.push({ name: 'agent-detail', params: { id: sub } })"
                >
                  {{ sub }}
                </span>
              </div>
            </div>
            <div v-if="agent.coordinatesWith.length > 0">
              <span class="text-text-muted">協調對象：</span>
              <div class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="coord in agent.coordinatesWith"
                  :key="coord"
                  class="cursor-pointer rounded-md bg-bg-hover px-2 py-0.5 text-xs hover:bg-bg-active"
                  @click="router.push({ name: 'agent-detail', params: { id: coord } })"
                >
                  {{ coord }}
                </span>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Tools -->
        <BaseCard title="工具">
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="tool in agent.tools"
              :key="tool"
              class="rounded-md bg-bg-hover px-2 py-0.5 text-xs text-text-secondary"
            >
              {{ tool }}
            </span>
            <span v-if="agent.tools.length === 0" class="text-sm text-text-muted">
              無指定工具
            </span>
          </div>
        </BaseCard>
      </div>

      <!-- System Prompt -->
      <div class="mt-4">
        <BaseCard>
          <template #header>
            <h3 class="text-sm font-semibold">系統提示詞</h3>
            <button
              class="cursor-pointer border-none bg-transparent text-xs text-accent-light hover:underline"
              @click="showPrompt = !showPrompt"
            >
              {{ showPrompt ? '收合' : '展開' }}
            </button>
          </template>
          <div v-if="showPrompt" class="max-h-[400px] overflow-y-auto">
            <pre class="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">{{ agent.systemPrompt }}</pre>
          </div>
          <div v-else class="text-sm text-text-muted">
            點擊「展開」查看完整系統提示詞（{{ agent.systemPrompt.length }} 字）
          </div>
        </BaseCard>
      </div>
    </div>

    <SessionLauncher
      :show="showLauncher"
      :preselected-agent-id="agent?.id"
      @close="showLauncher = false"
      @launched="showLauncher = false"
    />
  </div>
</template>
