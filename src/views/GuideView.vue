<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useIpc } from '../composables/useIpc';

const { getHealth } = useIpc();
const claudeAvailable = ref(false);
const checking = ref(true);

onMounted(async () => {
  try {
    const health = await getHealth();
    claudeAvailable.value = !!(health as Record<string, unknown>)?.claudeCodeAvailable;
  } catch {
    claudeAvailable.value = false;
  }
  checking.value = false;
});
</script>

<template>
  <div>
    <h2 class="mb-6 text-xl font-semibold">使用說明</h2>

    <!-- Claude Code 狀態 -->
    <div
      class="mb-6 flex items-center gap-3 rounded-xl border px-5 py-4"
      :class="
        checking
          ? 'border-border-default bg-bg-card'
          : claudeAvailable
            ? 'border-success/30 bg-success/5'
            : 'border-warning/30 bg-warning/5'
      "
    >
      <span v-if="checking" class="h-5 w-5 animate-spin rounded-full border-2 border-text-muted border-t-transparent"></span>
      <span v-else-if="claudeAvailable" class="text-xl text-success">&#10003;</span>
      <span v-else class="text-xl text-warning">&#9888;</span>
      <div>
        <div class="text-sm font-semibold" :class="claudeAvailable ? 'text-success' : 'text-warning'">
          {{ checking ? '偵測中...' : claudeAvailable ? 'Claude Code CLI 已就緒' : 'Claude Code CLI 未安裝' }}
        </div>
        <div class="text-xs text-text-muted">
          {{ claudeAvailable ? 'Maestro 已偵測到 Claude Code，可以正常啟動工作階段。' : '請依照下方步驟安裝後重新啟動 Maestro。' }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- 左欄：快速開始 -->
      <div class="space-y-4">
        <!-- Step 1: 安裝 Claude Code -->
        <div class="rounded-xl border border-border-default bg-bg-card p-5">
          <div class="mb-3 flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-light">1</span>
            <h3 class="text-sm font-semibold">安裝 Claude Code CLI</h3>
          </div>
          <p class="mb-3 text-xs leading-relaxed text-text-secondary">
            Maestro 的核心功能依賴 Claude Code CLI。每個 Agent 都是透過 CLI 啟動的 Claude Code 工作階段。
          </p>
          <div class="mb-2 text-xs font-medium text-text-secondary">透過 npm 安裝（推薦）：</div>
          <div class="rounded-lg bg-bg-primary px-4 py-2.5 font-mono text-xs text-text-primary">
            npm install -g @anthropic-ai/claude-code
          </div>
          <div class="mt-3 text-[11px] leading-relaxed text-text-muted">
            需要 Node.js 18+。安裝完成後在終端機輸入 <code class="rounded bg-bg-hover px-1 py-0.5">claude --version</code> 驗證。
          </div>
        </div>

        <!-- Step 2: 登入認證 -->
        <div class="rounded-xl border border-border-default bg-bg-card p-5">
          <div class="mb-3 flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-light">2</span>
            <h3 class="text-sm font-semibold">登入 Claude Code</h3>
          </div>
          <p class="mb-3 text-xs leading-relaxed text-text-secondary">
            首次使用需要登入 Anthropic 帳號並綁定付費方案（Claude Pro / Max / Team）。
          </p>
          <div class="rounded-lg bg-bg-primary px-4 py-2.5 font-mono text-xs text-text-primary">
            claude login
          </div>
          <div class="mt-3 text-[11px] leading-relaxed text-text-muted">
            依照終端機指示完成瀏覽器授權。登入成功後 Claude Code 會自動記住認證。
          </div>
        </div>

        <!-- Step 3: 建立專案 -->
        <div class="rounded-xl border border-border-default bg-bg-card p-5">
          <div class="mb-3 flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-light">3</span>
            <h3 class="text-sm font-semibold">在 Maestro 建立專案</h3>
          </div>
          <p class="mb-3 text-xs leading-relaxed text-text-secondary">
            前往「專案」頁面建立新專案，指定工作目錄。Maestro 會自動產生 CLAUDE.md 設定檔。
          </p>
          <div class="space-y-2 text-xs text-text-secondary">
            <div class="flex items-start gap-2">
              <span class="mt-0.5 text-accent-light">&#8227;</span>
              <span>選擇專案模板（Web App / API / Library 等）</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-0.5 text-accent-light">&#8227;</span>
              <span>設定工作目錄路徑（Agent 將在此目錄內操作）</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-0.5 text-accent-light">&#8227;</span>
              <span>建立 Sprint 並規劃任務</span>
            </div>
          </div>
        </div>

        <!-- Step 4: 啟動 Agent -->
        <div class="rounded-xl border border-border-default bg-bg-card p-5">
          <div class="mb-3 flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-light">4</span>
            <h3 class="text-sm font-semibold">啟動工作階段</h3>
          </div>
          <p class="text-xs leading-relaxed text-text-secondary">
            前往「工作階段」頁面，選擇 Agent、專案、任務，然後啟動。Agent 會在 xterm.js 終端中即時執行。
          </p>
        </div>
      </div>

      <!-- 右欄：概念說明 + 常見問題 -->
      <div class="space-y-4">
        <!-- 核心概念 -->
        <div class="rounded-xl border border-border-default bg-bg-card p-5">
          <h3 class="mb-3 text-sm font-semibold">核心概念</h3>
          <div class="space-y-3">
            <div>
              <div class="mb-1 text-xs font-semibold text-accent-light">Agent = Claude Code Session</div>
              <div class="text-[11px] leading-relaxed text-text-muted">
                每個 Agent 就是一個 Claude Code CLI 子程序。Maestro 不自建 AI Runtime，而是利用 Claude Code 強大的程式能力。
              </div>
            </div>
            <div class="h-px bg-border-default"></div>
            <div>
              <div class="mb-1 text-xs font-semibold text-accent-light">45 個預設角色</div>
              <div class="text-[11px] leading-relaxed text-text-muted">
                涵蓋 8 個部門：PM、設計、前端、後端、QA、DevOps、資安、資料。每個角色有專屬的 Prompt 與知識庫。
              </div>
            </div>
            <div class="h-px bg-border-default"></div>
            <div>
              <div class="mb-1 text-xs font-semibold text-accent-light">Sprint + 審核關卡</div>
              <div class="text-[11px] leading-relaxed text-text-muted">
                使用 Sprint 管理開發週期，7 道關卡（G0-G6）確保品質，從需求確認到正式發佈。
              </div>
            </div>
            <div class="h-px bg-border-default"></div>
            <div>
              <div class="mb-1 text-xs font-semibold text-accent-light">成本控管</div>
              <div class="text-[11px] leading-relaxed text-text-muted">
                即時追蹤每個 Session 的 Token 用量，支援每日/總額預算上限與警示。
              </div>
            </div>
          </div>
        </div>

        <!-- 系統需求 -->
        <div class="rounded-xl border border-border-default bg-bg-card p-5">
          <h3 class="mb-3 text-sm font-semibold">系統需求</h3>
          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between border-b border-border-default pb-2">
              <span class="text-text-secondary">作業系統</span>
              <span class="text-text-primary">Windows 10+ / macOS 12+</span>
            </div>
            <div class="flex items-center justify-between border-b border-border-default pb-2">
              <span class="text-text-secondary">Node.js</span>
              <span class="text-text-primary">18.0+</span>
            </div>
            <div class="flex items-center justify-between border-b border-border-default pb-2">
              <span class="text-text-secondary">Claude Code CLI</span>
              <span class="text-text-primary">最新版</span>
            </div>
            <div class="flex items-center justify-between border-b border-border-default pb-2">
              <span class="text-text-secondary">Anthropic 帳號</span>
              <span class="text-text-primary">Pro / Max / Team 方案</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-text-secondary">Git</span>
              <span class="text-text-primary">2.30+（選用，Git 功能需要）</span>
            </div>
          </div>
        </div>

        <!-- 常見問題 -->
        <div class="rounded-xl border border-border-default bg-bg-card p-5">
          <h3 class="mb-3 text-sm font-semibold">常見問題</h3>
          <div class="space-y-3">
            <div>
              <div class="mb-1 text-xs font-semibold text-text-primary">啟動 Agent 時出現「Claude CLI is not available」？</div>
              <div class="text-[11px] leading-relaxed text-text-muted">
                確認已安裝 Claude Code CLI 且在 PATH 中。安裝後需重啟 Maestro 讓系統偵測。也可在「設定 &gt; Claude 命令列」手動指定路徑。
              </div>
            </div>
            <div class="h-px bg-border-default"></div>
            <div>
              <div class="mb-1 text-xs font-semibold text-text-primary">Agent 執行中出現認證錯誤？</div>
              <div class="text-[11px] leading-relaxed text-text-muted">
                在終端機執行 <code class="rounded bg-bg-hover px-1 py-0.5">claude login</code> 重新認證。確保帳號有有效的付費方案。
              </div>
            </div>
            <div class="h-px bg-border-default"></div>
            <div>
              <div class="mb-1 text-xs font-semibold text-text-primary">可以同時執行多個 Agent 嗎？</div>
              <div class="text-[11px] leading-relaxed text-text-muted">
                可以。Maestro 支援多個 Session 同時運行，每個 Agent 是獨立的 Claude Code 子程序。但請注意 Token 用量會同時累計。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
