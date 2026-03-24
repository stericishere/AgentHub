<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAgentsStore } from '../../stores/agents';

const router = useRouter();
const agentsStore = useAgentsStore();

const show = ref(false);
const query = ref('');
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

interface CommandItem {
  id: string;
  label: string;
  description: string;
  category: 'page' | 'agent' | 'action';
  icon: string;
  action: () => void;
}

const pages: CommandItem[] = [
  { id: 'nav-dashboard', label: '儀表板', description: '總覽', category: 'page', icon: '▣', action: () => router.push('/') },
  { id: 'nav-sessions', label: '工作階段', description: '管理執行中的 Session', category: 'page', icon: '▶', action: () => router.push('/sessions') },
  { id: 'nav-agents', label: '代理人', description: '瀏覽所有代理人', category: 'page', icon: '☯', action: () => router.push('/agents') },
  { id: 'nav-projects', label: '專案管理', description: '管理專案', category: 'page', icon: '📁', action: () => router.push('/projects') },
  { id: 'nav-tasks', label: '任務看板', description: '看板視圖', category: 'page', icon: '☐', action: () => router.push('/tasks') },
  { id: 'nav-knowledge', label: '知識庫', description: '公司知識', category: 'page', icon: '📚', action: () => router.push('/knowledge') },
  { id: 'nav-costs', label: '成本分析', description: '費用追蹤', category: 'page', icon: '💰', action: () => router.push('/costs') },
  { id: 'nav-settings', label: '設定', description: '系統設定', category: 'page', icon: '⚙', action: () => router.push('/settings') },
];

const allItems = computed<CommandItem[]>(() => {
  const agentItems: CommandItem[] = agentsStore.agents.map((a) => ({
    id: `agent-${a.id}`,
    label: a.id,
    description: `${a.level} · ${a.department}`,
    category: 'agent' as const,
    icon: a.id.charAt(0).toUpperCase(),
    action: () => router.push({ name: 'agent-detail', params: { id: a.id } }),
  }));

  return [...pages, ...agentItems];
});

const filtered = computed(() => {
  if (!query.value.trim()) return allItems.value.slice(0, 15);

  const q = query.value.toLowerCase();
  return allItems.value
    .filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    )
    .slice(0, 15);
});

watch(query, () => {
  selectedIndex.value = 0;
});

function open() {
  show.value = true;
  query.value = '';
  selectedIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
}

function close() {
  show.value = false;
}

function execute(item: CommandItem) {
  close();
  item.action();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const item = filtered.value[selectedIndex.value];
    if (item) execute(item);
  } else if (e.key === 'Escape') {
    close();
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (show.value) {
      close();
    } else {
      open();
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});

const categoryLabel: Record<string, string> = {
  page: '頁面',
  agent: '代理人',
  action: '指令',
};
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div
        v-if="show"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 pt-[15vh]"
        @click.self="close"
      >
        <div
          class="w-[560px] overflow-hidden rounded-2xl border border-border-light bg-bg-card shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <!-- Search input -->
          <div class="flex items-center gap-3 border-b border-border-default px-4 py-3">
            <span class="text-text-muted">🔍</span>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              placeholder="搜尋頁面、代理人、指令..."
              class="flex-1 border-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              @keydown="onKeydown"
            />
            <kbd class="rounded border border-border-light bg-bg-hover px-1.5 py-[1px] text-[11px] text-text-muted">
              ESC
            </kbd>
          </div>

          <!-- Results -->
          <div class="max-h-[400px] overflow-y-auto py-2">
            <div v-if="filtered.length === 0" class="px-4 py-6 text-center text-sm text-text-muted">
              找不到結果
            </div>

            <div
              v-for="(item, idx) in filtered"
              :key="item.id"
              class="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors"
              :class="idx === selectedIndex ? 'bg-bg-hover' : 'hover:bg-bg-hover/50'"
              @click="execute(item)"
              @mouseenter="selectedIndex = idx"
            >
              <span
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-bg-active text-xs"
              >
                {{ item.icon }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="text-sm">{{ item.label }}</div>
                <div class="text-xs text-text-muted">{{ item.description }}</div>
              </div>
              <span class="text-[10px] uppercase tracking-wider text-text-muted">
                {{ categoryLabel[item.category] || item.category }}
              </span>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-3 border-t border-border-default px-4 py-2 text-[11px] text-text-muted">
            <span><kbd class="font-mono">↑↓</kbd> 導覽</span>
            <span><kbd class="font-mono">Enter</kbd> 選擇</span>
            <span><kbd class="font-mono">Esc</kbd> 關閉</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-enter-active,
.palette-leave-active {
  transition: opacity 0.15s ease;
}
.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}
</style>
