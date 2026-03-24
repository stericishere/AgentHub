<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useObjectionsStore } from '../../stores/objections';
import BaseButton from '../common/BaseButton.vue';
import BaseTag from '../common/BaseTag.vue';

const store = useObjectionsStore();
const resolvingId = ref<string | null>(null);
const resolutionText = ref('');

onMounted(() => {
  store.fetchOpen();
});

const severityColor: Record<string, 'red' | 'yellow' | 'blue' | 'purple'> = {
  critical: 'red',
  high: 'red',
  medium: 'yellow',
  low: 'blue',
};

const severityLabel: Record<string, string> = {
  critical: '嚴重',
  high: '高',
  medium: '中',
  low: '低',
};

function startResolve(id: string) {
  resolvingId.value = id;
  resolutionText.value = '';
}

async function submitResolve(id: string) {
  if (!resolutionText.value.trim()) return;
  await store.resolve(id, resolutionText.value.trim());
  resolvingId.value = null;
  resolutionText.value = '';
}

function cancelResolve() {
  resolvingId.value = null;
  resolutionText.value = '';
}
</script>

<template>
  <div class="rounded-xl border border-border-default bg-bg-card p-4">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">異議處理</h3>
      <span
        v-if="store.openCount > 0"
        class="rounded-full bg-danger/20 px-2 py-0.5 text-[11px] font-medium text-danger"
      >
        {{ store.openCount }}
      </span>
    </div>

    <div v-if="store.loading" class="py-4 text-center text-xs text-text-muted">載入中...</div>

    <div v-else-if="store.openList.length === 0" class="py-4 text-center text-xs text-text-muted">
      無待處理異議
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="obj in store.openList"
        :key="obj.id"
        class="rounded-lg border border-border-default bg-bg-primary p-3"
      >
        <div class="mb-1.5 flex items-center gap-2">
          <BaseTag :color="severityColor[obj.severity]" class="!text-[10px]">
            {{ severityLabel[obj.severity] || obj.severity }}
          </BaseTag>
          <span class="text-xs font-medium">{{ obj.from_agent }}</span>
          <span class="text-[11px] text-text-muted">→</span>
          <span class="text-xs font-medium">{{ obj.to_agent }}</span>
        </div>
        <p class="mb-2 text-xs text-text-secondary">{{ obj.reason }}</p>

        <!-- Resolve form -->
        <div v-if="resolvingId === obj.id" class="mt-2 space-y-2">
          <textarea
            v-model="resolutionText"
            rows="2"
            class="w-full resize-none rounded-lg border border-border-default bg-bg-hover px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            placeholder="輸入解決方案..."
          />
          <div class="flex gap-1.5">
            <BaseButton variant="success" size="sm" @click="submitResolve(obj.id)">
              確認解決
            </BaseButton>
            <BaseButton variant="ghost" size="sm" @click="cancelResolve">取消</BaseButton>
          </div>
        </div>
        <div v-else>
          <BaseButton variant="ghost" size="sm" @click="startResolve(obj.id)">
            處理異議
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
