<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useIpc } from '../composables/useIpc';
import FileTree from '../components/knowledge/FileTree.vue';
import MarkdownViewer from '../components/knowledge/MarkdownViewer.vue';
import type { TreeNode } from '../components/knowledge/FileTree.vue';

const { knowledgeListTree, knowledgeReadFile, knowledgeSearch } = useIpc();

const tree = ref<TreeNode[]>([]);
const selectedFile = ref<string | null>(null);
const fileContent = ref<string>('');
const searchQuery = ref('');
const searchResults = ref<Array<{ path: string; name: string; snippet: string }>>([]);
const loading = ref(false);

onMounted(async () => {
  tree.value = (await knowledgeListTree()) as TreeNode[];
});

async function selectFile(path: string) {
  selectedFile.value = path;
  loading.value = true;
  try {
    const content = await knowledgeReadFile(path);
    fileContent.value = content || '（空白檔案）';
  } catch (e) {
    fileContent.value = '讀取失敗';
  } finally {
    loading.value = false;
  }
}

async function doSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchResults.value = (await knowledgeSearch(searchQuery.value.trim())) as Array<{
    path: string;
    name: string;
    snippet: string;
  }>;
}
</script>

<template>
  <div class="flex h-full gap-0">
    <!-- Left: Tree + Search -->
    <div class="flex w-[260px] flex-shrink-0 flex-col border-r border-border-default">
      <div class="border-b border-border-default p-3">
        <h2 class="mb-2 text-sm font-semibold">知識庫</h2>
        <div class="relative">
          <input
            v-model="searchQuery"
            class="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            placeholder="搜尋知識庫..."
            @keydown.enter="doSearch"
          />
        </div>
      </div>

      <!-- Search results -->
      <div v-if="searchResults.length > 0" class="border-b border-border-default p-2">
        <div class="mb-1 text-[10px] font-semibold text-text-muted">搜尋結果</div>
        <div
          v-for="result in searchResults"
          :key="result.path"
          class="cursor-pointer rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-bg-hover"
          @click="selectFile(result.path)"
        >
          <div class="font-medium">{{ result.name }}</div>
          <div class="line-clamp-1 text-[11px] text-text-muted">{{ result.snippet }}</div>
        </div>
      </div>

      <!-- File tree -->
      <div class="flex-1 overflow-y-auto p-2">
        <FileTree
          v-if="tree.length > 0"
          :nodes="tree"
          @select="selectFile"
        />
        <div v-else class="py-4 text-center text-xs text-text-muted">
          載入中...
        </div>
      </div>
    </div>

    <!-- Right: Viewer -->
    <div class="flex-1 overflow-y-auto p-6">
      <div v-if="!selectedFile" class="flex h-full items-center justify-center text-sm text-text-muted">
        選擇一個檔案查看內容
      </div>

      <div v-else-if="loading" class="flex h-full items-center justify-center text-sm text-text-muted">
        載入中...
      </div>

      <MarkdownViewer
        v-else
        :content="fileContent"
        :file-path="selectedFile"
      />
    </div>
  </div>
</template>
