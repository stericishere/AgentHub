import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useIpc } from '../composables/useIpc';

export interface Objection {
  id: string;
  from_agent: string;
  to_agent: string;
  session_id: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved';
  resolution?: string;
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
}

export const useObjectionsStore = defineStore('objections', () => {
  const ipc = useIpc();
  const openList = ref<Objection[]>([]);
  const loading = ref(false);

  const openCount = computed(() => openList.value.length);

  async function fetchOpen() {
    loading.value = true;
    try {
      openList.value = (await ipc.listObjections()) as Objection[];
    } catch (err) {
      console.error('Failed to fetch objections', err);
    } finally {
      loading.value = false;
    }
  }

  async function resolve(objectionId: string, resolution: string, resolvedBy = 'user') {
    try {
      await ipc.resolveObjection({ objectionId, resolution, resolvedBy });
      openList.value = openList.value.filter((o) => o.id !== objectionId);
    } catch (err) {
      console.error('Failed to resolve objection', err);
    }
  }

  return {
    openList,
    loading,
    openCount,
    fetchOpen,
    resolve,
  };
});
