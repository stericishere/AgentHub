<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { GateType, GateRecord, GateChecklist, GateChecklistItem } from '../../stores/gates';
import BaseButton from '../common/BaseButton.vue';

const props = defineProps<{
  gate: GateRecord | null;
  gateType: GateType;
  checklist: GateChecklist | null;
  locked?: boolean;
}>();

const emit = defineEmits<{
  submit: [gateId: string, checklist: Record<string, boolean>];
  review: [
    gateId: string,
    decision: 'approved' | 'rejected',
    checklist?: Record<string, boolean>,
    comment?: string,
    itemReasons?: Record<string, string>,
  ];
}>();

const checkStates = ref<Record<string, boolean>>({});

/** 退回原因輸入模式 */
const rejectMode = ref(false);
const itemReasons = ref<Record<string, string>>({});
const rejectComment = ref('');

watch(
  () => props.gate,
  (gate) => {
    // 切換 gate 時重設退回模式
    rejectMode.value = false;
    rejectComment.value = '';
    itemReasons.value = {};

    if (gate?.checklist) {
      checkStates.value = { ...gate.checklist };
    } else if (props.checklist) {
      const states: Record<string, boolean> = {};
      for (const item of props.checklist.items) {
        states[item.label] = false;
      }
      checkStates.value = states;
    }
  },
  { immediate: true },
);

const allChecked = computed(() => {
  const values = Object.values(checkStates.value);
  return values.length > 0 && values.every(Boolean);
});

/** 不合格項目列表（用於退回原因輸入模式） */
const failedItems = computed((): string[] => {
  return Object.entries(checkStates.value)
    .filter(([, passed]) => !passed)
    .map(([item]) => item);
});

/** Item labels list (for iteration) */
const items = computed((): string[] => {
  if (props.gate?.checklist) return Object.keys(props.gate.checklist);
  return props.checklist?.items.map((i) => i.label) || [];
});

/** Map label → criteria for display */
const criteriaMap = computed((): Record<string, string> => {
  const map: Record<string, string> = {};
  if (props.checklist) {
    for (const item of props.checklist.items) {
      map[item.label] = item.criteria;
    }
  }
  return map;
});

const isDisabled = computed(() => props.locked || props.gate?.status === 'approved');

