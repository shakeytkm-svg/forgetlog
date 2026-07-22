// db.js — IndexedDB 封装（含 entries CRUD + 统计）
const DB_NAME = 'forgetlog';
const DB_VERSION = 2;  // v2: 索引名 createdAt -> created_at，对齐 02 字段命名
const STORE_NAME = 'entries';

// 打开数据库，返回 Promise<IDBDatabase>
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    // 升级时建表 / 改索引
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion;

      // v1：建 store + createdAt 索引（保留兼容旧库）
      if (oldVersion < 1) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // v2：索引重命名 createdAt -> created_at
      //     IndexedDB 不支持改名，删旧的、建新的
      if (oldVersion < 2) {
        const store = e.target.transaction.objectStore(STORE_NAME);
        if (store.indexNames.contains('createdAt')) {
          store.deleteIndex('createdAt');
        }
        if (!store.indexNames.contains('created_at')) {
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// 新增 entry
// 入参：{ text, tags }；自动补 id / created_at
async function addEntry({ text, tags }) {
  const db = await openDB();
  const entry = {
    id: Date.now().toString(),
    text,
    tags: Array.isArray(tags) ? tags : [],
    created_at: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).add(entry);
    req.onsuccess = () => resolve(entry);
    req.onerror = () => reject(req.error);
  });
}

// 列出最近 limit 条（按 created_at 倒序）
async function listEntries(limit = 10) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const idx = tx.objectStore(STORE_NAME).index('created_at');
    const result = [];
    // 'prev' = 索引倒序游标
    const req = idx.openCursor(null, 'prev');
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && result.length < limit) {
        result.push(cursor.value);
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// 列出今天的条目（created_at >= 今天本地 00:00，倒序）
async function listTodayEntries() {
  const db = await openDB();
  const start = new Date();
  start.setHours(0, 0, 0, 0);              // 今天 00:00（本地）
  const lowerBound = start.toISOString();   // 转 UTC ISO，字符串比较即可
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const idx = tx.objectStore(STORE_NAME).index('created_at');
    const result = [];
    const req = idx.openCursor(IDBKeyRange.lowerBound(lowerBound), 'prev');
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        result.push(cursor.value);
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// 按 id 删除一条
async function deleteEntry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// 统计
// 返回 { weekCount, byTag, byWeekday }
//   weekCount  本周（周一 00:00 起）条数
//   byTag      { 标签名: 数量 }
//   byWeekday  长度 7，下标 0=周一 ... 6=周日
async function getStats() {
  const db = await openDB();
  const entries = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // 本周周一 00:00（本地时间）
  const now = new Date();
  const day = now.getDay();                       // 0=Sun ... 6=Sat
  const daysSinceMonday = (day === 0) ? 6 : (day - 1);
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - daysSinceMonday);
  const mondayMs = monday.getTime();

  let weekCount = 0;
  const byTag = {};
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];        // 0=Mon ... 6=Sun

  for (const entry of entries) {
    const ts = new Date(entry.created_at).getTime();

    // 本周条数
    if (ts >= mondayMs) weekCount++;

    // 标签统计
    if (Array.isArray(entry.tags)) {
      for (const tag of entry.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    // 星期分布（周一起）
    const d = new Date(entry.created_at).getDay();  // 0=Sun
    const idx = (d === 0) ? 6 : (d - 1);            // 转 Mon=0...Sun=6
    byWeekday[idx]++;
  }

  return { weekCount, byTag, byWeekday };
}
