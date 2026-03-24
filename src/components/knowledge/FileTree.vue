<script setup lang="ts">
import { ref } from 'vue';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

defineProps<{
  nodes: TreeNode[];
  depth?: number;
}>();

const emit = defineEmits<{
  select: [path: string];
}>();

const expanded = ref<Set<string>>(new Set());

function toggle(path: string) {
  if (expanded.value.has(path)) {
    expanded.value.delete(path);
  } else {
    expanded.value.add(path);
  }
}

function isExpanded(path: string) {
  return expanded.value.has(path);
}

function getIcon(node: TreeNode): string {
  if (node.type === 'directory') {
    return isExpanded(node.path) ? '📂' : '📁';
  }
  if (node.name.endsWith('.md')) return '📄';
  if (node.name.endsWith('.json')) return '📋';
  if (node.name.endsWith('.yaml') || node.name.endsWith('.yml')) return '📋';
  return '📄';
}
</script>

<template>
  <div>
    <div
      v-for="node in nodes"
      :key="node.path"
    >
      <div
        class="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition-colors hover:bg-bg-hover"
        :style="{ paddingLeft: `${((depth || 0) * 16) + 8}px` }"
        @click="node.type === 'directory' ? toggle(node.path) : emit('select', node.path)"
      >
        <span class="w-4 text-center text-xs">{{ getIcon(node) }}</span>
        <span
          class="truncate"
          :class="node.type === 'directory' ? 'font-medium text-text-primary' : 'text-text-secondary'"
        >
          {{ node.name }}
        </span>
      </div>

      <FileTree
        v-if="node.type === 'directory' && node.children && isExpanded(node.path)"
        :nodes="node.children"
        :depth="(depth || 0) + 1"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
