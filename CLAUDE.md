# AgentHub (Maestro v2) — Agent 指南

> 本文件為專案最高規範。所有 Agent 執行任務前必須先閱讀本文件，再依索引查閱對應文件。
> **本文件只放規範類內容**，參考資訊一律建立索引指向對應文件。

---

## 專案簡介

- **專案名稱**: AgentHub (Maestro v2)
- **類型**: Electron 桌面應用（AI Agent 團隊管理平台）
- **核心價值**: 用 Harness Engineering（Skill + Hook + FileWatcher）驅動虛擬開發公司，GUI 只做監控和 3 個操作
- **目標用戶**: 老闆（一人公司創辦人）
- **開發平台**: Windows 11
- **來源**: 從 C:\agent-hub (Maestro v1) 複製精簡而來

---

## 開發規則

### 文件治理（最高原則）

1. **文件就是法律**: 程式碼必須與規範文件一致。發現不一致時，**以規範文件為準修正程式碼**；若規範文件本身有誤，須先提案修改文件，經 PM 或老闆確認後才能改程式碼。**任何情況下不得跳過文件直接改 code。**
2. **原子性**: 每個 PR / commit 必須同時包含「程式碼變更」與「對應文件更新」。只改 code 不改文件 = 未完成。只改文件不改 code = 未完成。兩者必須在同一次變更中一起完成。
3. **文件同步維護**: 任何功能新增、修改、刪除，必須同步更新對應的 `.knowledge/` 文件與本索引。程式碼與文件不一致視為未完成。
4. **索引完整性**: 所有 `.knowledge/` 文件都必須在本文件的「專案文件索引」中登記。新增文件但未更新索引 = 未完成。
5. **先確認再開發**: 功能需求確認 → 老闆核可 → 才進入開發。未經確認不得直接實作。
6. **遵循公司規範**: 所有開發須遵循下方「公司知識庫」所列的規範與 SOP。
7. **公司規範本地化**: 引用公司規範時，若本地 `.knowledge/` 尚無對應文件，必須先建立一份本地副本再使用。未用到的不需複製。
8. **需求備忘統一入口**: 老闆提出的額外需求、想法、未來功能構想，統一記錄到 `proposal/product-roadmap-draft.md` 的「未排期 Backlog」。PM 負責分類與評估，正式納入開發前須寫入對應 Sprint 提案書經 G0 審核。

### 命名規範（強制）

| 層 | 命名風格 | 範例 | 說明 |
|----|---------|------|------|
| 資料庫（sql.js） | snake_case | `project_id`, `created_at` | 表名、欄位名全部 snake_case |
| Electron Main Process | camelCase | `sessionManager`, `hookManager` | 服務、函數、變數 |
| Vue Renderer TypeScript | camelCase | `activeSession`, `sprintProgress` | 變數、函數、props |
| Vue 元件檔名 | PascalCase | `SessionTerminal.vue`, `GateChecklist.vue` | 元件檔案名 |
| TypeScript 型別/類別 | PascalCase | `SessionStatus`, `GateRecord` | 介面、型別、類別 |
| 一般檔案名 | kebab-case | `hook-manager.ts`, `event-parser.ts` | .ts, .vue 以外用 kebab |
| CSS | TailwindCSS 4 | `@theme` 定義 token | 避免行內樣式 |

### IPC 三方一致規則（強制）

新增或修改 IPC 通道時，**以下三處必須同步更新**，缺一不可：

| # | 檔案 | 內容 |
|---|------|------|
| 1 | `electron/types/ipc.ts` | IpcChannels 常數定義 |
| 2 | `electron/preload.ts` | MaestroApi 型別 + contextBridge 實作 |
| 3 | `src/composables/useIpc.ts` | useIpc() wrapper 函數 + return |

> 三處名稱、參數型別、回傳型別必須完全一致。不一致 = runtime 炸。

### 依賴與環境變數變更規則（強制）

