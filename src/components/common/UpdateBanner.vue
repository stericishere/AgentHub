<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import BaseButton from './BaseButton.vue';

const updateAvailable = ref(false);
const updateVersion = ref('');
const updateDownloaded = ref(false);
const downloadProgress = ref(0);
const dismissed = ref(false);

function onUpdateAvailable(_e: unknown, data: { version: string }) {
  updateAvailable.value = true;
  updateVersion.value = data.version;
}

function onUpdateProgress(_e: unknown, data: { percent: number }) {
  downloadProgress.value = Math.round(data.percent);
}

function onUpdateDownloaded() {
  updateDownloaded.value = true;
}

onMounted(() => {
  if (window.maestro?.on) {
    // These events are sent from updater-service
    const ipcRenderer = (window as any).__ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.on('update:available', onUpdateAvailable);
      ipcRenderer.on('update:progress', onUpdateProgress);
      ipcRenderer.on('update:downloaded', onUpdateDownloaded);
    }
  }
});

function dismiss() {
  dismissed.value = true;
}
</script>

<template>
  <div
    v-if="updateAvailable && !dismissed"
    class="flex items-center gap-3 border-b border-accent/30 bg-accent/10 px-6 py-2"
  >
    <span class="text-xs font-medium text-accent-light">
      <template v-if="updateDownloaded">
        Maestro {{ updateVersion }} 已下載完成！重啟即可更新。
      </template>
      <template v-else-if="downloadProgress > 0">
        正在下載 Maestro {{ updateVersion }}... {{ downloadProgress }}%
      </template>
      <template v-else>
        Maestro {{ updateVersion }} 可用
      </template>
    </span>

    <div class="ml-auto flex items-center gap-2">
      <BaseButton
        v-if="updateDownloaded"
        variant="primary"
        size="sm"
      >
        重啟更新
      </BaseButton>
      <BaseButton
        v-else-if="downloadProgress === 0"
        variant="primary"
        size="sm"
      >
        下載更新
      </BaseButton>
      <button
        class="cursor-pointer border-none bg-transparent text-xs text-text-muted hover:text-text-primary"
        @click="dismiss"
      >
        ✕
      </button>
    </div>
  </div>
</template>
