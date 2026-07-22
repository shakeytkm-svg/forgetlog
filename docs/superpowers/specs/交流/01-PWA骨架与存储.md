# 01 · PWA 骨架与存储

## 上下文（给 Trae）
从零开始建一个叫 **ForgetLog（忘事日记）** 的 PWA。它是一个"忘事日记"：记录你忘了什么事、看规律。这是第一条，先把骨架和本地存储立起来。

## 要做的
创建以下文件：
- `index.html`：最小骨架，移动优先 viewport（`width=device-width, initial-scale=1`），标题「忘事日记」，引入 `style.css` / `main.js` / `db.js`。
- `manifest.json`：`name=忘事日记 ForgetLog`、`short_name=忘事`、`display=standalone`、`start_url=./index.html`、`theme_color` / `background_color` 给个配色、`icons` 先放一个占位 png（可随便生成一个）。
- `sw.js`：基础 service worker，安装时缓存 `index.html` / `main.js` / `db.js` / `style.css`，做离线。
- `style.css`：移动端基础样式，大字号、大按钮、触摸友好。
- `main.js`：入口，先 `console.log('ForgetLog 启动')` 确认跑通；注册 service worker。
- `db.js`：打开 IndexedDB 库 `forgetlog`，版本 1，建一个 object store `entries`（`keyPath='id'`，并建 `created_at` 索引（与设计文档数据模型一致，全项目统一用下划线））。封装成 `openDB()` 返回 Promise。

## 约束
见 README 总约束。**别装任何依赖**，别引 CDN 框架。

## 验收标准（我照这个审）
1. 浏览器打开 `index.html` 能显示标题，控制台有 `ForgetLog 启动`。
2. F12 -> Application -> IndexedDB 能看到 `forgetlog` 库 + `entries` store + `createdAt` 索引。
3. Chrome 地址栏出现「安装」按钮，装到桌面后图标能打开。
4. 断网后刷新，页面还能打开（离线生效）。
