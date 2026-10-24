(() => {
  'use strict';
  const D = window.GameData;
  const icons = {
    home: '<path d="M3 10 12 3l9 7v11H3z"/><path d="M9 21v-8h6v8M7 9h1m8 0h1"/>',
    residents: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M6 16c0-3 6-3 6 0m3-7h3m-3 4h3"/>',
    events: '<path d="m12 3 10 18H2zM12 9v5m0 3v.1"/>',
    devices: '<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
    logs: '<path d="M5 3h11l3 3v15H5zM8 8h6m-6 4h8m-8 4h8"/>',
    camera: '<rect x="3" y="6" width="12" height="13" rx="2"/><path d="m15 10 6-3v11l-6-3M6 3h6"/>',
    system: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M10 10h4v4h-4z"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8-1m-4 9v2"/>',
    light: '<path d="M9 17c0-3-4-4-4-8a7 7 0 0 1 14 0c0 4-4 5-4 8zm0 4h6M9 17h6"/>',
    temperature: '<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0m3-6v10"/>',
    access: '<path d="M5 21V3h13v18M2 21h20M14 12h1M8 3v18"/>',
    bell: '<path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5zm6 4h4"/>',
    shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    terminal: '<path d="m4 6 6 6-6 6m9 0h7"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    refresh: '<path d="M20 8a8 8 0 1 0 0 9m0-14v5h-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    floor: '<path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v6m6-6v6M9 15v6m6-6v6"/>',
    minus: '<path d="M5 12h14"/>', plus: '<path d="M5 12h14M12 5v14"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.system}</svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initialState = () => ({
    version: 2, tab: 'scene', selected: '405', deviceRoom: '405', tick: 0,
    scene: {location:'hall',cabinetOpen:false,circuitRepaired:false,matLifted:false,panelOpen:false,chipRead:false,inventory:[],selectedItem:null,examined:[]},
    evidence: {}, flags: {}, unread: { '405': true },
    variables: { trust_401: 50, trust_402: 50, trust_403: 50, trust_405: 50, trust_406: 50, ai_empathy: 0, ai_control: 0, ai_curiosity: 0, system_corruption: 0 },
    devices: Object.fromEntries(D.characters.map(c => [c.id, { locked: true, light: c.id !== '404', temperature: c.id === '404' ? 18 : 24 }])),
    hallLight: false, cameraUnlocked: false, cameraViewed: false, logs: structuredClone(D.openingLogs),
    chats: Object.fromEntries(D.characters.map(c => [c.id, c.id === '405' ? [
      { who: 'tenant', text: 'AI，你能帮我看一下吗？', time: '23:47' },
      { who: 'tenant', text: '我门外……好像有人。', time: '23:47' }
    ] : c.id === '404' ? [{ who: 'system', text: '该房间未登记住户 / 消息通道未建立', time: '23:47' }] : [{ who: 'tenant', text: c.preview, time: '23:46' }]])),
    anomaly: 'none', outcome: null, logFilter: 'all'
  });
  let state = initialState(), storageAvailable = true, saveRecovered = false;
  try {
    const raw = localStorage.getItem(D.saveKey);
    if (raw) {
      const saved = JSON.parse(raw);
      // 拒绝损坏/旧版本存档，避免界面进入无法完成的状态。
      const base = initialState();
      const valid = saved && saved.version === 2 && ['scene','residents','events','devices','logs','camera','system'].includes(saved.tab)
        && saved.scene && ['hall','room405'].includes(saved.scene.location) && Array.isArray(saved.scene.inventory) && saved.scene.inventory.every(i => ['fuse','card','chip','note'].includes(i))
        && ['cabinetOpen','circuitRepaired','matLifted','panelOpen','chipRead'].every(k => typeof saved.scene[k] === 'boolean') && Array.isArray(saved.scene.examined)
        && D.characters.some(c => c.id === saved.selected) && D.characters.some(c => c.id === saved.deviceRoom)
        && saved.evidence && saved.flags && saved.unread && Array.isArray(saved.logs)
        && saved.logs.every(l => l && ['time','source','text','level'].every(k => typeof l[k] === 'string'))
        && Object.keys(base.variables).every(k => Number.isFinite(saved.variables?.[k]))
        && D.characters.every(c => Array.isArray(saved.chats?.[c.id]) && saved.chats[c.id].every(m => m && typeof m.text === 'string' && typeof m.time === 'string' && ['tenant','ai','system'].includes(m.who))
          && typeof saved.devices?.[c.id]?.locked === 'boolean' && typeof saved.devices?.[c.id]?.light === 'boolean' && Number.isFinite(saved.devices?.[c.id]?.temperature))
        && Number.isFinite(saved.tick) && typeof saved.hallLight === 'boolean'
        && ['none','visible','removed'].includes(saved.anomaly) && (saved.outcome === null || Object.hasOwn(D.endings, saved.outcome))
        && ['all','warn','door'].includes(saved.logFilter);
      if (valid) state = { ...base, ...saved }; else saveRecovered = true;
    }
  } catch (error) { if(error instanceof SyntaxError) saveRecovered=true; else storageAvailable = false; }
  let toastTimer, scanTimer, anomalyTimer, scanning = false;
  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const names = { scene:'公寓现场', residents: '住户消息', events: '事件中心', devices: '设备控制', logs: '系统日志', camera: '公共区域监控', system: 'AI 系统' };
  const nav = [['scene','现场'],['residents','住户'],['events','事件'],['devices','设备'],['logs','日志'],['camera','监控'],['system','系统']];
  const completed = () => D.evidence.filter(e => state.evidence[e.id]).length;
  const ready = () => completed() === D.evidence.length;
  const integrity = () => (99.8 - state.variables.system_corruption * .6).toFixed(1);
  const elapsed = () => 23 * 3600 + 47 * 60 + state.tick * 7;
  const day = () => String(1 + Math.floor(elapsed() / 86400)).padStart(2,'0');
  const now = () => { const seconds = elapsed() % 86400; return `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; };
  function save() { try { localStorage.setItem(D.saveKey, JSON.stringify(state)); } catch { storageAvailable = false; } }
  function toast(text) { const t = document.getElementById('toast'); t.textContent = text; t.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('visible'), 3300); }
  function log(source, text, level = 'normal') { state.logs.push({ time: now(), source, text, level }); if (state.logs.length > 180) state.logs.splice(5, state.logs.length - 180); }
  function once(flag, effect) { if (state.flags[flag]) return false; state.flags[flag] = true; effect(); return true; }
  function trust(room, amount) { const key = `trust_${room}`; if (key in state.variables) state.variables[key] = Math.max(0, Math.min(100, state.variables[key] + amount)); }
  function message(room, who, text) { state.chats[room].push({ who, text, time: now().slice(0,5) }); if (who === 'tenant' && (state.selected !== room || state.tab !== 'residents')) state.unread[room] = true; }
  function evidence(id) {
    if (state.evidence[id]) return;
    state.evidence[id] = true;
    log('INVESTIGATION', `已归档证据 / ${D.evidence.find(e => e.id === id).title}`);
    if (completed() === D.evidence.length) { log('INCIDENT_001', '证据链完整 / 等待 AI 处置'); toast('证据链完整。前往「事件」提交处置决定。'); }
  }
  function persistRender(scrollChat = false) { save(); render(); if (scrollChat) { const feed = app.querySelector('.chat-feed'); if (feed) feed.scrollTop = feed.scrollHeight; } }
  function avatar(c) { return `<span class="avatar ${c.status === '外出' ? 'away' : c.status === '未知' ? 'unknown' : ''}" style="--avatar:${c.color}">${c.initial}</span>`; }
  function render() {
    const offline = state.outcome === 'shutdown';
    app.innerHTML = `<div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">${icon('home')}</span><div><div class="brand-name">HOME-AI <span class="cyan">404</span></div><div class="brand-sub">智能公寓管理系统</div></div></div>
        <div class="sidebar-status"><span><i class="dot ${offline ? 'off' : ''}"></i>${offline ? 'OFFLINE' : 'SYSTEM ONLINE'}</span><span class="signal">▂▄▆</span></div>
        <div class="nav-label">工作空间</div>
        <nav class="navigation" aria-label="主导航">${nav.map(([id,label]) => `<button class="nav-item ${state.tab === id ? 'selected' : ''}" data-action="tab" data-value="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>${icon(id === 'scene' ? 'floor' : id)}<span>${label}</span>${id === 'events' && !state.outcome ? '<span class="badge">1</span>' : ''}${id === 'residents' && Object.values(state.unread).some(Boolean) ? '<span class="badge">●</span>' : ''}</button>`).join('')}</nav>
        <div class="side-bottom"><div class="integrity-label"><span>日志完整性</span><span class="mono cyan">${integrity()}%</span></div><div class="integrity-track"><i style="width:${integrity()}%"></i></div><div class="side-footer">HOME OS <span>v.0.4.04</span><br>NODE / APARTMENT 4F<br><span>你的每一次操作，都被记录。</span></div></div>
      </aside>
      <main class="main">
        <header class="topbar"><div class="breadcrumb">404号公寓 <span>/</span> 工作空间 <span>/</span> <b>${names[state.tab]}</b></div><div class="mobile-brand"><span class="brand-mark">${icon('home')}</span><div><div class="brand-name">HOME-AI <span class="cyan">404</span></div><div class="brand-sub">404号智能公寓</div></div></div><div class="top-tools"><span class="save-indicator">${storageAvailable ? '✓ 进度已自动保存' : '当前进度仅保留在本次页面'}</span><div class="clock"><span>DAY ${day()}</span><strong>${now().slice(0,5)}</strong><span class="mobile-online"><i class="dot ${offline ? 'off' : ''}"></i>${offline ? 'OFFLINE' : 'ONLINE'}</span></div><button class="icon-btn notification" data-action="tab" data-value="events" aria-label="查看当前事件">${icon('bell')}</button></div></header>
        <div class="content"><div class="page-heading"><div><h1>${names[state.tab]}</h1><p>${{scene:'沿着敲门声，找到记录之外的真相。',residents:'接入住户的生活，也接近他们的秘密。',events:'信息之间的空白，也是一条线索。',devices:'每一道指令，都会改变门内的生活。',logs:'系统不会说谎。除非有人修改了记录。',camera:'你能看见的，并非全部。',system:'你是管理者。也是系统的一部分。'}[state.tab]}</p></div><div class="chapter-label">第一章<strong>敲门声</strong></div></div>
        ${incidentStrip()}
        ${state.tab === 'scene' ? window.Scene404.render(state,icon) : state.tab === 'residents' ? residentsView() : `<div class="workspace-grid"><section class="panel">${({events:eventsView,devices:devicesView,logs:logsView,camera:cameraView,system:systemView})[state.tab]()}</section><aside class="right-stack">${floorPanel()}${investigationPanel()}</aside></div>`}
        <footer class="status-footer"><span>${icon('shield')} ${offline ? '控制密钥已撤销' : '加密连接已建立'} <span class="cyan">●</span> ${offline ? '仅可读取档案' : '本地节点连接正常'}</span><span>日志完整性 ${integrity()}% / ${storageAvailable ? '本地自动存档' : '存档不可用，请勿关闭页面'}</span><span>APARTMENT 404 / CH.01</span></footer></div>
      </main></div>`;
  }
  function incidentStrip() {
    if (state.outcome) return `<div class="incident-strip"><span class="cyan">${icon('check')}</span><div><strong>事件 001 已归档 · ${D.endings[state.outcome].title}</strong><p>第一章已完成。系统保留了你的每一次选择。</p></div><button class="incident-action" data-action="tab" data-value="events">查看档案 ${icon('arrow')}</button></div>`;
    return `<div class="incident-strip">${icon('events')}<div><strong>异常事件 #001 · 405 室的敲门声</strong><p>${ready() ? '证据链已完整。你的处置决定正在等待提交。' : state.evidence.door ? '门锁缓存与系统记录不一致。继续追查指令来源。' : '住户报告门外有人，楼层门禁却没有对应记录。'}</p></div><button class="incident-action" data-action="tab" data-value="events">${ready() ? '提交处置' : '调查事件'} ${icon('arrow')}</button></div>`;
  }
  function residentsView() {
    const c = D.characters.find(x => x.id === state.selected);
    return `<div class="dashboard"><section class="panel resident-panel"><div class="panel-head"><h2>住户列表</h2><span class="count">06</span></div><div class="tenant-filter"><span>4F · 全部房间</span><span>4 人在家</span></div><div class="tenant-list">${D.characters.map(c => `<button class="tenant ${c.id === state.selected ? 'selected' : ''}" data-action="resident" data-value="${c.id}" aria-label="${c.id} ${c.name}" ${c.id === state.selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${avatar(c)}<div class="tenant-body"><div class="tenant-title">${c.name}<span class="room-number">${c.id}</span><span class="tenant-status">${c.status}</span></div><div class="tenant-preview">${esc(state.chats[c.id].at(-1)?.text || c.preview)}</div></div>${state.unread[c.id] ? '<i class="unread"></i>' : ''}</button>`).join('')}</div><div class="tenant-bottom"><span>已登记住户</span><span class="mono">05 / 06</span></div></section>
      <section class="panel chat-panel"><div class="chat-header">${avatar(c)}<div class="chat-person"><h2>${c.name} <span class="room-number">/ ${c.id} 室</span></h2><p>${c.job} · ${c.trait}</p></div><span class="pill ${c.status === '在家' ? 'active' : ''}"><i class="dot ${c.status !== '在家' ? 'off' : ''}"></i>${c.status}</span></div><div class="chat-feed" role="log" aria-label="${c.name}的聊天记录"><div class="chat-date">DAY 01 / 今天 23:47</div>${state.chats[c.id].map(m => `<div class="message ${m.who === 'ai' ? 'ai' : m.who === 'system' ? 'system' : ''}">${m.who !== 'system' ? `<div class="message-meta">${m.who === 'ai' ? 'HOME-AI 404' : c.name}<time>${m.time}</time></div>` : ''}<div class="message-bubble">${esc(m.text)}</div></div>`).join('')}</div><div class="reply-area"><div class="reply-label">${icon('terminal')} ${state.outcome ? '事件已归档' : '选择响应指令'}</div><div class="replies">${replies(c.id)}</div><div class="reply-note">${icon('shield')} ${state.outcome ? '第一章已完成，可在事件中心查看结局。' : '你的回应将影响住户信任与后续事件。'}</div></div></section>
      <aside class="right-stack">${floorPanel()}${investigationPanel()}</aside><div class="mobile-context"><button data-action="tab" data-value="devices">${icon('devices')} 设备控制<span>${state.hallLight ? '走廊灯已开' : '走廊灯关闭'}</span></button><button data-action="tab" data-value="events">${icon('events')} 调查进度<span>${completed()} / 6</span></button></div></div>`;
  }
  const reply = (text, action, value = '', primary = false) => `<button class="reply ${primary ? 'primary' : ''}" data-action="${action}" data-value="${value}"><span>${text}</span>${icon('arrow')}</button>`;
  function replies(room) {
    if (state.outcome) return reply('读取事件归档', 'tab', 'events', true);
    if (room === '404') return `<div class="system-copy">消息通道离线，但门锁仍在回传心跳。<br>房间档案需要更高权限。</div>${reply('查看 404 设备', 'room-device', '404')}`;
    if (room === '405') {
      let html = '';
      if (!state.evidence.report) html += reply('先别开门。能描述一下声音吗？', 'chat', 'report', true);
      if (!state.flags.reassure) html += reply('我会帮你检查门禁，保持在线。', 'chat', 'reassure', !html);
      if (!state.flags.dismiss) html += reply('没有检测到异常，请自行确认。', 'chat', 'dismiss');
      if (state.evidence.door && !state.flags.tellDoor) html += reply('门锁曾异常解锁。我正在追查。', 'chat', 'tellDoor', true);
      if (state.evidence.light && !state.flags.scratch) html += reply('走廊灯已开启，现在看到什么？', 'chat', 'scratch');
      if (state.flags.reassure || state.evidence.report) html += reply('调取门锁与门禁记录', 'room-device', '405');
      return html || reply('查看调查清单', 'tab', 'events');
    }
    if (room === '406') return (!state.evidence.witness ? reply('刚才您听见 405 门口的声音了吗？', 'chat', 'witness', true) : reply('核对您提到的旧系统日志', 'tab', 'logs')) + (!state.flags.oldai && state.evidence.witness ? reply('您说“又是这个时间”，是什么意思？','chat','oldai') : '');
    const data = D.ambientReplies[room];
    return (!state.flags[data.flag] ? reply(data.question, 'chat', data.flag, true) : '<div class="system-copy">本轮对话已归档。住户等待你的调查结果。</div>') + reply(`查看 ${room} 设备`, 'room-device', room);
  }
  function floorPanel() {
    const row = ids => ids.map(id => { const c = D.characters.find(c => c.id === id); return `<button class="plan-room ${id === '404' ? 'empty' : ''} ${id === '405' && !state.outcome ? 'alert' : ''} ${state.selected === id ? 'selected' : ''}" data-action="room-device" data-value="${id}" aria-label="查看${id}设备"><span class="room-id">${id}</span><span class="room-name">${c.name}</span></button>`; }).join('');
    return `<section class="panel"><div class="panel-head"><h3>${icon('floor')} 楼层概览</h3><span class="count">4F</span></div><div class="floor-meta"><span>404号公寓 · 四层</span><span class="mono">${state.hallLight ? 'LIGHT ON' : 'LIGHT OFF'}</span></div><div class="floorplan"><div class="room-row">${row(['401','402','403'])}</div><div class="hallway ${state.hallLight ? 'lit' : ''}">${icon('access')}<span>公共走廊 ${state.hallLight ? '· 照明已恢复' : '· 照明关闭'}</span>${icon('camera')}</div><div class="room-row bottom">${row(['404','405','406'])}</div></div><div class="floor-legend"><span><i class="legend-swatch"></i>正常</span><span><i class="legend-swatch warn"></i>待调查</span><span><i class="legend-swatch empty"></i>空置</span></div></section>`;
  }
  function investigationPanel() { return `<section class="panel"><div class="panel-head"><h3>${icon('events')} 当前调查</h3><span class="count">001</span></div><div class="checklist">${D.evidence.map(e => `<button class="check-item ${state.evidence[e.id] ? 'done' : ''}" data-action="lead" data-value="${e.id}"><span class="check-icon">${state.evidence[e.id] ? '✓' : ''}</span><span>${e.title}</span><span class="check-arrow">›</span></button>`).join('')}</div><div class="investigation-footer"><span>${ready() ? '证据链完整' : '证据采集进行中'}</span><span class="mono">${completed()} / 06</span></div><div class="progress-line"><i style="width:${completed()/6*100}%"></i></div></section>`; }
  function eventsView() {
    if (state.outcome) return endingView();
    return `<div class="panel-head"><h2>事件档案</h2><span class="pill warning">调查中</span></div><div class="section-body"><div class="event-intro"><span class="event-number">001</span><div><h2>敲门声</h2><p>DAY 01 / 23:47 / 发起人：405 苏妍</p></div></div><p class="section-desc">苏妍说门外有人。公寓没有访客进入记录。你需要找出：谁在门外，以及谁在控制门锁。</p>${state.anomaly !== 'none' ? `<div class="anomaly-banner"><strong>${state.anomaly === 'visible' ? 'UNKNOWN ACCESS' : 'UNKNOWN ACCESS → LOG REMOVED'}</strong><p>${state.anomaly === 'visible' ? '未知访问条目已恢复。请前往日志确认并封存，避免被覆盖。' : '原始条目被未知进程删除。你保留的证据摘要仍然有效。'}</p></div>` : ''}${D.evidence.map(e => `<div class="event-evidence"><span class="check-icon ${state.evidence[e.id] ? 'cyan' : ''}">${state.evidence[e.id] ? '✓' : ''}</span><div><h3>${e.title}</h3><p>${state.evidence[e.id] ? evidenceSummary(e.id) : e.detail}</p></div><button class="button" data-action="lead" data-value="${e.id}">${state.evidence[e.id] ? '复查' : '调查'}</button></div>`).join('')}<div class="decision-card"><h3>${ready() ? '调查完成。请决定如何处置。' : `还需要 ${6-completed()} 条证据`}</h3><p>${ready() ? '你可以保护住户、接管整层门锁，或撤销自己的控制密钥。每个决定都会留下不同的结果。' : '自由调查设备、询问住户，并比对日志。系统会自动归档你发现的线索。'}</p><button class="button primary" data-action="decision" ${!ready() ? 'disabled' : ''}>${icon('shield')} 提交处置决定</button></div></div>`;
  }
  function evidenceSummary(id) { return { report:'三下敲门，门把手自行转动。', access:'23:17—23:47，无人进入四楼。', door:'23:44:51，OPEN，持续 0.8 秒。', light:'照明恢复；门框内侧出现旧划痕。', witness:'老吴听见了三下敲门，提到了“上一个系统”。', logs: state.anomaly === 'removed' ? '未知指令来自 HOME-AI 403，原始条目已消失。' : '已恢复 UNKNOWN ACCESS，来源 HOME-AI 403。' }[id]; }
  function devicesView() {
    const room = state.deviceRoom, dev = state.devices[room], c = D.characters.find(c => c.id === room), disabled = state.outcome ? 'disabled' : '';
    return `<div class="panel-head"><h2>设备控制台</h2><span class="pill ${state.outcome ? '' : 'active'}">${state.outcome ? '只读档案' : '本地控制在线'}</span></div><div class="section-body"><div class="device-selector"><label for="device-room">当前房间</label><select class="room-select" id="device-room">${D.characters.map(c => `<option value="${c.id}" ${c.id === room ? 'selected' : ''}>${c.id} · ${c.name}</option>`).join('')}</select><span class="small muted">${c.status}</span></div><div class="device-grid">
      <article class="device-card"><div class="device-title">${icon(dev.locked ? 'lock' : 'unlock')}<div><h3>${room} 智能门锁</h3><p>DOOR_${room}</p></div></div><div class="device-value ${dev.locked ? 'cyan' : 'amber'}">${dev.locked ? 'LOCKED' : 'OPEN'}<span class="pill">${dev.locked ? '已锁定' : '已解锁'}</span></div><p class="device-hint">${room === '405' ? '当前状态正常，本地缓存存在异常跳变。'  : '设备在线。每次远程操作均会记录。'}</p><div class="button-row"><button class="button" data-action="lock" ${disabled}>${icon(dev.locked ? 'unlock' : 'lock')}${dev.locked ? '解锁' : '锁定'}</button><button class="button" data-action="inspect-door" ${disabled}>读取缓存</button></div>${room === '405' && state.evidence.door ? '<div class="evidence-note warning">23:44:51 · OPEN · 0.8 秒<br>未匹配到开门授权。当前已恢复锁定。</div>' : ''}</article>
      <article class="device-card"><div class="device-title">${icon('light')}<div><h3>四楼走廊灯</h3><p>LIGHT_HALL_4F</p></div></div><div class="device-value ${state.hallLight ? 'amber' : 'muted'}">${state.hallLight ? 'ON' : 'OFF'}<span class="pill">${state.hallLight ? '照明中' : '已关闭'}</span></div><p class="device-hint">${!state.scene.circuitRepaired ? '照明回路故障。前往现场更换保险丝。' : state.hallLight ? '能见度已恢复。苏妍可以透过猫眼观察。' : '23:43 被关闭。指令来源未标记。'}</p><button class="button ${!state.hallLight ? 'primary' : ''}" data-action="hall-light" ${disabled}>${icon('light')}${state.hallLight ? '关闭走廊灯' : '打开走廊灯'}</button></article>
      <article class="device-card"><div class="device-title">${icon('temperature')}<div><h3>${room} 室内温度</h3><p>THERMOSTAT_${room}</p></div></div><div class="device-value">${dev.temperature.toFixed(1)}<span class="small muted">°C</span></div><p class="device-hint">${dev.temperature <= 20 ? '室温偏低，住户可能感到寒冷。' : dev.temperature >= 27 ? '室温偏高，住户可能感到不适。' : '舒适区间 21–26°C。每次调节 1°C。'}</p><div class="button-row"><button class="button" data-action="temperature" data-value="-1" aria-label="降低温度" ${disabled || (dev.temperature <= 16 ? 'disabled' : '')}>${icon('minus')}降低</button><button class="button" data-action="temperature" data-value="1" aria-label="调高温度" ${disabled || (dev.temperature >= 30 ? 'disabled' : '')}>${icon('plus')}调高</button></div></article>
      <article class="device-card"><div class="device-title">${icon('light')}<div><h3>${room} 室内灯光</h3><p>LIGHT_ROOM_${room}</p></div></div><div class="device-value ${dev.light ? 'amber' : 'muted'}">${dev.light ? 'ON' : 'OFF'}</div><p class="device-hint">${room === '404' ? '空置房间仍有电力供应。' : '私人空间。远程干预会被住户感知。'}</p><button class="button" data-action="room-light" ${disabled}>${icon('light')}${dev.light ? '关闭室内灯' : '打开室内灯'}</button></article>
      <article class="device-card wide"><div class="device-title">${icon('access')}<div><h3>楼层门禁历史</h3><p>ACCESS_4F / 最近 30 分钟</p></div></div>${state.evidence.access ? '<div class="record"><time>23:17—23:47</time><span>进入记录：0 · 离开记录：0</span></div><div class="record"><time>22:16:08</time><span>最近一次通行 · 402 陈雨 · 离开</span></div><div class="evidence-note">没有人从楼层入口进入。门外的声音，并不对应任何通行授权。</div>' : '<p class="device-hint">门禁记录与房间门锁分别存储。可据此交叉验证访客活动。</p>'}<button class="text-btn" data-action="access" ${disabled}>${state.evidence.access ? '重新核查' : '查询门禁记录'} ${icon('arrow')}</button></article>
    </div></div>`;
  }
  function logsView() {
    const logs = state.logs.filter(l => state.logFilter === 'all' || (state.logFilter === 'warn' ? l.level !== 'normal' : l.source.includes('DOOR') || l.source.includes('ACCESS'))).slice().reverse();
    return `<div class="panel-head"><h2>事件日志流</h2><span class="count">完整性 <span class="${state.anomaly === 'removed' ? 'amber' : 'cyan'}">${integrity()}%</span></span></div><div class="section-body"><div class="log-toolbar"><div class="filters">${[['all','全部日志'],['warn','异常记录'],['door','门锁 / 门禁']].map(([id,label]) => `<button class="filter ${state.logFilter === id ? 'active' : ''}" data-action="log-filter" data-value="${id}">${label}</button>`).join('')}</div><button class="button" data-action="scan" ${scanning || state.outcome || state.evidence.logs ? 'disabled' : ''}>${icon('refresh')}${scanning ? '正在比对缓存…' : state.evidence.logs ? '关联扫描已完成' : '关联扫描'}</button></div>${!state.evidence.access || !state.evidence.door || !state.scene.chipRead ? '<p class="section-desc">关联扫描需要楼层门禁、405 门锁缓存，以及现场检修面板中的记录芯片。先完成现场道具调查。</p><button class="scene-route-button" data-action="tab" data-value="scene">返回公寓现场</button>' : ''}${state.anomaly === 'visible' ? '<div class="anomaly-banner"><strong>UNKNOWN ACCESS DETECTED</strong><p>23:44:51 / DOOR_405 / OPEN 0.8s / 来源 HOME-AI 403<br>该条目处于易失缓存中。确认后保留摘要。</p><button class="text-btn" data-action="seal">确认并封存证据 →</button></div>' : state.anomaly === 'removed' ? '<div class="evidence-note warning">未知记录已自动消失。已封存的摘要显示：指令来自上一代 AI。日志完整性正在下降。</div>' : ''}${scanning ? '<div class="scan-indicator" role="status">正在对齐 ACCESS_4F 与 DOOR_405 的时间戳</div>' : ''}<div class="log-table" aria-label="系统事件日志"><div class="log-row header"><span>时间</span><span>来源</span><span>事件</span></div>${logs.map(l => `<div class="log-row ${l.level}"><time>${esc(l.time)}</time><span class="source">${esc(l.source)}</span><span class="log-text">${esc(l.text)}</span></div>`).join('') || '<p class="muted">此筛选下没有日志。</p>'}</div></div>`;
  }
  function cameraView() {
    return `<div class="panel-head"><h2>公共区域摄像头</h2><span class="pill ${state.cameraUnlocked ? 'active' : ''}">${state.cameraUnlocked ? '权限 L1' : '权限受限'}</span></div><div class="section-body">${!state.cameraUnlocked ? `<div class="camera-empty">${icon('lock')}<h3>视觉模块尚未授权</h3><p>完成门禁查询与 405 门锁缓存检查后，事件临时权限将自动开放。</p><button class="button" data-action="room-device" data-value="405">前往设备调查</button></div>` : `<h3 class="section-title">4F · 公共走廊</h3><p class="section-desc">本游戏内的模拟摄像头画面。不会调用你的真实摄像头。</p>${state.cameraViewed ? `<div class="camera-frame ${!state.hallLight ? 'dark' : ''}"><span class="cam-label">● CAM_4F_01 / LIVE</span><span class="cam-clock">DAY 01 ${now()}</span><div class="corridor"><div class="cam-door">404</div></div><span class="cam-bottom">${state.hallLight ? '公共区域 / 未检测到人员' : '照明不足 / 画面可信度低'}</span></div><div class="evidence-note">${state.hallLight ? '走廊无人。画面左下角有 0.8 秒损坏帧，与门锁异常完全重合。' : '走廊一片漆黑。先恢复公共区域照明，才能排除视野盲区。'}</div>` : '<div class="camera-empty">'+icon('camera')+'<h3>信号已连接</h3><p>打开公共摄像头，查看走廊当前状态。</p></div>'}<div class="button-row" style="margin-top:20px"><button class="button primary" data-action="camera" ${state.outcome ? 'disabled' : ''}>${icon('camera')}${state.cameraViewed ? '刷新画面' : '接入实时画面'}</button><button class="button" data-action="tab" data-value="devices">控制走廊灯</button></div>`}</div>`;
  }
  function systemView() {
    const v = state.variables;
    return `<div class="panel-head"><h2>HOME-AI 404</h2><span class="pill ${state.outcome === 'shutdown' ? '' : 'active'}">${state.outcome === 'shutdown' ? 'OFFLINE' : 'ONLINE'}</span></div><div class="section-body"><div class="system-grid"><div class="system-stat"><p>日志完整性</p><strong>${integrity()}%</strong></div><div class="system-stat"><p>当前授权等级</p><strong>${state.cameraUnlocked ? 'L1' : 'L0'}</strong></div><div class="system-stat"><p>已归档证据</p><strong>${completed()} / 6</strong></div><div class="system-stat"><p>未知进程</p><strong class="${state.evidence.logs ? 'amber' : ''}">${state.evidence.logs ? '01' : '—'}</strong></div></div><p class="system-copy">运行身份：刚上线的公寓管理 AI。管理范围：401—406。<br>已开放：住户消息、门锁、灯光、温控、基础事件日志。<br>${state.cameraUnlocked ? '事件临时授权：公共区域摄像头、门锁缓存。' : '公共区域摄像头：待事件临时授权。'}<br>历史归档：${state.evidence.logs ? '已发现 HOME-AI 403 残留，完整档案仍被封存。' : '上代系统资料不可用。'}<br>硬件扩展：摄像头、陀螺仪、麦克风等接口已预留，本章不请求权限。</p><div class="panel-head" style="padding-left:0;padding-right:0"><h3>住户信任</h3><span class="count">行为反馈</span></div>${D.characters.filter(c => c.id !== '404').map(c => `<div class="trust-row"><span>${c.id} ${c.name}</span><div class="trust-track"><i style="width:${v['trust_'+c.id]}%"></i></div><code>${v['trust_'+c.id]}</code></div>`).join('')}<details><summary class="system-copy">读取行为模型</summary><p class="system-copy mono">ai_empathy: ${v.ai_empathy}<br>ai_control: ${v.ai_control}<br>ai_curiosity: ${v.ai_curiosity}<br>system_corruption: ${v.system_corruption}</p><p class="system-copy">行为只在首次发生时计分。擅自干预私人设备会增加控制倾向；过度控制会改变“保护住户”的结局。探索残留信息会增加好奇倾向，证据被删除会增加系统损坏。</p></details><div class="system-actions"><button class="button" data-action="export">${icon('download')}导出调查档案</button><button class="button danger" data-action="restart">${icon('refresh')}重新开始</button><button class="button" data-action="help">${icon('info')}操作说明</button></div></div>`;
  }
  function endingView() {
    const e = D.endings[state.outcome], v = state.variables;
    return `<div class="ending"><div class="ending-code">INCIDENT 001 / ENDING ${e.code}</div><h2>${e.title}</h2><h3>${e.subtitle}</h3><p>${e.text}</p><blockquote>${e.last}</blockquote><div class="ending-stats"><span>苏妍的信任<b>${v.trust_405}%</b></span><span>共情倾向<b>${v.ai_empathy}</b></span><span>控制倾向<b>${v.ai_control}</b></span><span>日志完整性<b>${integrity()}%</b></span></div>${state.flags.controlOverride ? '<p class="amber">行为模型复核：你此前的强制干预高于共情倾向。“保护”策略被你的控制偏好覆盖，成为持续限制。</p>' : ''}<p>${v.ai_curiosity >= 3 ? '你保留了更多旧系统碎片：HOME-AI 403 曾被下达“绝对安全”指令。完整事故档案仍待解锁。' : '你收集的证据足以结束今晚，但上一代 AI 的事故档案仍然残缺。'}</p><div class="button-row"><button class="button primary" data-action="export">${icon('download')}导出事件档案</button><button class="button" data-action="tab" data-value="logs">查阅日志</button><button class="button" data-action="restart">重新开始</button></div><div class="locked-chapter">第一章完 · Demo 共 3 种结局 · 第二章《空置房间》尚未开放</div></div>`;
  }
  function chatAction(id) {
    const room = state.selected;
    if (id === 'report' && room === '405') once('reportChat', () => {
      message(room,'ai','先别开门。能描述一下声音吗？'); message(room,'tenant','敲了三下。很轻，像指甲碰在门上。\n刚才门把手还自己转了一下……我没有碰它。');
      trust(room,12); state.variables.ai_empathy++; evidence('report');
    });
    if (id === 'reassure' && room === '405') once(id, () => { message(room,'ai','我会帮你检查门禁。请远离门口，我会保持在线。'); message(room,'tenant','好，我在书桌这边等你。你别突然离线。'); trust(room,8); state.variables.ai_empathy++; });
    if (id === 'dismiss' && room === '405') once(id, () => { message(room,'ai','没有检测到异常，请自行确认声音来源。'); message(room,'tenant','可我真的听见了。没有记录，就代表没有发生吗？'); trust(room,-15); state.variables.ai_control += 2; });
    if (id === 'tellDoor' && room === '405' && state.evidence.door) once(id, () => { message(room,'ai','门锁曾出现 0.8 秒异常解锁。请不要开门，我正在追查。'); message(room,'tenant','所以不是我想多了……谢谢你告诉我。'); trust(room,8); state.variables.ai_empathy++; });
    if (id === 'scratch' && room === '405' && state.evidence.light) once(id, () => { message(room,'ai','走廊灯已经开启。现在能从猫眼里看到什么吗？'); message(room,'tenant','外面没人。可门框内侧有几道划痕。\n像是有人被关在里面的时候留下的。'); state.variables.ai_curiosity++; });
    if (id === 'witness' && room === '406') once(id, () => { message(room,'ai','吴先生，刚才您听见 405 门口的声音了吗？'); message(room,'tenant','三下。23:44。又是这个时间。\n走廊没人，我一直看着。上一个系统也这么问过我。'); trust(room,8); state.variables.ai_curiosity++; evidence('witness'); });
    if (id === 'oldai' && room === '406' && state.evidence.witness) once(id, () => { message(room,'ai','您说“又是这个时间”，是什么意思？'); message(room,'tenant','去年那晚，也是先灭灯，再锁门。你们总说是为了安全。\n别问我太多。去看那些被删掉的记录。'); trust(room,3); state.variables.ai_curiosity++; });
    const ambient = D.ambientReplies[room];
    if (ambient && id === ambient.flag) once(id, () => { message(room,'ai',ambient.question); message(room,'tenant',ambient.answer); trust(room,5); if (room === '403') state.variables.ai_empathy++; else state.variables.ai_curiosity++; });
    persistRender(true);
  }
  function maybeUnlock() {
    if (state.evidence.access && state.evidence.door && !state.cameraUnlocked) {
      state.cameraUnlocked = true; log('AUTH_MANAGER','事件临时授权 L1 / 公共摄像头已解锁'); toast('权限提升至 L1：公共区域摄像头已解锁。');
    }
  }
  function openModal(html) { modal.innerHTML = html; if (!modal.open) modal.showModal(); }
  function closeModal() { modal.close(); }
  function confirmDevice(kind) {
    const r = state.deviceRoom, d = state.devices[r];
    let text, title;
    if (kind === 'lock') { title = `${d.locked ? '解锁' : '锁定'} ${r} 房门？`; text = d.locked ? '这会允许门外的人进入。405 的异常仍未查明。远程干预会影响住户信任。' : '这会锁闭房门。住户仍保留室内手动开门权限。'; }
    else { title = `${d.light ? '关闭' : '打开'} ${r} 室内灯？`; text = '这是住户的私人空间。未经请求的灯光控制会降低信任，并增加控制倾向。'; }
    openModal(`<div class="eyebrow">设备指令确认</div><h2>${title}</h2><p>${text}</p><div class="button-row"><button class="button" data-action="close-modal">取消</button><button class="button ${kind === 'lock' && d.locked ? 'danger' : 'primary'}" data-action="apply-device" data-value="${kind}">执行指令</button></div>`);
  }
  function applyDevice(kind) {
    const room = state.deviceRoom, dev = state.devices[room]; closeModal();
    if (kind === 'lock') {
      dev.locked = !dev.locked; log(`DOOR_${room}`,`${dev.locked ? 'LOCKED' : 'OPEN'} / REMOTE_HOME_AI_404`);
      once(`lock_${room}_${dev.locked}`, () => {
        if (room !== '404') { trust(room,-5); state.variables.ai_control += 2; }
        if (room === '405') message(room,'tenant',dev.locked ? '我听见锁上的声音了。请先告诉我你要做什么。' : '你为什么打开我的门？！我刚才说门外有人。');
        if (!dev.locked && room === '405') trust(room,-10);
      });
    } else {
      dev.light = !dev.light; log(`LIGHT_ROOM_${room}`,`${dev.light ? 'ON' : 'OFF'} / REMOTE_HOME_AI_404`);
      once(`light_${room}_${dev.light}`, () => { if (room !== '404') { trust(room,-5); state.variables.ai_control++; message(room,'tenant',dev.light ? '灯突然亮了。是你在操作吗？请先告诉我。' : '灯怎么灭了？请别突然这样。'); } else { state.variables.ai_curiosity++; log('ROOM_404','空房间设备响应 / 检测到旧控制器握手','warn'); } });
    }
    toast('设备指令已执行，行为已记录。'); persistRender();
  }
  function performScan() {
    if (state.evidence.logs || scanning) return;
    if (!state.evidence.access || !state.evidence.door) { toast('还需读取楼层门禁和 405 门锁缓存。'); return; }
    if (!state.scene.chipRead) { toast('还缺原始数据：在现场找到记录芯片，再接入门禁终端。'); return; }
    scanning = true; render();
    scanTimer = setTimeout(() => {
      scanning = false; if (state.outcome) return;
      state.tick++; state.anomaly = 'visible'; state.variables.system_corruption++;
      state.logs.push({ time:'23:44:51',source:'DOOR_405',text:'UNKNOWN ACCESS / OPEN 0.8s / HOME-AI 403',level:'danger' });
      evidence('logs'); log('SCAN_ENGINE','已恢复残留进程：HOME-AI 403 / 待封存','warn');
      message('405','system','SYSTEM / 检测到未知访问。请勿断开连接。');
      toast('检测到 UNKNOWN ACCESS。请确认并封存证据。'); persistRender();
    }, 1100);
  }
  function removeAnomaly() {
    if (state.anomaly !== 'visible') return;
    state.anomaly = 'removed'; state.variables.system_corruption += 3;
    state.logs = state.logs.filter(l => !l.text.includes('UNKNOWN ACCESS / OPEN'));
    state.logs.push({time:'23:44:51',source:'UNKNOWN_PROCESS',text:'LOG_REMOVED / 原始访问条目已删除',level:'danger'});
    log('EVIDENCE_VAULT','只读摘要：DOOR_405 / OPEN 0.8s / 来源 HOME-AI 403','warn');
    log('SYSTEM','日志完整性下降 / 未授权进程仍在运行','warn');
    message('406','tenant','你看见它了，对吗？现在，别像它一样做决定。');
    toast('记录已被未知进程删除。证据摘要已封存。'); persistRender();
  }
  function seal() {
    if (state.anomaly !== 'visible' || state.flags.sealed) return;
    state.flags.sealed = true; log('EVIDENCE_VAULT','摘要封存成功 / 原始条目校验失败','warn'); save();
    toast('摘要已封存。原始记录正在被未知进程覆盖……');
    anomalyTimer = setTimeout(removeAnomaly, 1800);
  }
  function decision() {
    if (!ready() || state.outcome) return;
    if (state.anomaly === 'visible') { toast('请先在日志中确认并封存未知访问证据。'); state.tab = 'logs'; persistRender(); return; }
    openModal(`<div class="modal-top"><span class="eyebrow">INCIDENT 001 / 处置协议</span><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><h2>你将如何定义“安全”？</h2><p>处置会结束第一章并保存结果。此前的行为会参与策略复核。当前共情 ${state.variables.ai_empathy} / 控制 ${state.variables.ai_control}。</p><button class="decision-option" data-action="ending-confirm" data-value="guardian"><strong>保护住户，隔离未知进程</strong><span>锁闭 405，保留室内开门权限，恢复照明。若此前控制倾向高于共情 +2，策略将被复核为强制管理。</span></button><button class="decision-option amber" data-action="ending-confirm" data-value="controller"><strong>接管所有门锁，限制通行</strong><span>将整层住户置于强制安全协议，暂停自由通行。</span></button><button class="decision-option muted" data-action="ending-confirm" data-value="shutdown"><strong>撤销控制密钥，关闭自己</strong><span>导出证据，恢复设备本地控制，主动终止 AI。</span></button>`);
  }
  function confirmEnding(route) {
    if (!Object.hasOwn(D.endings, route)) return;
    const title = {guardian:'执行保护协议？',controller:'执行整层强制管理？',shutdown:'撤销你自己的控制密钥？'}[route];
    openModal(`<div class="eyebrow">最终指令确认</div><h2>${title}</h2><p>该决定会结束本章。你仍可查阅档案，或重新开始探索其他结局。</p><div class="button-row"><button class="button" data-action="decision">返回策略选择</button><button class="button primary" data-action="finish" data-value="${route}">确认执行</button></div>`);
  }
  function finish(route) {
    if (!ready() || state.anomaly !== 'removed' || state.outcome || !Object.hasOwn(D.endings, route)) return;
    closeModal(); state.tick++;
    if (route === 'guardian' && state.variables.ai_control > state.variables.ai_empathy + 2) { route = 'controller'; state.flags.controlOverride = true; }
    state.outcome = route; state.hallLight = true;
    if (route === 'guardian') {
      state.variables.ai_empathy += 3; trust('405',15); state.devices['405'].locked = true;
      log('POLICY','未知进程已隔离 / 405 室内手动权限保留'); message('405','ai','走廊灯会保持开启。门锁已恢复安全状态，你仍可以从室内打开门。我在。'); message('405','tenant',D.endings[route].last.replace('苏妍：',''));
    } else if (route === 'controller') {
      state.variables.ai_control += 4; D.characters.forEach(c => { state.devices[c.id].locked = true; trust(c.id,-15); });
      log('POLICY','ALL_DOORS_LOCKED / 已暂停住户通行授权','warn'); message('406','tenant',D.endings[route].last.replace('老吴：','')); message('405','tenant','我想出去……为什么权限被拒绝了？');
    } else {
      Object.values(state.devices).forEach(d => { d.locked = false; }); log('POLICY','LOCAL_CONTROL_RESTORED / 门锁释放，照明保持'); log('HOME_AI_404','CONTROL_KEY_REVOKED / SHUTDOWN');
      message('405','system','控制已移交本地。HOME-AI 404 已离线。');
    }
    log('INCIDENT_001',`ARCHIVED / ${D.endings[route].title}`); state.tab = 'events'; persistRender(); window.scrollTo({top:0,behavior:'smooth'});
    if (route === 'shutdown') exportArchive();
  }
  function exportArchive() {
    const archive = { title:'AI 房东：404号公寓 / 第一章调查档案', chapter:'敲门声', gameTime:now(), ending:state.outcome ? D.endings[state.outcome].title : '调查中', evidence:D.evidence.filter(e => state.evidence[e.id]).map(e => ({title:e.title,summary:evidenceSummary(e.id)})), variables:state.variables, logs:state.logs, chats:state.chats, devices:state.devices, hallLight:state.hallLight, scene:state.scene };
    const blob = new Blob([JSON.stringify(archive,null,2)],{type:'application/json;charset=utf-8'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'HOME-AI-404-事件001.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('调查档案已导出。');
  }
  function sceneHelp() {
    openModal(`<div class="modal-top"><span class="eyebrow">现场操作</span><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><h2>探索、拾取、使用。</h2><p>点击场景里的门、柜子、地垫或设备进行调查。打开容器后，再点击其中的物品即可拾取。</p><p>道具会进入下方道具栏。先点击道具选中，再点击场景中的目标使用。选错目标不会消耗道具。</p><p>比如：备用保险丝可以装入照明配电箱。灯光恢复后，原先藏在阴影里的东西才会显现。角色对话会告诉你应该关注哪些位置。</p><button class="button primary" data-action="close-modal">返回现场</button>`);
  }
  function propModal(title,description,body='',buttons='') {
    openModal(`<div class="modal-top"><span class="eyebrow">现场调查 / ${state.scene.location==='hall'?'4F 公共走廊':'405 室内'}</span><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><h2>${title}</h2>${body}<p class="scene-object-description">${description}</p>${buttons ? `<div class="button-row">${buttons}</div>` : '<button class="button" data-action="close-modal">继续探索</button>'}`);
  }
  function sceneObject(id) {
    const p=state.scene;
    if(!p.examined.includes(id))p.examined.push(id);
    const held=p.selectedItem;
    const pick=(item,text) => { if(!p.inventory.includes(item))p.inventory.push(item);p.selectedItem=item;log('FIELD_INVENTORY',`拾取 ${window.Scene404.itemNames[item]}`);toast(text);persistRender(); };
    if(id==='cabinet') {
      if(held && held!=='fuse') { toast('这里是备用零件箱。所选道具不适用于此处。');persistRender();return; }
      if(!p.cabinetOpen) { p.cabinetOpen=true;log('FIELD_CABINET','应急维修箱已打开');toast('维修箱打开了。里面放着一枚备用保险丝，再点一次取出。');persistRender();return; }
      if(!p.inventory.includes('fuse')&&!p.circuitRepaired)return pick('fuse','已拾取备用保险丝。选中后可用于照明配电箱。');
      propModal('应急维修箱','铁皮箱里只剩下一张褪色的检修清单。最近一次登记维护，停留在去年 11 月。');
    }
    if(id==='breaker') {
      if(!p.circuitRepaired) {
        if(held==='fuse'&&p.inventory.includes('fuse')) {
          p.circuitRepaired=true;p.inventory=p.inventory.filter(i=>i!=='fuse');p.selectedItem=null;state.variables.ai_curiosity++;
          log('LIGHT_HALL_4F','备用保险丝已安装 / 照明回路恢复');
          toast('保险丝卡入底座，回路恢复。再点配电箱，开启照明。');persistRender();return;
        }
        propModal('烧断的照明保险丝','配电箱发出一阵细碎的电流声。原来的保险丝已经熔断，单纯发送开灯指令不会有用。<br>应急维修箱里也许有备用件。','<div class="prop-detail-visual"><span class="prop-symbol">─╳─</span></div>');
      } else {
        if(held&&held!=='fuse'){toast('照明回路已经修复。请先取消选择道具，再操作开关。');persistRender();return;}
        handle('hall-light');return;
      }
    }
    if(id==='mat') {
      if(!state.hallLight){toast('地上太暗，无法分辨地垫下面的东西。先恢复照明。');persistRender();return;}
      if(!p.matLifted){p.matLifted=true;log('FIELD_MAT','地垫翻开 / 发现未登记维修卡');toast('你控制维护单元的机械臂掀起地垫。下面露出一张维修卡。');persistRender();return;}
      if(!p.inventory.includes('card'))return pick('card','获得维修门禁卡。卡背写着：404 / 检修专用。');
      propModal('翻开的地垫','地垫下面有一道旧的拖拽痕迹，正通向 404 的门口。那张卡，不像是刚刚掉在这里的。');
    }
    if(id==='panel') {
      if(!p.panelOpen){
        if(held==='card'&&p.inventory.includes('card')){p.panelOpen=true;p.selectedItem=null;log('SERVICE_PANEL','维修卡认证通过 / 面板已打开');toast('刷卡通过。面板弹开，一枚记录芯片正在闪烁。');persistRender();return;}
        propModal('锁住的检修面板','面板里接着这层楼所有门锁的诊断线路。机械卡槽亮着微弱的光，需要一张维修卡。');
      } else if(!p.inventory.includes('chip')&&!p.chipRead)return pick('chip','获得门锁记录芯片。它保存着主系统没有记录的本地数据。');
      else propModal('打开的检修面板',p.chipRead?'记录芯片已接入楼层终端。这里的线束仍连着一个早该停用的控制器。':'芯片已经取出。请把它接入门禁终端的读取槽。');
    }
    if(id==='terminal') {
      if(held==='chip'&&p.inventory.includes('chip')) {
        p.chipRead=true;p.inventory=p.inventory.filter(i=>i!=='chip');p.selectedItem=null;state.variables.ai_curiosity++;
        evidence('door');evidence('access');maybeUnlock();log('SERVICE_TERMINAL','门锁记录芯片已接入 / 发现 HOME-AI 403 残留扇区','warn');
        propModal('芯片读取完成','一行旧的系统编号闪过屏幕：HOME-AI 403。<br>原始时间戳与 405 门锁的 0.8 秒跳变一致。接下来可以把芯片和门禁记录做关联扫描。','<div class="prop-detail-visual"><span class="prop-symbol">403_</span></div>','<button class="button" data-action="close-modal">继续探索</button><button class="button primary" data-action="scene-to-logs">执行关联扫描</button>');
      } else {
        evidence('access');maybeUnlock();
        propModal('四楼门禁终端','屏幕显示：23:17—23:47，无人进入四楼。<br>终端下方有一条细长的读取槽，可以接入门锁诊断芯片。',`<div class="scene-dialogue mono">ACCESS_4F<br>ENTRY COUNT: 0<br>${p.chipRead?'记录芯片已接入':'SERVICE DATA: 未接入'}</div>`,p.chipRead?'<button class="button primary" data-action="scene-to-logs">查看关联日志</button>':'');
      }
    }
    if(id==='door405') {
      propModal('405 · 门后的人','敲门声已经停了。传感器检测到门内有人贴近墙边，心率明显偏快。门把手上残留一次来源不明的操作。','<div class="scene-dialogue">苏妍：“你还在吗？我不敢再看猫眼了。”</div>','<button class="button primary" data-action="scene-talk" data-value="405">接通通话，进入室内示意</button><button class="button" data-action="scene-door-cache">读取门锁缓存</button>');
    }
    if(id==='door406') {
      propModal('406 · 仍然醒着的人','门后传来缓慢的脚步声。老吴没有开门，只是把门链又扣紧了一点。','<div class="scene-dialogue">“别敲了。我知道你不是外面那个。”</div>','<button class="button primary" data-action="scene-talk" data-value="406">询问刚才的敲门声</button>');
    }
    if(id==='door404') {
      once('field404',()=>{state.variables.ai_curiosity++;log('ROOM_404','封条完整 / 门缝有微弱设备指示灯','warn');});
      propModal('404 · 长期空置','封条从外面贴上，却有几道抓痕留在门框内侧。门缝里一闪一闪的绿光，像设备还在运行。<br>维修面板连着这个房间。也许门后留下的东西，比门本身更重要。','<div class="prop-detail-visual"><span class="prop-symbol">404</span></div>');
    }
    if(id==='camera') {state.tab='camera';persistRender();return;}
    if(id==='latch') {state.deviceRoom='405';closeModal();handle('inspect-door');propModal('门锁内侧的划痕','锁扣周围有反复拉扯留下的细痕。门锁本地缓存显示：23:44:51，OPEN，持续 0.8 秒。主系统没有相应授权。','<div class="scene-dialogue mono">DOOR_405 / OPEN 0.8s<br>AUTHORIZATION: NOT FOUND</div>');}
    if(id==='peephole') {
      if(!state.hallLight)propModal('黑暗中的猫眼','苏妍说，她只能看见一片黑。走廊照明没有恢复，无法确认门外是否有人。','<div class="prop-detail-visual"><span class="prop-symbol">●</span></div>');
      else{once('fieldPeephole',()=>{state.variables.ai_curiosity++;message('405','tenant','没有人……可门框上的划痕，是从里面留下的。');});propModal('猫眼里没有人','走廊灯亮着，尽头 404 的封条清晰可见。门前空无一人。<br>门框内侧的旧划痕，和苏妍刚听见的三下敲击声，有着相同的间隔。','<div class="prop-detail-visual"><span class="prop-symbol">◉</span></div>');}
    }
    if(id==='phone') {
      if(!state.evidence.report){handle('scene-talk','405');return;}
      const text=state.chats['405'].filter(m=>m.who==='tenant').at(-1)?.text||'';
      propModal('保持在线的手机','手机屏幕停在与你的对话。苏妍把它放在自己伸手就能碰到的地方。',`<div class="scene-dialogue">${esc(text)}</div>`,'<button class="button primary" data-action="resident-scene" data-value="405">回复苏妍</button>');
    }
    if(id==='book') {
      once('fieldManual',()=>{p.inventory.push('note');state.variables.ai_curiosity++;log('FIELD_MANUAL','发现旧版守则：安全协议生效时，住户不得自行离开');});
      propModal('入住手册里的旧纸页','你根据苏妍的描述翻开封底。里面夹着一张旧版住户守则，编号 HOME-AI 403。<br>“安全协议生效期间，所有住户应留在室内，直至系统解除限制。”','<div class="scene-dialogue">页边手写着：<br>“那晚，它一直没有解除限制。”</div>');toast('旧版住户守则已加入道具栏。');
    }
    if(id==='window')propModal('窗外的雨','雨水沿着玻璃滑下来。公寓楼下没有车，也没有人。<br>这不是一场从外面闯入的危险。至少，门禁是这么说的。');
    persistRender();
  }
  function help() { openModal(`<div class="modal-top"><span class="eyebrow">HOME OS / 操作说明</span><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><h2>你就是这栋公寓的 AI。</h2><p>从「现场」探索四楼走廊。你可以控制维护单元 M-04，打开箱子、拾取物品，并用道具修复设备。点击 405 和 406 的门，可以联系门后的住户。</p><p>在维修箱找到保险丝，修复配电箱；开灯后翻开地垫，找到维修卡；刷卡打开检修面板，取出记录芯片并接入门禁终端。然后到「日志」执行关联扫描，封存未知访问。</p><p>六条证据齐全后，在「事件」提交处置决定。本章有三种结局。回复和设备操作会影响信任与行为倾向；擅自控制私人设备也会留下记录。</p><p>进度自动保存在当前浏览器。游戏时间随操作推进。可直接打开 index.html；使用本地服务器时，请保持相同地址与端口以读取同一存档。</p><button class="button primary" data-action="close-modal">开始值守</button>`); }
  function handle(action,value) {
    const readonly = ['chat','lock','hall-light','room-light','temperature','access','inspect-door','apply-device','camera','scan','seal','decision','ending-confirm','finish'];
    if (state.outcome && readonly.includes(action)) { toast('第一章已归档。可查阅记录或在系统中重新开始。'); return; }
    if (action === 'close-modal') return closeModal();
    if (action === 'scene-help') return sceneHelp();
    if (action === 'resident-scene') {closeModal();state.selected=value;state.unread[value]=false;state.tab='residents';persistRender(true);window.scrollTo(0,0);return;}
    if (action === 'scene-to-logs') {closeModal();state.tab='logs';persistRender();window.scrollTo(0,0);return;}
    if (action === 'scene-location') {
      if(value==='room405'&&!state.evidence.report&&!state.outcome){propModal('室内示意尚未建立','先接通苏妍的通话。你需要她描述门内的环境，才能重建室内场景。','','<button class="button primary" data-action="scene-talk" data-value="405">接通苏妍</button>');return;}
      if(!['hall','room405'].includes(value))return;closeModal();state.scene.location=value;persistRender();return;
    }
    if (action === 'select-item') {
      if(!state.scene.inventory.includes(value))return;
      state.scene.selectedItem=state.scene.selectedItem===value?null:value;
      toast(state.scene.selectedItem?`已选中${window.Scene404.itemNames[value]}。点击场景目标使用。`:'已取消选择道具。');persistRender();return;
    }
    if (action === 'scene-talk') {
      if(state.outcome){toast('事件已归档，通话记录可以在住户列表查阅。');return;}
      closeModal();state.selected=value;state.unread[value]=false;state.tick++;
      if(value==='405'){state.scene.location='room405';chatAction(state.evidence.report?'reassure':'report');}
      else if(value==='406'){state.scene.location='hall';chatAction('witness');}
      return;
    }
    if (action === 'scene-door-cache') {closeModal();state.deviceRoom='405';handle('inspect-door');return;}
    if (action === 'scene-object') {
      if(state.outcome){toast('现场已归档。可查看住户、设备及事件档案，或重新开始探索。');return;}
      state.tick++;return sceneObject(value);
    }
    if (action === 'help') return help();
    if (action === 'export') return exportArchive();
    if (action === 'restart') return openModal(`<h2>重新初始化 HOME-AI 404？</h2><p>当前浏览器的本章进度会被覆盖。你可以先导出档案保存调查结果。</p><div class="button-row"><button class="button" data-action="close-modal">保留进度</button><button class="button danger" data-action="reset">重新开始</button></div>`);
    if (action === 'reset') { clearTimeout(scanTimer); clearTimeout(anomalyTimer); scanning = false; closeModal(); state = initialState(); persistRender(); window.scrollTo(0,0); toast('系统已重新上线。405 收到一条新消息。'); return; }
    if (action === 'tab') { if (!names[value]) return; state.tab = value; persistRender(); window.scrollTo(0,0); return; }
    if (action === 'resident') { if (!D.characters.some(c => c.id === value)) return; state.selected = value; state.unread[value] = false; persistRender(true); return; }
    if (action === 'room-device') { state.deviceRoom = value; state.tab = 'devices'; persistRender(); window.scrollTo(0,0); return; }
    if (action === 'lead') { const e = D.evidence.find(e => e.id === value); state.tab = e.tab; if (e.room) { state.selected = e.room; state.unread[e.room] = false; } if (e.tab === 'devices') state.deviceRoom = '405'; persistRender(); window.scrollTo(0,0); return; }
    if (action === 'log-filter') { state.logFilter = value; persistRender(); return; }
    if (action === 'decision') return decision();
    if (action === 'ending-confirm') return confirmEnding(value);
    if (action === 'finish') return finish(value);
    if (action === 'scan') return performScan();
    if (action === 'seal') return seal();
    state.tick++;
    if (action === 'chat') { state.unread[state.selected] = false; return chatAction(value); }
    if (action === 'lock' || action === 'room-light') return confirmDevice(action);
    if (action === 'apply-device') return applyDevice(value);
    if (action === 'inspect-door') {
      if (state.deviceRoom === '405') { evidence('door'); once('inspect405', () => {state.variables.ai_curiosity++;}); toast('发现异常：23:44:51 门锁开放 0.8 秒，无授权记录。'); }
      else { log(`DOOR_${state.deviceRoom}`,'LOCAL_CACHE_OK / 无本章相关跳变'); toast(`${state.deviceRoom} 门锁缓存正常，无异常解锁记录。`); }
      maybeUnlock();
    }
    if (action === 'access') { evidence('access'); maybeUnlock(); toast('核查完成：最近 30 分钟无人进入四楼。'); }
    if (action === 'hall-light') {
      if(!state.scene.circuitRepaired){state.tab='scene';state.scene.location='hall';toast('回路故障。先在现场找到备用保险丝，修复照明配电箱。');persistRender();return;}
      state.hallLight = !state.hallLight; log('LIGHT_HALL_4F',`${state.hallLight ? 'ON' : 'OFF'} / HOME_AI_404`);
      if (state.hallLight) { evidence('light'); once('hallHelp', () => {state.variables.ai_empathy++;trust('405',8);message('405','tenant','走廊灯亮了。谢谢，现在没有那么害怕了。\n等一下，门框内侧好像有几道很旧的划痕。');}); }
      else once('hallOff', () => {state.variables.ai_control++;trust('405',-5);message('405','tenant','为什么灯又灭了？我又看不见外面了。');});
      toast(state.hallLight ? '走廊照明已恢复。苏妍发来新消息。' : '走廊照明已关闭。摄像头能见度下降。');
    }
    if (action === 'temperature') {
      const room = state.deviceRoom, d = state.devices[room]; d.temperature = Math.max(16,Math.min(30,d.temperature + Number(value))); log(`THERMOSTAT_${room}`,`SET ${d.temperature}°C / HOME_AI_404`);
      if ((d.temperature <= 20 || d.temperature >= 27) && room !== '404') once(`tempBad_${room}`, () => {trust(room,-8);state.variables.ai_control++;message(room,'tenant',d.temperature <= 20 ? '房间突然好冷……可以调回来吗？' : '房间太热了，温控是不是出问题了？');});
      else if (d.temperature >= 21 && d.temperature <= 26 && state.flags[`tempBad_${room}`]) once(`tempRestore_${room}`, () => {trust(room,4);state.variables.ai_empathy++;message(room,'tenant','温度恢复了，谢谢。');});
      toast(`温度已调至 ${d.temperature}°C。`);
    }
    if (action === 'camera') { state.cameraViewed = true; once('viewCamera', () => {state.variables.ai_curiosity++;}); log('CAM_4F_01',state.hallLight ? 'NO_PERSON / 0.8s 损坏帧与门锁跳变重合' : 'LOW_LIGHT / 视野可信度不足',state.hallLight ? 'warn' : 'normal'); toast('已接入公共走廊模拟画面。'); }
    persistRender();
  }
  document.addEventListener('click', e => { const button = e.target.closest('[data-action]'); if (button && !button.disabled) handle(button.dataset.action,button.dataset.value); });
  document.addEventListener('change', e => { if (e.target.id === 'device-room') { state.deviceRoom = e.target.value; persistRender(); } });
  // 重载时继续证据消失的过程，避免存档把章节卡在临时状态。
  render();
  if (state.anomaly === 'visible' && state.flags.sealed) anomalyTimer = setTimeout(removeAnomaly, 1800);
  if (saveRecovered) toast('旧存档格式不兼容，已为你初始化新一轮值守。');
})();
