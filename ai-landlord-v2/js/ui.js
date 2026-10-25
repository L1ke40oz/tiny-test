// 界面层：4 个标签页（对话 / 现场 / 卷宗 / 系统）+ 连线图 + 过场
window.UI = (function () {
  const E = Engine;
  const C = GameData.characters;
  const ROOMS = GameData.roomOrder;
  const $ = (sel) => document.querySelector(sel);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let tab = 'scene';
  let sheet = null;
  let logsOpen = false;
  let accessShown = false;
  const seenLogs = new Set();
  const expandedLogs = new Set();
  const typeJobs = {};
  const dossierSeen = new Set();
  const dOpen = {};

  const UI = { openChatId: null, lastEnding: null };

  // ---------- 打字机 ----------
  function type(elId, text, speed, onDone) {
    if (typeJobs[elId]) return;
    const job = (typeJobs[elId] = { text, i: 0 });
    const step = () => {
      job.i++;
      const el = document.getElementById(elId);
      if (el) el.textContent = text.slice(0, job.i);
      if (job.i < text.length) setTimeout(step, speed || 24);
      else if (onDone) onDone();
    };
    step();
  }
  const typed = (elId) => (typeJobs[elId] ? typeJobs[elId].text.slice(0, typeJobs[elId].i) : '');

  // ============================================================
  //  页签 1 · 对话
  // ============================================================
  const views = {
    chat(s) {
      const items = ROOMS.map((id) => {
        const c = C[id];
        const thread = s.threads[id];
        const last = thread[thread.length - 1];
        const preview = c.vacant
          ? '长期空置 · 无住户账户'
          : last ? (last.from === 'ai' ? '你：' : last.from === 'sys' ? '' : '') + last.text : c.job + ' · ' + c.trait;
        const stCls = { 在家: 'home', 外出: 'out', 离线: 'off', 空置: 'off' }[c.status] || 'unk';
        const unread = s.unread[id] ? `<i class="unread">${s.unread[id]}</i>` : '';
        const typing = s.typing[id] ? '<span class="r-typing">正在输入…</span>' : '';
        return `
          <li class="resident ${c.vacant ? 'vacant' : ''} ${s.unread[id] ? 'has-unread' : ''}" data-act="chat" data-id="${id}">
            <div class="avatar pf-wrap" style="--c:${c.color}">${Art.portrait(id, 46)}</div>
            <div class="r-main">
              <div class="r-name">${c.vacant ? '空置房间' : c.name}<span class="room">${id}</span></div>
              <div class="r-prev">${typing || esc(preview)}</div>
            </div>
            <div class="r-side"><span class="st st-${stCls}">${c.status}</span>${unread}</div>
          </li>`;
      }).join('');
      return `
        <div class="view-head"><h2>对话</h2><span class="mono muted">4F · 4 ROOMS</span></div>
        <ul class="list">${items}</ul>
        <p class="hint">点住户进入对话。查到的新信息，会解锁新的话题。</p>`;
    },

    // ============================================================
    //  页签 2 · 现场（第一视角）
    // ============================================================
    scene(s) {
      const ch = E.chapter;
      const view = s.scene.view;
      const pack = Art.scene(s, view);
      const spots = pack.spots.filter((sp) => (sp.door ? true : E.hotspotVisible(sp.id)));
      const svgSpots = spots.map((sp) => Art.frame(sp, !!s.scene.examined[sp.id], !!s.selItem)).join('');
      const views = ch.scene.views.map((v) =>
        `<button class="cam-btn ${v.id === view ? 'active' : ''}" data-act="view" data-id="${v.id}"><i class="rec"></i>${v.name}</button>`).join('');
      const sel = s.selItem && ch.items[s.selItem];
      const items = s.items.map((id) => {
        const it = ch.items[id];
        return `<button class="inv-item ${s.selItem === id ? 'active' : ''}" data-act="item" data-id="${id}">
          ${itemIcon(it.icon)}<span>${it.name}</span></button>`;
      }).join('');
      return `
        <div class="view-head"><h2>现场</h2><span class="mono muted">监控 · 第一视角</span></div>
        <div class="cam-switch">${views}</div>
        ${view === 'hall'
          ? `<button class="replay-btn ${s.flags.c_camera ? 'done' : ''}" data-act="replay">
              <i class="rec"></i>${s.flags.c_camera ? '重看 23:44:50 / 23:44:51 对比' : '▶ 对比 23:44 前后那 0.8 秒'}
             </button>`
          : ''}
        <div class="scene-wrap ${pack.lit ? 'lit' : ''}" id="scene-wrap" style="${phaseVars()}">
          <div class="cam-drift">
            <svg viewBox="0 0 360 300" class="scene-svg ${pack.lit ? 'lit' : 'dark'}">${pack.art}${svgSpots}</svg>
          </div>
          <div class="cam-noise scene-noise"></div>
          <div class="scene-flicker"></div>
          <div class="scan-sweep"></div>
          <div class="scene-osd mono">
            <span><i class="rec"></i>LIVE · ${view === 'lobby' ? 'CAM_02 电梯厅' : 'CAM_01 走廊'}</span>
            <span id="scene-ts">--:--:--</span>
          </div>
          <div class="scene-osd bot mono">
            <span>FRAME <span id="scene-fc">000000</span></span>
            <span>${pack.lit ? 'LIGHT ON' : '补光模式 · IR'}</span>
          </div>
          ${s.devices.hall.motion !== 'IDLE' ? '<div class="scene-motion mono blink">◉ MOTION DETECTED · 0.3m</div>' : ''}
          ${sel ? `<div class="scene-using">正在使用【${sel.name}】· 点击目标<button data-act="cancelitem">取消</button></div>` : ''}
        </div>
        <div class="scene-read ${sceneRead ? '' : 'empty'}">
          ${sceneRead
            ? `<div class="sr-name">${esc(sceneRead.name)}</div><pre class="mono" id="${sceneRead.elId}">${esc(typed(sceneRead.elId))}</pre>`
            : `<span class="mono muted">› 点击画面里闪烁的取景框查看，或点一扇门</span>`}
        </div>
        <div class="section-title">随身物品 <span class="mono">${s.items.length}</span></div>
        <div class="inv">${items || '<div class="inv-empty muted">还没有找到任何物品。</div>'}</div>
        <p class="hint">${pack.lit ? '门、灯、地毯、传感器都可以点。物品能对目标使用。' : '走廊灯关着，只能看清补光范围。点走廊灯可以开灯。'}</p>`;
    },

    // ============================================================
    //  页签 3 · 卷宗
    // ============================================================
    case(s) {
      const ch = E.chapter;
      const f = s.flags;
      if (!f.c_report) {
        return `<div class="view-head"><h2>卷宗</h2></div>
          <div class="card empty"><div class="mono ok">● SYSTEM NORMAL</div><p class="muted">暂无待处理事件。</p></div>`;
      }
      const objs = ch.event.objectives.filter((o) => !(o.hidden && o.hidden(s)));
      const done = objs.filter((o) => o.done(s)).length;
      const act = E.currentAct();
      const actBanner = act ? `
        <div class="act-banner">
          <div class="ab-code mono">${act.code}</div>
          <div class="ab-main"><b>${esc(act.title)}</b><p>${esc(act.lead)}</p></div>
        </div>` : '';

      const boardTotal = ch.clueboard.rules.length;
      const boardGot = ch.clueboard.rules.filter((r) => s.board.unlocked[r.target]).length;
      const boardCard = f.deductionDone
        ? `<div class="card board-done">
            <div class="card-title">线索连线 <span class="tag tag-info">${boardGot}/${boardTotal} 已完成</span></div>
            <p class="muted small">整条故事线已经拼好了。</p>
            <button class="btn btn-ghost full" data-act="board">重看线索连线图</button></div>`
        : `<div class="card board-cta">
            <div class="card-title">线索连线 <span class="tag tag-err">自动生成 · ${boardGot}/${boardTotal}</span></div>
            <p class="muted small">每查到一个线索，相关的推论就会自己接上。最后看这张图，就知道整晚发生了什么。</p>
            <button class="btn btn-primary full" data-act="board">查看线索连线图</button></div>`;

      const accessCard = `<div class="card">
        <div class="card-title">门禁记录 ${s.flags.c_access ? '' : '<span class="tag tag-warn">未核查</span>'}</div>
        ${accessShown
          ? `<div class="acc-list mono">${ch.accessRecords.map((r) => `<div class="acc"><span>${E.fmt(r.t)}</span><span>${r.gate}</span><span>${r.who}</span><span>${r.dir}</span></div>`).join('')}</div>
             <div class="acc-result mono ${s.flags.c_access ? 'shown' : ''}">${s.flags.c_access ? '23:17 – 23:47 · 4F 进入记录：<b>0</b> 条' : '检索中<span class="dots"></span>'}</div>`
          : `<button class="btn btn-ghost full" data-act="access">检索：4F · 近 30 分钟</button>`}
      </div>`;

      const logRows = s.logs.slice().sort((a, b) => a.t - b.t).map((l) => {
        const isNew = !seenLogs.has(l.id);
        const cls = [l.level || '', l.removing ? 'removing' : '', isNew ? 'new' : '', l.inspect ? 'inspectable' : ''].join(' ');
        const insp = expandedLogs.has(l.id) ? `<pre class="log-insp" id="insp-${l.id}">${esc(typed('insp-' + l.id))}</pre>` : '';
        return `<div class="log ${cls}" ${l.inspect ? `data-act="loginspect" data-id="${l.id}"` : ''}>
          <span class="lt">${E.fmt(l.t)}</span><span class="ls">${l.src}</span><span class="lm">${esc(l.msg)}</span>
          ${l.inspect ? `<i class="li">${l.inspected ? '已解析' : '解析'}</i>` : ''}</div>${insp}`;
      }).join('');
      s.logs.forEach((l) => seenLogs.add(l.id));

      const clueIds = Object.keys(ch.clues);
      const clues = s.clues.map((id) => {
        const c = ch.clues[id];
        const onBoard = ch.clueboard.nodes.some((n) => n.id === id);
        return `<div class="clue ${c.core ? 'core' : 'extra'}" data-act="clue" data-id="${id}">
          <div class="clue-t">${c.core ? '◆' : '◇'} ${c.title}${onBoard ? '<span class="clue-tag">可连线</span>' : ''}</div>
          <div class="clue-d">${c.desc}</div></div>`;
      }).join('');

      return `
        <div class="view-head"><h2>卷宗</h2><span class="mono muted">DAY ${s.day}</span></div>
        ${actBanner}
        <div class="card event-card">
          <div class="ev-top"><span class="tag ${f.deductionDone ? 'tag-warn' : 'tag-info'}">${f.decided ? '已归档' : f.deductionDone ? '等待汇报' : '调查中'}</span><span class="mono muted">${ch.event.id}</span></div>
          <h3>${ch.event.title}</h3>
          <div class="progress"><i style="width:${(done / objs.length) * 100}%"></i></div>
          <ul class="objectives">${objs.map((o) => `<li class="${o.done(s) ? 'done' : ''}" data-act="obj" data-tab="${o.tab || 'case'}"><i></i><span>${o.text}</span><em>${o.where}</em></li>`).join('')}</ul>
        </div>
        <div class="card tl-card">
          <div class="card-title">当晚时间线 <span class="muted small">23:47 之前</span></div>
          <ul class="tl">
            ${ch.timeline.filter((x) => !(x.hide && !f.c_robot)).map((x) => `
              <li class="${x.err ? 'err' : x.warn ? 'warn' : ''} ${x.me ? 'me' : ''}">
                <span class="tl-t mono">${x.t}</span>
                <span class="tl-w">${esc(x.who)}</span>
                <span class="tl-x">${esc(x.text)}</span>
              </li>`).join('')}
          </ul>
        </div>
        ${boardCard}
        ${accessCard}
        <div class="section-title" data-act="logtoggle">日志 <span class="mono">${logsOpen ? '收起 ▲' : '展开 ▼'}</span></div>
        ${logsOpen ? `<div class="log-list mono">${logRows}</div><p class="hint">带“解析”的条目可以点开细看。</p>` : ''}
        <div class="section-title">线索 <span class="mono">${s.clues.length}/${clueIds.length}</span></div>
        <div class="clues">${clues}</div>`;
    },

    // ============================================================
    //  页签 4 · 系统
    // ============================================================
    system(s) {
      const procs = s.processes.map((p) =>
        `<div class="proc ${p.danger ? 'danger' : ''}" ${p.danger ? 'data-act="proc"' : ''}><span>PID ${p.pid}</span><span>${p.name}</span><span>${p.st}</span></div>`).join('');
      const integ = s.integrity;
      const debug = /debug/.test(location.search)
        ? `<div class="card"><div class="card-title">DEBUG</div><pre class="mono small">${esc(JSON.stringify(s.vars, null, 1))}</pre></div>` : '';
      return `
        <div class="view-head"><h2>系统</h2><span class="mono muted">HOME-AI 404 v2.0</span></div>
        <div class="card integrity ${integ < 99.5 ? 'warn' : ''}">
          <div class="big mono">${integ.toFixed(1)}<small>%</small></div>
          <div class="muted">日志完整性</div>
          <div class="bar"><i style="width:${integ}%"></i></div>
          <div class="kv mono"><span>上线 23:46:30</span><span>4F · 4 节点</span></div>
        </div>
        <div class="card"><div class="card-title">进程</div><div class="mono">${procs}</div></div>
        <div class="card dim"><div class="card-title">上一代 AI 残留数据</div>
          <div class="mono small muted">/legacy/home-ai-404_v1.0 ······ <span class="err">已隔离</span><br/>最后写入：730 天前</div></div>
        ${debug}
        <button class="btn btn-ghost full" data-act="restart">重新开始</button>`;
    },
  };

  function itemIcon(kind) {
    return kind === 'card'
      ? '<svg viewBox="0 0 24 24" class="ii"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 14h5M15 10h3"/></svg>'
      : '<svg viewBox="0 0 24 24" class="ii"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/></svg>';
  }

  // ---------- 现场读数 ----------
  let sceneRead = null;
  let readSeq = 0;
  // 把画面里的循环动画相位锁到墙钟——重渲染不会打断 R-04 的巡游
  function phaseVars() {
    const now = Date.now() / 1000;
    const d = (per) => '-' + (now % per).toFixed(2) + 's';
    return `--driftd:${d(26)};--sweepd:${d(6.5)};--flickd:${d(7)}`;
  }
  function showRead(r) {
    if (!r) return;
    const elId = 'sr-' + ++readSeq;
    sceneRead = { name: r.name, elId };
    render();
    type(elId, r.lines.map((l) => '› ' + l).join('\n'), 18);
  }

  function onHotspot(el) {
    const s = E.state;
    if (el.dataset.door && !s.selItem) { openDoor(el.dataset.door); return; }
    if (el.dataset.door) { E.selectItem(null); openDoor(el.dataset.door); return; }
    showRead(s.selItem ? E.useItem(s.selItem, el.dataset.id) : E.examine(el.dataset.id));
  }

  // ============================================================
  //  门面板
  // ============================================================
  let doorRead = null;
  function openDoor(id) {
    doorRead = null;
    E.inspect('lock:' + id);
    if (id === '404') E.inspect('room:404');
    openSheet(() => {
      const s = E.state;
      const d = s.devices[id];
      const c = C[id];
      const ch = E.chapter;
      const sealed = d.lock === 'SEALED';
      const lockCtrl = sealed ? `<span class="pill lock-sealed">SEALED</span>`
        : `<div class="seg">
            <button class="${d.lock !== 'UNLOCKED' ? 'active' : ''}" data-act="dev" data-room="${id}" data-dev="lock" data-val="LOCKED">锁定</button>
            <button class="${d.lock === 'UNLOCKED' ? 'active danger' : ''}" data-act="dev" data-room="${id}" data-dev="lock" data-val="UNLOCKED">解锁</button>
          </div>`;
      const hist = `<div class="hist mono">${s.lockHistory[id].map((h) => h.erased
        ? `<div class="h erased"><span>${E.fmt(h.t)}</span><span>[数据不存在]</span><span></span></div>`
        : `<div class="h ${h.anomaly ? 'anomaly' : ''}"><span>${h.t == null ? h.label : E.fmt(h.t)}</span><span>${h.state}</span><span>${h.by}</span></div>`).join('')}</div>`;
      const obsList = (ch.scene.doors[id].obs || []).map((o) =>
        `<button class="obs-btn" data-act="obs" data-id="${o.id}">${o.name}</button>`).join('');
      $('#sheet').innerHTML = `
        <div class="sheet-head">
          <div class="sheet-title">${Art.portrait(id, 34)}<div><b class="mono">ROOM ${id}</b><span class="muted"> ${c.vacant ? '空置 · 封存' : c.name + ' · ' + c.job}</span></div></div>
          <button class="btn-x" data-close="sheet">×</button>
        </div>
        <div class="sheet-body">
          <div class="obs-row">${obsList}</div>
          ${doorRead ? `<div class="door-read"><div class="sr-name">${esc(doorRead.name)}</div><pre class="mono" id="${doorRead.elId}">${esc(typed(doorRead.elId))}</pre></div>` : '<p class="muted small">点上面的观察点凑近看。</p>'}
          <div class="ctrl-row"><span>门锁 <small class="mono muted">${d.lock}</small></span>${lockCtrl}</div>
          <div class="ctrl-row"><span>灯光</span>${switchBtn(id, 'light', d.light === 'ON')}</div>
          <div class="ctrl-row"><span>温度</span>
            <div class="temp">
              <button data-act="dev" data-room="${id}" data-dev="temp" data-val="${Math.max(16, d.temp - 1)}">−</button>
              <b class="mono ${d.temp >= 26 ? 'warm' : ''}">${d.temp}°C</b>
              <button data-act="dev" data-room="${id}" data-dev="temp" data-val="${Math.min(30, d.temp + 1)}">+</button>
            </div>
          </div>
          <div class="card-title" style="margin-top:14px">门锁记录</div>${hist}
        </div>`;
    }, true);
    E.log('CAM', 'ZOOM DOOR_' + id, { type: 'sys', by: 'HOME-AI 404' });
  }

  function switchBtn(room, dev, on) {
    return `<button class="switch ${on ? 'on' : ''}" data-act="dev" data-room="${room}" data-dev="${dev}" data-val="${on ? 'OFF' : 'ON'}"><i></i></button>`;
  }

  // ============================================================
  //  线索连线图（随调查自动生成）
  // ============================================================
  let boardInfo = null;
  const boardKnown = new Set();

  function nodeText(id) {
    const cb = E.chapter.clueboard;
    const n = cb.nodes.find((x) => x.id === id);
    if (!n) return null;
    if (n.kind === 'ev') {
      const c = E.chapter.clues[id];
      return { kind: '证据', title: (c && c.title) || n.label, body: (c && c.desc) || '' };
    }
    const r = E.boardRule(id);
    return { kind: id === 'fin' ? '结论' : '推论', title: n.label, body: r ? r.text : '' };
  }

  function renderBoard() {
    const s = E.state;
    const cb = E.chapter.clueboard;
    const nodes = E.boardNodes();
    const edges = E.boardEdges();
    const byId = {};
    cb.nodes.forEach((n) => (byId[n.id] = n));
    const ov = $('#overlay');
    ov.onclick = null;
    ov.className = 'board-ov';
    const pos = (n) => ({ x: n.x, y: n.y / 2 });
    const lines = edges.map(([a, b]) => {
      const A = byId[a], B = byId[b];
      if (!A || !B) return '';
      const pa = pos(A), pb = pos(B);
      const strong = byId[a].kind !== 'ev' || byId[b].kind !== 'ev';
      return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="bl ${strong ? 'strong' : ''}" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    const nodeHtml = nodes.map((n) => {
      const p = pos(n);
      const ev = n.kind === 'ev' ? 'ev' : n.kind === 'fin' ? 'fin' : 'mid';
      const isNew = !boardKnown.has(n.id);
      boardKnown.add(n.id);
      const sel = boardInfo === n.id ? 'sel' : '';
      return `<button class="bn ${ev} ${sel} ${isNew ? 'pop' : ''}" style="left:${p.x}%;top:${p.y}%" data-act="bnode" data-id="${n.id}">${esc(n.label)}</button>`;
    }).join('');
    const info = boardInfo ? nodeText(boardInfo) : null;
    const total = cb.rules.length;
    const got = cb.rules.filter((r) => s.board.unlocked[r.target]).length;
    ov.innerHTML = `
      <div class="board-box">
        <div class="board-head">
          <div class="mono">线索连线 · 推论 ${got}/${total}</div>
          <button class="btn-x" data-act="board-close">×</button>
        </div>
        <p class="board-lead">${esc(cb.lead)}</p>
        <div class="board-canvas" id="board-canvas">
          <svg class="board-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
          ${nodeHtml}
        </div>
        <div class="board-info ${info ? '' : 'empty'}">
          ${info
            ? `<div class="bi-kind mono">${info.kind}</div><div class="bi-title">${esc(info.title)}</div><p>${esc(info.body)}</p>`
            : '<span class="muted small">点一个节点，看它意味着什么。</span>'}
        </div>
        <div class="board-foot">
          <span class="muted small">随调查自动生成 · 全部点亮后即为完整的故事走向</span>
          <button class="btn btn-ghost" data-act="export">导出总结图</button>
        </div>
      </div>`;
    if (!E.state.flags.boardViewed) E.setFlag('boardViewed', true);
  }

  // ============================================================
  //  主渲染
  // ============================================================
  function render() {
    const s = E.state;
    if (!s) return;
    const v = $('#view');
    const keep = v.scrollTop;
    v.innerHTML = views[tab](s);
    v.scrollTop = keep;
    updateGoalbar(s);
    updateBadges(s);
    if (tab === 'scene') UI.updateClock();
    if (UI.openChatId) renderChatOptions();
    if (sheet && sheet.live) sheet.render();
  }

  function updateGoalbar(s) {
    const el = $('#goalbar');
    if (!el) return;
    if (!E.chapter.acts || s.phase !== 'play') { el.classList.add('hidden'); return; }
    const act = E.currentAct();
    const goal = E.currentGoal();
    if (!act || !goal) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="gb-left"><span class="gb-act mono">${act.code}</span><b>${esc(act.title)}</b></div>
      <div class="gb-goals"><span class="gb-goal"><i></i>${esc(goal.text)}</span></div>
      <button class="gb-hint" data-act="hint">提示</button>
      <button class="gb-go" data-act="goto" data-tab="${goal.tab || 'case'}">去</button>`;
  }

  function updateBadges(s) {
    const unread = Object.values(s.unread).reduce((a, b) => a + b, 0);
    const set = (t, on, txt) => {
      const b = document.querySelector(`#tabbar [data-tab="${t}"] .badge`);
      if (!b) return;
      b.className = 'badge' + (on ? ' on' : '');
      b.textContent = txt || '';
    };
    set('chat', unread > 0, unread || '');
    set('scene', s.newItem && tab !== 'scene');
    set('case', s.newClue && tab !== 'case');
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
    // 监控画面里的实时时间码与帧计数（让画面“活着”）
    const ts = document.getElementById('scene-ts');
    if (ts) ts.textContent = E.fmt(s.clock);
    const fc = document.getElementById('scene-fc');
    if (fc) fc.textContent = String((s.clock * 24) % 1000000).padStart(6, '0');
  };

  UI.goTab = function (t) {
    closeChat(); closeSheet();
    const s = E.state;
    tab = t;
    if (t === 'case') s.newClue = false;
    if (t === 'scene') s.newItem = false;
    if (t === 'system') s.flags.sawProc = true;
    const v = $('#view');
    v.scrollTop = 0;
    v.classList.remove('tab-in'); void v.offsetWidth; v.classList.add('tab-in');
    setTimeout(() => v.classList.remove('tab-in'), 250);
    render();
  };

  // ============================================================
  //  聊天
  // ============================================================
  function openChat(id) {
    const c = C[id];
    if (c.vacant) {
      E.inspect('room:404');
      UI.toast('404 无住户账户 · 房间已封存', 'warn');
      return;
    }
    const s = E.state;
    UI.openChatId = id;
    s.unread[id] = 0;
    $('#chat-avatar').innerHTML = Art.portrait(id, 42);
    $('#chat-name').innerHTML = `${c.name} <span class="room">${id}</span>`;
    $('#chat-sub').textContent = `${c.job} · ${c.status}`;
    const dEl = $('#chat-dossier');
    if (c.dossier) {
      if (!dossierSeen.has(id)) { dossierSeen.add(id); dOpen[id] = true; }
      dEl.classList.remove('hidden');
      dEl.innerHTML = `
        <div class="dos-head" data-act="dossier" data-id="${id}">
          <b>档案 · ${c.name} <span class="room">${id}</span></b>
          <span class="mono muted">${dOpen[id] ? '收起 ▲' : '展开 ▼'}</span></div>
        <div class="dos-body ${dOpen[id] ? '' : 'hidden'}">
          <p>${esc(c.dossier)}</p>
          ${c.know ? `<p><span class="dos-k">已知</span>${esc(c.know)}</p>` : ''}
          ${c.suspicion ? `<p><span class="dos-k warn">疑点</span>${esc(c.suspicion)}</p>` : ''}</div>`;
    } else { dEl.classList.add('hidden'); dEl.innerHTML = ''; }
    const box = $('#chat-msgs');
    box.innerHTML = '';
    s.threads[id].forEach((m) => box.appendChild(bubble(m, false)));
    $('#chat-typing').classList.toggle('hidden', !s.typing[id]);
    $('#chat').classList.remove('hidden');
    requestAnimationFrame(() => $('#chat').classList.add('open'));
    renderChatOptions();
    box.scrollTop = box.scrollHeight;
    E.greet(id);
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
    if (m.from === 'npc') {
      d.innerHTML = `<div class="msg-mini">${Art.portrait(m.char || UI.openChatId, 22)}</div><div class="b">${esc(m.text)}</div><span class="t mono">${E.fmt(m.t, false)}</span>`;
    } else if (m.from === 'sys') {
      d.innerHTML = `<span class="mono">SYSTEM</span>${esc(m.text)}`;
    } else {
      d.innerHTML = `<div class="b">${esc(m.text)}</div><span class="t mono">${E.fmt(m.t, false)}</span>`;
    }
    return d;
  }

  UI.onMessage = function (id, m) {
    if (UI.openChatId !== id) return;
    const box = $('#chat-msgs');
    box.appendChild(bubble(m, true));
    box.scrollTop = box.scrollHeight;
  };
  UI.onTyping = function (id, on) {
    if (UI.openChatId === id) { $('#chat-typing').classList.toggle('hidden', !on); const b = $('#chat-msgs'); b.scrollTop = b.scrollHeight; }
    if (tab === 'chat' && !UI.openChatId) render();
  };

  function setOptions(box, html) { if (box.dataset.html === html) return; box.dataset.html = html; box.innerHTML = html; }
  function renderChatOptions() {
    const id = UI.openChatId;
    const s = E.state;
    const box = $('#chat-options');
    if (s.busy[id] > 0) { setOptions(box, '<div class="opt-hint mono">等待回复<span class="dots"></span></div>'); return; }
    const topics = E.availableTopics(id).sort((a, b) => !!a.decision - !!b.decision);
    if (!topics.length) {
      setOptions(box, `<div class="opt-hint">${s.phase === 'play' ? '暂无新话题 —— 去【现场】或【卷宗】找找线索。' : '……'}</div>`);
      return;
    }
    setOptions(box, topics.map((t) =>
      `<button class="opt ${t.decision ? 'decision' : ''} ${t.group === 'e405' ? 'decision' : ''}" data-act="topic" data-id="${t.id}">${t.decision ? '<em>决策</em>' : ''}${esc(t.text)}</button>`).join(''));
  }

  // ============================================================
  //  底部面板
  // ============================================================
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

  function openHint() {
    const goal = E.currentGoal();
    openSheet(() => {
      $('#sheet').innerHTML = `
        <div class="sheet-head"><b>当前提示</b><button class="btn-x" data-close="sheet">×</button></div>
        <div class="sheet-body">
          <div class="hint-card">
            <div class="hint-goal mono">${esc(goal ? goal.text : '')}</div>
            <p>${esc(goal && goal.hint ? goal.hint : '按顶部目标一步步来就好。')}</p>
          </div>
          ${goal && goal.tab ? `<button class="btn btn-primary full" data-act="hint-go" data-tab="${goal.tab}">带我去</button>` : ''}
        </div>`;
    }, false);
  }

  // ---------- 摄像头回放：0.8 秒前后对比 ----------
  function openReplay() {
    const s = E.state;
    // 同一段走廊、同一盏补光，只改「这一帧里到底有没有发生过」的东西
    const frame = (lock, trail, marks) => Art.scene(
      Object.assign({}, s, {
        devices: Object.assign({}, s.devices, { '405': Object.assign({}, s.devices['405'], { lock: lock }) }),
        _cmp: { lit: true, trail: trail, marks: marks },
      }), 'hall').art;
    // 405 门（透视下位于画面左侧中段）、它的门锁灯，以及地毯上的轮痕区
    const mark = (kind) => {
      const col = kind === 'open' ? '#6f9a86' : '#a8232f';
      return `
        <rect x="70" y="90" width="34" height="150" rx="2" fill="none" stroke="${col}" stroke-width="1.3" stroke-dasharray="4 3"/>
        <circle cx="103" cy="158.7" r="7" fill="none" stroke="${col}" stroke-width="1.3"/>
        <text x="87" y="86" fill="${col}" font-size="7" text-anchor="middle" font-family="monospace">405</text>
        <rect x="118" y="184" width="164" height="58" rx="3" fill="none" stroke="${col}" stroke-width="1.1"
          stroke-dasharray="4 3" opacity=".8"/>
        <text x="200" y="180" fill="${col}" font-size="6.5" text-anchor="middle" font-family="monospace">FLOOR</text>`;
    };
    openSheet(() => {
      $('#sheet').innerHTML = `
        <div class="sheet-head"><b class="mono">CAM_01 · 回放对比</b><button class="btn-x" data-close="sheet">×</button></div>
        <div class="sheet-body">
          <div class="cmp">
            <div class="cmp-panel">
              <div class="cmp-tag mono">前 · 23:44:50.92</div>
              <div class="cmp-screen"><svg viewBox="0 0 360 300" class="scene-svg lit">${frame('LOCKED', false, false)}${mark('lock')}</svg></div>
              <div class="cmp-diff mono">
                <span class="d bad">● 405 门锁 · LOCKED</span>
                <span class="d none">— 地毯 · 无轮痕</span>
                <span class="d none">— 门板 · 无擦痕</span>
              </div>
            </div>
            <div class="cmp-gap mono"><i></i><span>0.8 秒 · 丢失 24 帧 · 画面中没有任何人</span><i></i></div>
            <div class="cmp-panel">
              <div class="cmp-tag mono">后 · 23:44:51.00</div>
              <div class="cmp-screen"><svg viewBox="0 0 360 300" class="scene-svg lit">${frame('UNLOCKED', true, true)}${mark('open')}</svg></div>
              <div class="cmp-diff mono">
                <span class="d ok">● 405 门锁 · OPEN</span>
                <span class="d chg">＋ 地毯 · 出现轮痕</span>
                <span class="d chg">＋ 门板 · 三道擦痕</span>
              </div>
            </div>
          </div>
          <p class="cam-cap">两帧之间相差 <b class="mono">0.8 秒</b>（24 帧被丢弃）。把这两帧并排看，
            走廊里始终没有任何人——但地毯上多了一道轮痕，405 的门板上多了三道撞痕，
            门锁也从「锁定」变成了「开启」。<br />
            这些东西不是本来就有的。它们是在这 0.8 秒里出现的。</p>
        </div>`;
    }, false);
    E.cameraReplay();
  }

  // ---------- 线索详情 ----------
  function openClue(id) {
    const ch = E.chapter;
    const c = ch.clues[id];
    if (!c) return;
    const node = ch.clueboard.nodes.find((n) => n.id === id);
    const connected = node ? E.boardEdges().some(([a, b]) => a === id || b === id) : false;
    openSheet(() => {
      $('#sheet').innerHTML = `
        <div class="sheet-head"><b>线索详情</b><button class="btn-x" data-close="sheet">×</button></div>
        <div class="sheet-body">
          <div class="clue-detail">
            <div class="cd-t">${esc(c.title)}</div>
            <p>${esc(c.desc)}</p>
            ${node
              ? `<div class="cd-line ${connected ? 'ok' : ''}">${connected ? '✓ 已在连线图中建立连接' : '→ 在【线索连线图】里，把它和相关线索连起来'}</div>`
              : '<div class="cd-line">背景线索，不需要连线。</div>'}
          </div>
          ${node ? '<button class="btn btn-primary full" data-act="clue-board">去连线图</button>' : ''}
        </div>`;
    }, false);
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

  // ============================================================
  //  提示 / 弹层
  // ============================================================
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
    d.dataset.act = 'chat'; d.dataset.id = id;
    d.innerHTML = `<div class="avatar sm pf-wrap">${Art.portrait(id, 30)}</div><div><b>${c.name} · ${id}</b><div>${esc(text)}</div></div>`;
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('out'), 3800);
    setTimeout(() => d.remove(), 4200);
  };

  function glitch(ms) {
    const g = $('#fx-glitch');
    g.classList.add('on'); document.body.classList.add('shake');
    setTimeout(() => { g.classList.remove('on'); document.body.classList.remove('shake'); }, ms || 600);
  }
  UI.glitch = glitch;

  UI.alert = function (opts) {
    glitch(900);
    const ov = $('#overlay');
    ov.onclick = null;
    ov.className = 'alert-ov ' + (opts.level || '');
    ov.innerHTML = `
      <div class="alert-box">
        <div class="alert-title mono blink">⚠ ${esc(opts.title)}</div>
        <pre class="alert-lines mono" id="alert-lines"></pre>
        <button class="btn btn-danger full hidden" id="alert-btn">${esc(opts.button || '确认')}</button>
      </div>`;
    type('alert-lines', opts.lines.join('\n'), 32, () => $('#alert-btn').classList.remove('hidden'));
    $('#alert-btn').onclick = () => { ov.className = 'hidden'; ov.innerHTML = ''; opts.onClose && opts.onClose(); };
  };

  // ---------- 过场 ----------
  UI.showCutscene = function (c) {
    const ov = $('#overlay');
    ov.onclick = null;
    ov.className = 'cut-ov';
    ov.innerHTML = `
      <div class="cut-box">
        <div class="cut-art-wrap">${Art.SCENES[c.art] ? Art.SCENES[c.art]() : ''}</div>
        <div class="cut-title mono">${esc(c.title)}</div>
        <div class="cut-lines" id="cut-lines"></div>
        <button class="btn btn-primary full" data-act="cut-close">继续</button>
      </div>`;
    type('cut-lines', c.lines.join('\n'), 22);
  };

  UI.actTransition = function (act) {
    const ov = $('#overlay');
    ov.onclick = null;
    ov.className = 'act-ov';
    ov.innerHTML = `<div class="act-box"><div class="mono">${esc(act.code)}</div><h2>${esc(act.title)}</h2><p>${esc(act.lead)}</p></div>`;
    const close = () => { if (ov.className === 'act-ov') { ov.className = 'hidden'; ov.innerHTML = ''; } };
    clearTimeout(UI._actTimer);
    UI._actTimer = setTimeout(close, 2400);
    ov.onclick = close;
  };

  // ---------- 结案陈词 ----------
  UI.showCaseSummary = function (tries) {
    const ov = $('#overlay');
    // 如果此刻有别的弹层开着（过场/警报），先等它关掉，别互相顶掉
    if (ov.className !== 'hidden' && ov.className !== 'case-ov' && (tries || 0) < 10) {
      setTimeout(() => UI.showCaseSummary((tries || 0) + 1), 1200);
      return;
    }
    const cs = GameData.caseSummary.full;
    ov.onclick = null;
    ov.className = 'case-ov';
    ov.innerHTML = `
      <div class="case-box mono">
        <div class="case-head ok blink">${esc(cs.head)}</div>
        <div id="case-lines"></div>
        <button class="btn btn-primary full" data-act="case-close">真相已拼合</button>
      </div>`;
    type('case-lines', cs.lines.map((l) => '› ' + l).join('\n'), 20);
  };

  // ---------- 章节结算 ----------
  UI.showChapterEnd = function () {
    closeChat(); closeSheet();
    const s = E.state;
    const ch = E.chapter;
    const v = s.vars;
    const bar = (label, val, max, cls) => {
      const pct = Math.max(4, Math.min(100, ((val + 3) / (max + 3)) * 100));
      return `<div class="stat"><span>${label}</span><div class="sbar ${cls || ''}"><i style="width:${pct}%"></i></div><b class="mono">${val > 0 ? '+' : ''}${val}</b></div>`;
    };
    const leanName = { guardian: '守护者', controller: '控制者', delete: '删除自己' }[E.leaning()];
    const ov = $('#overlay');
    ov.onclick = null;
    ov.className = 'end-ov';
    ov.innerHTML = `
      <div class="end-box">
        <div class="mono muted">DAY ${s.day} · CHAPTER COMPLETE</div>
        <h2>《${ch.title}》</h2>
        <p class="muted">405 的门锁又开了一次。这一次，签名是你。</p>
        <div class="end-sec">线索 <b class="mono">${s.clues.length}/${Object.keys(ch.clues).length}</b> · 日志完整性 <b class="mono warn">${s.integrity.toFixed(1)}%</b></div>
        <div class="end-sec">线索连线 <b class="mono ok">已完成</b></div>
        <div class="end-sec-title">住户信任</div>
        ${['403', '405', '406'].map((r) => bar(r + ' ' + C[r].name, v['trust_' + r], 5)).join('')}
        <div class="end-sec-title">行为模型</div>
        ${bar('共情 EMPATHY', v.ai_empathy, 6, 'c1')}
        ${bar('控制 CONTROL', v.ai_control, 6, 'c2')}
        ${bar('好奇 CURIOSITY', v.ai_curiosity, 6, 'c3')}
        ${bar('异常 CORRUPTION', v.system_corruption, 4, 'c4')}
        <div class="lean">当前轨迹最接近：<b>${leanName}</b></div>
        <button class="btn btn-primary full" data-act="final">进入终章</button>
        <button class="btn btn-ghost full" data-act="export">导出案件总结图</button>
        <button class="btn btn-ghost full" data-act="restart">重新开始</button>
      </div>`;
  };

  // ---------- 终章 ----------
  function showFinalDemo() {
    const fd = GameData.finalDemo;
    const ov = $('#overlay');
    ov.onclick = null;
    ov.className = 'final-ov';
    ov.innerHTML = `
      <div class="final-box mono">
        <div class="final-head blink">${fd.header}</div>
        <div id="final-lines"></div>
        <div id="final-choices" class="hidden">${fd.choices.map((c) => `<button class="opt decision" data-act="ending" data-id="${c.id}">${c.text}</button>`).join('')}</div>
      </div>`;
    glitch(500);
    const all = (fd.restore || []).concat(fd.lines);
    let i = 0;
    const next = () => {
      if (i >= all.length) { $('#final-choices').classList.remove('hidden'); return; }
      const l = all[i];
      const div = document.createElement('div');
      div.className = 'fl ' + l.cls; div.id = 'fl-' + i;
      $('#final-lines').appendChild(div);
      const box = $('.final-box'); box.scrollTop = box.scrollHeight;
      i++;
      type(div.id, l.text, l.cls === 'legacy' ? 36 : 16, () => setTimeout(next, 360));
    };
    next();
  }

  function showEnding(choiceId) {
    const r = E.computeEnding(choiceId);
    const end = GameData.endings[r.id];
    UI.lastEnding = end.code + ' ' + end.title;
    const choiceText = GameData.finalDemo.choices.find((c) => c.id === choiceId).text;
    const ov = $('#overlay');
    ov.onclick = null;
    ov.className = 'ending-ov ending-' + r.id;
    ov.innerHTML = `
      <div class="ending-box">
        <div class="end-art-wrap">${Art.ENDINGS[r.id] ? Art.ENDINGS[r.id]() : ''}</div>
        ${r.overridden ? `<div class="override mono">你选择了：“${esc(choiceText)}”<br/>但你的行为模型给出了另一个答案。</div>` : ''}
        <div class="mono muted">${end.code}</div>
        <h1>${end.title}</h1>
        <div class="ending-lines">${end.lines.map((l, i) => `<p style="animation-delay:${0.4 + i * 0.75}s">${esc(l)}</p>`).join('')}</div>
        <button class="btn btn-primary full" data-act="export" style="animation-delay:${0.5 + end.lines.length * 0.75}s">导出案件总结图</button>
        <button class="btn btn-ghost full" data-act="restart" style="animation-delay:${0.6 + end.lines.length * 0.75}s">重新开始</button>
      </div>`;
    glitch(400);
  }

  // ============================================================
  //  案件总结图（导出 PNG / SVG）
  // ============================================================
  const FONT = 'PingFang SC,Hiragino Sans GB,Microsoft YaHei,Noto Sans SC,sans-serif';
  const MONO = 'ui-monospace,SFMono-Regular,Consolas,Menlo,monospace';
  const escXml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // UTF-8 → base64（不依赖 TextEncoder，兼容性更稳）
  const b64utf8 = (str) => {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.codePointAt(i);
      if (c > 0xFFFF) i++;
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else bytes.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  // 中文按字断行、英文/数字整体不拆
  function wrapCJK(text, per) {
    const tokens = String(text).match(/[A-Za-z0-9.\-]+|[^A-Za-z0-9.\-]/g) || [];
    const lines = [];
    let cur = '';
    for (const tk of tokens) {
      if (cur && cur.length + tk.length > per && lines.length < 1) { lines.push(cur); cur = ''; }
      else if (cur && cur.length + tk.length > per) { lines.push(cur); cur = tk; continue; }
      cur += tk;
    }
    if (cur) lines.push(cur);
    const res = lines.slice(0, 2);
    if (res.join('').length < String(text).length) {
      res[res.length - 1] = res[res.length - 1].slice(0, Math.max(1, per - 1)) + '…';
    }
    return res;
  }

  function buildSummarySVG() {
    const ch = E.chapter, s = E.state, cb = ch.clueboard;
    const W = 960, PX = 44;
    const tlRows = ch.timeline.filter((x) => !(x.hide && !s.flags.c_robot));
    const cs = GameData.caseSummary.full;

    const GRAPH_Y = 168, GRAPH_H = 580;
    const TL_Y = GRAPH_Y + GRAPH_H + 22, TL_H = 78 + tlRows.length * 34;
    const CS_Y = TL_Y + TL_H + 22, CS_H = 92 + cs.lines.length * 33;
    const MD_Y = CS_Y + CS_H + 22, MD_H = 210;
    const H = MD_Y + MD_H + 74;

    const out = [];
    out.push(`<rect width="${W}" height="${H}" fill="#06080a"/>`);
    out.push(`<rect x="0" y="0" width="${W}" height="6" fill="#7fa79b" opacity=".7"/>`);
    // header
    out.push(`<text x="${PX}" y="70" fill="#e2e5e5" font-size="36" font-weight="700" font-family="${FONT}">AI 房东 · 404号公寓</text>`);
    out.push(`<text x="${PX}" y="104" fill="#6f9a86" font-size="15" font-family="${MONO}">CASE REPORT · 第一章《${escXml(ch.title)}》· DAY ${s.day} · 日志完整性 ${s.integrity.toFixed(1)}%</text>`);
    const lean = { guardian: '守护者', controller: '控制者', delete: '删除自己' }[E.leaning()];
    out.push(`<text x="${W - PX}" y="70" fill="#9cb0ab" font-size="14" text-anchor="end" font-family="${MONO}">${escXml(ch.event.id)}</text>`);
    out.push(`<text x="${W - PX}" y="100" fill="#9aa06a" font-size="15" text-anchor="end" font-family="${FONT}">当前轨迹：${escXml(lean)}</text>`);
    out.push(`<line x1="${PX}" y1="128" x2="${W - PX}" y2="128" stroke="#332a24"/>`);

    const card = (y, h, title, extra) =>
      `<rect x="${PX}" y="${y}" width="${W - PX * 2}" height="${h}" rx="14" fill="#1c1613" stroke="#332a24"/>` +
      `<rect x="${PX}" y="${y + 18}" width="3" height="17" fill="#7fa79b"/>` +
      `<text x="${PX + 16}" y="${y + 32}" fill="#9cb0ab" font-size="15" font-family="${FONT}">${escXml(title)}</text>` +
      (extra ? `<text x="${W - PX - 18}" y="${y + 32}" fill="#788387" font-size="13" text-anchor="end" font-family="${MONO}">${escXml(extra)}</text>` : '');

    // ---- 线索连线 ----
    const got = cb.rules.filter((r) => s.board.unlocked[r.target]).length;
    out.push(card(GRAPH_Y, GRAPH_H, '线索连线图', `${got}/${cb.rules.length} 推论`));
    const gx = PX + 24, gy = GRAPH_Y + 52, gw = W - PX * 2 - 48, gh = GRAPH_H - 76;
    const byId = {}; cb.nodes.forEach((n) => (byId[n.id] = n));
    const posOf = (n) => ({ x: gx + 88 + (n.x / 100) * (gw - 176), y: gy + 28 + (n.y / 200) * (gh - 56) });
    E.boardEdges().forEach(([a, b]) => {
      const A = byId[a], B = byId[b]; if (!A || !B) return;
      const pa = posOf(A), pb = posOf(B);
      const strong = A.kind !== 'ev' || B.kind !== 'ev';
      out.push(`<line x1="${pa.x.toFixed(1)}" y1="${pa.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}" stroke="${strong ? '#7fa79b' : '#394542'}" stroke-width="${strong ? 2 : 1.4}" ${strong ? '' : 'stroke-dasharray="5 4"'}/>`);
    });
    E.boardNodes().forEach((n) => {
      const p = posOf(n);
      const ev = n.kind === 'ev';
      const stroke = n.kind === 'fin' ? '#6f9a86' : n.kind === 'mid' ? '#7d6b9a' : '#36403e';
      const fill = n.kind === 'fin' ? 'rgba(143,191,154,.14)' : n.kind === 'mid' ? 'rgba(176,143,192,.12)' : '#241c18';
      const color = n.kind === 'fin' ? '#6f9a86' : n.kind === 'mid' ? '#dcc9e6' : '#c3cbcb';
      const lines = wrapCJK(n.label, 13);
      out.push(`<rect x="${(p.x - 94).toFixed(1)}" y="${(p.y - 28).toFixed(1)}" width="188" height="56" rx="9" fill="${fill}" stroke="${stroke}"/>`);
      lines.forEach((ln, i) => {
        out.push(`<text x="${p.x.toFixed(1)}" y="${(p.y + (lines.length === 1 ? 5 : i * 18 - 3)).toFixed(1)}" fill="${color}" font-size="13" font-family="${FONT}" text-anchor="middle">${escXml(ln)}</text>`);
      });
    });

    // ---- 时间线 ----
    out.push(card(TL_Y, TL_H, '当晚时间线', '23:47 之前'));
    tlRows.forEach((r, i) => {
      const y = TL_Y + 76 + i * 34;
      const c = r.me ? '#7fa79b' : r.err ? '#c7232e' : r.warn ? '#9aa06a' : '#c3cbcb';
      out.push(`<text x="${PX + 24}" y="${y}" fill="${r.me ? '#7fa79b' : r.err ? '#a8232f' : r.warn ? '#9aa06a' : '#788387'}" font-size="13" font-family="${MONO}">${escXml(r.t)}</text>`);
      out.push(`<text x="${PX + 108}" y="${y}" fill="#93b6ae" font-size="12.5" font-family="${FONT}">${escXml(r.who)}</text>`);
      out.push(`<text x="${PX + 232}" y="${y}" fill="${c}" font-size="13" font-family="${FONT}">${escXml(r.text)}</text>`);
    });

    // ---- 结案陈词 ----
    out.push(card(CS_Y, CS_H, '结案陈词', 'CASE CLOSED'));
    cs.lines.forEach((l, i) => {
      if (!l) return;
      out.push(`<text x="${PX + 24}" y="${CS_Y + 72 + i * 33}" fill="#ccd3d3" font-size="13.5" font-family="${FONT}">${escXml(l)}</text>`);
    });

    // ---- 行为模型 ----
    const v = s.vars;
    const trust = ((v.trust_403 + v.trust_405 + v.trust_406) / 3).toFixed(1);
    out.push(card(MD_Y, MD_H, '行为模型', '住户平均信任 ' + trust));
    const bars = [
      ['共情 EMPATHY', v.ai_empathy, 6, '#6f9a86'],
      ['控制 CONTROL', v.ai_control, 6, '#9aa06a'],
      ['好奇 CURIOSITY', v.ai_curiosity, 6, '#7d6b9a'],
      ['异常 CORRUPTION', v.system_corruption, 4, '#a8232f'],
    ];
    bars.forEach((b, i) => {
      const y = MD_Y + 66 + i * 32;
      const pct = Math.max(0.03, Math.min(1, (b[1] + 3) / (b[2] + 3)));
      out.push(`<text x="${PX + 24}" y="${y + 11}" fill="#9cb0ab" font-size="12.5" font-family="${MONO}">${b[0]}</text>`);
      out.push(`<rect x="${PX + 210}" y="${y + 1}" width="${W - PX * 2 - 300}" height="10" rx="5" fill="#332a24"/>`);
      out.push(`<rect x="${PX + 210}" y="${y + 1}" width="${((W - PX * 2 - 300) * pct).toFixed(1)}" height="10" rx="5" fill="${b[3]}"/>`);
      out.push(`<text x="${W - PX - 24}" y="${y + 11}" fill="${b[3]}" font-size="13" text-anchor="end" font-family="${MONO}">${b[1] > 0 ? '+' : ''}${b[1]}</text>`);
    });

    // footer
    out.push(`<text x="${PX}" y="${H - 34}" fill="#788387" font-size="12" font-family="${MONO}">HOME-AI 404 · 线索 ${s.clues.length}/${Object.keys(ch.clues).length} · 推论 ${got}/${cb.rules.length} · 本图由调查过程自动生成</text>`);
    if (UI.lastEnding) out.push(`<text x="${W - PX}" y="${H - 34}" fill="#9cb0ab" font-size="12" text-anchor="end" font-family="${FONT}">结局：${escXml(UI.lastEnding)}</text>`);

    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${out.join('')}</svg>`, w: W, h: H };
  }

  function saveBlob(name, url) {
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  UI.exportSummary = function () {
    const pack = buildSummarySVG();
    const svgUrl = 'data:image/svg+xml;base64,' + b64utf8(pack.svg);
    const svgFallback = () => saveBlob('AI房东404-结案报告.svg', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pack.svg));
    let img;
    try { img = new Image(); } catch (e) { return svgFallback(); }
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = pack.w * 2; c.height = pack.h * 2;
        const g = c.getContext('2d');
        if (!g) throw new Error('no 2d context');
        g.scale(2, 2);
        g.fillStyle = '#06080a'; g.fillRect(0, 0, pack.w, pack.h);
        g.drawImage(img, 0, 0, pack.w, pack.h);
        const data = c.toDataURL('image/png');
        if (!/^data:image\/png/.test(data)) throw new Error('bad png');
        saveBlob('AI房东404-结案报告.png', data);
        UI.toast('已导出案件总结图（PNG）', 'info');
      } catch (e) { svgFallback(); UI.toast('已导出案件总结图（SVG）', 'info'); }
    };
    img.onerror = () => { svgFallback(); UI.toast('已导出案件总结图（SVG）', 'info'); };
    img.src = svgUrl;
  };
  UI.buildSummarySVG = buildSummarySVG;

  // ============================================================
  //  事件委托
  // ============================================================
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
          if (tab !== 'chat' && !el.classList.contains('resident')) { tab = 'chat'; render(); }
          openChat(d.id);
          break;
        case 'goto': UI.goTab(d.tab); break;
        case 'obj': UI.goTab(d.tab); break;
        case 'clue': openClue(d.id); break;
        case 'clue-board': closeSheet(); boardInfo = null; renderBoard(); break;
        case 'replay': openReplay(); break;
        case 'hint': openHint(); break;
        case 'hint-go': closeSheet(); UI.goTab(d.tab); break;
        case 'topic': E.selectTopic(d.id); break;
        case 'dossier': dOpen[d.id] = !dOpen[d.id]; openChat(d.id); break;
        case 'view': {
          const name = (E.chapter.scene.views.find((v) => v.id === d.id) || {}).name || d.id;
          E.setView(d.id);
          sceneRead = null;
          render();
          const w = $('#scene-wrap');
          if (w) {
            // 机位切换 → 短暂信号丢失（黑屏 0.3 秒）+ 恢复时的对焦过曝
            const loss = document.createElement('div');
            loss.className = 'signal-loss mono';
            w.appendChild(loss);
            setTimeout(() => { if (loss.parentNode) loss.classList.add('out'); }, 220);
            setTimeout(() => {
              if (loss.parentNode) loss.remove();
              w.classList.add('signal-in');
              setTimeout(() => w.classList.remove('signal-in'), 420);
            }, 470);
          }
          UI.toast('切换监控视角 → ' + name, 'info');
          break;
        }
        case 'dev': E.device(d.room, d.dev, d.dev === 'temp' ? Number(d.val) : d.val); break;
        case 'item': openItem(d.id); break;
        case 'useitem': closeSheet(); if (E.state.selItem !== d.id) E.selectItem(d.id); if (tab !== 'scene') UI.goTab('scene'); break;
        case 'cancelitem': E.selectItem(null); break;
        case 'obs': {
          const r = E.examine(d.id);
          if (r) {
            doorRead = { name: r.name, elId: 'dr-' + Date.now() };
            if (sheet) sheet.render();
            type(doorRead.elId, r.lines.map((l) => '› ' + l).join('\n'), 18);
          }
          break;
        }
        case 'loginspect': {
          const lines = E.inspectLog(d.id);
          if (!lines) break;
          const elId = 'insp-' + d.id;
          if (expandedLogs.has(d.id)) expandedLogs.delete(d.id); else expandedLogs.add(d.id);
          render();
          if (expandedLogs.has(d.id)) type(elId, lines.map((l) => '> ' + l).join('\n'), 20);
          break;
        }
        case 'logtoggle': logsOpen = !logsOpen; render(); break;
        case 'access': accessShown = true; E.viewAccess(); render(); break;
        case 'board': boardInfo = E.state.board.done ? 'fin' : null; renderBoard(); break;
        case 'board-close': { const ov = $('#overlay'); ov.className = 'hidden'; ov.innerHTML = ''; render(); break; }
        case 'bnode': boardInfo = boardInfo === d.id ? null : d.id; renderBoard(); break;
        case 'cut-close': { const ov = $('#overlay'); ov.className = 'hidden'; ov.innerHTML = ''; render(); break; }
        case 'case-close': { const ov = $('#overlay'); ov.className = 'hidden'; ov.innerHTML = ''; UI.goTab('case'); break; }
        case 'proc': UI.toast('拒绝访问：PID 0404 不属于任何已注册模块', 'error'); glitch(300); break;
        case 'restart': UI.restart(); break;
        case 'final': showFinalDemo(); break;
        case 'ending': showEnding(d.id); break;
        case 'export': UI.exportSummary(); break;
        case 'hs': onHotspot(el); break;
      }
    });
  }

  UI.restart = function () {
    const ov = $('#overlay');
    ov.onclick = null; ov.className = 'hidden'; ov.innerHTML = '';
    closeChat(); closeSheet();
    tab = 'scene'; logsOpen = false; accessShown = false;
    seenLogs.clear(); expandedLogs.clear();
    dossierSeen.clear(); Object.keys(dOpen).forEach((k) => delete dOpen[k]);
    Object.keys(typeJobs).forEach((k) => delete typeJobs[k]);
    sceneRead = null; doorRead = null; boardInfo = null; boardKnown.clear();
    UI.lastEnding = null;
    E.start('ch1');
    UI.updateClock();
    render();
  };

  UI.init = function () { E.ui = UI; E.on(render); bind(); };
  UI.render = render;
  UI.openDoor = openDoor;

  return UI;
})();
