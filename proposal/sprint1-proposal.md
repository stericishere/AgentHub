# Sprint 提案書: Sprint 1 — 搬家 + 清理

> **提案人**: 老闆 + PM
> **日期**: 2026-03-24
> **專案**: AgentHub (Maestro v2)
> **狀態**: 待 G0 審核

---

## 1. 目標

將 Maestro v1（C:\agent-hub）完整複製到 v2（C:\projects\AgentHub），砍掉不需要的頁面、服務、元件、DB 表和依賴，確保精簡後的應用能正常啟動和運行核心功能（開 Session、建專案）。

## 2. 範圍定義

### 做

| # | 功能/任務 | 優先級 | 說明 |
|---|----------|--------|------|
| 1 | 複製 v1 程式碼到 v2 目錄 | P0 | electron/, src/, agents/, knowledge/, tests/, 設定檔 |
| 2 | 移除不需要的頁面（13→5） | P0 | 砍 8 個頁面 + 相關路由 |
| 3 | 移除不需要的服務（33→~14） | P0 | 砍 19 個服務 + 修正 import |
| 4 | 移除不需要的 IPC handler（17→~10） | P0 | 砍 6 個模組 + 清理 preload |
| 5 | 移除不需要的 Store（12→7） | P0 | 砍 4 個 + 修正元件引用 |
| 6 | 移除不需要的元件 | P1 | 隨頁面砍掉的元件 |
| 7 | 精簡 DB schema（27→~12） | P1 | 移除 15 張表 + 更新 migration |
| 8 | 移除不需要的依賴 | P1 | monaco-editor, @notionhq/client, simple-git |
| 9 | 確保 lint + typecheck 通過 | P0 | 砍完後所有型別和引用正確 |
| 10 | 驗證核心功能可用 | P0 | 開 Session、停 Session、建專案 |

### 不做（明確排除）

- Hook / Skill / FileWatcher（Sprint 2-3）
- 新功能開發
- UI 改版設計
- 效能優化
- 公司管理 Agent（Sprint 4）

## 3. 流程決策（G0 核心產出）

### 步驟勾選

| 勾選 | 步驟 | 說明 | 對應關卡 | 備註 |
|------|------|------|---------|------|
| [x] | 需求分析 | 需求文件、砍除清單 | G0（本文件） | 必選 |
| [ ] | 設計 | — | — | 不需要，沿用 v1 架構 |
| [ ] | UI 圖稿 | — | — | 不需要，沿用 v1 介面 |
| [x] | 實作 | 複製 + 刪除 + 修正引用 | G2: 程式碼審查 | |
| [x] | 測試 | 確保 lint/typecheck 通過 + 核心功能可用 | G3: 測試驗收 | |
| [x] | 文件 | 更新 CLAUDE.md + .knowledge/ | G4: 文件審查 | |
| [ ] | 部署 | — | — | 桌面應用不需要 |
| [ ] | 發佈 | — | — | 尚未到發佈階段 |

### 阻斷規則

- [x] G2（程式碼審查）通過前不得進入測試
- [ ] 無其他阻斷

## 4. 團隊分配

| 角色 | Agent | 負責範圍 |
|------|-------|---------|
| L1 領導 | tech-lead | 整體規劃、砍除決策、Review |
| L2 執行 | frontend-developer | Vue 頁面/元件/Store 清理 |
| L2 執行 | backend-architect | Service/IPC/DB 清理 |

## 5. 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| 砍掉的模組有隱藏依賴 | 高 | 中 | 每砍一個模組就跑 typecheck |
| session-manager 依賴被砍模組 | 中 | 高 | 優先處理 session-manager 的 import |
| DB migration 版本衝突 | 低 | 中 | 重建 migration，不保留歷史版本 |

## 6. 失敗模式分析

| 失敗場景 | 可能性 | 影響 | 偵測方式 | 緩解措施 |
|---------|--------|------|---------|---------|
| 應用啟動後白屏 | 中 | 高 | `npm run dev` 啟動測試 | 逐步砍除，每步驗證 |
| Session 無法開啟 | 中 | 高 | 手動測試 spawn | 優先保護 session-manager 依賴鏈 |
| TypeScript 編譯大量錯誤 | 高 | 中 | `npm run typecheck` | 先砍 import，再處理型別 |

## 7. 可觀測性

- **日誌策略**: Electron console.log + DevTools
- **關鍵 Dashboard**: 開發時用 DevTools 觀察
- **告警規則**: typecheck / lint 紅燈 = 阻塞

## 8. Rollback 計畫

| 項目 | 說明 |
|------|------|
| 程式碼回滾 | git revert 到複製後的初始 commit |
| DB 回滾 | 不適用（開發階段可重建） |
| 判斷標準 | session-manager 完全無法運作 |
| 負責人 | tech-lead |

## 9. 驗收標準

- [ ] 應用能正常啟動，無 import error、無白屏
- [ ] DashboardView, SessionsView, ProjectsView, ProjectDetailView, SettingsView 可正常進入
- [ ] 可開啟 Session（spawn Claude CLI + xterm.js 輸出正常）
- [ ] 可停止 Session
- [ ] 可建立新專案
- [ ] DB 只剩保留的 ~12 張表
- [ ] package.json 已移除 monaco-editor, @notionhq/client, simple-git
- [ ] `npm run lint` 通過
- [ ] `npm run typecheck` 通過（或僅剩已知的 minor issues）
- [ ] 首屏載入 bundle < 3MB
- [ ] CLAUDE.md 目錄結構已更新
- [ ] .knowledge/architecture.md 服務清單已更新

---

**G0 審核結果**

**老闆決策**: [x] 通過 / [ ] 調整後通過 / [ ] 擱置

**審核意見**: 無調整，照提案執行

**確認的流程**: 需求 → 實作 → G2 → 測試 → G3 → 文件 → G4

**G0 通過日期**: 2026-03-24
