// main.js — 入口（屏切换 + 主页 + 记录页）
console.log('ForgetLog 启动');

// 标签候选（03 写死，后续可扩展）
const TAGS = ['切换场景', '到家', '下车', '出门', '刚刷完手机'];
// 当前选中标签
let selectedTags = new Set();
// 编辑模式：非 null 表示正在编辑该 id 的记录
let editingId = null;

// ---- 屏切换 ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ---- 主页：刷新本周数 ----
async function refreshWeekCount() {
  try {
    const stats = await getStats();
    document.getElementById('week-count').textContent = stats.weekCount;
  } catch (err) {
    console.error('读取本周数失败:', err);
  }
}

// ---- 记录页：渲染标签 chips ----
function renderTagChips() {
  const wrap = document.getElementById('tag-chips');
  wrap.innerHTML = '';
  TAGS.forEach(tag => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = tag;
    chip.dataset.tag = tag;
    if (selectedTags.has(tag)) chip.classList.add('active');
    chip.addEventListener('click', () => {
      if (selectedTags.has(tag)) {
        selectedTags.delete(tag);
        chip.classList.remove('active');
      } else {
        selectedTags.add(tag);
        chip.classList.add('active');
      }
    });
    wrap.appendChild(chip);
  });
}

// ---- 记录页：保存 ----
async function saveEntry() {
  const text = document.getElementById('entry-text').value.trim();
  const tags = Array.from(selectedTags);
  if (!text) {
    showToast('没写内容');
    return;
  }
  try {
    if (editingId) {
      await updateEntry(editingId, { text, tags });   // 更新（保留 created_at）
      showToast('已更新');
    } else {
      await addEntry({ text, tags });                   // 新建
      showToast('已记');
    }
    // 清空 + 退出编辑模式
    document.getElementById('entry-text').value = '';
    selectedTags.clear();
    const wasEditing = editingId;
    editingId = null;
    document.querySelector('#screen-entry .app-header h1').textContent = '记一笔';
    document.getElementById('btn-save').textContent = '保存';
    if (wasEditing) {
      showScreen('screen-board');
      await renderBoard();
    } else {
      showScreen('screen-home');
    }
    refreshWeekCount();
  } catch (err) {
    console.error('保存失败:', err);
    showToast('保存失败');
  }
}

// ---- 轻提示 ----
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1500);
}

// ---- 语音输入 ----
// 兼容性：取标准名或 webkit 前缀名
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;          // 当前识别实例
let recActive = false;   // 是否正在识别（防止重复 start/stop）

// 初始化语音：不支持则隐藏按钮 + 显示提示
function initVoice() {
  const btn = document.getElementById('btn-voice');
  const tip = document.getElementById('voice-unsupported');
  if (!SpeechRecognition) {
    btn.classList.add('hidden');
    tip.classList.remove('hidden');
    return;
  }
  // 支持时绑定按住/松开（pointer 兼容触屏+鼠标）
  btn.addEventListener('pointerdown', startVoice);
  btn.addEventListener('pointerup', stopVoice);
  btn.addEventListener('pointerleave', stopVoice);   // 手指/鼠标滑出也算松开
  btn.addEventListener('pointercancel', stopVoice);
}

// 按下：开始识别
function startVoice(e) {
  if (e) e.preventDefault();       // 自动唤醒调用时无事件对象
  if (recActive) return;          // 防重复
  rec = new SpeechRecognition();
  rec.lang = 'zh-CN';
  rec.continuous = false;          // 单次模式
  rec.interimResults = true;       // 要中间结果

  const btn = document.getElementById('btn-voice');
  const interimEl = document.getElementById('voice-interim');

  // 中间结果 + 最终结果
  rec.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    // 实时显示中间结果
    interimEl.textContent = interim;
    interimEl.classList.toggle('hidden', !interim);
    // 最终结果追加进文本框（不覆盖，先加空格）
    if (final) {
      const ta = document.getElementById('entry-text');
      ta.value = ta.value.trim()
        ? ta.value.trim() + ' ' + final
        : final;
      interimEl.textContent = '';
      interimEl.classList.add('hidden');
    }
  };

  rec.onerror = (event) => {
    console.warn('语音识别错误:', event.error);
    // not-allowed：麦克风权限被拒；no-speech：没检测到语音
    if (event.error === 'not-allowed') {
      showToast('麦克风未授权');
    }
  };

  rec.onend = () => {
    recActive = false;
    btn.classList.remove('recording');
    btn.textContent = '🎤 按住说话';
    interimEl.classList.add('hidden');
    interimEl.textContent = '';
  };

  try {
    rec.start();
    recActive = true;
    btn.classList.add('recording');
    btn.textContent = '🎤 说话中…松开结束';
  } catch (err) {
    // 重复 start 会抛 InvalidStateError，忽略
    console.warn('rec.start 失败:', err);
    recActive = false;
  }
}

