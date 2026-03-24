import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useIpc } from '../composables/useIpc';

export type GateType = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';
export type GateStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface GateRecord {
  id: string;
  projectId: string;
  sprintId: string | null;
  gateType: GateType;
  status: GateStatus;
  submittedBy: string | null;
  reviewer: string | null;
  checklist: Record<string, boolean> | null;
  decision: string | null;
  itemReasons?: Record<string, string> | null;
  createdAt: string;
  projectName?: string;
  sprintName?: string;
}

export interface GateChecklistItem {
  label: string;
  criteria: string;
}

export interface GateChecklist {
  gateType: GateType;
  label: string;
  items: GateChecklistItem[];
}

export const useGatesStore = defineStore('gates', () => {
  const {
    createGate,
    listGates,
    submitGate,
    reviewGate,
    getGateChecklists,
    initGatePipeline,
  } = useIpc();

  const gates = ref<GateRecord[]>([]);
  const checklists = ref<GateChecklist[]>([]);
  const selectedProjectId = ref<string | null>(null);
  const selectedSprintId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const GATE_ORDER: GateType[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];

  /**
   * 每個 Sprint 只計算「當前這一關」（第一個未通過的 gate）。
   * Sprint 建立時會自動產生 6 個 pending gate，但實際待處理的永遠只有一個。
   */
  const pendingCount = computed(() => {
    const sprintMap = new Map<string, GateRecord[]>();
    for (const gate of gates.value) {
      const key = gate.sprintId || gate.id; // no-sprint gates count individually
      if (!sprintMap.has(key)) sprintMap.set(key, []);
      sprintMap.get(key)!.push(gate);
    }

    let count = 0;
    for (const [, gateList] of sprintMap) {
      if (!gateList[0]?.sprintId) {
        // Legacy gate without sprint — count if pending/submitted
        if (gateList[0].status === 'pending' || gateList[0].status === 'submitted') count++;
        continue;
      }
      gateList.sort((a, b) => GATE_ORDER.indexOf(a.gateType) - GATE_ORDER.indexOf(b.gateType));
      const current = gateList.find((g) => g.status !== 'approved');
      if (current) count++;
    }
    return count;
  });

  /** 取得每個 Sprint 當前待處理的那一關 */
  const actionableGates = computed(() => {
    const sprintMap = new Map<string, GateRecord[]>();
    for (const gate of gates.value) {
      const key = gate.sprintId || gate.id;
      if (!sprintMap.has(key)) sprintMap.set(key, []);
      sprintMap.get(key)!.push(gate);
    }

    const result: GateRecord[] = [];
    for (const [, gateList] of sprintMap) {
      if (!gateList[0]?.sprintId) {
        if (gateList[0].status !== 'approved') result.push(gateList[0]);
        continue;
      }
      gateList.sort((a, b) => GATE_ORDER.indexOf(a.gateType) - GATE_ORDER.indexOf(b.gateType));
      const current = gateList.find((g) => g.status !== 'approved');
      if (current) result.push(current);
    }
    return result;
  });

  const pipeline = computed(() => {
    const result: Record<GateType, GateRecord | null> = {
      G0: null, G1: null, G2: null, G3: null, G4: null, G5: null, G6: null,
    };
    // Latest gate per type
    for (const gate of gates.value) {
      if (!result[gate.gateType]) {
        result[gate.gateType] = gate;
      }
    }
    return result;
  });

  async function fetchGates(projectId?: string, sprintId?: string | null) {
    loading.value = true;
    try {
      const filters: Record<string, unknown> = {};
      if (projectId) filters.projectId = projectId;
      if (sprintId !== undefined) filters.sprintId = sprintId;
      gates.value = (await listGates(Object.keys(filters).length > 0 ? filters : undefined)) as GateRecord[];
    } catch (e) {
      console.error('Failed to fetch gates', e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchChecklists() {
    try {
      checklists.value = (await getGateChecklists()) as GateChecklist[];
    } catch (e) {
      console.error('Failed to fetch checklists', e);
    }
  }

  async function create(params: { projectId: string; sprintId?: string | null; gateType: GateType }) {
    error.value = null;
    try {
      const gate = (await createGate(params)) as GateRecord;
      gates.value.unshift(gate);
      return gate;
    } catch (e: any) {
      error.value = `建立關卡失敗: ${e.message || e}`;
      console.error('Failed to create gate', e);
      throw e;
    }
  }

  async function submit(gateId: string, submittedBy: string, checklist: Record<string, boolean>) {
    error.value = null;
    try {
      const gate = (await submitGate({ gateId, submittedBy, checklist })) as GateRecord;
      const idx = gates.value.findIndex((g) => g.id === gateId);
      if (idx !== -1) gates.value[idx] = gate;
      return gate;
    } catch (e: any) {
      error.value = `提交審核失敗: ${e.message || e}`;
      console.error('Failed to submit gate', e);
      throw e;
    }
  }

  async function review(
    gateId: string,
    reviewer: string,
    decision: 'approved' | 'rejected',
    comment?: string,
    checklist?: Record<string, boolean>,
    itemReasons?: Record<string, string>,
  ) {
    error.value = null;
    try {
      const gate = (await reviewGate({ gateId, reviewer, decision, comment, checklist, itemReasons })) as GateRecord;
      const idx = gates.value.findIndex((g) => g.id === gateId);
      if (idx !== -1) gates.value[idx] = gate;
      return gate;
    } catch (e: any) {
      error.value = `審核操作失敗: ${e.message || e}`;
      console.error('Failed to review gate', e);
      throw e;
    }
  }

  /** @deprecated 使用 setContext() 代替 */
  function setProject(projectId: string | null) {
    selectedProjectId.value = projectId;
    selectedSprintId.value = null;
    if (projectId) fetchGates(projectId);
  }

  function setContext(projectId: string | null, sprintId: string | null) {
    selectedProjectId.value = projectId;
    selectedSprintId.value = sprintId;
    if (projectId) {
      fetchGates(projectId, sprintId ?? undefined);
    }
  }

  /** 取得此 sprint 實際存在的 gate 類型列表（已排序） */
  const existingGateTypes = computed((): GateType[] => {
    const order: GateType[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
    return order.filter((t) => pipeline.value[t] !== null);
  });

  function isGateLocked(gateType: GateType): boolean {
    const existing = existingGateTypes.value;
    const idx = existing.indexOf(gateType);
    // 第一個存在的 gate 永遠不鎖
    if (idx <= 0) return false;
    const prevType = existing[idx - 1];
    const prevGate = pipeline.value[prevType];
    return !prevGate || prevGate.status !== 'approved';
  }

  async function initPipeline(projectId: string, sprintId: string) {
    error.value = null;
    try {
      const created = (await initGatePipeline(projectId, sprintId)) as GateRecord[];
      gates.value.unshift(...created);
      return created;
    } catch (e: any) {
      error.value = `初始化管線失敗: ${e.message || e}`;
      console.error('Failed to init pipeline', e);
      throw e;
    }
  }

  return {
    gates,
    checklists,
    selectedProjectId,
    selectedSprintId,
    loading,
    error,
    pendingCount,
    actionableGates,
    pipeline,
    existingGateTypes,
    fetchGates,
    fetchChecklists,
    create,
    submit,
    review,
    setProject,
    setContext,
    isGateLocked,
    initPipeline,
  };
});
