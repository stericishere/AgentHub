import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useIpc } from '../composables/useIpc';

export const useSettingsStore = defineStore('settings', () => {
  const { getSetting, updateSetting, getAllSettings } = useIpc();

  const preferences = ref<Record<string, string>>({});
  const loading = ref(false);

  async function fetchAll() {
    loading.value = true;
    try {
      preferences.value = (await getAllSettings()) as Record<string, string>;
    } catch (e) {
      console.error('Failed to fetch settings', e);
    } finally {
      loading.value = false;
    }
  }

  async function get(key: string): Promise<string | null> {
    if (preferences.value[key] !== undefined) return preferences.value[key];
    return getSetting(key);
  }

  async function update(key: string, value: string, category?: string) {
    await updateSetting({ key, value, category });
    preferences.value[key] = value;
  }

  function getLocal(key: string, defaultValue: string = ''): string {
    return preferences.value[key] ?? defaultValue;
  }

  return {
    preferences,
    loading,
    fetchAll,
    get,
    update,
    getLocal,
  };
});