修改 `package.json` 的 dependencies / devDependencies 後，**必須**：
1. 執行 `npm install` 更新 `package-lock.json`
2. 將 `package-lock.json` 與 `package.json` **一起 commit**
3. `node-pty` 等原生模組需額外 `npx electron-rebuild -f -w node-pty`

### 禁止指令（強制）

- ❌ `npx kill-port`、`taskkill /F /IM node.exe`、`Stop-Process -Name node` — 本機多專案運行
- ❌ `--no-verify` 跳過 hook
- ❌ `git push --force` 到 main
- ❌ 僅改程式碼不改文件

### Commit 紀律（強制）

1. **一事一 commit**: 禁止「大雜燴」commit
2. **commit 前必過 lint + type-check**
3. **commit message 格式**: `<type>(<scope>): <summary>`，type 限 feat/fix/refactor/test/docs/chore
4. **lockfile 必須隨 package.json 一起 commit**

### 禁止憑空想像規則（最高強制力）

> **核心原則：不確定就去讀，不要猜。**

| 項目 | 真相來源 | 違反後果 |
|------|---------|---------|
| IPC 通道參數/回傳 | `electron/types/ipc.ts` 型別定義 | runtime undefined |
| DB 表結構 | `electron/services/database.ts` schema | query 失敗 |
| Pinia store 方法 | 對應 `src/stores/*.ts` | undefined is not a function |
| 子專案檔案格式 | `.knowledge/` 對應的格式定義文件 | FileWatcher 解析失敗 |

---

## 技術棧

| 類型 | 技術 | 版本 |
|------|------|------|
| 桌面框架 | Electron | 35+ |
| 前端 | Vue 3 + Vite + TypeScript | |
| UI | TailwindCSS | 4 |
| 終端 | xterm.js + node-pty | |
| 狀態管理 | Pinia | |
| 資料庫 | sql.js (WASM SQLite) | |
| 檔案監控 | chokidar | |
| Markdown | marked + gray-matter | |
| 測試 | Vitest + @vue/test-utils + happy-dom | |
| E2E | Playwright | |
| 打包 | electron-builder | |

> 已移除：monaco-editor, @notionhq/client, simple-git

---

## 目錄結構

```
AgentHub/
├── electron/                    # Electron Main Process
│   ├── main.ts                  # App 進入點
│   ├── preload.ts               # Context Bridge
│   ├── ipc/                     # IPC Handlers（~10 模組）
│   ├── services/                # 核心服務（~14 個）
│   ├── types/                   # 共享型別
│   └── utils/
├── src/                         # Vue 3 Renderer
│   ├── router/
│   ├── stores/                  # Pinia（~7 個）
│   ├── views/                   # 頁面（5 個）
│   │   ├── DashboardView.vue    # 監控：Sprint + 任務 + Gate + Session
│   │   ├── SessionsView.vue     # 核心：終端互動
│   │   ├── ProjectsView.vue     # 操作：建立專案 + 專案詳情
│   │   ├── ProjectDetailView.vue
│   │   └── SettingsView.vue     # 設定
│   ├── components/
│   ├── composables/
│   └── assets/
├── agents/                      # Agent 定義 (YAML)
│   └── definitions/             # 角色定義
├── knowledge/                   # 知識庫（公司級）
│   └── company/
│       ├── sop/
│       ├── standards/
│       ├── templates/
│       └── skill-templates/     # Sprint 2 新增
├── tests/
├── e2e/
├── .knowledge/                  # 專案級技術規範
├── .tasks/                      # 任務獨立資料夾
├── proposal/                    # Sprint 規劃
└── CLAUDE.md                    # 本文件
```

---

## 團隊管理架構（強制）

```
老闆（最終決策者）
├── product-manager (PM) — L1
│   ├── feedback-synthesizer — L2
│   ├── sprint-prioritizer — L2
│   └── trend-researcher — L2
├── tech-lead — L1
│   ├── frontend-developer — L2
│   ├── backend-architect — L2
│   └── ai-engineer — L2
├── design-director — L1
│   ├── ui-designer — L2
│   └── ux-researcher — L2
├── qa-lead — L1
│   └── test-writer-fixer — L2
└── 公司管理 Agent — L1（知識庫回饋專用）
```