/** Items that were already checked (passed) when gate was rejected — lock them on resubmit */
const lockedItems = computed(() => {
  if (props.gate?.status !== 'rejected' || !props.gate?.checklist) return new Set<string>();
  return new Set(
    Object.entries(props.gate.checklist)
      .filter(([, passed]) => passed)
      .map(([item]) => item),
  );
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

const prevGateLabel = computed(() => {
  const order: GateType[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
  const idx = order.indexOf(props.gateType);
  if (idx <= 0) return '';
  const prev = order[idx - 1];
  return `${prev} — ${gateLabels[prev]}`;
});

const statusLabels: Record<string, string> = {
  pending: '待處理',
  submitted: '已提交',
  approved: '已通過',
  rejected: '已退回',
};

const statusColors: Record<string, string> = {
  pending: 'text-yellow-400',
  submitted: 'text-blue-400',
  approved: 'text-emerald-400',
  rejected: 'text-red-400',
};

/** 進入退回原因輸入模式 */
function enterRejectMode() {
  rejectMode.value = true;
  rejectComment.value = '';
  itemReasons.value = {};
}

/** 取消退回，回到 checklist */
function cancelReject() {
  rejectMode.value = false;
  rejectComment.value = '';
  itemReasons.value = {};
}

/** 確認退回 */
function confirmReject() {
  if (!props.gate) return;
  // 過濾掉空白原因
  const reasons: Record<string, string> = {};
  for (const [item, reason] of Object.entries(itemReasons.value)) {
    const trimmed = reason.trim();
    if (trimmed) reasons[item] = trimmed;
  }
  const comment = rejectComment.value.trim() || undefined;
  emit('review', props.gate.id, 'rejected', { ...checkStates.value }, comment, reasons);
  rejectMode.value = false;
}
</script>

<template>
  <div class="rounded-xl border border-border-default bg-bg-card p-5">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-sm font-semibold">
        {{ gateType }} — {{ gateLabels[gateType] }}
      </h3>
      <span
        v-if="gate"
        class="text-xs font-medium"
        :class="statusColors[gate.status]"
      >
        {{ statusLabels[gate.status] }}
      </span>
    </div>

    <!-- Locked hint -->
    <div v-if="locked && gate" class="text-center">
      <div class="mb-3 space-y-2">
        <label
          v-for="item in items"
          :key="item"
          class="flex items-center gap-2.5 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs opacity-40"
        >
          <input type="checkbox" :checked="false" disabled class="h-3.5 w-3.5 accent-accent" />
          <span>{{ item }}</span>
        </label>
      </div>
      <p class="text-xs text-text-muted">
        需先通過 {{ prevGateLabel }} 關卡
      </p>
    </div>

    <!-- No gate yet -->
    <div v-else-if="!gate" class="text-center">
      <p class="text-xs text-text-muted">尚未建立此關卡</p>
    </div>

    <!-- Reject reason input mode (step 2) -->
    <div v-else-if="rejectMode">
      <p class="mb-3 text-[11px] text-text-muted">
        請為每個不合格項目說明退回原因，填寫完成後點擊「確認退回」。
      </p>

      <div class="mb-4 space-y-3">
        <div
          v-for="item in failedItems"
          :key="item"
          class="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2"
        >
          <div class="mb-1.5 text-xs font-medium text-red-400">{{ item }}</div>
          <input
            v-model="itemReasons[item]"
            type="text"
            :placeholder="'不合格原因...'"
            class="w-full rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
          />
        </div>
      </div>

      <div class="mb-4">
        <label class="mb-1 block text-[11px] text-text-muted">整體退回備註（選填）</label>
        <textarea
          v-model="rejectComment"
          rows="2"
          placeholder="整體退回原因或建議..."
          class="w-full resize-none rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
        />
      </div>

      <div class="flex gap-2">
        <BaseButton size="sm" variant="danger" @click="confirmReject">
          確認退回
        </BaseButton>
        <BaseButton size="sm" @click="cancelReject">
          取消
        </BaseButton>
      </div>
    </div>

    <!-- Checklist -->
    <div v-else>
      <div class="mb-4 space-y-2">
        <div
          v-for="item in items"
          :key="item"
        >
          <label
            class="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs transition-colors hover:border-border-light"
            :class="{ 'opacity-60': isDisabled && !lockedItems.has(item) }"
          >
            <input
              type="checkbox"
              :checked="checkStates[item]"
              :disabled="isDisabled || lockedItems.has(item)"
              class="mt-0.5 h-3.5 w-3.5 accent-accent"
              @change="checkStates[item] = !checkStates[item]"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span>{{ item }}</span>
                <span v-if="lockedItems.has(item)" class="text-[10px] text-emerald-400">✓ 已通過</span>
              </div>
              <div v-if="criteriaMap[item]" class="mt-0.5 text-[11px] leading-tight text-text-muted">
                {{ criteriaMap[item] }}
              </div>
            </div>
          </label>
          <!-- 退回原因顯示（rejected 狀態 + 該項未通過 + 有原因） -->
          <div
            v-if="gate.status === 'rejected' && !checkStates[item] && gate.itemReasons?.[item]"
            class="ml-6 mt-1 rounded border-l-2 border-red-500/50 bg-red-500/5 px-2 py-1 text-[11px] text-red-400"
          >
            不合格原因：{{ gate.itemReasons[item] }}
          </div>
        </div>
      </div>

      <!-- Reviewer hint -->
      <p v-if="gate.status === 'submitted'" class="mb-3 text-[11px] text-text-muted">
        取消勾選不合格的項目，再點擊「退回」；全部合格則點擊「核准」。
      </p>

      <!-- Actions -->
      <div class="flex gap-2">
        <BaseButton
          v-if="gate.status === 'pending' || gate.status === 'rejected'"
          size="sm"
          :disabled="!allChecked"
          @click="emit('submit', gate.id, { ...checkStates })"
        >
          {{ gate.status === 'rejected' ? '重新提交' : '提交審核' }}
        </BaseButton>
        <BaseButton
          v-if="gate.status === 'submitted'"
          size="sm"
          variant="success"
          :disabled="!allChecked"
          @click="emit('review', gate.id, 'approved')"
        >
          核准
        </BaseButton>
        <BaseButton
          v-if="gate.status === 'submitted'"
          size="sm"
          variant="danger"
          :disabled="allChecked"
          @click="enterRejectMode"
        >
          退回
        </BaseButton>
      </div>

      <!-- Meta info -->
      <div
        v-if="gate.submittedBy || gate.reviewer"
        class="mt-3 space-y-1 text-[11px] text-text-muted"
      >
        <div v-if="gate.submittedBy">提交者：{{ gate.submittedBy }}</div>
        <div v-if="gate.reviewer">審核者：{{ gate.reviewer }}</div>
        <div v-if="gate.decision">決議：{{ gate.decision }}</div>
      </div>
    </div>
  </div>
</template>
