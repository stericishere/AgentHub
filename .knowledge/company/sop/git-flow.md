# Git 版控流程設計

> 版本: v1.2 | 2026-04-08
> 目標：讓 Harness 支援多 L1 並行、多 L2 並行、任務依賴隔離

---

## 一、分支結構

```
main
└── sprint-{N}                          ← /dev-plan 建立時
    ├── task/s{N}-T2-page-generator     ← 並行組 A，需要 branch
    ├── task/s{N}-T3-slug-registry      ← 並行組 A，需要 branch
    └── （循序任務直接 commit 到 sprint-{N}）
```

**L1 的職責透過 metadata 記錄**（任務檔「指派給」欄位），不在 Git 分支體現。

---

## 二、何時需要 branch？

**判斷依據：`| 並行組 |` 欄位**（由 L1 在 task-delegation 規劃時設定）

| 並行組值 | 意義 | Git 行為 |
|---------|------|---------|
| `—` | 循序任務，同一時間只有一個 L2 在動 | 直接 commit 到 sprint-{N} |
| `A` / `B` / `C`... | 同組任務可並行（不同 L2 同時執行） | 各自建立 task branch |

**原則：branch 只為隔離並行工作，循序任務不需要 branch。**

### 實例（Sprint 19）

```
並行組 A：T2（Page Generator）+ T3（Slug Registry）  → 各開 branch
並行組 B：T8（CLI）+ T9（API）                        → 各開 branch
並行組 C：T10（AI API）+ T13（D3 圖）+ T16（Fixture） → 各開 branch
並行組 —：T1 → T4 → T5 → T6 → T14 → T15 → T17 → T18 → 直接 commit
```

18 個任務中，只有 8 個需要 branch，其餘 10 個循序任務直接 commit。

---

## 三、完整生命週期

### 階段 1：Sprint 啟動

| 時機 | Git 動作 | Skill |
|------|---------|-------|
| dev-plan 產出後 | `git checkout -b sprint-{N}` from main | `/dev-plan` |

---

### 階段 2：任務規劃

L1 執行 `/task-delegation` 時，為每個任務標記 `| 並行組 |`：

```markdown
| 並行組 | A |     ← 同組的任務會並行執行，需要 branch
| 並行組 | — |     ← 循序任務，直接 commit 到 sprint
```

**L1 標記規則：**
- 同一時間可以被不同 L2 同時執行的任務 → 同一並行組字母
- 必須等前一個完成才能開始的任務 → `—`

---

### 階段 3：任務執行

#### 循序任務（並行組 = —）

| 時機 | Git 動作 | Skill |
|------|---------|-------|
| L2 開始任務 | 依賴檢查 → 確認在 sprint-{N} branch 上 | `/task-start` |
| L2 完成實作 | `git add -A && git commit -m "{type}: {title} (T{id})"` | `/task-done` |

#### 並行任務（並行組 = A/B/C...）

| 時機 | Git 動作 | Skill |
|------|---------|-------|
| L2 開始任務 | 依賴檢查 → `git checkout -b task/s{N}-T{id}-{slug}` from sprint-{N} | `/task-start` |
| L2 完成實作 | `git add -A && git commit -m "{type}: {title} (T{id})"` on task branch | `/task-done` |

**依賴檢查邏輯（兩種任務共用）：**
```
讀取任務檔 | 依賴 | 欄位
→ 逐一確認依賴任務狀態 = done
→ done 語意：task-approve 已執行，程式碼已在 sprint-{N}
→ 有任一未 done → block，列出未完成的依賴
→ 全部 done → 繼續執行
```

---

### 階段 4：L1 審核

| 時機 | Git 動作 | Skill |
|------|---------|-------|
| 審核前同步 | `git merge sprint-{N}` into task branch（僅並行任務需要），解衝突 | `/sop-review` STEP 2 |
| 取得審核依據 | **並行任務**：`git diff sprint-{N}...task/s{N}-T{id}-{slug}` | `/sop-review` STEP 2.5 |
| 取得審核依據 | **循序任務**：`git show HEAD`（最新一筆 commit） | `/sop-review` STEP 2.5 |
| 審核通過（並行） | merge task branch → sprint-{N}，刪 task branch | `/task-approve` |
| 審核通過（循序） | 狀態更新為 done（code 已在 sprint-{N}） | `/task-approve` |
| 審核退回 | 並行任務：task branch 保留；循序任務：在 sprint-{N} 繼續修改 | `/task-status rejected` |

**並行任務 task-approve merge 流程：**
```bash
git checkout sprint-{N}
git merge --no-ff task/s{N}-T{id}-{slug} -m "feat(T{id}): {title}"
git branch -d task/s{N}-T{id}-{slug}
```

> merge 完成後，依賴此 task 的下游任務即解鎖（可執行 /task-start）

---

### 階段 5：Sprint 結案

