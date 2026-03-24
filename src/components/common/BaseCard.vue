<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<template>
  <div class="rounded-xl border border-border-default bg-bg-card p-5">
    <div v-if="title || $slots.header" class="mb-4 flex items-center justify-between">
      <h3 v-if="title" class="text-sm font-semibold">{{ title }}</h3>
      <slot name="header" />
    </div>
    <slot />
  </div>
</template>
