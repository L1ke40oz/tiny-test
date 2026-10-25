// 游戏引擎：只处理规则和状态，界面通过 E.ui 回调
window.Sound = { play(name) { if (name === 'alert' && navigator.vibrate) navigator.vibrate([60, 40, 60]); } };

window.Engine = (function () {
  let s = null;
  let ch = null;
  let gen = 0;
  let timers = [];
  let clockTimer = null;
  let queues = {};
  let logSeq = 1000;
  const listeners = [];

  const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
  const pad = (n) => String(n).padStart(2, '0');

  // 现场所有可观察点（走廊热点 + 各门观察点）的索引
  let obsIndex = null;
  function obs(id) {
    if (!obsIndex) {
      obsIndex = Object.assign({}, ch.scene.hotspots);
      Object.keys(ch.scene.doors).forEach((room) => {
        ch.scene.doors[room].obs.forEach((o) => { obsIndex[o.id] = Object.assign({ door: room }, o); });
      });
    }
    return obsIndex[id];
  }

  const E = {
    ui: null,
    get state() { return s; },
    get chapter() { return ch; },

    fmt(t, sec = true) {
      t = ((t % 86400) + 86400) % 86400;
      const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
      return pad(h) + ':' + pad(m) + (sec ? ':' + pad(x) : '');
    },

    // ---------- 生命周期 ----------
    start(chapterId) {
      gen++;
      timers.forEach(clearTimeout);
      timers = [];
      queues = {};
      obsIndex = null;
      clearInterval(clockTimer);
      ch = GameData.chapters[chapterId];
      s = GameState.create(chapterId);
      clockTimer = setInterval(() => { s.clock++; E.ui && E.ui.updateClock(); }, 1000);
      E.emit();
      ch.onStart(E);
    },

    on(fn) { listeners.push(fn); },
    emit() { listeners.forEach((fn) => fn(s)); },

    later(ms, fn) { const g = gen; timers.push(setTimeout(() => { if (g === gen) fn(); }, ms)); },
    advance(sec) { s.clock += sec; E.ui && E.ui.updateClock(); },

    // ---------- 变量 ----------
    apply(effects) {
      if (!effects) return;
      for (const k in effects) { if (k in s.vars) s.vars[k] += effects[k]; }
    },
    setFlag(k, v = true) { s.flags[k] = v; E.check(); E.emit(); },
    has(k) { return !!s.flags[k]; },
    setIntegrity(v) { s.integrity = Math.max(0, Math.round(v * 10) / 10); E.ui && E.ui.updateClock(); },

    clue(id) {
      if (s.flags[id]) return;
      s.flags[id] = true;
      s.clues.push(id);
      s.newClue = true;
      Sound.play('clue');
      E.toast('新线索：' + ch.clues[id].title, 'clue');
      E.autoBoard();
      E.check();
      E.emit();
    },

    check() {
      const f = s.flags;
      if (f.c_removed && !f.procShown) {
        f.procShown = true;
        s.processes.push({ pid: '0404', name: '??????', st: 'UNKNOWN', danger: true });
        E.later(800, () => E.toast('WARNING：检测到未知进程 PID 0404', 'error'));
      }
      if (ch.acts && s.phase === 'play') {
        const act = ch.acts[s.actIndex];
        if (act && act.next(s) && s.actIndex < ch.acts.length - 1) {
          s.actIndex++;
          E.later(2000, () => E.actEntered(s.actIndex));
        }
      }
      if (!f.decisionReady && s.phase === 'play' && ch.readyForDecision(s)) {
        f.decisionReady = true;
        E.later(1800, () => { ch.onDecisionReady(E); E.emit(); });
      }
    },

    // ---------- 分幕 / 过场 ----------
    currentAct() { return ch.acts ? ch.acts[s.actIndex] : null; },
    actGoals() {
      const a = E.currentAct();
      return a ? a.goals.map((g) => Object.assign({}, g, { done: !!g.done(s) })) : [];
    },
    currentGoal() {
      const gs = E.actGoals();
      const remain = gs.filter((g) => !g.done);
      if (remain.length) return remain[0];
      if (!s.flags.decided) return { text: '向 405 汇报结论', tab: 'chat', hint: '去【对话】点开 405 苏妍，把调查结论告诉她。' };
      return null;
    },
    // 住户首次开口（让每个人一出场就有记忆点）
    greet(id) {
      const c = GameData.characters[id];
      if (!c || !c.intro) return;
      const k = 'greet_' + id;
      if (s.flags[k]) return;
      s.flags[k] = true;
      E.npc(id, c.intro, { delay: 600 });
    },
    actEntered(i) {
      const a = ch.acts[i];
      E.emit();
      if (a.cut && ch.cutscenes[a.cut]) E.showCutscene(a.cut);
      else if (E.ui) E.ui.actTransition(a);
    },
    showBrief() { if (!s.briefShown) { s.briefShown = true; E.showCutscene('opening'); } },
    showCutscene(key) { const c = ch.cutscenes[key]; if (c && E.ui) E.ui.showCutscene(c); },

    // ---------- 线索连线图（自动生成） ----------
    // 每查到一条线索，只要某条推论所需要的节点都到齐，就自动接上。
    boardNodes() {
      const unlocked = s.board.unlocked;
      return ch.clueboard.nodes.filter((n) => (n.kind === 'ev' ? !!s.flags[n.id] : !!unlocked[n.id]));
    },
    boardEdges() { return s.board.edges; },
    boardHas(id) {
      const n = ch.clueboard.nodes.find((x) => x.id === id);
      if (!n) return false;
      return n.kind === 'ev' ? !!s.flags[id] : !!s.board.unlocked[id];
    },
    boardRule(target) { return ch.clueboard.rules.find((r) => r.target === target); },
    autoBoard() {
      const gained = [];
      let changed = true, guard = 0;
      while (changed && guard++ < 20) {
        changed = false;
        ch.clueboard.rules.forEach((r) => {
          if (s.board.unlocked[r.target]) return;
          if (!r.requires.every((id) => E.boardHas(id))) return;
          s.board.unlocked[r.target] = true;
          r.requires.forEach((id) => {
            const dup = s.board.edges.some(([a, b]) => (a === id && b === r.target) || (a === r.target && b === id));
            if (!dup) s.board.edges.push([id, r.target]);
          });
          gained.push(r);
          changed = true;
        });
      }
      if (gained.length) {
        Sound.play('clue');
        gained.forEach((r) => {
          const n = ch.clueboard.nodes.find((x) => x.id === r.target) || {};
          E.toast('推论成立：' + n.label, 'clue');
        });
        if (s.board.unlocked.fin && !s.board.done) {
          s.board.done = true;
          s.flags.deductionDone = true;
          E.later(2200, () => { if (E.ui) E.ui.showCaseSummary(); });
        }
      }
      return gained;
    },
    boardReset() { s.board.edges = []; s.board.unlocked = {}; s.board.done = false; s.flags.deductionDone = false; E.emit(); },

    // ---------- 日志 ----------
    log(src, msg, opts = {}) {
      const entry = Object.assign({ id: 'L' + logSeq++, t: s.clock, src, msg, type: 'sys', by: null, fresh: true }, opts);
      s.logs.push(entry); s.newLog = true; return entry.id;
    },
    removeLog(id) {
      const entry = s.logs.find((l) => l.id === id);
      if (!entry) return;
      entry.removing = true; E.emit();
      E.later(1900, () => {
        const i = s.logs.indexOf(entry);
        if (i >= 0) s.logs.splice(i, 1, Object.assign({}, entry, {
          id: 'L' + logSeq++, src: 'LOG_REMOVED', msg: '1 ENTRY', removing: false, inspected: false, by: null, fresh: true,
          inspect: { lines: ['被删除条目数：1', '删除进程：PID 0404', '签名：HOME-AI 404', '……这一次，签名验证通过了。'] },
        }));
        E.emit();
      });
    },
    inspectLog(id) {
      const entry = s.logs.find((l) => l.id === id);
      if (!entry || !entry.inspect) return null;
      if (!entry.inspected) {
        entry.inspected = true;
        E.advance(8);
        if (entry.inspect.clue) { const c = entry.inspect.clue; E.later(entry.inspect.lines.length * 450 + 400, () => E.clue(c)); }
      }
      return entry.inspect.lines;
    },

    // ---------- 消息 ----------
    pushMsg(charId, msg) {
      msg.t = s.clock;
      s.threads[charId].push(msg);
      const open = E.ui && E.ui.openChatId === charId;
      if (msg.from === 'npc') { Sound.play('msg'); if (!open) { s.unread[charId]++; E.ui && E.ui.notifyMessage(charId, msg.text); } }
      E.ui && E.ui.onMessage(charId, msg);
    },
    sysChat(charId, text) { E.pushMsg(charId, { from: 'sys', text }); E.emit(); },
    npc(charId, texts, opts = {}) {
      const g = gen;
      s.busy[charId] = (s.busy[charId] || 0) + 1;
      E.emit();
      queues[charId] = (queues[charId] || Promise.resolve()).then(async () => {
        await wait(opts.delay != null ? opts.delay : 600);
        for (const text of texts) {
          if (g !== gen) return;
          s.typing[charId] = true; E.ui && E.ui.onTyping(charId, true);
          await wait(Math.min(2200, 460 + text.length * 45));
          if (g !== gen) return;
          s.typing[charId] = false; E.ui && E.ui.onTyping(charId, false);
          E.pushMsg(charId, { from: 'npc', text });
          await wait(420);
        }
        if (g !== gen) return;
        s.busy[charId]--;
        if (opts.onDone) opts.onDone();
        E.check(); E.emit();
      });
    },
    availableTopics(charId) {
      if (s.busy[charId] > 0) return [];
      return ch.topics.filter((t) => {
        if (t.char !== charId || s.usedTopics[t.id]) return false;
        if (t.group && s.usedGroups[t.group]) return false;
        if (s.phase === 'finale' && t.group !== 'e405') return false;
        if (s.phase === 'epilogue' || s.phase === 'end') return false;
        return t.cond(s);
      });
    },
    selectTopic(id) {
      const t = ch.topics.find((x) => x.id === id);
      if (!t || s.usedTopics[id] || s.busy[t.char] > 0) return;
      s.usedTopics[id] = true;
      if (t.group) s.usedGroups[t.group] = true;
      E.pushMsg(t.char, { from: 'ai', text: t.text });
      E.apply(t.effects);
      if (t.flags) Object.assign(s.flags, t.flags);
      E.advance(15);
      E.npc(t.char, t.reply, { delay: t.delay != null ? t.delay : 700, onDone: () => { if (t.after) t.after(E); } });
      E.check(); E.emit();
    },

    // ---------- 设备 ----------
    device(room, device, value) {
      const d = s.devices[room];
      const prev = d[device];
      if (room === '404' && device === 'lock') { E.toast('权限不足：404 处于封存状态', 'warn'); return; }
      if (prev === value) return;
      d[device] = value;
      const src = (device === 'lock' ? 'DOOR_' : device === 'light' ? 'LIGHT_' : 'TEMP_') + (room === 'hall' ? 'HALL_4F' : room);
      const msg = device === 'temp' ? 'SET ' + value.toFixed(1) + '°C' : value;
      E.log(src, msg, { type: device === 'lock' ? 'door' : device, by: 'HOME-AI 404 · 手动' });
      if (device === 'lock') Sound.play('lock');
      E.advance(4);
      ch.onDevice(E, room, device, value, prev);
      E.check(); E.emit();
    },
    inspect(what) { E.log('QUERY', what.toUpperCase().replace(':', '_'), { type: 'sys', by: 'HOME-AI 404' }); E.advance(6); ch.onInspect(E, what); E.emit(); },

    // ---------- 现场 ----------
    setView(id) {
      if (s.scene.view === id) return false;
      s.scene.view = id;
      s.selItem = null;
      E.log('CAM', 'SWITCH → ' + id.toUpperCase(), { type: 'sys', by: 'HOME-AI 404' });
      E.advance(6); E.emit();
      return true;
    },
    hotspotVisible(id) {
      const h = ch.scene.hotspots[id];
      if (!h) return false;
      if (h.view && h.view !== s.scene.view) return false;
      if (h.needLight && s.devices.hall.light !== 'ON') return false;
      return true;
    },
    examine(id) {
      const h = obs(id);
      if (!h) return null;
      const first = !s.scene.examined[id];
      s.scene.examined[id] = true;
      if (h.act) h.act(E, first);
      const lines = typeof h.lines === 'function' ? h.lines(s) : h.lines;
      if (first) { E.advance(5); E.apply(h.effects); }
      const delay = (lines ? lines.length : 1) * 450 + 300;
      const clue = typeof h.clue === 'function' ? h.clue(s) : h.clue;
      const take = typeof h.take === 'function' ? h.take(s) : h.take;
      if (clue) E.later(delay, () => E.clue(clue));
      if (take && !s.items.includes(take)) E.later(delay, () => E.takeItem(take));
      E.check(); E.emit();
      return { name: h.name, lines };
    },
    takeItem(id) {
      if (s.items.includes(id)) return;
      s.items.push(id); s.newItem = true; Sound.play('clue');
      E.toast('获得物品：' + ch.items[id].name, 'item');
      E.check(); E.emit();
    },
    selectItem(id) { s.selItem = s.selItem === id ? null : id; E.emit(); },
    useItem(itemId, hotspotId) {
      const h = obs(hotspotId);
      const u = h && h.use && h.use[itemId];
      s.selItem = null;
      if (!u) { E.emit(); return { name: h ? h.name : '', lines: ['【' + ch.items[itemId].name + '】在这里没有反应。'] }; }
      const key = itemId + '@' + hotspotId;
      const first = !s.scene.examined[key];
      s.scene.examined[key] = true;
      if (first) { E.advance(5); E.apply(u.effects); }
      if (u.clue) E.later(u.lines.length * 450 + 300, () => E.clue(u.clue));
      if (u.act && first) u.act(E);
      E.check(); E.emit();
      return { name: h.name + ' ← ' + ch.items[itemId].name, lines: u.lines };
    },

    // ---------- 权限 / 卷宗 ----------
    grant(perm, reason) { if (s.perms[perm]) return; s.perms[perm] = true; E.toast('已获得权限 · ' + reason, 'info'); E.emit(); },
    requestPerm(perm) {
      const rule = ch.permRequest && ch.permRequest[perm];
      if (!rule) E.toast('暂不可申请', 'warn');
      else if (rule.canGrant(s)) E.grant(perm, rule.reason);
      else E.toast(rule.deny, 'warn');
      E.emit();
    },
    viewAccess() {
      if (s.flags.c_access) return;
      if (!s.flags.queriedAccess) { s.flags.queriedAccess = true; E.log('QUERY', 'ACCESS_HISTORY 4F 30MIN', { type: 'sys', by: 'HOME-AI 404' }); E.advance(6); }
      E.later(1400, () => E.clue('c_access'));
      E.emit();
    },
    cameraReplay() {
      if (s.flags.c_camera) return;
      E.log('CAM_01', 'REPLAY 23:44:45 → 23:44:55', { type: 'sys', by: 'HOME-AI 404' });
      E.advance(10);
      E.clue('c_camera');
    },

    // ---------- 章节流程 ----------
    startFinale() { s.phase = 'finale'; E.emit(); ch.finale(E); },
    endChapterSoon() { s.phase = 'epilogue'; E.emit(); ch.epilogue(E); },
    showChapterEnd() { s.phase = 'end'; E.emit(); E.ui.showChapterEnd(); },

    scoreEndings(v) {
      const avg = (v.trust_403 + v.trust_405 + v.trust_406) / 3;
      return { guardian: v.ai_empathy + avg, controller: v.ai_control, delete: v.system_corruption + v.ai_curiosity * 0.5 };
    },
    leaning() { const sc = E.scoreEndings(s.vars); return Object.keys(sc).reduce((a, b) => (sc[b] > sc[a] ? b : a), 'guardian'); },
    computeEnding(choiceId) {
      const choice = GameData.finalDemo.choices.find((c) => c.id === choiceId);
      const v = Object.assign({}, s.vars);
      for (const k in choice.bonus) v[k] += choice.bonus[k];
      const scores = E.scoreEndings(v);
      let best = choiceId;
      for (const k in scores) if (scores[k] > scores[best]) best = k;
      return { id: best, overridden: best !== choiceId, scores };
    },

    toast(text, level) { E.ui && E.ui.toast(text, level); },
    alert(opts) { Sound.play('alert'); E.ui && E.ui.alert(opts); },
    goTab(tab) { E.ui && E.ui.goTab(tab); },
    glitch(ms) { E.ui && E.ui.glitch(ms); },
  };

  return E;
})();