| 時機 | Git 動作 | Skill |
|------|---------|-------|
| 老闆 + PM 確認所有 Gate 通過 | merge sprint-{N} → main，tag，清理 | `/sprint-close` |

**sprint-close 流程：**
```bash
# 1. 確認所有 .tasks/sprint-{N}/ 任務狀態均為 done
# 2. git checkout main
# 3. git merge --no-ff sprint-{N} -m "release: sprint-{N} 結案"
# 4. git tag sprint-{N}-release
# 5. git branch --merged main | grep "task/s{N}-" | xargs git branch -d
# 6. git branch -d sprint-{N}
```

> 步驟 5 只刪除已完整 merge 進 main 的 task branches，避免誤刪未整合分支。

---

### 專案初始化

| 時機 | Git 動作 | Skill |
|------|---------|-------|
| 新專案建立 | git init + .gitignore + 初始 commit | `/project-kickoff` |

```bash
git init
# 建立 .gitignore（依 project-type 填入對應範本）
git add -A
git commit -m "chore: project kickoff — {project-name}"
```

**.gitignore 必含：** `node_modules/` `dist/` `.env` `.env.*` `.claude/`

---

## 四、狀態機（與 Git 的對應）

| 狀態 | 觸發 Skill | Git 狀態 |
|------|-----------|---------|
| `assigned` | `/task-dispatch` | 無 branch |
| `in_progress` | `/task-start` | 循序：在 sprint-{N}；並行：task branch 建立 |
| `in_review` | `/task-done` | 循序：sprint-{N} 有新 commit；並行：task branch 有 commit |
| `done` | `/task-approve` | 程式碼已在 sprint-{N}，並行任務的 branch 已刪 |
| `blocked` | `/task-status blocked` | 暫停，等待依賴解鎖 |
| `changes_requested` | `/task-status rejected` | 循序：在 sprint-{N} 修改；並行：task branch 保留繼續修 |

> **done = 程式碼已在 sprint-{N}**，此為依賴解鎖的判斷條件，語意嚴格。

---

## 五、Skill 改動清單

| Skill | 改動 |
|-------|------|
| `project-kickoff` | 新增：git init + .gitignore + 初始 commit |
| `dev-plan` | 新增：產出後 `git checkout -b sprint-{N}` from main |
| `task-delegation` | 新增：`\| 並行組 \| — \|` 欄位，L1 規劃時標記 |
| `task-start` | 新增：讀取並行組 → 循序確認 branch；並行建立 task branch |
| `task-done` | 新增：`git add -A && git commit -m "{type}: {title} (T{id})"` |
| `task-approve` | 新增：並行任務 merge task→sprint-{N} 刪 branch；循序任務只更新狀態 |
| `sop-review` | 新增：STEP 2 同步 sprint（並行任務）；STEP 2.5 取 diff 或 git show |
| `sop-execute` | 修復：STEP 2 inline bash 改 Glob tool |
| `sop-deploy` | 修復：inline bash + 最後呼叫 /sprint-close |
| `sprint-close` | **新增 Skill**：merge sprint→main，tag，清理已 merge branches |

---

## 六、Commit Message 規範

格式：`{type}: {任務標題} (T{id})`

| type | 使用時機 |
|------|---------|
| `feat` | 新功能 |
| `fix` | 修復 bug |
| `refactor` | 重構（不改行為）|
| `docs` | 文件更新 |
| `test` | 測試新增/修改 |
| `chore` | 工具、設定、雜項 |

> 由 `git-commit-check.sh` hook 自動驗證，不符格式 → block。

---

## 七、Branch 命名規則

| 類型 | 格式 | 範例 |
|------|------|------|
| Sprint | `sprint-{N}` | `sprint-15` |
| Task（並行） | `task/s{N}-T{id}-{slug}` | `task/s19-T2-page-generator` |

**slug 規則：** 任務標題轉小寫 kebab-case，去除特殊字元，最長 30 字元。
**唯一性保證：** sprint 編號 + task id 組合，跨 sprint 不會衝突。

---

## 八、邊界情況

| 情況 | 處理方式 |
|------|---------|
| merge 產生衝突 | Skill 偵測後停止，列出衝突檔案，由人工解決後繼續 |
| sprint branch 不存在就呼叫 task-start | block，提示「請先執行 /dev-plan」 |
| 循序任務在錯誤 branch 執行 | task-done 驗證當前 branch = sprint-{N}，不符則 block |
| sprint-close 時有未 done 任務 | block，列出未完成任務清單 |
| 並行任務退回重做 | task branch 保留（changes_requested），L2 繼續 commit，同步 sprint 後 L1 再 review |
| 循序任務退回重做 | 在 sprint-{N} 上直接修改，L1 再看 git show |
| sprint-close 前有殘留 task branch | 只清已 merge 至 main 者，未 merge 的保留並警告 |
