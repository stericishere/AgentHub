<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGatesStore, type GateType } from '../stores/gates';
import { useProjectsStore } from '../stores/projects';
import GatePipeline from '../components/gate/GatePipeline.vue';
import GateChecklistPanel from '../components/gate/GateChecklistPanel.vue';
import BaseTag from '../components/common/BaseTag.vue';
import BaseButton from '../components/common/BaseButton.vue';

const route = useRoute();
const gatesStore = useGatesStore();
const projectsStore = useProjectsStore();

const selectedGate = ref<GateType | null>(null);
const selectedProjectId = ref<string | null>(null);
const selectedSprintId = ref<string | null>(null);

onMounted(async () => {
  await gatesStore.fetchChecklists();
  if (projectsStore.projects.length === 0) await projectsStore.fetchAll();

  // 優先使用 query param 指定的專案
  const queryProjectId = route.query.projectId as string | undefined;
  if (queryProjectId && projectsStore.projects.some((p) => p.id === queryProjectId)) {
    selectedProjectId.value = queryProjectId;
  } else if (projectsStore.projects.length > 0 && !selectedProjectId.value) {
    selectedProjectId.value = projectsStore.projects[0].id;
  }
});

// 選專案 → 拉 sprints → 自動選 active sprint
watch(selectedProjectId, async (id) => {
  selectedSprintId.value = null;
  selectedGate.value = null;
  if (id) {
    await projectsStore.fetchSprints(id);
    const active = projectsStore.sprints.find((s) => s.status === 'active');
    selectedSprintId.value = active?.id ?? projectsStore.sprints[0]?.id ?? null;
  }
});

// 選 sprint → 設定 gate context
watch(selectedSprintId, (sprintId) => {
  selectedGate.value = null;
  if (selectedProjectId.value) {
    gatesStore.setContext(selectedProjectId.value, sprintId);
  }
});

// 判斷 pipeline 是否全空（舊 Sprint 未初始化）
const pipelineEmpty = computed(() => {
  return selectedSprintId.value !== null && gatesStore.existingGateTypes.length === 0;
});

// locked gates 列表（給 GatePipeline 用，只檢查實際存在的 gate）
const lockedGates = computed(() => {
  return gatesStore.existingGateTypes.filter((t) => gatesStore.isGateLocked(t));
});

function getChecklist(gateType: GateType) {
  return gatesStore.checklists.find((c) => c.gateType === gateType) || null;
}

async function handleInitPipeline() {
  if (!selectedProjectId.value || !selectedSprintId.value) return;
  try {
    await gatesStore.initPipeline(selectedProjectId.value, selectedSprintId.value);
    // 重新拉一次確保 pipeline computed 正確
    gatesStore.setContext(selectedProjectId.value, selectedSprintId.value);
  } catch {
    // error is set in store
  }
}

async function handleSubmit(gateId: string, checklist: Record<string, boolean>) {
  try {
    await gatesStore.submit(gateId, 'user', checklist);
  } catch {
    // error is set in store
  }
}

async function handleReview(
  gateId: string,
  decision: 'approved' | 'rejected',
  checklist?: Record<string, boolean>,
  comment?: string,
  itemReasons?: Record<string, string>,
) {
  try {
    await gatesStore.review(gateId, 'user', decision, comment, checklist, itemReasons);
  } catch {
    // error is set in store
  }
}

const statusLabels: Record<string, string> = {
  pending: '待處理',
  submitted: '已提交',
  approved: '已通過',
  rejected: '已退回',
};

const statusColors: Record<string, 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red',
};

const sprintStatusLabels: Record<string, string> = {
  planning: '規劃中',
  active: '進行中',
  review: '審查中',
  completed: '已完成',
};
</script>

