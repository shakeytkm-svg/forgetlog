# 02 · 数据层 CRUD

## 上下文（给 Trae）
01 已完成：有 `db.js`，里面 `openDB()` 能返回打开的 IndexedDB 库（含 `entries` store）。现在给 entries 补增删查统计。

## 要做的
在 `db.js` 里加这些函数（都返回 Promise / async）：
- `addEntry({ text, tags })`：自动生成 `id`（用 `Date.now().toString()` 即可）和 `created_at`（`new Date().toISOString()`），写入后返回这条 entry。
- `listEntries(limit = 10)`：按 `createdAt` 倒序取最近 `limit` 条。
- `deleteEntry(id)`：按 id 删一条。
- `getStats()`：返回一个对象：
  - `weekCount`：本周（周一 00:00 起）的条数；
  - `byTag`：`{ 标签名: 数量 }`，标签来自 entries 的 `tags` 数组；
  - `byWeekday`：长度 7 的数组，下标 0=周一 … 6=周日，每个是该星期几的条数。

## 约束
纯 IndexedDB 操作，别引第三方库。`byWeekday` 注意：JS 的 `getDay()` 周日是 0，要换成「周一起」的顺序。

## 验收标准
控制台能跑通这条链：
1. `addEntry({ text: '测试', tags: ['到家'] })` 不报错；
2. `listEntries(10)` 能看到刚才那条；
3. `getStats()` 返回结构正确，`weekCount` >= 1，`byTag` 有 `到家:1`；
4. `deleteEntry(id)` 后再 `listEntries(10)` 看不到那条了。
