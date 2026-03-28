---
name: knowledge-feedback
description: Scan child projects for pitfalls and propose company standard updates
allowed-tools: Read, Edit, Glob, Grep, Bash
---

# 知識回饋

掃描子專案踩坑紀錄，分類並提出公司規範修改建議。

## 使用方式
```
/knowledge-feedback
```

## 參數
無（操作所有已知子專案）

## 前置條件

- 必須使用「公司知識管理者」(company-manager) Agent 開啟 Session
- 系統提示詞中已注入子專案清單

## 執行步驟

### 階段 1: 收集踩坑紀錄

1. 從系統提示詞中取得子專案清單（含絕對路徑）
2. 依序讀取每個子專案的 `.knowledge/postmortem-log.md`
3. 讀取每個子專案的 `.knowledge/coding-standards.md` 了解專案現況

### 階段 2: 分類與標記

對每筆踩坑紀錄進行分類：

| 分類 | 判斷標準 | 處理方式 |
|------|---------|---------|
| **通用問題** | 會在多個專案重複發生、與特定技術棧無關 | 建議更新公司規範 |
| **專案特定** | 僅與該專案的技術選擇或架構有關 | 僅供參考，不更新公司規範 |
| **已處理** | 已在公司規範中有對應規則 | 跳過 |

### 階段 3: 產出摘要報告

輸出以下格式的報告：

```markdown
# 跨專案知識回饋報告

**掃描日期**: {today}
**掃描專案數**: {count}

## 通用問題（建議更新公司規範）

| # | 來源專案 | 問題摘要 | 分類 | 建議更新的規範文件 | 建議內容 |
|---|---------|---------|------|------------------|---------|
| 1 | {project} | {summary} | {category} | {file} | {suggestion} |

## 專案特定問題（僅供參考）

| # | 來源專案 | 問題摘要 | 備註 |
|---|---------|---------|------|
| 1 | {project} | {summary} | {note} |

## 建議的規範修改

### 修改 1: {file}

**原因**: {why}

**建議新增/修改的內容**:
{diff or new content}
```

### 階段 4: 等待老闆確認

- 將報告呈報老闆
- **不得自行修改任何檔案**，等待老闆逐項確認
- 老闆可能：全部接受 / 部分接受 / 全部拒絕 / 提出修改意見

### 階段 5: 執行更新

老闆確認後：

1. 修改 `knowledge/company/` 下的對應文件
2. 每個修改都說明：改了什麼、為什麼、影響範圍
3. 更新完成後，整理變更摘要

## 可寫入的路徑

- `knowledge/company/sop/*.md`
- `knowledge/company/standards/*.md`
- `knowledge/company/templates/*.md`

## 不可寫入的路徑

- 子專案的任何檔案（唯讀）
- `knowledge/company/skill-templates/`（Skill 模板由開發流程管理）
- `knowledge/company/project-templates/`（專案模板由開發流程管理）
