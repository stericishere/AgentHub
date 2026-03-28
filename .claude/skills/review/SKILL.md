---
name: review
description: Perform L1 internal code review with checklist and record in dev plan
disable-model-invocation: true
allowed-tools: Read, Edit, Glob, Grep, Bash
---

# L1 內部 Review

執行 Code Review checklist 並記錄到開發計畫書第 10 節。

## 使用方式
```
/review <review-type> [target]
```

## 參數
- `$0`: Review 類型（code / spec / design / function）
- `$ARGUMENTS`: 完整參數

## Review Checklist

### 對程式碼（code）
- [ ] 無 bug 或邏輯錯誤
- [ ] 錯誤處理完整（外部呼叫有 try-catch）
- [ ] 無硬編碼機密資訊
- [ ] 命名有意義且符合規範
- [ ] 無死碼（註解掉的程式碼、未使用的 import）
- [ ] 單一職責原則
- [ ] TypeScript 型別正確（無 any）

### 對規範（spec）
- [ ] 實作與 API 規範文件一致
- [ ] 實作與 data model 文件一致
- [ ] 實作與 feature spec 一致

### 對設計稿（design）
- [ ] 佈局結構一致
- [ ] 色彩一致
- [ ] 響應式一致
- [ ] 文案一致

### 對功能（function）
- [ ] 端到端功能正常
- [ ] 效能達標
- [ ] 驗收標準全部滿足

## 執行步驟

1. 根據 review type 選擇對應 checklist
2. 逐項檢查，標記 ✅ 或 ❌ 並說明
3. 判定結果：0 Blocker + 0 Major = 通過
4. 在 dev-plan 第 10 節「Review 紀錄」append：
```
| {review-type} | {今天日期} | {通過/不通過} | {摘要} |
```
