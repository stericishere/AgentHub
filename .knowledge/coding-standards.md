# 編碼規範（本地版）

> **版本**: v1.0（本地化自公司 coding-standards v3.0）
> **最後更新**: 2026-03-24

---

## 通用規則

> 繼承自 `.knowledge/company/standards/coding-standards.md`

1. **不硬編碼機密資訊** — 密碼、API Key 一律用環境變數
2. **有意義的命名** — 變數/函數名稱要能說明用途
3. **單一職責** — 每個函數/類別只做一件事
4. **錯誤處理** — 外部呼叫必須有錯誤處理
5. **無死碼** — 不留註解掉的程式碼、不用的 import
6. **文件同步** — 程式碼與文件必須同步更新

## Electron Main Process（TypeScript）

- 格式化: Prettier（printWidth: 100, singleQuote: true）
- 命名: camelCase（變數/函數）, PascalCase（類別/型別）
- 檔案命名: kebab-case（`hook-manager.ts`, `session-manager.ts`）
- 嚴格模式: `strict: true`
- 服務模式: singleton export（`export const serviceName = new ServiceClass()`）
- 未使用變數: 用底線前綴 `_varName`

### Service 開發規範

```typescript
// 標準 Service 結構
class ServiceManager {
  private db: Database;

  initialize(db: Database): void { /* 注入依賴 */ }

  // public 方法 = 業務邏輯
  async doSomething(): Promise<Result> { }

  // private 方法 = 內部實作
  private parseData(): Data { }
}

export const serviceManager = new ServiceManager();
```

### IPC Handler 開發規範

```typescript
// 標準 IPC Handler 結構
export function registerXxxHandlers() {
  ipcMain.handle(IpcChannels.XXX_ACTION, async (_event, params) => {
    try {
      return await someService.doAction(params);
    } catch (error) {
      console.error('[xxx] Action failed:', error);
      throw error;
    }
  });
}
```

## Vue 3 Renderer（TypeScript + Vue SFC）

- 元件: `<script setup lang="ts">` 優先
- 命名: PascalCase 檔名（`SessionTerminal.vue`）
- Props: 使用 `defineProps<{}>()` 搭配 TypeScript 泛型
- Emit: 使用 `defineEmits<{}>()` 搭配 TypeScript 泛型
- Store: Pinia composition API 風格（`defineStore('name', () => { })`)
- 樣式: TailwindCSS 4 class，避免 `<style>` 和行內樣式

### Pinia Store 開發規範

```typescript
export const useXxxStore = defineStore('xxx', () => {
  // state
  const items = ref<Item[]>([]);
  const loading = ref(false);

  // getters
  const activeItems = computed(() => items.value.filter(i => i.active));

  // actions
  async function fetchItems() {
    loading.value = true;
    try {
      items.value = await window.maestro.xxx.list();
    } finally {
      loading.value = false;
    }
  }

  return { items, loading, activeItems, fetchItems };
});
```

## DB 命名（sql.js / SQLite）

- 表名: snake_case 複數（`claude_sessions`, `audit_logs`）
- 欄位名: snake_case（`project_id`, `created_at`）
- 主鍵: `id TEXT PRIMARY KEY`（UUID 格式）
- 時間戳: `created_at`, `updated_at`（ISO 8601 字串）
- 布林: `is_xxx`（SQLite 用 INTEGER 0/1）

## Git

- 分支: `feature/sprint1-xxx`, `fix/xxx`, `hotfix/xxx`
- Commit: `<type>(<scope>): <summary>`
- 禁止: `--no-verify`, `push --force` to main
