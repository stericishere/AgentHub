<script setup lang="ts">
defineProps<{
  show: boolean;
  title?: string;
  /** 寬度 class，預設 w-[500px] */
  width?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="emit('close')"
      >
        <div
          class="overflow-hidden rounded-2xl border border-border-light bg-bg-card shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          :class="width || 'w-[500px]'"
        >
          <div v-if="title" class="flex items-center justify-between border-b border-border-default px-5 py-4">
            <h3 class="text-sm font-semibold">{{ title }}</h3>
            <button
              class="cursor-pointer border-none bg-transparent text-text-muted hover:text-text-primary"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>
          <div class="p-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="border-t border-border-default px-5 py-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
