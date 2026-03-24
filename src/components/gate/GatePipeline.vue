<script setup lang="ts">
import { computed } from 'vue';
import type { GateType } from '../../stores/gates';

interface GateNode {
  type: GateType;
  label: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'none';
  locked: boolean;
}

const props = defineProps<{
  pipeline: Record<GateType, { status: string } | null>;
  selectedGate?: GateType | null;
  lockedGates?: GateType[];
}>();

const emit = defineEmits<{
  select: [gateType: GateType];
}>();

const gateLabels: Record<GateType, string> = {
  G0: '需求確認',
  G1: '圖稿審核',
  G2: '程式碼審查',
  G3: '測試驗收',
  G4: '文件審查',
  G5: '部署就緒',
  G6: '正式發佈',
};

const ALL_GATE_TYPES: GateType[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];

/** 只顯示實際存在的 gate（動態 Sprint 類型可能只有部分 gate） */
const gateTypes = computed((): GateType[] => {
  const existing = ALL_GATE_TYPES.filter((t) => props.pipeline[t] !== null);
  return existing.length > 0 ? existing : ALL_GATE_TYPES;
});

function getNode(
  type: GateType,
  pipeline: Record<GateType, { status: string } | null>,
): GateNode {
  const gate = pipeline[type];
  return {
    type,
    label: gateLabels[type],
    status: gate ? (gate.status as GateNode['status']) : 'none',
    locked: props.lockedGates?.includes(type) ?? false,
  };
}

const statusColors: Record<string, string> = {
  none: 'bg-bg-hover border-border-default',
  pending: 'bg-yellow-500/20 border-yellow-500',
  submitted: 'bg-blue-500/20 border-blue-500',
  approved: 'bg-emerald-500/20 border-emerald-500',
  rejected: 'bg-red-500/20 border-red-500',
};

const statusDotColors: Record<string, string> = {
  none: 'bg-text-muted',
  pending: 'bg-yellow-400',
  submitted: 'bg-blue-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-red-400',
};
</script>

<template>
  <div class="flex items-center gap-1">
    <template v-for="(type, index) in gateTypes" :key="type">
      <!-- Gate node -->
      <button
        class="relative flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-2.5 transition-all hover:scale-105"
        :class="[
          statusColors[getNode(type, pipeline).status],
          selectedGate === type ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary' : '',
          getNode(type, pipeline).locked ? 'opacity-50' : '',
        ]"
        @click="emit('select', type)"
      >
        <!-- Lock icon -->
        <span
          v-if="getNode(type, pipeline).locked"
          class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-bg-card text-[8px] shadow"
          title="前一關卡尚未通過"
        >
          &#128274;
        </span>
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
          :class="statusDotColors[getNode(type, pipeline).status]"
        >
          {{ type }}
        </div>
        <span class="whitespace-nowrap text-[10px] font-medium text-text-secondary">
          {{ gateLabels[type] }}
        </span>
      </button>

      <!-- Connector line -->
      <div
        v-if="index < gateTypes.length - 1"
        class="h-0.5 w-6 flex-shrink-0"
        :class="
          getNode(gateTypes[index]!, pipeline).status === 'approved'
            ? 'bg-emerald-500'
            : 'bg-border-default'
        "
      />
    </template>
  </div>
</template>