// 松开：停止识别
function stopVoice(e) {
  if (!recActive || !rec) return;
  try {
    rec.stop();   // 真停，触发 onend
  } catch (err) {
    console.warn('rec.stop 失败:', err);
  }
}

// ---- 切场检查弹窗（提醒 + 显示今天已记）----
async function openCheckOverlay() {
  const todayEl = document.getElementById('check-today');
  todayEl.innerHTML = '';
  try {
    const today = await listTodayEntries();
    if (today.length === 0) {
      todayEl.innerHTML = '<p class="empty">今天还没记</p>';
    } else {
      const title = document.createElement('p');
      title.className = 'check-today-title';
      title.textContent = '今天已记 ' + today.length + ' 笔';
      todayEl.appendChild(title);
      today.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'check-today-item';

        const time = document.createElement('span');
        time.className = 'ct-time';
        time.textContent = formatTime(entry.created_at);

        const text = document.createElement('span');
        text.className = 'ct-text';
        text.textContent = entry.text;

        const tags = document.createElement('span');
        tags.className = 'ct-tags';
        tags.textContent = (entry.tags || []).join(' / ');

        item.appendChild(time);
        item.appendChild(text);
        item.appendChild(tags);
        todayEl.appendChild(item);
      });
    }
  } catch (err) {
    console.error('读取今日记录失败:', err);
    todayEl.innerHTML = '<p class="empty">读取失败</p>';
  }
  document.getElementById('check-overlay').classList.remove('hidden');
}
function closeCheckOverlay() {
  document.getElementById('check-overlay').classList.add('hidden');
}

// ---- 看板 ----
// 星期几标签（与 byWeekday 数组下标对齐：0=周一 ... 6=周日）
const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// 渲染看板：调 getStats + listEntries
async function renderBoard() {
  let stats, recent;
  try {
    [stats, recent] = await Promise.all([getStats(), listEntries(10)]);
  } catch (err) {
    console.error('看板数据读取失败:', err);
    showToast('看板加载失败');
    return;
  }

  // 本周数
  document.getElementById('board-week').textContent = stats.weekCount;

  // 按场景分布
  const tagWrap = document.getElementById('board-by-tag');
  tagWrap.innerHTML = '';
  const tagEntries = Object.entries(stats.byTag);
  if (tagEntries.length === 0) {
    tagWrap.innerHTML = '<p class="empty">暂无数据</p>';
  } else {
    const maxTag = Math.max(...tagEntries.map(([, n]) => n));
    tagEntries
      .sort((a, b) => b[1] - a[1])   // 数量降序
      .forEach(([tag, n]) => {
        tagWrap.appendChild(makeBarRow(tag, n, maxTag));
      });
  }

  // 按星期几分布
  const wdWrap = document.getElementById('board-by-weekday');
  wdWrap.innerHTML = '';
  const maxWd = Math.max(...stats.byWeekday, 1);   // 至少 1，避免除 0
  stats.byWeekday.forEach((n, i) => {
    wdWrap.appendChild(makeBarRow(WEEKDAY_NAMES[i], n, maxWd));
  });

  // 最近 10 条
  const listEl = document.getElementById('board-recent');
  listEl.innerHTML = '';
  if (recent.length === 0) {
    listEl.innerHTML = '<li class="empty">暂无记录</li>';
  } else {
    recent.forEach(entry => {
      listEl.appendChild(makeEntryItem(entry));
    });
  }
}

// 生成一根横条行：label + bar + count
function makeBarRow(label, count, max) {
  const row = document.createElement('div');
  row.className = 'bar-row';

  const lab = document.createElement('span');
  lab.className = 'bar-label';
  lab.textContent = label;

  const track = document.createElement('div');
  track.className = 'bar-track';
  const fill = document.createElement('div');
  fill.className = 'bar-fill';
  fill.style.width = (max > 0 ? (count / max) * 100 : 0) + '%';
  track.appendChild(fill);

  const cnt = document.createElement('span');
  cnt.className = 'bar-count';
  cnt.textContent = count;

  row.appendChild(lab);
  row.appendChild(track);
  row.appendChild(cnt);
  return row;
}

