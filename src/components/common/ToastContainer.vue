<script setup lang="ts">
import { useUiStore } from '../../stores/ui';

const uiStore = useUiStore();

const typeClasses: Record<string, string> = {
  error: 'border-danger/40 bg-danger/5 text-danger',
  success: 'border-green-500/40 bg-green-500/5 text-green-500',
  warning: 'border-yellow-500/40 bg-yellow-500/5 text-yellow-500',
  info: 'border-blue-500/40 bg-blue-500/5 text-blue-500',
};

const typeIcons: Record<string, string> = {
  error: '✕',
  success: '✓',
  warning: '!',
  info: 'i',
};
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2">
    <transition-group name="toast">
      <div
        v-for="toast in uiStore.toasts"
        :key="toast.id"
        class="flex max-w-[360px] items-start gap-2 rounded-lg border bg-bg-card px-4 py-3 shadow-lg"
        :class="typeClasses[toast.type]"
      >
        <span class="mt-0.5 flex-shrink-0 text-sm font-bold" :class="typeClasses[toast.type]">
          {{ typeIcons[toast.type] }}
        </span>
        <div class="min-w-0 flex-1">
          <p v-if="toast.title" class="text-xs font-bold text-text-primary">{{ toast.title }}</p>
          <p class="text-xs text-text-secondary" :class="{ 'mt-0.5': toast.title }">
            {{ toast.message }}
          </p>
        </div>
        <button
          class="flex-shrink-0 cursor-pointer border-none bg-transparent text-xs text-text-muted hover:text-text-primary"
          @click="uiStore.dismissToast(toast.id)"
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
