<script setup lang="ts">
import { useUiStore } from '../../stores/ui';

const uiStore = useUiStore();
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
    <transition-group name="toast">
      <div
        v-for="error in uiStore.errors"
        :key="error.id"
        class="flex max-w-[360px] items-start gap-2 rounded-lg border border-danger/40 bg-bg-card px-4 py-3 shadow-lg"
        style="animation: slideInUp 200ms ease-out"
      >
        <span class="mt-0.5 flex-shrink-0 text-sm text-danger">!</span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-text-primary">Error</p>
          <p class="mt-0.5 text-xs text-text-secondary">{{ error.message }}</p>
        </div>
        <button
          class="flex-shrink-0 cursor-pointer border-none bg-transparent text-xs text-text-muted hover:text-text-primary"
          @click="uiStore.dismissError(error.id)"
        >
          ✕
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.toast-enter-active {
  animation: slideInUp 200ms ease-out;
}

.toast-leave-active {
  transition: all 200ms ease-in;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