// 开始编辑一条记录（复用记录页）
function startEdit(entry) {
  editingId = entry.id;
  document.getElementById('entry-text').value = entry.text || '';
  selectedTags = new Set(entry.tags || []);
  document.querySelector('#screen-entry .app-header h1').textContent = '编辑';
  document.getElementById('btn-save').textContent = '更新';
  renderTagChips();
  showScreen('screen-entry');
}

// 生成一条记录项：时间 + 文字 + 标签 + 编辑/删除按钮
function makeEntryItem(entry) {
  const li = document.createElement('li');
  li.className = 'entry-item';

  const time = document.createElement('span');
  time.className = 'entry-time';
  time.textContent = formatTime(entry.created_at);

  const text = document.createElement('span');
  text.className = 'entry-text';
  text.textContent = entry.text;

  const tags = document.createElement('span');
  tags.className = 'entry-tags';
  tags.textContent = (entry.tags || []).join(' / ');

  const actions = document.createElement('div');
  actions.className = 'entry-actions';

  const edit = document.createElement('button');
  edit.className = 'entry-edit';
  edit.textContent = '编辑';
  edit.addEventListener('click', () => startEdit(entry));

  const del = document.createElement('button');
  del.className = 'entry-del';
  del.textContent = '删除';
  del.addEventListener('click', () => askDelete(entry));

  actions.appendChild(edit);
  actions.appendChild(del);

  li.appendChild(time);
  li.appendChild(text);
  li.appendChild(tags);
  li.appendChild(actions);
  return li;
}

// 格式化时间：2026-07-22 14:30
function formatTime(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- 删除二次确认 ----
let pendingDeleteId = null;   // 待删除的 entry id

function askDelete(entry) {
  pendingDeleteId = entry.id;
  document.getElementById('delete-overlay').classList.remove('hidden');
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  try {
    await deleteEntry(pendingDeleteId);
    pendingDeleteId = null;
    document.getElementById('delete-overlay').classList.add('hidden');
    // 刷新看板 + 主页本周数
    await renderBoard();
    refreshWeekCount();
    showToast('已删除');
  } catch (err) {
    console.error('删除失败:', err);
    showToast('删除失败');
  }
}

function cancelDelete() {
  pendingDeleteId = null;
  document.getElementById('delete-overlay').classList.add('hidden');
}

// ---- 事件绑定 ----
document.getElementById('btn-add').addEventListener('click', () => {
  // 新建模式：清空 + 重置标题/按钮
  editingId = null;
  document.getElementById('entry-text').value = '';
  selectedTags.clear();
  document.querySelector('#screen-entry .app-header h1').textContent = '记一笔';
  document.getElementById('btn-save').textContent = '保存';
  renderTagChips();
  showScreen('screen-entry');
});

document.getElementById('btn-back').addEventListener('click', () => {
  // 退出编辑模式
  editingId = null;
  document.querySelector('#screen-entry .app-header h1').textContent = '记一笔';
  document.getElementById('btn-save').textContent = '保存';
  showScreen('screen-home');
});

document.getElementById('btn-save').addEventListener('click', saveEntry);

// 切场检查：05 真弹窗（纯提醒，不存数据）
document.getElementById('btn-check').addEventListener('click', openCheckOverlay);
document.getElementById('btn-check-done').addEventListener('click', closeCheckOverlay);

// 看板
document.getElementById('btn-board').addEventListener('click', async () => {
  showScreen('screen-board');
  await renderBoard();
});
document.getElementById('btn-board-back').addEventListener('click', () => {
  showScreen('screen-home');
});

// 删除二次确认
document.getElementById('btn-delete-confirm').addEventListener('click', confirmDelete);
document.getElementById('btn-delete-cancel').addEventListener('click', cancelDelete);

// 初始化：打开 DB 并刷新本周数 + 语音兼容性检测
openDB()
  .then(db => {
    console.log('数据库就绪:', db.name, 'v' + db.version);
    refreshWeekCount();
  })
  .catch(err => console.error('数据库打开失败:', err));

initVoice();   // 不支持则隐藏按钮 + 显示提示

// 唤醒：?log=1 自动进记录页 + 自动启动语音（06）
// 用法：index.html?log=1（配 Google 助手例程「嘿 Google，记忘事」）
if (new URLSearchParams(location.search).get('log') === '1') {
  renderTagChips();
  showScreen('screen-entry');
  // 自动启动语音：支持时才启动，不支持只进记录页不报错
  if (SpeechRecognition) {
    startVoice(null);
  }
}

// 注册 service worker（需 https 或 localhost）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW 注册成功:', reg.scope))
      .catch(err => console.error('SW 注册失败:', err));
  });
}
