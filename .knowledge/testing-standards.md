# 測試規範（本地版）

> **版本**: v1.0
> **最後更新**: 2026-03-24

---

## 測試框架

| 類型 | 工具 | 說明 |
|------|------|------|
| 單元測試 | Vitest + @vue/test-utils + happy-dom | Service 邏輯 + Vue 元件 |
| E2E 測試 | Playwright | 使用者流程端到端 |

## 測試策略

### 單元測試

- **必須測試**: Service 核心邏輯（session-manager, gate-keeper, task-manager, markdown-parser）
- **選擇測試**: Vue 元件的關鍵互動邏輯
- **不需測試**: 純 UI 展示元件、IPC 薄 wrapper

### E2E 測試

- **必須測試**: Session 開啟/關閉、專案建立、Gate 審核流程
- **選擇測試**: Dashboard 監控更新、Settings 變更

## 測試命名規範

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange → Act → Assert
    });

    it('should throw [ErrorType] when [invalid condition]', () => {
      // ...
    });
  });
});
```

## 測試檔案位置

| 類型 | 位置 | 命名 |
|------|------|------|
| Service 單元測試 | `tests/services/` | `{service-name}.test.ts` |
| 元件測試 | `tests/components/` | `{ComponentName}.test.ts` |
| E2E 測試 | `e2e/` | `{feature}.test.ts` |

## 執行指令

```bash
npm run test              # 全部單元測試
npm run test -- --watch   # watch 模式
npm run build && npx playwright test   # E2E 測試
```

## Sprint 2 新增

FileWatcher 相關測試重點：
- `markdown-parser.test.ts` — 解析 dev-plan 第 10 節各種格式
- `project-sync.test.ts` — 檔案變更 → DB upsert → 事件發射
