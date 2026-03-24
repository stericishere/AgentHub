<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useGatesStore, type GateRecord, type GateType } from '../../stores/gates';
import GateChecklistPanel from './GateChecklistPanel.vue';
import BaseButton from '../common/BaseButton.vue';

const gatesStore = useGatesStore();

const expanded = ref(false);
const currentIndex = ref(0);

const submittedGates = computed(() =>
  gatesStore.gates.filter((g) => g.status === 'submitted'),
);

const hasGates = computed(() => submittedGates.value.length > 0);

const currentGate = computed((): GateRecord | null =>
  submittedGates.value[currentIndex.value] || null,
);

const currentChecklist = computed(() => {
  if (!currentGate.value) return null;
  return gatesStore.checklists.find((c) => c.gateType === currentGate.value!.gateType) || null;
});

const gateLabels: Record<GateType, string> = {
  G0: '需求確認',
  G1: '圖稿審核',
  G2: '程式碼審查',
  G3: '測試驗收',
  G4: '文件審查',
  G5: '部署就緒',
  G6: '正式發佈',
};

function cycleGate(dir: 1 | -1) {
  const len = submittedGates.value.length;
  if (len === 0) return;
  currentIndex.value = (currentIndex.value + dir + len) % len;
}

async function onSubmit(gateId: string, checklist: Record<string, boolean>) {
  await gatesStore.submit(gateId, 'user', checklist);
  await refreshGates();
}

async function onReview(
  gateId: string,
  decision: 'approved' | 'rejected',
  checklist?: Record<string, boolean>,
  comment?: string,
  itemReasons?: Record<string, string>,
) {
  await gatesStore.review(gateId, 'user', decision, comment, checklist, itemReasons);
  await refreshGates();
  // 如果審核後沒有更多待審，收起 Banner
  if (submittedGates.value.length === 0) {
    expanded.value = false;
    currentIndex.value = 0;
  } else if (currentIndex.value >= submittedGates.value.length) {
    currentIndex.value = 0;
  }
}

async function refreshGates() {
  // 重新抓取所有 submitted gates（不限專案）
  await gatesStore.fetchGates();
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await gatesStore.fetchChecklists();
  await refreshGates();
  // 每 30 秒輪詢一次
  pollTimer = setInterval(refreshGates, 30_000);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

// 監聽 main process 推送的 gate 狀態變更
if (window.maestro?.on?.gateStatusChanged) {
  window.maestro.on.gateStatusChanged(() => {
    refreshGates();
  });
}
</script>

<template>
  <div v-if="hasGates" class="mx-4 mb-3">
    <!-- Collapsed Banner -->
    <div
      class="flex cursor-pointer items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 transition-colors hover:bg-yellow-500/15"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-yellow-400">
          {{ submittedGates.length }} 個關卡待審核
        </span>
        <span v-if="currentGate" class="text-xs text-text-muted">
          — {{ currentGate.gateType }} {{ gateLabels[currentGate.gateType] }}
          <template v-if="currentGate.projectName">
            ({{ currentGate.projectName }}<template v-if="currentGate.sprintName"> / {{ currentGate.sprintName }}</template>)
          </template>
        </span>
      </div>
      <div class="flex items-center gap-2">
        <template v-if="submittedGates.length > 1">
          <BaseButton size="sm" variant="ghost" @click.stop="cycleGate(-1)">
            &lt;
          </BaseButton>
          <span class="text-xs text-text-muted">{{ currentIndex + 1 }}/{{ submittedGates.length }}</span>
          <BaseButton size="sm" variant="ghost" @click.stop="cycleGate(1)">
            &gt;
          </BaseButton>
        </template>
        <span class="text-xs text-text-muted">{{ expanded ? '收起' : '展開' }}</span>
      </div>
    </div>

    <!-- Expanded: Checklist Panel -->
    <div v-if="expanded && currentGate" class="mt-2">
      <GateChecklistPanel
        :gate="currentGate"
        :gate-type="currentGate.gateType"
        :checklist="currentChecklist"
        @submit="onSubmit"
        @review="onReview"
      />
    </div>
  </div>
</template>