<template>
  <div>
    <h2 class="mb-6 text-xl font-semibold">審核關卡</h2>

    <!-- Error banner -->
    <div
      v-if="gatesStore.error"
      class="mb-4 flex items-center justify-between rounded-lg border border-danger/30 bg-danger-dim px-4 py-2 text-xs text-danger"
    >
      <span>{{ gatesStore.error }}</span>
      <button class="ml-2 font-medium hover:underline" @click="gatesStore.error = null">
        關閉
      </button>
    </div>

    <!-- Project + Sprint selector -->
    <div class="mb-6 flex items-center gap-3">
      <select
        v-model="selectedProjectId"
        class="rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option :value="null" disabled>選擇專案</option>
        <option
          v-for="project in projectsStore.projects"
          :key="project.id"
          :value="project.id"
        >
          {{ project.name }}
        </option>
      </select>

      <select
        v-if="selectedProjectId && projectsStore.sprints.length > 0"
        v-model="selectedSprintId"
        class="rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option :value="null" disabled>選擇 Sprint</option>
        <option
          v-for="sprint in projectsStore.sprints"
          :key="sprint.id"
          :value="sprint.id"
        >
          {{ sprint.name }} ({{ sprintStatusLabels[sprint.status] || sprint.status }})
        </option>
      </select>

      <span
        v-if="selectedProjectId && projectsStore.sprints.length === 0"
        class="text-xs text-text-muted"
      >
        此專案尚無 Sprint
      </span>
    </div>

    <div v-if="selectedProjectId && selectedSprintId">
      <!-- Pipeline empty → init button -->
      <div
        v-if="pipelineEmpty && !gatesStore.loading"
        class="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-center"
      >
        <p class="mb-3 text-sm text-text-secondary">
          此 Sprint 尚未建立審核管線
        </p>
        <BaseButton size="sm" @click="handleInitPipeline">初始化審核管線</BaseButton>
      </div>

      <!-- Pipeline visualization -->
      <div
        v-if="!pipelineEmpty"
        class="mb-6 overflow-x-auto rounded-xl border border-border-default bg-bg-card p-5"
      >
        <h3 class="mb-4 text-sm font-semibold">審核管線</h3>
        <div class="flex justify-center">
          <GatePipeline
            :pipeline="gatesStore.pipeline"
            :selected-gate="selectedGate"
            :locked-gates="lockedGates"
            @select="selectedGate = $event"
          />
        </div>
      </div>

      <div v-if="!pipelineEmpty" class="grid grid-cols-2 gap-4">
        <!-- Checklist panel -->
        <div>
          <div v-if="selectedGate">
            <GateChecklistPanel
              :gate="gatesStore.pipeline[selectedGate]"
              :gate-type="selectedGate"
              :checklist="getChecklist(selectedGate)"
              :locked="gatesStore.isGateLocked(selectedGate)"
              @submit="handleSubmit"
              @review="(gateId, decision, checklist, comment, itemReasons) => handleReview(gateId, decision, checklist, comment, itemReasons)"
            />
          </div>
          <div
            v-else
            class="rounded-xl border border-border-default bg-bg-card p-8 text-center text-xs text-text-muted"
          >
            點擊上方管線中的關卡以查看詳情
          </div>
        </div>

        <!-- Gate history list -->
        <div class="rounded-xl border border-border-default bg-bg-card p-5">
          <h3 class="mb-3 text-sm font-semibold">關卡記錄</h3>
          <div
            v-if="gatesStore.gates.length === 0"
            class="py-4 text-center text-xs text-text-muted"
          >
            尚無關卡記錄
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="gate in gatesStore.gates"
              :key="gate.id"
              class="flex items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs"
            >
              <span class="font-semibold text-accent-light">{{ gate.gateType }}</span>
              <span class="flex-1 truncate text-text-secondary">
                {{ gate.projectName || gate.projectId }}
              </span>
              <BaseTag :color="statusColors[gate.status]" class="!text-[10px]">
                {{ statusLabels[gate.status] }}
              </BaseTag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="!selectedProjectId"
      class="rounded-xl border border-border-default bg-bg-card p-8 text-center text-text-muted"
    >
      請先選擇一個專案
    </div>

    <div
      v-else-if="!selectedSprintId"
      class="rounded-xl border border-border-default bg-bg-card p-8 text-center text-text-muted"
    >
      請選擇一個 Sprint
    </div>
  </div>
</template>
