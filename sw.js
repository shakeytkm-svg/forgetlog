// sw.js — service worker，离线缓存核心文件
const CACHE_NAME = 'forgetlog-v4';   // v4: 加编辑功能（updateEntry + 记录页编辑模式）
const CACHE_URLS = [
  './',
  './index.html',
  './main.js',
  './db.js',
  './style.css',
  './icon.png',
  './manifest.json'
];

// 安装：预缓存核心文件
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 拦截请求：缓存优先，回退网络
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
