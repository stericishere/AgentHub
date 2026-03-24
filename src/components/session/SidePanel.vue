<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import type { ActiveSession, SessionRecord } from '../../stores/sessions';
import { useGitStore } from '../../stores/git';
import { useIpc } from '../../composables/useIpc';
import { formatTokens } from '../../utils/format-tokens';
const DiffViewer = defineAsyncComponent(() => import('../diff/DiffViewer.vue'));
import BaseButton from '../common/BaseButton.vue';

type PanelSession = ActiveSession | SessionRecord;

const props = defineProps<{
  session: PanelSession;
}>();

const emit = defineEmits<{
  close: [];
}>();

const ipc = useIpc();
const gitStore = useGitStore();
const activeTab = ref<'diff' | 'output' | 'cost' | 'summary' | 'git'>('diff');
const inlineMode = ref(false);
const logContent = ref('');
const logLoading = ref(false);

// Git tab state
const commitMessage = ref('');
const selectedFiles = ref<Set<string>>(new Set());
const newBranchName = ref('');
const gitOperating = ref(false);
const gitResult = ref<string | null>(null);

const tabs = [
  { key: 'diff', label: 'Diff' },
  { key: 'output', label: '輸出' },
  { key: 'cost', label: '用量' },
  { key: 'summary', label: '摘要' },
  { key: 'git', label: 'Git' },
] as const;

/** Helper to detect if session is an ActiveSession (has sessionId) or SessionRecord (has id) */
function isActiveSession(s: PanelSession): s is ActiveSession {
  return 'sessionId' in s;
}

const sessionId = computed(() =>
  isActiveSession(props.session) ? props.session.sessionId : props.session.id,
);

const agentName = computed(() =>
  isActiveSession(props.session) ? props.session.agentName : props.session.agent_id,
);

const taskText = computed(() => props.session.task);

const costUsd = computed(() =>
  isActiveSession(props.session) ? props.session.costUsd : (props.session.cost_usd || 0),
);

const inputTokens = computed(() =>
  isActiveSession(props.session) ? props.session.inputTokens : (props.session.input_tokens || 0),
);

const outputTokens = computed(() =>
  isActiveSession(props.session) ? props.session.outputTokens : (props.session.output_tokens || 0),
);

const turnsCount = computed(() =>
  isActiveSession(props.session) ? props.session.turnsCount : (props.session.turns_count || 0),
);

const toolCallsCount = computed(() =>
  isActiveSession(props.session) ? props.session.toolCallsCount : 0,
);

const resultSummary = computed(() =>
  isActiveSession(props.session) ? undefined : props.session.result_summary,
);

const sessionCwd = computed(() => {
  if (isActiveSession(props.session) && props.session.workDir) return props.session.workDir;
  return process.cwd?.() || 'C:\\';
});

onMounted(async () => {
  await gitStore.fetchDiff(sessionCwd.value);
});

watch(
  () => gitStore.diffEntries,
  (entries) => {
    if (entries.length > 0 && !gitStore.selectedFile) {
      selectFile(entries[0].file);
    }
  },
);

// Load log content when output tab is selected, refresh git data for git tab
watch(activeTab, async (tab) => {
  if (tab === 'output' && !logContent.value) {
    await loadLog();
  }
  if (tab === 'git') {
    await refreshGitData();
  }
});

async function refreshGitData() {
  const cwd = sessionCwd.value;
  await Promise.all([
    gitStore.fetchStatus(cwd),
    gitStore.fetchDiff(cwd),
    gitStore.fetchBranches(cwd),
    gitStore.fetchLog(cwd, 10),
  ]);
  // Auto-select all changed files
  const allFiles = [
    ...(gitStore.status?.staged || []),
    ...(gitStore.status?.modified || []),
    ...(gitStore.status?.untracked || []),
  ];
  selectedFiles.value = new Set(allFiles);
}

function toggleFile(file: string) {
  const s = new Set(selectedFiles.value);
  if (s.has(file)) s.delete(file);
  else s.add(file);
  selectedFiles.value = s;
}

function selectAllFiles() {
  const allFiles = [
    ...(gitStore.status?.staged || []),
    ...(gitStore.status?.modified || []),
    ...(gitStore.status?.untracked || []),
  ];
  selectedFiles.value = new Set(allFiles);
}

function deselectAllFiles() {
  selectedFiles.value = new Set();
}

async function handleCommit() {
  if (!commitMessage.value.trim()) return;
  gitOperating.value = true;
  gitResult.value = null;
  try {
    const files = [...selectedFiles.value];
    const result = await gitStore.commit(sessionCwd.value, commitMessage.value, files);
    gitResult.value = `Committed ${result.hash.slice(0, 7)}: ${result.filesChanged} files`;
    commitMessage.value = '';
  } catch (err: any) {
    gitResult.value = `Commit failed: ${err.message}`;
  } finally {
    gitOperating.value = false;
  }
}

