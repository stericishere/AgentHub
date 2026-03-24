# API 規範

> **版本**: v3.0
> **最後更新**: 2026-03-09

---

## RESTful 設計

- GET: 查詢（不修改資料）
- POST: 建立
- PUT: 完整更新
- PATCH: 部分更新
- DELETE: 刪除

**完整 CRUD 原則**: 所有 API 資源必須實作完整 CRUD（GET /, GET /:id, POST /, PATCH /:id, DELETE /:id），除非有明確理由省略。

## 回應格式

### 成功

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": "2026-03-03T12:00:00+08:00",
  "trace_id": "abc123"
}
```

### 錯誤

```json
{
  "code": 400,
  "message": "參數錯誤",
  "errors": [
    { "field": "email", "message": "格式不正確" }
  ],
  "timestamp": "2026-03-03T12:00:00+08:00",
  "trace_id": "abc123"
}
```

### 錯誤碼命名空間

使用 `模組_錯誤類型` 格式，全大寫底線分隔：

```
AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
MENU_ITEM_SOLD_OUT
ORDER_ALREADY_CANCELLED
SHOP_NOT_FOUND
```

## 分頁

```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "total_elements": 100,
  "total_pages": 5
}
```

## 命名

- URL 路徑: kebab-case（`/api/user-profiles`）
- Query / Body 欄位: snake_case（`user_name`, `start_date`）
- 時間格式: ISO 8601 帶時區（`+08:00`）
- 金額: 字串型別（`"123.45"`），Zod 驗證接受 string 和 number 並轉為 string

### 金額欄位處理（Zod）

```typescript
// 接受 string 或 number，統一轉為 string
const priceSchema = z.union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/));
```

## 請求注意事項

- **無 Body 的請求（GET / DELETE）不要送 Content-Type header**，否則 Fastify 等框架會回傳 400
- **認證 header**: `Authorization: Bearer <token>`
- **多租戶公開路由**: 使用 `:shopSlug` 路徑參數，由 middleware 解析為 `shop_id`

## Rate Limiting

| 類型 | 限制 | 說明 |
|------|------|------|
| 認證端點 | 10 次/分鐘 | 防暴力破解 |
| 訂單/交易 | 5 次/分鐘 | 防重複提交 |
| 一般公開 API | 60 次/分鐘 | 防濫用 |

Rate Limit 回傳 **429 Too Many Requests**，不要回傳 500。需在 `errorResponseBuilder` 中明確指定回應格式。

## 版本

- URL 路徑版本: `/api/v{major}/...`
- 僅 breaking change 時升版
- 舊版維護至少 6 個月

## 注意

以上是通用 API 設計原則。具體的端點清單、認證方式、WebSocket 設計等，由各專案在 `{workDir}/.knowledge/` 中定義。
