# 忘事日记 ForgetLog

记录你忘了什么事，看规律。PWA，可装到桌面，可离线用。

## 本地跑起来

需要本地服务器（Service Worker / 麦克风权限要求 `localhost` 或 `https`，`file://` 不行）：

```bash
# 任选一种
python -m http.server 8000
npx serve .
```

浏览器开 `http://localhost:8000`。

## 装到桌面

Chrome / Edge 打开后，地址栏右侧会出现「安装」按钮，点一下即可装到桌面（standalone 全屏，无浏览器地址栏）。

## 配 Google 助手例程（嘿 Google，记忘事）

让 Google 助手一句话打开记忘事页面并自动开始录音。

### 前提

- PWA 已部署到 **https** 地址（麦克风权限必须要 https 或 localhost，真机用 https）。
- 手机上装了 Google 助手 App。

### 步骤

1. 把本 PWA 部署到你的服务器，拿到 https 地址，例如 `https://你的域名/index.html`。
2. 打开 Google 助手 App → 右下角「快指令」(Routines) → 新建个人快指令。
3. 填写：
   - **说「嘿 Google」时**：`记忘事`
   - **执行操作**：打开网址 `https://你的域名/index.html?log=1`（注意带 `?log=1`，会自动进记录页并启动语音）
4. 保存。
5. 试试说「嘿 Google，记忘事」，手机会打开 ForgetLog 记录页并自动开始录音。

> 地址里的 `你的域名` 换成你实际部署的地址。`?log=1` 是唤醒参数，不带的话只进主页。

## 离线

首次打开后会缓存核心文件，断网后刷新页面仍可用，数据存在本地 IndexedDB。

## 文件结构

| 文件 | 作用 |
|---|---|
| `index.html` | 三屏结构（主页 / 记录页 / 看板）+ 弹窗 |
| `main.js` | 页面逻辑 + 语音 + 看板 + 唤醒 |
| `db.js` | IndexedDB 封装（entries CRUD + 统计） |
| `style.css` | 移动端样式 |
| `sw.js` | Service Worker（离线缓存） |
| `manifest.json` | PWA 清单 |
| `icon.png` | 桌面图标 |