async function handlePush() {
  gitOperating.value = true;
  gitResult.value = null;
  try {
    const result = await gitStore.push(sessionCwd.value, 'origin', undefined, true);
    gitResult.value = `Pushed to ${result.remote}/${result.branch}`;
  } catch (err: any) {
    gitResult.value = `Push failed: ${err.message}`;
  } finally {
    gitOperating.value = false;
  }
}

async function handlePull() {
  gitOperating.value = true;
  gitResult.value = null;
  try {
    const result = await gitStore.pull(sessionCwd.value);
    gitResult.value = result.summary;
  } catch (err: any) {
    gitResult.value = `Pull failed: ${err.message}`;
  } finally {
    gitOperating.value = false;
  }
}

async function handleCreateBranch() {
  if (!newBranchName.value.trim()) return;
  gitOperating.value = true;
  try {
    await gitStore.createBranch(sessionCwd.value, newBranchName.value.trim());
    newBranchName.value = '';
    gitResult.value = null;
  } catch (err: any) {
    gitResult.value = `Branch failed: ${err.message}`;
  } finally {
    gitOperating.value = false;
  }
}

async function handleCheckout(branchName: string) {
  gitOperating.value = true;
  try {
    await gitStore.checkoutBranch(sessionCwd.value, branchName);
    gitResult.value = null;
  } catch (err: any) {
    gitResult.value = `Checkout failed: ${err.message}`;
  } finally {
    gitOperating.value = false;
  }
}

async function handleDeleteBranch(branchName: string) {
  gitOperating.value = true;
  try {
    await gitStore.deleteBranch(sessionCwd.value, branchName);
    gitResult.value = null;
  } catch (err: any) {
    gitResult.value = `Delete failed: ${err.message}`;
  } finally {
    gitOperating.value = false;
  }
}

async function loadLog() {
  logLoading.value = true;
  try {
    logContent.value = await ipc.getSessionLog(sessionId.value);
  } catch (err) {
    logContent.value = '無法載入工作階段紀錄';
  } finally {
    logLoading.value = false;
  }
}

async function selectFile(file: string) {
  const cwd = gitStore.currentCwd || process.cwd?.() || 'C:\\';
  await gitStore.fetchFileDiff(cwd, file);
}
</script>

