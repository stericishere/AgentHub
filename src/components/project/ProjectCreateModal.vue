<script setup lang="ts">
import { ref } from 'vue';
import BaseButton from '../common/BaseButton.vue';
import { useIpc } from '../../composables/useIpc';

const emit = defineEmits<{
  close: [];
  create: [params: { name: string; description: string; template: string; workDir: string }];
}>();

const ipc = useIpc();
const name = ref('');
const description = ref('');
const template = ref('blank');
const workDir = ref('');

const templates = [
  { value: 'blank', label: '空白專案' },
  { value: 'web-app', label: 'Web 應用' },
  { value: 'mobile-app', label: '行動應用' },
  { value: 'api-service', label: 'API 服務' },
  { value: 'library', label: '套件/函式庫' },
];

async function browseFolder() {
  const folder = await ipc.selectFolder();
  if (folder) workDir.value = folder;
}

function submit() {
  if (!name.value.trim() || !workDir.value.trim()) return;
  emit('create', {
    name: name.value.trim(),
    description: description.value.trim(),
    template: template.value,
    workDir: workDir.value.trim(),
  });
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="emit('close')"
  >
    <div class="w-[520px] rounded-xl border border-border-default bg-bg-secondary p-6">
      <h3 class="mb-4 text-base font-semibold">建立新專案</h3>

      <div class="mb-3">
        <label class="mb-1 block text-xs text-text-muted">專案名稱</label>
        <input
          v-model="name"
          class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          placeholder="我的新專案"
          @keydown.enter="submit"
        />
      </div>

      <div class="mb-3">
        <label class="mb-1 block text-xs text-text-muted">描述</label>
        <textarea
          v-model="description"
          class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          rows="3"
          placeholder="專案描述（選填）"
        />
      </div>

      <div class="mb-3">
        <label class="mb-1 block text-xs text-text-muted">工作目錄 <span class="text-red-400">*</span></label>
        <div class="flex gap-2">
          <input
            v-model="workDir"
            class="min-w-0 flex-1 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            placeholder="C:\projects\my-project"
            @keydown.enter="submit"
          />
          <BaseButton variant="ghost" size="sm" @click="browseFolder">瀏覽</BaseButton>
        </div>
        <p class="mt-1 text-[11px] text-text-muted">Session 將在此目錄下執行 Claude Code</p>
      </div>

      <div class="mb-5">
        <label class="mb-2 block text-xs text-text-muted">專案模板</label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="t in templates"
            :key="t.value"
            class="cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition-all"
            :class="
              template === t.value
                ? 'border-accent bg-accent/10 text-accent-light'
                : 'border-border-default bg-bg-primary text-text-secondary hover:border-border-light'
            "
            @click="template = t.value"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <BaseButton variant="ghost" size="sm" @click="emit('close')">取消</BaseButton>
        <BaseButton variant="primary" size="sm" @click="submit">建立專案</BaseButton>
      </div>
    </div>
  </div>
</template>
