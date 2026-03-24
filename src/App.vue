<script setup lang="ts">
import { onMounted, onErrorCaptured, getCurrentInstance } from 'vue';
import MainLayout from './layouts/MainLayout.vue';
import ErrorToast from './components/common/ErrorToast.vue';
import ToastContainer from './components/common/ToastContainer.vue';
import { useSessionsStore } from './stores/sessions';
import { useAgentsStore } from './stores/agents';
import { useProjectsStore } from './stores/projects';
import { useGatesStore } from './stores/gates';
import { useCostsStore } from './stores/costs';
import { useSettingsStore } from './stores/settings';
import { useUiStore } from './stores/ui';
import { useAuthStore } from './stores/auth';

const sessionsStore = useSessionsStore();
const agentsStore = useAgentsStore();
const projectsStore = useProjectsStore();
const gatesStore = useGatesStore();
const costsStore = useCostsStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const authStore = useAuthStore();

// Global error handler
onErrorCaptured((err) => {
  uiStore.addError(err.message || 'An unexpected error occurred');
  return false;
});

// Register global app error handler
const app = getCurrentInstance()?.appContext.app;
if (app) {
  app.config.errorHandler = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    uiStore.addError(message);
  };
}

onMounted(async () => {
  // Initialize theme
  uiStore.initTheme();

  // Initialize stores
  await Promise.all([
    agentsStore.fetchAll(),
    agentsStore.fetchDepartments(),
    sessionsStore.fetchActive(),
    sessionsStore.fetchHistory(),
    projectsStore.fetchAll(),
    costsStore.fetchOverview(),
    gatesStore.fetchChecklists(),
    settingsStore.fetchAll(),
    authStore.checkStatus(),
  ]);

  // Fetch ALL gates (cross-project) for sidebar badge
  gatesStore.fetchGates();

  // Setup real-time listeners
  sessionsStore.setupListeners();
});
</script>

<template>
  <MainLayout />
  <ErrorToast />
  <ToastContainer />
</template>
