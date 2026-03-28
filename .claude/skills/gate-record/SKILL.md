---
name: gate-record
description: Record a gate review decision in the dev plan section 10
disable-model-invocation: true
allowed-tools: Read, Edit, Glob
---

# Gate 審核紀錄

在開發計畫書第 10 節附加 Gate 審核紀錄。

## 使用方式
```
/gate-record <gate-type> <decision> [comment]
```

## 參數
- `$0`: Gate 類型（G0 / G2 / G3 / G4）
- `$1`: 決策（通過 / 駁回 / 附條件通過）
- `$ARGUMENTS`: 完整參數（含審核意見）

## 執行步驟

1. 找到當前 Sprint 的 dev-plan：
!`ls -t proposal/sprint*-dev-plan.md 2>/dev/null | head -1`

2. 讀取 dev-plan 找到第 10 節的 Gate 紀錄表：
!`ls -t proposal/sprint*-dev-plan.md 2>/dev/null | head -1 | xargs cat 2>/dev/null | grep -A 20 "Gate 紀錄"`

3. 在 Gate 紀錄表的最後一行後 append：
```
| $0 | {今天日期} | $1 | {審核意見} |
```

4. 使用 Edit 工具精確插入，不改動其他內容。
