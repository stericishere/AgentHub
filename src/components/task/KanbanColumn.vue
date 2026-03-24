<script setup lang="ts">
import { ref } from 'vue';
import TaskCard from './TaskCard.vue';
import type { TaskRecord } from '../../stores/tasks';

const props = defineProps<{
  label: string;
  status: string;
  tasks: TaskRecord[];
  dragSourceStatus?: string | null;
  isValidTarget?: boolean;
}>();

const emit = defineEmits<{
  drop: [taskId: string, toStatus: string];
  'task-click': [taskId: string];
  'card-dragstart': [payload: { taskId: string; fromStatus: string }];
}>();

const isDragOver = ref(false);

function onDragOver(e: DragEvent) {
  e.preventDefault();
  // Set appropriate drop effect based on validity
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = props.isValidTarget === false ? 'none' : 'move';
  }
  isDragOver.value = true;
}

function onDragLeave(e: DragEvent) {
  // Only clear if we actually left the column (not just moved to a child element)
  const related = e.relatedTarget as Node | null;
  if (related && (e.currentTarget as HTMLElement).contains(related)) return;
  isDragOver.value = false;
}

function onDrop(e: DragEvent, status: string) {
  e.preventDefault();
  isDragOver.value = false;
  const taskId = e.dataTransfer?.getData('text/plain');
  if (taskId) {
    emit('drop', taskId, status);
  }
}

// Compute column border + background class while a drag is in progress
function getDragClass(): string {
  if (!isDragOver.value || props.dragSourceStatus == null) return '';
  if (props.isValidTarget === false) {
    return 'border-danger/60 bg-danger/5 cursor-not-allowed';
  }
  return 'border-success/60 bg-success/5';
}
</script>

<template>
  <div
    class="flex min-w-[220px] flex-1 flex-col rounded-xl border border-transparent bg-bg-secondary p-3 transition-colors"
    :class="getDragClass()"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop($event, status)"
  >
    <div class="mb-3 flex items-center justify-between">
      <span class="text-sm font-semibold text-text-secondary">{{ label }}</span>
      <span class="rounded-full bg-bg-hover px-2 py-0.5 text-[11px] text-text-muted">
        {{ tasks.length }}
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-2">
      <TaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        @click="emit('task-click', $event)"
        @dragstart="emit('card-dragstart', $event)"
      />

      <div
        v-if="tasks.length === 0"
        class="flex-1 rounded-lg border border-dashed py-8 text-center text-[11px] transition-colors"
        :class="
          isDragOver && dragSourceStatus != null
            ? isValidTarget === false
              ? 'border-danger/40 text-danger/60'
              : 'border-success/40 text-success/60'
            : 'border-border-default text-text-muted'
        "
      >
        <template v-if="isDragOver && dragSourceStatus != null && isValidTarget === false">
          無效的狀態轉換
        </template>
        <template v-else>
          拖曳任務至此
        </template>
      </div>
    </div>
  </div>
</template>
