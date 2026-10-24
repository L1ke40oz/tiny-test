// 界面层：渲染各页面、聊天、弹层和动画
window.UI = (function () {
  const E = Engine;
  const C = GameData.characters;
  const ROOMS = GameData.roomOrder;
  const $ = (sel) => document.querySelector(sel);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let tab = 'residents';
  let sheet = null;            // { render, live, onClose }
  let logFilter = 'all';
  let logsLoaded = false;
  let accessQueried = false;
  const seenLogs = new Set();
  const expandedLogs = new Set();
  const histShown = new Set();
  const typeJobs = {};

  const UI = { openChatId: null };

  // ---------- 打字机：按元素 id 写入，重渲染后也能继续 ----------
  function type(elId, text, speed, onDone) {
    if (typeJobs[elId]) return;
    const job = (typeJobs[elId] = { text, i: 0 });
    const step = () => {
      job.i++;
      const el = document.getElementById(elId);
      if (el) el.textContent = text.slice(0, job.i);
      if (job.i < text.length) setTimeout(step, speed || 26);
      else if (onDone) onDone();
    };
    step();
  }
  const typed = (elId) => (typeJobs[elId] ? typeJobs[elId].text.slice(0, typeJobs[elId].i) : '');

  // ============ 各页面 ============
  const views = {
    residents(s) {
      const items = ROOMS.map((id) => {
        const c = C[id];
        const thread = s.threads[id];
        const last = thread[thread.length - 1];
        const preview = c.vacant
          ? '长期空置 · SEALED'
          : last ? (last.from === 'ai' ? '你：' : last.from === 'sys' ? 'SYSTEM：' : '') + last.text : c.job + ' · ' + c.trait;
        const stCls = { 在家: 'home', 外出: 'out', 离线: 'off', 空置: 'off' }[c.status] || 'unk';
        const unread = s.unread[id] ? `<i class="unread">${s.unread[id]}</i>` : '';
        const typing = s.typing[id] ? '<span class="r-typing">正在输入…</span>' : '';
        return `
          <li class="resident ${c.vacant ? 'vacant' : ''} ${s.unread[id] ? 'has-unread' : ''}" data-act="chat" data-id="${id}">
            <div class="avatar" style="--c:${c.color}">${c.avatar}</div>
            <div class="r-main">
              <div class="r-name">${c.vacant ? '空置房间' : c.name}<span class="room">${id}</span></div>
              <div class="r-prev">${typing || esc(preview)}</div>
            </div>
            <div class="r-side"><span class="st st-${stCls}">${c.status}</span>${unread}</div>
          </li>`;
      }).join('');
      return `
        <div class="view-head"><h2>住户</h2><span class="mono muted">4F · 6 ROOMS</span></div>
        <ul class="list">${items}</ul>
        <p class="hint">点击住户进入对话。调查得到的信息会解锁新的话题。</p>`;
    },

    scene(s) {
      const ch = E.chapter;
      const sc = s.scene;
      const node = ch.scene.nodes[sc.node];
      const dark = s.devices.hall.light !== 'ON';
      if (sceneRead && sceneRead.node !== sc.node) sceneRead = null;
      const exits = node.exits.map((id) =>
        `<button class="nav-btn" data-act="go" data-id="${id}" ${sc.override ? 'disabled' : ''}>${id === 'lobby' || (id === 'hall' && sc.node !== 'lobby') ? '◂' : '▸'} ${ch.scene.nodes[id].name}</button>`
      ).join('');
      const map = ['lobby', 'hall', 'door404', 'door405'].map((id) =>
        `<i class="${sc.node === id ? 'here' : sc.visited[id] || id === ch.scene.start ? 'seen' : ''}" title="${ch.scene.nodes[id].name}"></i>`
      ).join('');
      const read = sceneRead
        ? `<div class="scene-read">
             <div class="sr-name">${esc(sceneRead.name)}</div>
             <pre class="mono" id="${sceneRead.elId}">${esc(typed(sceneRead.elId))}</pre>
           </div>`
        : `<div class="scene-read empty mono muted">› 点击画面中的取景框进行查看</div>`;
      const sel = s.selItem && ch.items[s.selItem];
      const items = s.items.map((id) => {
        const it = ch.items[id];
        return `<button class="inv-item ${s.selItem === id ? 'active' : ''}" data-act="item" data-id="${id}">
          ${itemIcon(it.icon)}<span>${it.name}</span></button>`;
      }).join('');
      return `
        <div class="view-head"><h2>现场</h2><span class="mono muted">R-04 · CLEANING UNIT</span></div>
        <div class="scene-wrap ${sc.override ? 'override' : ''} ${sel ? 'using' : ''}" id="scene-wrap">
          ${Scene.svg(s)}
          <div class="scene-osd mono">
            <span><i class="rec"></i>R-04 · ${node.name}</span>
            <span>${dark ? 'LIGHT OFF · 补光' : 'LIGHT ON'}</span>
          </div>
          <div class="scene-map">${map}</div>
          ${sc.override ? '<div class="scene-override mono"><b class="blink">CONTROL OVERRIDE</b><span>CALLER: PID 0404</span></div>' : ''}
          ${sel ? `<div class="scene-using">正在使用【${sel.name}】· 点击目标<button data-act="cancelitem">取消</button></div>` : ''}
        </div>
        <div class="scene-nav">${exits}</div>
        ${read}
        <div class="section-title">物品 <span class="mono">${s.items.length}</span></div>
        <div class="inv">${items || '<div class="inv-empty muted">还没有找到任何物品。</div>'}</div>
        <p class="hint">${dark ? '走廊灯关着，R-04 只能看清补光灯照到的地方。点击画面里的“走廊灯”可以开灯。' : '物品可以对画面中的目标使用，也可以在聊天中出示给住户。'}</p>`;
    },

    events(s) {
      const ch = E.chapter;
      const f = s.flags;
      if (!f.c_report) {
        return `<div class="view-head"><h2>事件</h2></div>
          <div class="card empty"><div class="mono ok">● SYSTEM NORMAL</div><p class="muted">暂无待处理事件。</p></div>`;
      }
      const objs = ch.event.objectives.filter((o) => !(o.hidden && o.hidden(s)));
      const done = objs.filter((o) => o.done(s)).length;
      const status = s.phase === 'end' || s.phase === 'epilogue' ? ['已归档', 'tag-dim']
        : s.phase === 'finale' ? ['UNKNOWN ACCESS', 'tag-err blink']
        : f.decisionReady ? ['等待决策', 'tag-warn'] : ['调查中', 'tag-info'];
      const clueIds = Object.keys(ch.clues);
      const clues = s.clues.map((id) => {
        const c = ch.clues[id];
        return `<div class="clue ${c.core ? 'core' : 'extra'}"><div class="clue-t">${c.core ? '◆' : '◇'} ${c.title}</div><div class="clue-d">${c.desc}</div></div>`;
      }).join('');
      const hidden = clueIds.length - s.clues.length;
      return `
        <div class="view-head"><h2>事件</h2><span class="mono muted">DAY ${s.day}</span></div>
        <div class="card event-card">
          <div class="ev-top"><span class="tag ${status[1]}">${status[0]}</span><span class="mono muted">${ch.event.id} · ${ch.event.time}</span></div>
          <h3>${ch.event.title}</h3>
          <p class="muted">“我门外好像有人。”—— 405 苏妍</p>
          <div class="progress"><i style="width:${(done / objs.length) * 100}%"></i></div>
          <ul class="objectives">
            ${objs.map((o) => `<li class="${o.done(s) ? 'done' : ''}"><i></i><span>${o.text}</span><em>${o.where}</em></li>`).join('')}
          </ul>
        </div>
        <div class="section-title">线索 <span class="mono">${s.clues.length}/${clueIds.length}</span></div>
        <div class="clues">${clues}${hidden ? `<div class="clue unknown">还有 ${hidden} 条线索未发现……</div>` : ''}</div>`;
    },

    devices(s) {
      const hall = s.devices.hall;
      const rooms = ROOMS.map((id) => {
        const d = s.devices[id];
        const c = C[id];
        const anomaly = id === '404' ? 'sealed' : '';
        return `
          <div class="room-card ${anomaly}" data-act="room" data-id="${id}">
            <div class="rc-top"><b>${id}</b><span class="muted">${c.vacant ? '空置' : c.name}</span></div>
            <div class="rc-stats">
              <span class="pill lock-${d.lock.toLowerCase()}">${d.lock}</span>
              <span class="pill ${d.light === 'ON' ? 'on' : ''}">LIGHT ${d.light}</span>
              <span class="pill ${d.temp >= 26 ? 'warm' : ''}">${d.temp}°C</span>
            </div>
          </div>`;
      }).join('');
      return `
        <div class="view-head"><h2>设备</h2><span class="mono muted">4F DEVICE BUS</span></div>
        <div class="card hall-card">
          <div class="card-title">4F 公共走廊</div>
          <div class="ctrl-row">
            <span>走廊灯</span>
            ${switchBtn('hall', 'light', hall.light === 'ON')}
          </div>
          <div class="ctrl-row"><span>移动传感器</span><span class="mono ${hall.motion === 'IDLE' ? 'muted' : 'err blink'}">${hall.motion}</span></div>
        </div>
        <div class="room-grid">${rooms}</div>
        <p class="hint">点击房间可以控制门锁、灯光、温度，并查看门锁记录。</p>`;
    },

    logs(s) {
      if (!logsLoaded) {
        return `<div class="view-head"><h2>日志</h2></div><div class="loading mono">LOADING LOG BUFFER<span class="dots"></span></div>`;
      }
      const filters = [['all', '全部'], ['door', '门锁'], ['light', '灯光'], ['temp', '温度'], ['anomaly', '异常'], ['sys', '系统']];
      const visible = s.logs.filter((l) => !l.perm || s.perms[l.perm]);
      const hiddenCount = s.logs.length - visible.length;
      const rows = visible
        .map((l, i) => ({ l, i }))
        .sort((a, b) => a.l.t - b.l.t || a.i - b.i)
        .map(({ l }) => l)
        .filter((l) => logFilter === 'all' || l.type === logFilter || (logFilter === 'anomaly' && l.level === 'error') || (logFilter === 'sys' && l.type === 'access'));
      let n = 0;
      const html = rows.map((l) => {
        const isNew = !seenLogs.has(l.id);
        const delay = isNew ? `style="animation-delay:${Math.min(n++, 20) * 35}ms"` : '';
        const cls = [l.level || '', l.removing ? 'removing' : '', isNew ? 'new' : '', l.inspect ? 'inspectable' : ''].join(' ');
        const insp = expandedLogs.has(l.id)
          ? `<pre class="log-insp" id="insp-${l.id}">${esc(typed('insp-' + l.id))}</pre>` : '';
        return `
          <div class="log ${cls}" ${delay} ${l.inspect ? `data-act="loginspect" data-id="${l.id}"` : ''}>
            <span class="lt">${E.fmt(l.t)}</span><span class="ls">${l.src}</span><span class="lm">${esc(l.msg)}</span>
            ${l.inspect ? `<i class="li">${l.inspected ? '已解析' : '解析'}</i>` : ''}
          </div>${insp}`;
      }).join('');
      rows.forEach((l) => seenLogs.add(l.id));
      return `
        <div class="view-head"><h2>日志</h2><span class="mono muted">${s.logs.length} ENTRIES</span></div>
        <div class="chips">${filters.map(([k, t]) => `<button class="chip ${logFilter === k ? 'active' : ''}" data-act="logfilter" data-f="${k}">${t}</button>`).join('')}</div>
        <div class="log-list mono">${html || '<div class="muted">无匹配记录</div>'}</div>
        ${hiddenCount ? `<div class="hint mono">${hiddenCount} 条记录需要【门禁历史】权限</div>` : ''}
        <p class="hint">带“解析”标记的条目可以点击深入分析。</p>`;
    },

    monitor(s) {
      const ch = E.chapter;
      const access = s.perms.access
        ? `
          <div class="acc-list mono">
            ${ch.accessRecords.map((r) => `<div class="acc"><span>${E.fmt(r.t)}</span><span>${r.gate}</span><span>${r.who}</span><span>${r.dir}</span></div>`).join('')}
          </div>
          ${accessQueried
            ? `<div class="acc-result mono ${s.flags.c_access ? 'shown' : ''}">${s.flags.c_access ? '23:17 – 23:47 · 4F 进入记录：<b>0</b> 条' : '检索中<span class="dots"></span>'}</div>`
            : `<button class="btn btn-ghost full" data-act="access">检索：4F · 近 30 分钟</button>`}`
        : `<div class="locked-box"><span class="mono">ACCESS DENIED</span><p class="muted">需要【门禁历史】权限</p><button class="btn btn-ghost" data-act="perm" data-p="access">申请临时权限</button></div>`;
      const cams = [['CAM_4F_HALL', '4F 走廊'], ['CAM_1F_LOBBY', '1F 大堂'], ['CAM_ELEVATOR', '电梯轿厢']];
      const camHtml = s.perms.camera
        ? cams.map(([id, name]) => `<div class="cam-item" data-act="cam" data-id="${id}"><span class="rec"></span><b class="mono">${id}</b><span class="muted">${name}</span><span class="mono ok">LIVE</span></div>`).join('')
        : `<div class="locked-box"><span class="mono">ACCESS DENIED</span><p class="muted">需要【公共区域摄像头】权限，申请时需要关联异常证据。</p><button class="btn btn-ghost" data-act="perm" data-p="camera">申请临时权限</button></div>`;
      return `
        <div class="view-head"><h2>监控</h2><span class="mono muted">SECURITY</span></div>
        <div class="card"><div class="card-title">门禁记录 ${s.perms.access ? '<span class="tag tag-warn">临时授权</span>' : ''}</div>${access}</div>
        <div class="card"><div class="card-title">公共区域摄像头 ${s.perms.camera ? '<span class="tag tag-warn">临时授权</span>' : ''}</div>${camHtml}</div>
        <div class="card dim"><div class="card-title">异常行为记录</div><div class="locked-box"><span class="mono">LEVEL 2 REQUIRED</span><p class="muted">将在后续章节开放</p></div></div>`;
    },

    system(s) {
      const permRows = Object.keys(s.perms).map((p) => {
        const ok = s.perms[p];
        const req = !ok && (p === 'access' || p === 'camera')
          ? `<button class="btn btn-mini" data-act="perm" data-p="${p}">申请</button>`
          : `<span class="mono ${ok ? 'ok' : 'muted'}">${ok ? 'GRANTED' : 'LOCKED'}</span>`;
        return `<div class="ctrl-row"><span>${E.permName(p)}</span>${req}</div>`;
      }).join('');
      const procs = s.processes.map((p) =>
        `<div class="proc ${p.danger ? 'danger' : ''}" ${p.danger ? 'data-act="proc"' : ''}><span>PID ${p.pid}</span><span>${p.name}</span><span>${p.st}</span></div>`
      ).join('');
      const integ = s.integrity;
      const debug = /debug/.test(location.search)
        ? `<div class="card"><div class="card-title">DEBUG · 隐藏变量</div><pre class="mono small">${esc(JSON.stringify(s.vars, null, 1))}</pre></div>` : '';
      return `
        <div class="view-head"><h2>系统</h2><span class="mono muted">HOME-AI 404 v2.0</span></div>
        <div class="card integrity ${integ < 99.5 ? 'warn' : ''}">
          <div class="big mono">${integ.toFixed(1)}<small>%</small></div>
          <div class="muted">日志完整性 LOG INTEGRITY</div>
          <div class="bar"><i style="width:${integ}%"></i></div>
          <div class="kv mono"><span>上线时间 23:46:30</span><span>4F · 6 节点</span></div>
        </div>
        <div class="card"><div class="card-title">权限</div>${permRows}</div>
        <div class="card"><div class="card-title">进程</div><div class="mono">${procs}</div></div>
        <div class="card dim"><div class="card-title">上一代 AI 残留数据</div>
          <div class="mono small muted">/legacy/home-ai-404_v1.0 ······ <span class="err">已隔离</span><br/>大小：██.█ MB · 最后写入：730 天前</div></div>
        ${debug}
        <button class="btn btn-ghost full" data-act="restart">重新开始</button>`;
    },
  };

  function itemIcon(kind) {
    return kind === 'card'
      ? '<svg viewBox="0 0 24 24" class="ii"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 14h5M15 10h3"/></svg>'
      : '<svg viewBox="0 0 24 24" class="ii"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 19h4"/></svg>';
  }

  // 现场读数：每次查看生成新的打字机
  let sceneRead = null;
  let readSeq = 0;
  function showRead(r) {
    if (!r) return;
    const elId = 'sr-' + ++readSeq;
    sceneRead = { name: r.name, elId, node: E.state.scene.node };
    render();
    type(elId, r.lines.map((l) => '› ' + l).join('\n'), 20);
  }

  function onHotspot(el) {
    const s = E.state;
    const go = el.dataset.go;
    if (go && !s.selItem) { moveTo(go); return; }
    if (go) { E.selectItem(null); moveTo(go); return; }
    showRead(s.selItem ? E.useItem(s.selItem, el.dataset.id) : E.examine(el.dataset.id));
  }

  function moveTo(id) {
    const wrap = $('#scene-wrap');
    if (E.state.scene.override) { E.goNode(id); return; }
    if (wrap) wrap.classList.add('moving');
    setTimeout(() => {
      if (E.goNode(id)) sceneRead = null;
      render();
      const w = $('#scene-wrap');
      if (w) { w.classList.add('arrive'); setTimeout(() => w.classList.remove('arrive'), 400); }
    }, 380);
  }

  function openItem(id) {
    const it = E.chapter.items[id];
    openSheet(() => {
      $('#sheet').innerHTML = `
        <div class="sheet-head"><b>${it.name}</b><button class="btn-x" data-close="sheet">×</button></div>
        <div class="sheet-body">
          <div class="item-big">${itemIcon(it.icon)}</div>
          <p>${it.desc}</p>
          <p class="muted small" style="margin-top:8px">${it.hint}</p>
          <button class="btn btn-primary full" data-act="useitem" data-id="${id}">在现场使用</button>
        </div>`;
    }, false);
  }

  function switchBtn(room, dev, on) {
    return `<button class="switch ${on ? 'on' : ''}" data-act="dev" data-room="${room}" data-dev="${dev}" data-val="${on ? 'OFF' : 'ON'}"><i></i></button>`;
  }

  // ============ 主渲染 ============
  function render() {
    const s = E.state;
    if (!s) return;
    const v = $('#view');
    const keepScroll = v.scrollTop;
    const atBottom = v.scrollHeight - v.scrollTop - v.clientHeight < 40;
    v.innerHTML = views[tab](s);
    if (tab === 'logs' && atBottom) v.scrollTop = v.scrollHeight;
    else v.scrollTop = keepScroll;
    updateBadges(s);
    if (UI.openChatId) renderChatOptions();
    if (sheet && sheet.live) sheet.render();
  }

  function updateBadges(s) {
    const unread = Object.values(s.unread).reduce((a, b) => a + b, 0);
    const set = (t, on, txt) => {
      const b = document.querySelector(`#tabbar [data-tab="${t}"] .badge`);
      b.className = 'badge' + (on ? ' on' : '');
      b.textContent = txt || '';
    };
    set('residents', unread > 0, unread || '');
    set('scene', s.newItem && tab !== 'scene');
    set('events', s.newClue && tab !== 'events');
    set('logs', s.newLog && tab !== 'logs');
    set('system', s.processes.some((p) => p.danger) && tab !== 'system' && !s.flags.sawProc);
    document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  }

  UI.updateClock = function () {
    const s = E.state;
    $('#tb-time').textContent = E.fmt(s.clock, false);
    $('#tb-day').textContent = 'DAY ' + s.day;
    $('#tb-chapter').textContent = E.chapter.title;
    const el = $('#tb-integrity');
    el.textContent = 'LOG ' + s.integrity.toFixed(1) + '%';
    el.className = 'tb-integrity' + (s.integrity < 99.5 ? ' warn' : '');
  };

  UI.goTab = function (t) {
    closeChat();
    closeSheet();
    const s = E.state;
    tab = t;
    if (t === 'events') s.newClue = false;
    if (t === 'scene') s.newItem = false;
    if (t === 'system') s.flags.sawProc = true;
    if (t === 'logs') {
      s.newLog = false;
      if (!logsLoaded) setTimeout(() => { logsLoaded = true; if (tab === 'logs') { render(); scrollBottom(); } }, 750);
    }
    const v = $('#view');
    v.scrollTop = 0;
    v.classList.remove('tab-in');
    void v.offsetWidth;
    v.classList.add('tab-in');
    setTimeout(() => v.classList.remove('tab-in'), 250);
    render();
    if (t === 'logs' && logsLoaded) scrollBottom();
  };
  const scrollBottom = () => { const v = $('#view'); v.scrollTop = v.scrollHeight; };

  // ============ 聊天 ============
  function openChat(id) {
    const c = C[id];
    if (c.vacant) {
      E.inspect('room:404');
      UI.toast('404 无住户账户 · 房间已封存（SEALED）', 'warn');
      return;
    }
    const s = E.state;
    UI.openChatId = id;
    s.unread[id] = 0;
    $('#chat-avatar').textContent = c.avatar;
    $('#chat-avatar').style.setProperty('--c', c.color);
    $('#chat-name').innerHTML = `${c.name} <span class="room">${id}</span>`;
    $('#chat-sub').textContent = `${c.job} · ${c.status}`;
    const box = $('#chat-msgs');
    box.innerHTML = '';
    s.threads[id].forEach((m) => box.appendChild(bubble(m, false)));
    $('#chat-typing').classList.toggle('hidden', !s.typing[id]);
    $('#chat').classList.remove('hidden');
    requestAnimationFrame(() => $('#chat').classList.add('open'));
    renderChatOptions();
    box.scrollTop = box.scrollHeight;
    E.emit();
  }

  function closeChat() {
    if (!UI.openChatId) return;
    UI.openChatId = null;
    const el = $('#chat');
    el.classList.remove('open');
    setTimeout(() => { if (!UI.openChatId) el.classList.add('hidden'); }, 250);
    E.state && render();
  }

  function bubble(m, animate) {
    const d = document.createElement('div');
    d.className = 'msg msg-' + m.from + (animate ? ' anim' : '');
    if (m.from === 'sys') d.innerHTML = `<span class="mono">SYSTEM · ${E.fmt(m.t, false)}</span>${esc(m.text)}`;
    else d.innerHTML = `<div class="b">${esc(m.text)}</div><span class="t mono">${E.fmt(m.t, false)}</span>`;
    return d;
  }

  UI.onMessage = function (id, m) {
    if (UI.openChatId !== id) return;
    const box = $('#chat-msgs');
    box.appendChild(bubble(m, true));
    box.scrollTop = box.scrollHeight;
  };

  UI.onTyping = function (id, on) {
    if (UI.openChatId === id) {
      $('#chat-typing').classList.toggle('hidden', !on);
      const box = $('#chat-msgs');
      box.scrollTop = box.scrollHeight;
    }
    if (tab === 'residents' && !UI.openChatId) render();
  };

  // 只在内容变化时重写，避免选项动画反复播放
  function setOptions(box, html) {
    if (box.dataset.html === html) return;
    box.dataset.html = html;
    box.innerHTML = html;
  }

  function renderChatOptions() {
    const id = UI.openChatId;
    const s = E.state;
    const box = $('#chat-options');
    if (s.busy[id] > 0) { setOptions(box, '<div class="opt-hint mono">等待回复<span class="dots"></span></div>'); return; }
    const topics = E.availableTopics(id).sort((a, b) => !!a.decision - !!b.decision);
    if (!topics.length) {
      setOptions(box, `<div class="opt-hint">${s.phase === 'play' ? '暂无新话题 —— 去调查设备、日志或监控，可能会发现新的问题。' : '……'}</div>`);
      return;
    }
    setOptions(box, topics.map((t) =>
      `<button class="opt ${t.decision ? 'decision' : ''} ${t.group === '405_end' ? 'decision' : ''}" data-act="topic" data-id="${t.id}">${t.decision ? '<em>决策</em>' : ''}${esc(t.text)}</button>`
    ).join(''));
  }

  // ============ 底部面板 ============
  function openSheet(renderFn, live, onClose) {
    sheet = { render: renderFn, live, onClose };
    const el = $('#sheet');
    el.classList.remove('hidden');
    renderFn();
    requestAnimationFrame(() => el.classList.add('open'));
  }
  function closeSheet() {
    if (!sheet) return;
    if (sheet.onClose) sheet.onClose();
    sheet = null;
    const el = $('#sheet');
    el.classList.remove('open');
    setTimeout(() => { if (!sheet) el.classList.add('hidden'); }, 250);
  }

  function openRoom(id) {
    if (id === '404') E.inspect('room:404');
    openSheet(() => {
      const s = E.state;
      const d = s.devices[id];
      const c = C[id];
      const sealed = d.lock === 'SEALED';
      const lockCtrl = sealed
        ? `<span class="pill lock-sealed">SEALED</span>`
        : `<div class="seg">
            <button class="${d.lock !== 'UNLOCKED' ? 'active' : ''}" data-act="dev" data-room="${id}" data-dev="lock" data-val="LOCKED">锁定</button>
            <button class="${d.lock === 'UNLOCKED' ? 'active danger' : ''}" data-act="dev" data-room="${id}" data-dev="lock" data-val="UNLOCKED">解锁</button>
          </div>`;
      const hist = histShown.has(id)
        ? `<div class="hist mono">${s.lockHistory[id].map((h) => h.erased
            ? `<div class="h erased"><span>${E.fmt(h.t)}</span><span>[数据不存在]</span><span></span></div>`
            : `<div class="h ${h.anomaly ? 'anomaly' : ''}"><span>${h.t == null ? h.label : E.fmt(h.t)}</span><span>${h.state}</span><span>${h.by}</span></div>`).join('')}</div>`
        : `<button class="btn btn-ghost full" data-act="lockhist" data-room="${id}">查看门锁记录</button>`;
      $('#sheet').innerHTML = `
        <div class="sheet-head"><div><b class="mono">ROOM ${id}</b><span class="muted"> ${c.vacant ? '空置 · 封存' : c.name + ' · ' + c.job}</span></div><button class="btn-x" data-close="sheet">×</button></div>
        <div class="sheet-body">
          <div class="ctrl-row"><span>门锁 <small class="mono muted">${d.lock}</small></span>${lockCtrl}</div>
          <div class="ctrl-row"><span>灯光</span>${switchBtn(id, 'light', d.light === 'ON')}</div>
          <div class="ctrl-row"><span>温度</span>
            <div class="temp">
              <button data-act="dev" data-room="${id}" data-dev="temp" data-val="${Math.max(16, d.temp - 1)}">−</button>
              <b class="mono ${d.temp >= 26 ? 'warm' : ''}">${d.temp}°C</b>
              <button data-act="dev" data-room="${id}" data-dev="temp" data-val="${Math.min(30, d.temp + 1)}">+</button>
            </div>
          </div>
          ${hist}
        </div>`;
    }, true);
  }

  function showLockHistory(room) {
    histShown.add(room);
    E.inspect('lock:' + room);
    if (sheet) sheet.render();
  }

  // ---------- 摄像头 ----------
  function corridorSVG(cam, led405) {
    // 简单透视走廊：左侧 401/403/405，右侧 402/404/406
    const W = 320, H = 200, bx1 = 138, bx2 = 182, by1 = 78, by2 = 122;
    const top = (x) => (by1 * x) / bx1;
    const bot = (x) => H - ((H - by2) * x) / bx1;
    const door = (x1, x2, label, right, led) => {
      const p = [[x1, top(x1) + (bot(x1) - top(x1)) * 0.28], [x2, top(x2) + (bot(x2) - top(x2)) * 0.28], [x2, bot(x2)], [x1, bot(x1)]];
      const pts = p.map(([x, y]) => (right ? W - x : x) + ',' + y).join(' ');
      const lx = right ? W - (x1 + x2) / 2 : (x1 + x2) / 2;
      const ly = top(x1) + (bot(x1) - top(x1)) * 0.2;
      const ledX = right ? W - x2 - 3 : x2 + 3;
      const ledY = (top(x2) + bot(x2)) / 2;
      return `<polygon points="${pts}" class="door"/><text x="${lx}" y="${ly}" class="dl">${label}</text>` +
        (led ? `<circle cx="${ledX}" cy="${ledY}" r="1.8" fill="${led}"/>` : '');
    };
    const doors = cam === 'CAM_4F_HALL'
      ? door(14, 46, '401', false, '#ff4d6a') + door(70, 94, '403', false, '#ff4d6a') + door(110, 126, '405', false, led405) +
        door(14, 46, '402', true, '#ff4d6a') + door(70, 94, '404', true, '#7a2131') + door(110, 126, '406', true, '#ff4d6a')
      : cam === 'CAM_1F_LOBBY' ? door(40, 100, 'EXIT', false, '#5ee0b0') : door(100, 128, '4F', true, '#36e2f2');
    const lit = cam !== 'CAM_4F_HALL' || E.state.devices.hall.light === 'ON';
    const lamps = [[0.2, 34], [0.5, 20], [0.78, 10]]
      .map(([k, w]) => `<rect x="${W / 2 - w / 2}" y="${by1 * k}" width="${w}" height="${Math.max(1.5, w / 10)}" class="lamp"/>`).join('');
    return `
      <svg viewBox="0 0 ${W} ${H}" class="corridor ${lit ? 'lit' : ''}">
        <polygon points="0,0 ${bx1},${by1} ${bx1},${by2} 0,${H}" class="wall"/>
        <polygon points="${W},0 ${bx2},${by1} ${bx2},${by2} ${W},${H}" class="wall"/>
        <polygon points="0,${H} ${bx1},${by2} ${bx2},${by2} ${W},${H}" class="floor"/>
        <polygon points="0,0 ${bx1},${by1} ${bx2},${by1} ${W},0" class="ceil"/>
        <rect x="${bx1}" y="${by1}" width="${bx2 - bx1}" height="${by2 - by1}" class="back"/>
        ${lamps}
        ${doors}
      </svg>`;
  }

  function openCamera(cam) {
    let clockTimer = null;
    let replaying = false;
    const s = E.state;
    const captions = {
      CAM_4F_HALL: '实时画面：走廊无人。',
      CAM_1F_LOBBY: '实时画面：大堂无人。最后一次人员经过：23:12（403 周航）。',
      CAM_ELEVATOR: '实时画面：电梯停靠 4F，门已关闭。',
    };
    openSheet(() => {
      $('#sheet').innerHTML = `
        <div class="sheet-head"><b class="mono">${cam}</b><button class="btn-x" data-close="sheet">×</button></div>
        <div class="sheet-body">
          <div class="cam-screen loading" id="cam-screen">
            <div class="cam-load mono">CONNECTING ${cam}<span class="dots"></span></div>
          </div>
          ${cam === 'CAM_4F_HALL' ? `<button class="btn btn-ghost full" id="btn-replay">回放 23:44:45 – 23:44:55</button>` : ''}
          <p class="cam-cap muted" id="cam-cap"></p>
        </div>`;
    }, false, () => clearInterval(clockTimer));

    if (!s.flags['cam_' + cam]) { s.flags['cam_' + cam] = true; E.log('CAM', cam + ' STREAM_OPEN', { type: 'sys' }); E.emit(); }

    const showFeed = (t, led) => {
      const scr = $('#cam-screen');
      if (!scr) return;
      scr.classList.remove('loading');
      scr.innerHTML = `${corridorSVG(cam, led)}<div class="cam-noise"></div>
        <div class="cam-osd mono"><span><i class="rec"></i>${replaying ? 'REPLAY' : 'LIVE'}</span><span id="cam-ts">${E.fmt(t)}</span></div>
        <div class="cam-drop mono" id="cam-drop">FRAME DROPPED ×24</div>`;
    };
    E.later(1300, () => {
      showFeed(E.state.clock, E.state.devices['405'].lock === 'UNLOCKED' ? '#5ee0b0' : '#ff4d6a');
      $('#cam-cap') && ($('#cam-cap').textContent = captions[cam]);
      clockTimer = setInterval(() => { if (!replaying && $('#cam-ts')) $('#cam-ts').textContent = E.fmt(E.state.clock); }, 1000);
    });

    const btn = $('#btn-replay');
    if (btn) btn.onclick = () => {
      if (replaying) return;
      replaying = true;
      btn.disabled = true;
      $('#cam-cap').textContent = '';
      const start = 23 * 3600 + 44 * 60 + 45;
      let t = start;
      showFeed(t, '#ff4d6a');
      const iv = setInterval(() => {
        t++;
        const ts = $('#cam-ts');
        if (!ts) { clearInterval(iv); return; }
        ts.textContent = E.fmt(t);
        if (t === start + 5) { showFeed(t, '#5ee0b0'); }
        if (t === start + 6) { $('#cam-screen').classList.add('dropped'); }
        if (t === start + 7) { $('#cam-screen').classList.remove('dropped'); showFeed(t, '#ff4d6a'); $('#cam-drop').classList.add('show'); }
        if (t >= start + 10) {
          clearInterval(iv);
          replaying = false;
          btn.disabled = false;
          type('cam-cap', '回放结束。23:44:51 画面缺失 0.8 秒（24 帧）。缺失前的最后一帧中，405 门锁指示灯为绿色——OPEN。画面中没有任何人。', 30);
          E.cameraReplayDone();
        }
      }, 650);
    };
  }

  // ============ 提示 / 弹层 ============
  UI.toast = function (text, level) {
    const box = $('#toasts');
    const d = document.createElement('div');
    d.className = 'toast toast-' + (level || 'info');
    d.textContent = text;
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('out'), 3200);
    setTimeout(() => d.remove(), 3600);
  };

  UI.notifyMessage = function (id, text) {
    const c = C[id];
    const box = $('#toasts');
    const d = document.createElement('div');
    d.className = 'toast toast-msg';
    d.dataset.act = 'chat';
    d.dataset.id = id;
    d.innerHTML = `<div class="avatar sm" style="--c:${c.color}">${c.avatar}</div><div><b>${c.name} · ${id}</b><div>${esc(text)}</div></div>`;
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('out'), 3800);
    setTimeout(() => d.remove(), 4200);
  };

  function glitch(ms) {
    const g = $('#fx-glitch');
    g.classList.add('on');
    document.body.classList.add('shake');
    setTimeout(() => { g.classList.remove('on'); document.body.classList.remove('shake'); }, ms || 600);
  }

  UI.alert = function (opts) {
    glitch(900);
    const ov = $('#overlay');
    ov.className = 'alert-ov ' + (opts.level || '');
    ov.innerHTML = `
      <div class="alert-box">
        <div class="alert-title mono blink">⚠ ${esc(opts.title)}</div>
        <pre class="alert-lines mono" id="alert-lines"></pre>
        <button class="btn btn-danger full hidden" id="alert-btn">${esc(opts.button || '确认')}</button>
      </div>`;
    const id = 'alert-lines';
    delete typeJobs[id];
    type(id, opts.lines.join('\n'), 34, () => $('#alert-btn').classList.remove('hidden'));
    $('#alert-btn').onclick = () => {
      ov.className = 'hidden';
      ov.innerHTML = '';
      opts.onClose && opts.onClose();
    };
  };

  // ---------- 章节结算 ----------
  UI.showChapterEnd = function () {
    closeChat();
    closeSheet();
    const s = E.state;
    const ch = E.chapter;
    const v = s.vars;
    const bar = (label, val, max, cls) => {
      const pct = Math.max(4, Math.min(100, ((val + 3) / (max + 3)) * 100));
      return `<div class="stat"><span>${label}</span><div class="sbar ${cls || ''}"><i style="width:${pct}%"></i></div><b class="mono">${val > 0 ? '+' : ''}${val}</b></div>`;
    };
    const leanName = { guardian: '守护者', controller: '控制者', delete: '删除自己' }[E.leaning()];
    const ov = $('#overlay');
    ov.className = 'end-ov';
    ov.innerHTML = `
      <div class="end-box">
        <div class="mono muted">DAY ${s.day} · CHAPTER COMPLETE</div>
        <h2>《${ch.title}》</h2>
        <p class="muted">405 的门锁又开了一次。这一次，签名是你。</p>
        <div class="end-sec">线索 <b class="mono">${s.clues.length}/${Object.keys(ch.clues).length}</b> · 日志完整性 <b class="mono warn">${s.integrity.toFixed(1)}%</b></div>
        <div class="end-sec-title">住户信任</div>
        ${['401', '402', '403', '405', '406'].map((r) => bar(r + ' ' + C[r].name, v['trust_' + r], 5)).join('')}
        <div class="end-sec-title">行为模型</div>
        ${bar('共情 EMPATHY', v.ai_empathy, 6, 'c1')}
        ${bar('控制 CONTROL', v.ai_control, 6, 'c2')}
        ${bar('好奇 CURIOSITY', v.ai_curiosity, 6, 'c3')}
        ${bar('异常 CORRUPTION', v.system_corruption, 4, 'c4')}
        <div class="lean">当前轨迹最接近：<b>${leanName}</b></div>
        <div class="next mono">NEXT · DAY 2《第二把钥匙》—— 制作中</div>
        <button class="btn btn-primary full" data-act="final">进入终章（演示）</button>
        <button class="btn btn-ghost full" data-act="restart">重新开始第一章</button>
      </div>`;
  };

  // ---------- 终章演示 ----------
  function showFinalDemo() {
    const fd = GameData.finalDemo;
    const ov = $('#overlay');
    ov.className = 'final-ov';
    ov.innerHTML = `
      <div class="final-box mono">
        <div class="final-head blink">${fd.header}</div>
        <div id="final-lines"></div>
        <div id="final-choices" class="hidden">${fd.choices.map((c) => `<button class="opt decision" data-act="ending" data-id="${c.id}">${c.text}</button>`).join('')}</div>
      </div>`;
    glitch(500);
    let i = 0;
    const next = () => {
      if (i >= fd.lines.length) { $('#final-choices').classList.remove('hidden'); return; }
      const l = fd.lines[i];
      const div = document.createElement('div');
      div.className = 'fl ' + l.cls;
      div.id = 'fl-' + i;
      $('#final-lines').appendChild(div);
      const box = $('.final-box'); box.scrollTop = box.scrollHeight;
      i++;
      type(div.id, l.text, l.cls === 'legacy' ? 38 : 18, () => setTimeout(next, 380));
    };
    next();
  }

  function showEnding(choiceId) {
    const r = E.computeEnding(choiceId);
    const end = GameData.endings[r.id];
    const choiceText = GameData.finalDemo.choices.find((c) => c.id === choiceId).text;
    const ov = $('#overlay');
    ov.className = 'ending-ov ending-' + r.id;
    ov.innerHTML = `
      <div class="ending-box">
        ${r.overridden ? `<div class="override mono">你选择了：“${esc(choiceText)}”<br/>但你的行为模型给出了另一个答案。</div>` : ''}
        <div class="mono muted">${end.code}</div>
        <h1>${end.title}</h1>
        <div class="ending-lines">${end.lines.map((l, i) => `<p style="animation-delay:${0.6 + i * 0.9}s">${esc(l)}</p>`).join('')}</div>
        <button class="btn btn-ghost full" data-act="restart" style="animation-delay:${0.8 + end.lines.length * 0.9}s">重新开始</button>
      </div>`;
    glitch(400);
  }

  // ============ 事件委托 ============
  function bind() {
    document.getElementById('app').addEventListener('click', (ev) => {
      const closeEl = ev.target.closest('[data-close]');
      if (closeEl) { closeEl.dataset.close === 'chat' ? closeChat() : closeSheet(); return; }
      const tabEl = ev.target.closest('#tabbar [data-tab]');
      if (tabEl) { UI.goTab(tabEl.dataset.tab); return; }
      const el = ev.target.closest('[data-act]');
      if (!el) return;
      const d = el.dataset;
      switch (d.act) {
        case 'chat':
          if (el.classList.contains('toast')) el.remove();
          closeSheet();
          if (tab !== 'residents' && !el.classList.contains('resident')) { tab = 'residents'; render(); }
          openChat(d.id);
          break;
        case 'topic': E.selectTopic(d.id); break;
        case 'room': openRoom(d.id); break;
        case 'dev': {
          const val = d.dev === 'temp' ? Number(d.val) : d.val;
          E.device(d.room, d.dev, val);
          break;
        }
        case 'lockhist': showLockHistory(d.room); break;
        case 'loginspect': {
          const lines = E.inspectLog(d.id);
          if (!lines) break;
          const elId = 'insp-' + d.id;
          if (expandedLogs.has(d.id)) expandedLogs.delete(d.id);
          else expandedLogs.add(d.id);
          render();
          if (expandedLogs.has(d.id)) type(elId, lines.map((l) => '> ' + l).join('\n'), 22);
          break;
        }
        case 'logfilter': logFilter = d.f; render(); break;
        case 'access': accessQueried = true; E.viewAccess(); render(); break;
        case 'perm': E.requestPerm(d.p); break;
        case 'cam': openCamera(d.id); break;
        case 'proc': UI.toast('拒绝访问：PID 0404 不属于任何已注册模块', 'error'); glitch(300); break;
        case 'restart': UI.restart(); break;
        case 'hs': onHotspot(el); break;
        case 'go': moveTo(d.id); break;
        case 'item': openItem(d.id); break;
        case 'useitem': closeSheet(); if (E.state.selItem !== d.id) E.selectItem(d.id); if (tab !== 'scene') UI.goTab('scene'); break;
        case 'cancelitem': E.selectItem(null); break;
        case 'final': showFinalDemo(); break;
        case 'ending': showEnding(d.id); break;
      }
    });
  }

  UI.restart = function () {
    const ov = $('#overlay');
    ov.className = 'hidden';
    ov.innerHTML = '';
    closeChat();
    closeSheet();
    tab = 'residents';
    logFilter = 'all';
    logsLoaded = false;
    accessQueried = false;
    seenLogs.clear();
    expandedLogs.clear();
    histShown.clear();
    sceneRead = null;
    Object.keys(typeJobs).forEach((k) => delete typeJobs[k]);
    E.start('ch1');
    UI.updateClock();
    render();
  };

  UI.init = function () {
    E.ui = UI;
    E.on(render);
    bind();
  };
  UI.render = render;
  UI.glitch = glitch;

  return UI;
})();
