<script setup lang="ts">
import { computed, ref } from 'vue';
import BaseTag from '../common/BaseTag.vue';
import type { TaskRecord } from '../../stores/tasks';
import { useTasksStore } from '../../stores/tasks';
import { useAgentsStore } from '../../stores/agents';

const props = defineProps<{
  task: TaskRecord;
}>();

const emit = defineEmits<{
  click: [taskId: string];
  dragstart: [payload: { taskId: string; fromStatus: string }];
}>();

const tasksStore = useTasksStore();
const agentsStore = useAgentsStore();

const isDragging = ref(false);

const hasActiveSession = computed(() => {
  const counts = tasksStore.sessionCounts[props.task.id];
  return counts && counts.active > 0;
});

const priorityColor = computed(() => {
  const map: Record<string, string> = {
    critical: 'border-l-danger',
    high: 'border-l-warning',
    medium: 'border-l-info',
    low: 'border-l-text-muted',
  };
  return map[props.task.priority] || map.medium;
});

const priorityLabel: Record<string, string> = {
  critical: '緊急',
  high: '高',
  medium: '中',
  low: '低',
};

const priorityTagColor = computed((): 'red' | 'yellow' | 'blue' | 'purple' => {
  const map: Record<string, 'red' | 'yellow' | 'blue' | 'purple'> = {
    critical: 'red',
    high: 'yellow',
    medium: 'blue',
    low: 'purple',
  };
  return map[props.task.priority] || 'blue';
});

function onDragStart(e: DragEvent) {
  e.dataTransfer!.setData('text/plain', props.task.id);
  e.dataTransfer!.effectAllowed = 'move';
  isDragging.value = true;
  emit('dragstart', { taskId: props.task.id, fromStatus: props.task.status });
}

function onDragEnd() {
  isDragging.value = false;
}
</script>

<template>
  <div
    class="cursor-pointer rounded-lg border-l-[3px] bg-bg-card p-3 transition-all hover:shadow-md"
    :class="[priorityColor, isDragging ? 'opacity-40' : 'opacity-100']"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="emit('click', task.id)"
  >
    <div class="mb-1.5 flex items-center gap-1.5">
      <span
        v-if="hasActiveSession"
        class="inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-success"
        title="有進行中的工作階段"
      />
      <span class="text-[13px] font-medium leading-tight">{{ task.title }}</span>
    </div>

    <div v-if="task.description" class="mb-2 line-clamp-2 text-[11px] text-text-muted">
      {{ task.description }}
    </div>

    <div class="flex items-center gap-1.5">
      <BaseTag :color="priorityTagColor" class="!text-[10px]">
        {{ priorityLabel[task.priority] || task.priority }}
      </BaseTag>

      <div v-if="task.assignedTo" class="ml-auto flex items-center gap-1">
        <span class="text-xs leading-none">{{ agentsStore.agentIcon(task.assignedTo) }}</span>
        <span class="max-w-[80px] truncate text-[10px] text-text-muted">
          {{ agentsStore.displayName(task.assignedTo) }}
        </span>
      </div>
    </div>

    <div v-if="task.dependsOn.length > 0" class="mt-1.5 text-[10px] text-text-muted/60">
      依賴 {{ task.dependsOn.length }} 項任務
    </div>
  </div>
</template>