### 指揮鏈規則

- ❌ L2 不得跳過 L1 直接向老闆回報
- ❌ 老闆不得跳過 L1 直接指揮 L2
- ❌ L1 不得在未 Review 的情況下提交 Gate
- 老闆只對接 L1 層，L1 負責指揮 L2 subagent

---

## Sprint 流程

> 詳見 `.knowledge/company/sop/sprint-planning.md`

```
老闆 + PM 討論需求
    ↓
撰寫提案書（sprint-proposal.md）
    ↓
G0 審核：確認目標、範圍、勾選步驟和關卡
    ↓
L1 撰寫開發計畫書（dev-plan.md）
    ↓
老闆透過 PM 下達指令 → 手動轉達 L1 Agent
    ↓
L1 指揮 L2 執行 → 完成後更新 .tasks/ 狀態
    ↓
FileWatcher 偵測 → GUI Dashboard 即時同步
    ↓
L1 Review → PM Gate 審核 → 老闆決策
    ↓
所有關卡通過 → Sprint 完成
```

---

## 踩坑快速參考

| 場景 | 規則 |
|------|------|
| `node-pty` 編譯 | 需要 Visual Studio Build Tools。`npx electron-rebuild -f -w node-pty` |
| 新增 IPC 通道 | `ipc.ts` → `preload.ts` → `useIpc.ts` 三方同步 |
| 修改 Pinia store | 確認 `useIpc()` 有暴露對應 IPC wrapper |
| 修改 DB schema | 必須在 database.ts migrations 新增版本 |
| 循環依賴 | service 之間用 lazy `require()` 避免 |
| TailwindCSS 4 | 用 `@theme` 定義 token，不用 `tailwind.config.js` |

---

## 常用指令

```bash
npm run dev          # 啟動開發模式
npm run test         # 單元測試
npm run lint         # ESLint 檢查
npm run typecheck    # TypeScript 型別檢查
npm run build        # 打包
```

---

## 專案文件索引

### 專案級規範（.knowledge/）

| 文件 | 用途 | 版本 |
|------|------|------|
| `.knowledge/project-overview.md` | 專案概述、目標、v1→v2 變更摘要 | v1.0 |
| `.knowledge/architecture.md` | 系統架構、服務清單、IPC 架構 | v1.0 |
| `.knowledge/directory-structure.md` | 目錄結構詳細說明 | v1.0 |
| `.knowledge/coding-standards.md` | Electron + Vue 編碼規範 | v1.0 |
| `.knowledge/testing-standards.md` | 測試策略與規範 | v1.0 |
| `.knowledge/quality-checklist.md` | G0-G6 品質檢查清單 | v1.0 |
| `.knowledge/postmortem-log.md` | 踩坑紀錄 | v1.0 |

### 公司規範（.knowledge/company/）

| 文件 | 用途 |
|------|------|
| `.knowledge/company/sop/sprint-planning.md` | Sprint 規劃 SOP v4.1 |
| `.knowledge/company/sop/code-review.md` | 程式碼審查 SOP |
| `.knowledge/company/standards/coding-standards.md` | 公司編碼標準 |
| `.knowledge/company/standards/api-standards.md` | 公司 API 標準 |
| `.knowledge/company/standards/quality-checklist.md` | 公司品質檢查清單 |
| `.knowledge/company/templates/sprint-proposal.md.template` | Sprint 提案書範本 |
| `.knowledge/company/templates/dev-plan.md.template` | 開發計畫書範本 |
| `.knowledge/company/templates/internal-review.md.template` | 內部審查報告範本 |

### Sprint 規劃

| 文件 | 用途 |
|------|------|
| `proposal/sprint1-proposal.md` | Sprint 1 提案書（搬家 + 清理） |
| `proposal/sprint1-dev-plan.md` | Sprint 1 開發計畫書 |
