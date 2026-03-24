<script setup lang="ts">
const model = defineModel<boolean>({ default: false });
</script>

<template>
  <button
    role="switch"
    :aria-checked="model"
    class="relative h-6 w-11 cursor-pointer rounded-xl border-none transition-colors duration-200"
    :class="model ? 'bg-accent' : 'bg-bg-hover'"
    @click="model = !model"
  >
    <span
      class="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-200"
      :class="model ? 'translate-x-5' : 'translate-x-0'"
    />
  </button>
</template>