<template>
  <div
    class="flex w-[500px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border-default bg-bg-card shadow-xl"
    style="animation: slideInRight 200ms ease-out"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border-default px-4 py-2.5">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">{{ agentName }}</span>
        <span class="text-xs text-text-muted">{{ taskText.slice(0, 40) }}...</span>
      </div>
      <button
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-text-muted hover:bg-bg-hover hover:text-text-primary"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-border-default">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex-1 cursor-pointer border-b-2 border-none bg-transparent px-3 py-2 text-xs font-medium transition-colors"
        :class="
          activeTab === tab.key
            ? 'border-b-accent text-accent-light'
            : 'border-b-transparent text-text-muted hover:text-text-primary'
        "
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-hidden">
      <!-- Diff tab -->
      <div v-if="activeTab === 'diff'" class="flex h-full flex-col">
        <!-- File list -->
        <div class="border-b border-border-default p-2">
          <div class="flex items-center justify-between px-1 pb-1">
            <span class="text-[11px] text-text-muted">
              {{ gitStore.diffEntries.length }} 個變更檔案
            </span>
            <button
              class="cursor-pointer border-none bg-transparent text-[11px] text-text-muted hover:text-text-primary"
              @click="inlineMode = !inlineMode"
            >
              {{ inlineMode ? 'Split' : 'Inline' }}
            </button>
          </div>
          <div class="max-h-[120px] space-y-0.5 overflow-y-auto">
            <button
              v-for="entry in gitStore.diffEntries"
              :key="entry.file"
              class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors"
              :class="
                gitStore.selectedFile === entry.file
                  ? 'bg-accent/10 text-accent-light'
                  : 'bg-transparent text-text-secondary hover:bg-bg-hover'
              "
              @click="selectFile(entry.file)"
            >
              <span
                class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                :class="{
                  'bg-success': entry.status === 'added',
                  'bg-warning': entry.status === 'modified',
                  'bg-danger': entry.status === 'deleted',
                  'bg-info': entry.status === 'renamed',
                }"
              />
              <span class="min-w-0 flex-1 truncate">{{ entry.file }}</span>
              <span class="text-[10px] text-success">+{{ entry.insertions }}</span>
              <span class="text-[10px] text-danger">-{{ entry.deletions }}</span>
            </button>
          </div>
        </div>

        <!-- Monaco diff editor -->
        <div class="flex-1">
          <DiffViewer
            v-if="gitStore.fileDiff"
            :original="gitStore.fileDiff.original"
            :modified="gitStore.fileDiff.modified"
            :filename="gitStore.selectedFile || undefined"
            :inline="inlineMode"
          />
          <div v-else class="flex h-full items-center justify-center text-xs text-text-muted">
            選擇檔案查看差異
          </div>
        </div>
      </div>

      <!-- Output tab -->
      <div v-else-if="activeTab === 'output'" class="h-full overflow-y-auto bg-bg-primary p-4">
        <div v-if="logLoading" class="flex h-full items-center justify-center text-xs text-text-muted">
          載入中...
        </div>
        <pre
          v-else-if="logContent"
          class="whitespace-pre-wrap break-all font-mono text-xs text-text-secondary"
        >{{ logContent }}</pre>
        <div v-else class="flex h-full items-center justify-center text-xs text-text-muted">
          尚無輸出紀錄
        </div>
      </div>

      <!-- Cost tab -->
      <div v-else-if="activeTab === 'cost'" class="h-full overflow-y-auto p-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-text-secondary">總 Token 用量</span>
            <span class="font-medium">{{ formatTokens(inputTokens + outputTokens) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-text-secondary">輸入 Tokens</span>
            <span class="font-medium">{{ formatTokens(inputTokens) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-text-secondary">輸出 Tokens</span>
            <span class="font-medium">{{ formatTokens(outputTokens) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-text-secondary">工具呼叫</span>
            <span class="font-medium">{{ toolCallsCount }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-text-secondary">回合數</span>
            <span class="font-medium">{{ turnsCount }}</span>
          </div>
          <div class="mt-2 border-t border-border-default pt-3">
            <div class="flex items-center justify-between text-xs text-text-muted">
              <span>參考成本 (USD)</span>
              <span>${{ costUsd.toFixed(4) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary tab -->
      <div v-else-if="activeTab === 'summary'" class="h-full overflow-y-auto p-4">
        <pre
          v-if="resultSummary"
          class="whitespace-pre-wrap break-words text-xs text-text-secondary"
        >{{ resultSummary }}</pre>
        <p v-else class="text-xs text-text-muted">
          尚無工作摘要
        </p>
      </div>

      <!-- Git tab -->
      <div v-else-if="activeTab === 'git'" class="h-full overflow-y-auto p-4">
        <div class="space-y-4">
          <!-- Branch info -->
          <div v-if="gitStore.status" class="rounded-lg border border-border-default bg-bg-primary p-3">
            <div class="flex items-center gap-2">
              <span class="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs text-white">&#9741;</span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold">{{ gitStore.status.branch }}</div>
                <div class="text-[11px] text-text-muted">&#8594; origin</div>
              </div>
              <div class="flex gap-1.5">
                <span v-if="gitStore.status.ahead > 0" class="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                  &#8593; {{ gitStore.status.ahead }}
                </span>
                <span v-if="gitStore.status.behind > 0" class="rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-medium text-info">
                  &#8595; {{ gitStore.status.behind }}
                </span>
              </div>
            </div>
          </div>

          <!-- Changed files -->
          <div>
            <div class="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <span>變更檔案</span>
              <span class="rounded-full bg-bg-hover px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal">
                {{ (gitStore.status?.modified.length || 0) + (gitStore.status?.untracked.length || 0) + (gitStore.status?.staged.length || 0) }}
              </span>
            </div>
            <div class="overflow-hidden rounded-lg border border-border-default">
              <div
                v-for="file in [...(gitStore.status?.staged || []), ...(gitStore.status?.modified || []), ...(gitStore.status?.untracked || [])]"
                :key="file"
                class="flex cursor-pointer items-center gap-2 border-b border-border-default px-3 py-2 text-xs last:border-b-0 hover:bg-bg-hover"
                @click="toggleFile(file)"
              >
                <span
                  class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[10px]"
                  :class="selectedFiles.has(file) ? 'bg-accent text-white' : 'border border-border-default'"
                >
                  <span v-if="selectedFiles.has(file)">&#10003;</span>
                </span>
                <span
                  class="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded text-[10px] font-bold"
                  :class="{
                    'bg-warning/15 text-warning': gitStore.status?.modified.includes(file),
                    'bg-success/15 text-success': gitStore.status?.untracked.includes(file),
                    'bg-info/15 text-info': gitStore.status?.staged.includes(file) && !gitStore.status?.modified.includes(file),
                  }"
                >
                  {{ gitStore.status?.untracked.includes(file) ? 'A' : gitStore.status?.staged.includes(file) && !gitStore.status?.modified.includes(file) ? 'S' : 'M' }}
                </span>
                <span class="min-w-0 flex-1 truncate font-mono text-[11px]">{{ file }}</span>
              </div>
              <div v-if="(gitStore.status?.modified.length || 0) + (gitStore.status?.untracked.length || 0) + (gitStore.status?.staged.length || 0) === 0"
                class="px-3 py-3 text-center text-[11px] text-text-muted">
                沒有變更的檔案
              </div>
              <div class="flex gap-2 border-t border-border-default bg-bg-secondary px-3 py-1.5">
                <button class="border-none bg-transparent text-[11px] text-accent-light hover:underline" @click="selectAllFiles">全選</button>
                <button class="border-none bg-transparent text-[11px] text-accent-light hover:underline" @click="deselectAllFiles">取消全選</button>
                <span class="ml-auto text-[10px] text-text-muted">{{ selectedFiles.size }} 已選</span>
              </div>
            </div>
          </div>

          <!-- Commit message -->
          <div>
            <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">提交訊息</div>
            <textarea
              v-model="commitMessage"
              class="w-full resize-y rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              placeholder="feat: describe your changes..."
              rows="2"
              style="min-height: 40px; max-height: 120px"
            />
          </div>

          <!-- Main actions -->
          <div class="flex gap-2">
            <BaseButton
              class="flex-1"
              :disabled="gitOperating || !commitMessage.trim() || selectedFiles.size === 0"
              @click="handleCommit"
            >
              &#10003; Commit
            </BaseButton>
            <BaseButton
              variant="success"
              :disabled="gitOperating"
              @click="handlePush"
            >
              &#8593; Push
            </BaseButton>
            <BaseButton
              variant="secondary"
              :disabled="gitOperating"
              @click="handlePull"
            >
              &#8595; Pull
            </BaseButton>
          </div>

          <!-- Result message -->
          <div v-if="gitResult" class="rounded-lg border px-3 py-2 text-xs"
            :class="gitResult.includes('failed') ? 'border-danger/30 bg-danger/10 text-danger' : 'border-success/30 bg-success/10 text-success'"
          >
            {{ gitResult }}
          </div>

          <!-- Branch manager -->
          <div>
            <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">分支管理</div>
            <div class="mb-2 flex gap-2">
              <input
                v-model="newBranchName"
                class="flex-1 rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 font-mono text-[11px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
                placeholder="新分支名稱..."
                @keyup.enter="handleCreateBranch"
              />
              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="gitOperating || !newBranchName.trim()"
                @click="handleCreateBranch"
              >
                建立
              </BaseButton>
            </div>
            <div class="overflow-hidden rounded-lg border border-border-default">
              <div
                v-for="branch in gitStore.branches?.all || []"
                :key="branch"
                class="flex cursor-pointer items-center gap-2 border-b border-border-default px-3 py-2 text-xs last:border-b-0 hover:bg-bg-hover"
                :class="{ 'bg-bg-active': branch === gitStore.branches?.current }"
                @click="branch !== gitStore.branches?.current && handleCheckout(branch.replace('remotes/', ''))"
              >
                <span
                  class="h-3 w-3 flex-shrink-0 rounded-full border-2"
                  :class="branch === gitStore.branches?.current ? 'border-accent bg-accent shadow-[inset_0_0_0_2px_var(--bg-card)]' : 'border-border-default'"
                />
                <span class="min-w-0 flex-1 truncate font-mono text-[11px]">{{ branch.replace('remotes/origin/', '') }}</span>
                <span v-if="branch === gitStore.branches?.current" class="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent-light">
                  current
                </span>
                <button
                  v-if="branch !== gitStore.branches?.current && !branch.startsWith('remotes/')"
                  class="flex h-5 w-5 items-center justify-center rounded border-none bg-transparent text-[11px] text-text-muted opacity-0 hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
                  style="opacity: 0; transition: opacity 0.1s"
                  @click.stop="handleDeleteBranch(branch)"
                  @mouseenter="($event.target as HTMLElement).style.opacity = '1'"
                  @mouseleave="($event.target as HTMLElement).style.opacity = '0'"
                >
                  &#128465;
                </button>
              </div>
            </div>
          </div>

          <!-- Recent commits -->
          <div v-if="gitStore.commits.length > 0">
            <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">最近提交</div>
            <div class="overflow-hidden rounded-lg border border-border-default">
              <div
                v-for="c in gitStore.commits.slice(0, 5)"
                :key="c.hash"
                class="border-b border-border-default px-3 py-2 last:border-b-0"
              >
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[10px] text-accent-light">{{ c.hash.slice(0, 7) }}</span>
                  <span class="min-w-0 flex-1 truncate text-[11px] text-text-secondary">{{ c.message }}</span>
                </div>
                <div class="mt-0.5 text-[10px] text-text-muted">{{ c.author }} &middot; {{ c.date.slice(0, 10) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
