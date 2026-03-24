# 程式碼規範

> **版本**: v3.0
> **最後更新**: 2026-03-09

---

## 通用規則

1. **不硬編碼機密資訊** — 密碼、API Key 一律用環境變數
2. **有意義的命名** — 變數/函數名稱要能說明用途
3. **單一職責** — 每個函數/類別只做一件事
4. **錯誤處理** — 外部呼叫必須有錯誤處理
5. **無死碼** — 不留註解掉的程式碼、不用的 import
6. **文件同步** — 程式碼與文件必須同步更新，只改 code 不改文件 = 未完成

## TypeScript / JavaScript

- 格式化: ESLint + Prettier（printWidth: 100, singleQuote: true）
- 命名: camelCase（變數/函數）, PascalCase（元件/類別/型別）
- 檔案命名: kebab-case（`user-profile.ts`, `UserCard.vue`）
- 嚴格模式: `strict: true`
- 型別: 避免 `any`，善用 interface / type
- 未使用變數: 用底線前綴 `_varName` 標記，不加 `eslint-disable`

### 命名轉換規範（前後端分層）

| 層 | 命名風格 | 範例 | 說明 |
|----|---------|------|------|
| 資料庫（Schema / SQL） | snake_case | `shop_id`, `is_sold_out` | 表名、欄位名全部 snake_case |
| API 回應 JSON（含信封層） | snake_case | `trace_id`, `total_elements` | 所有 API 輸出一律 snake_case |
| API 請求 Body / Query | snake_case | `customer_name`, `start_date` | 驗證 schema 用 snake_case |
| 前端 TypeScript 型別 | camelCase | `shopId`, `isSoldOut` | 前端型別定義用 camelCase |
| 前後端轉換 | 自動 | `camelToSnake()` / `snakeToCamel()` | 在 services/api 層統一處理 |

> 共用型別（如 API 信封 `ApiResponse`）若同時被後端建構回應使用，用 snake_case；純前端資料型別用 camelCase。

### Monorepo 慣例

- 套件管理: pnpm workspace（`pnpm-workspace.yaml`）
- 共用套件: `packages/shared/` 放共用型別與工具函數
- 建置順序: 先建 shared → 再平行建其他套件
- 跨套件引用: 透過 workspace 協定（`workspace:*`）
- 各套件獨立 `tsconfig.json`，繼承根層 `tsconfig.base.json`

## Python

- 格式化: ruff（line-length=100）
- 型別: 使用 type hints
- 命名: snake_case（變數/函數）, PascalCase（類別）
- 文件字串: Google style docstring
- 匯入排序: isort（透過 ruff）

## Git

- 分支: `feature/xxx`, `fix/xxx`, `hotfix/xxx`
- Commit: 簡潔描述修改內容，說明「為什麼」而非「改了什麼」
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- 不提交: node_modules, __pycache__, .env, .DS_Store, dist/, *.js.map

## CI/CD 常見陷阱

| 問題 | 原因 | 正確做法 |
|------|------|---------|
| Prisma client 未初始化 | 只跑 migrate 沒跑 generate | 先 `prisma generate` 再 `prisma migrate deploy` |
| pnpm 參數被吃掉 | pnpm 攔截了子命令參數 | 用 `--` 分隔：`pnpm test -- --run` |
| Vitest 跑到 .js 編譯產物 | TypeScript 編譯留下 .js 檔 | `.gitignore` 排除 `packages/*/src/**/*.js` |
| 種子資料 API 400 | ID 格式不合 Zod 驗證 | SQL 直接插入必須符合目標格式（如 UUID） |
| SSH heredoc 解析失敗 | SQL 內容的單引號破壞 heredoc | 先 scp 檔案到主機再執行 |

## 注意

以上是通用底線規範。每個專案可在 `{workDir}/CLAUDE.md` 中定義更嚴格或更具體的規範（如特定框架的慣例），專案規範優先於通用規範。
