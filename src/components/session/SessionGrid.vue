<script setup lang="ts">
import { computed } from 'vue';
import SessionCard from './SessionCard.vue';
import type { ActiveSession, LayoutMode } from '../../stores/sessions';

const props = defineProps<{
  sessions: ActiveSession[];
  layout: LayoutMode;
  selectedSessionId: string | null;
}>();

const emit = defineEmits<{
  select: [sessionId: string];
  stop: [sessionId: string];
  remix: [session: ActiveSession];
  openDiff: [session: ActiveSession];
  navigateToTask: [taskId: string];
  delegation: [session: ActiveSession];
  assignTask: [session: ActiveSession];
  requestSummary: [session: ActiveSession];
}>();

const gridClass = computed(() => {
  switch (props.layout) {
    case 'single':
      return 'grid-cols-1';
    case 'dual':
      return 'grid-cols-2';
    case 'triple':
      return 'grid-cols-3';
    case 'list':
    default:
      return 'grid-cols-1';
  }
});

const isCompact = computed(() => props.layout === 'list');
</script>

<template>
  <div v-if="sessions.length === 0" class="rounded-xl border border-border-default bg-bg-card p-8 text-center text-text-muted">
    尚未有執行中的工作階段
  </div>

  <div v-else class="grid gap-4" :class="gridClass">
    <SessionCard
      v-for="session in sessions"
      :key="session.sessionId"
      :session="session"
      :selected="session.sessionId === selectedSessionId"
      :compact="isCompact"
      @select="emit('select', $event)"
      @stop="emit('stop', $event)"
      @remix="emit('remix', $event)"
      @open-diff="emit('openDiff', $event)"
      @navigate-to-task="emit('navigateToTask', $event)"
      @delegation="emit('delegation', $event)"
      @assign-task="emit('assignTask', $event)"
      @request-summary="emit('requestSummary', $event)"
    />
  </div>
</template>
