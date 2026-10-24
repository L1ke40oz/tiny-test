// 游戏引擎：只处理规则和状态，不直接操作 DOM（通过 E.ui 回调界面）

// 音效预留：后续把 play 换成真正的音频即可
window.Sound = {
  play(name) {
    // 'msg' | 'alert' | 'lock' | 'clue'
    if (name === 'alert' && navigator.vibrate) navigator.vibrate([60, 40, 60]);
  },
};

// 手机能力预留（摄像头 / 陀螺仪 / 麦克风 / 手电筒），后续章节使用
window.Sensors = {
  async requestCamera() { throw new Error('NOT_IMPLEMENTED'); },
  async requestMic() { throw new Error('NOT_IMPLEMENTED'); },
  onTilt(/* cb */) {},
};

window.Engine = (function () {
  let s = null;
  let ch = null;
  let gen = 0;            // 重开游戏时作废旧的定时任务
  let timers = [];
  let clockTimer = null;
  let queues = {};
  let logSeq = 1000;
  const listeners = [];

  const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
  const pad = (n) => String(n).padStart(2, '0');

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
      clearInterval(clockTimer);
      ch = GameData.chapters[chapterId];
      s = GameState.create(chapterId);
      clockTimer = setInterval(() => { s.clock++; E.ui && E.ui.updateClock(); }, 1000);
      E.emit();
      ch.onStart(E);
    },

    on(fn) { listeners.push(fn); },
    emit() { listeners.forEach((fn) => fn(s)); },

    later(ms, fn) {
      const g = gen;
      timers.push(setTimeout(() => { if (g === gen) fn(); }, ms));
    },

    advance(sec) { s.clock += sec; E.ui && E.ui.updateClock(); },

    // ---------- 变量 / 标记 ----------
    apply(effects) {
      if (!effects) return;
      for (const k in effects) {
        if (!(k in s.vars)) continue;
        s.vars[k] += effects[k];
        if (k === 'system_corruption' && effects[k] > 0) {
          E.setIntegrity(s.integrity - 0.1 * effects[k]);
        }
      }
    },
    setFlag(k, v = true) { s.flags[k] = v; E.check(); E.emit(); },
    has(k) { return !!s.flags[k]; },

    setIntegrity(v) {
      s.integrity = Math.max(0, Math.round(v * 10) / 10);
      E.ui && E.ui.updateClock();
    },

    clue(id) {
      if (s.flags[id]) return;
      s.flags[id] = true;
      s.clues.push(id);
      s.newClue = true;
      Sound.play('clue');
      E.toast('新线索：' + ch.clues[id].title, 'clue');
      E.check();
      E.emit();
    },

    // 剧情推进检查
    check() {
      const f = s.flags;
      if (f.replied405 && !s.perms.access && !f.accessGranted) {
        f.accessGranted = true;
        E.later(1200, () => E.grant('access', '住户安全事件 EVT-0001'));
      }
      if (f.c_removed && !f.procShown) {
        f.procShown = true;
        s.processes.push({ pid: '0404', name: '??????', st: 'UNKNOWN', danger: true });
        E.later(800, () => E.toast('WARNING：UNKNOWN PROCESS DETECTED · PID 0404', 'error'));
      }
      if (!f.decisionReady && s.phase === 'play' && ch.readyForDecision(s)) {
        f.decisionReady = true;
        E.later(1500, () => { ch.onDecisionReady(E); E.emit(); });
      }
    },

    // ---------- 日志 ----------
    log(src, msg, opts = {}) {
      const entry = Object.assign({ id: 'L' + logSeq++, t: s.clock, src, msg, type: 'sys', by: null, fresh: true }, opts);
      s.logs.push(entry);
      s.newLog = true;
      return entry.id;
    },

    removeLog(id) {
      const entry = s.logs.find((l) => l.id === id);
      if (!entry) return;
      entry.removing = true;
      E.emit();
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
        if (entry.inspect.clue) {
          const c = entry.inspect.clue;
          E.later(entry.inspect.lines.length * 500 + 400, () => E.clue(c));
        }
      }
      return entry.inspect.lines;
    },

    // ---------- 消息 ----------
    pushMsg(charId, msg) {
      msg.t = s.clock;
      s.threads[charId].push(msg);
      const open = E.ui && E.ui.openChatId === charId;
      if (msg.from === 'npc') {
        Sound.play('msg');
        if (!open) {
          s.unread[charId]++;
          E.ui && E.ui.notifyMessage(charId, msg.text);
        }
      }
      E.ui && E.ui.onMessage(charId, msg);
    },

    sysChat(charId, text) { E.pushMsg(charId, { from: 'sys', text }); E.emit(); },

    // 住户逐条发消息（带“正在输入”）
    npc(charId, texts, opts = {}) {
      const g = gen;
      s.busy[charId] = (s.busy[charId] || 0) + 1;
      E.emit();
      queues[charId] = (queues[charId] || Promise.resolve()).then(async () => {
        await wait(opts.delay != null ? opts.delay : 600);
        for (const text of texts) {
          if (g !== gen) return;
          s.typing[charId] = true;
          E.ui && E.ui.onTyping(charId, true);
          await wait(Math.min(2000, 450 + text.length * 40));
          if (g !== gen) return;
          s.typing[charId] = false;
          E.ui && E.ui.onTyping(charId, false);
          E.pushMsg(charId, { from: 'npc', text });
          await wait(300);
        }
        if (g !== gen) return;
        s.busy[charId]--;
        if (opts.onDone) opts.onDone();
        E.check();
        E.emit();
      });
    },

    availableTopics(charId) {
      if (s.busy[charId] > 0) return [];
      return ch.topics.filter((t) => {
        if (t.char !== charId || s.usedTopics[t.id]) return false;
        if (t.group && s.usedGroups[t.group]) return false;
        if (s.phase === 'finale' && t.group !== '405_end') return false;
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
      E.npc(t.char, t.reply, {
        delay: t.delay != null ? t.delay : 700,
        onDone: () => { if (t.after) t.after(E); },
      });
      E.check();
      E.emit();
    },

    // ---------- 设备 ----------
    device(room, device, value) {
      const d = s.devices[room];
      const prev = d[device];
      if (room === '404' && device === 'lock') {
        E.toast('权限不足：404 处于封存状态（SEALED）', 'warn');
        return;
      }
      if (prev === value) return;
      d[device] = value;
      const src = (device === 'lock' ? 'DOOR_' : device === 'light' ? 'LIGHT_' : 'TEMP_') + (room === 'hall' ? 'HALL_4F' : room);
      const msg = device === 'temp' ? 'SET ' + value.toFixed(1) + '°C' : value;
      E.log(src, msg, { type: device === 'lock' ? 'door' : device, by: 'HOME-AI 404 · 手动' });
      if (device === 'lock') Sound.play('lock');
      E.advance(4);
      ch.onDevice(E, room, device, value, prev);
      E.check();
      E.emit();
    },

    inspect(what) {
      E.log('QUERY', what.toUpperCase().replace(':', '_'), { type: 'sys', by: 'HOME-AI 404' });
      E.advance(6);
      ch.onInspect(E, what);
      E.emit();
    },

    viewAccess() {
      if (!s.perms.access) return;
      if (!s.flags.queriedAccess) {
        s.flags.queriedAccess = true;
        E.log('QUERY', 'ACCESS_HISTORY 4F 30MIN', { type: 'sys', by: 'HOME-AI 404' });
        E.advance(6);
      }
      E.later(1400, () => E.clue('c_access'));
    },

    cameraReplayDone() { E.clue('c_camera'); },

    // ---------- 现场探索（R-04） ----------
    goNode(id) {
      const sc = s.scene;
      if (sc.override) { E.toast('R-04 控制权被占用 · CALLER PID 0404', 'error'); return false; }
      if (sc.node === id) return false;
      const from = sc.node;
      sc.node = id;
      const first = !sc.visited[id];
      sc.visited[id] = true;
      s.selItem = null;
      E.log('R-04', 'MOVE ' + from.toUpperCase() + ' → ' + id.toUpperCase(), { type: 'sys', by: 'HOME-AI 404' });
      E.advance(12);
      if (ch.scene.onArrive) ch.scene.onArrive(E, id, first);
      E.check();
      E.emit();
      return true;
    },

    hotspotVisible(id) {
      const h = ch.scene.hotspots[id];
      return !!h && !(h.needLight && s.devices.hall.light !== 'ON');
    },

    // 查看热点，返回 { name, lines } 交给界面显示
    examine(id) {
      const h = ch.scene.hotspots[id];
      if (!h) return null;
      const first = !s.scene.examined[id];
      s.scene.examined[id] = true;
      if (h.act) h.act(E, first);   // 先执行（比如开灯），文字反映执行后的状态
      const lines = typeof h.lines === 'function' ? h.lines(s) : h.lines;
      if (first) { E.advance(5); E.apply(h.effects); }
      const readDelay = lines.length * 550 + 300;
      const clue = typeof h.clue === 'function' ? h.clue(s) : h.clue;
      const take = typeof h.take === 'function' ? h.take(s) : h.take;
      if (clue) E.later(readDelay, () => E.clue(clue));
      if (take && !s.items.includes(take)) E.later(readDelay, () => E.takeItem(take));
      E.check();
      E.emit();
      return { name: h.name, lines };
    },

    takeItem(id) {
      if (s.items.includes(id)) return;
      s.items.push(id);
      s.newItem = true;
      Sound.play('clue');
      E.log('R-04', 'PICKUP ' + id.toUpperCase(), { type: 'sys' });
      E.toast('获得物品：' + ch.items[id].name, 'item');
      E.check();
      E.emit();
    },

    selectItem(id) { s.selItem = s.selItem === id ? null : id; E.emit(); },

    // 对热点使用物品
    useItem(itemId, hotspotId) {
      const h = ch.scene.hotspots[hotspotId];
      const u = h && h.use && h.use[itemId];
      s.selItem = null;
      if (!u) { E.emit(); return { name: h ? h.name : '', lines: ['【' + ch.items[itemId].name + '】在这里没有反应。'] }; }
      const key = itemId + '@' + hotspotId;
      const first = !s.scene.examined[key];
      s.scene.examined[key] = true;
      if (first) { E.advance(5); E.apply(u.effects); }
      if (u.clue) E.later(u.lines.length * 550 + 300, () => E.clue(u.clue));
      if (u.act && first) u.act(E);
      E.check();
      E.emit();
      return { name: h.name + ' ← ' + ch.items[itemId].name, lines: u.lines };
    },

    // ---------- 权限 ----------
    grant(perm, reason) {
      if (s.perms[perm]) return;
      s.perms[perm] = true;
      E.log('PERM', 'GRANTED ' + perm.toUpperCase(), { type: 'sys', level: 'warn' });
      E.toast('SYSTEM：已临时授予【' + E.permName(perm) + '】权限 · ' + reason, 'info');
      E.emit();
    },

    requestPerm(perm) {
      const rule = ch.permRequest && ch.permRequest[perm];
      E.log('PERM', 'REQUEST ' + perm.toUpperCase(), { type: 'sys' });
      if (!rule) {
        E.toast('申请被拒绝：权限等级不足（后续章节解锁）', 'warn');
      } else if (rule.canGrant(s)) {
        E.grant(perm, rule.reason);
      } else {
        E.toast(rule.deny, 'warn');
      }
      E.emit();
    },

    permName(p) {
      return {
        messages: '住户消息', locks: '门锁控制', lights: '灯光控制', temp: '温度调节', basicLog: '基础事件日志',
        access: '门禁历史', camera: '公共区域摄像头', anomaly: '异常行为记录', history: '历史系统日志', legacy: '上一代 AI 残留数据',
      }[p];
    },

    // ---------- 章节流程 ----------
    startFinale() {
      s.phase = 'finale';
      E.emit();
      ch.finale(E);
    },
    endChapterSoon() {
      s.phase = 'epilogue';
      E.emit();
      ch.epilogue(E);
    },
    showChapterEnd() {
      s.phase = 'end';
      E.emit();
      E.ui.showChapterEnd();
    },

    // 结局判定：最终选择提供加成，但行为模型可能推翻选择
    scoreEndings(v) {
      const trusts = ['trust_401', 'trust_402', 'trust_403', 'trust_405', 'trust_406'].map((k) => v[k]);
      const avgTrust = trusts.reduce((a, b) => a + b, 0) / trusts.length;
      return {
        guardian: v.ai_empathy + avgTrust,
        controller: v.ai_control,
        delete: v.system_corruption + v.ai_curiosity * 0.5,
      };
    },

    // 当前行为轨迹最接近的结局（不含最终选择）
    leaning() {
      const sc = E.scoreEndings(s.vars);
      return Object.keys(sc).reduce((a, b) => (sc[b] > sc[a] ? b : a), 'guardian');
    },

    computeEnding(choiceId) {
      const choice = GameData.finalDemo.choices.find((c) => c.id === choiceId);
      const v = Object.assign({}, s.vars);
      for (const k in choice.bonus) v[k] += choice.bonus[k];
      const scores = E.scoreEndings(v);
      let best = choiceId;
      for (const k in scores) if (scores[k] > scores[best]) best = k;
      return { id: best, overridden: best !== choiceId, scores };
    },

    // 界面回调转发
    toast(text, level) { E.ui && E.ui.toast(text, level); },
    alert(opts) { Sound.play('alert'); E.ui && E.ui.alert(opts); },
    goTab(tab) { E.ui && E.ui.goTab(tab); },
    glitch(ms) { E.ui && E.ui.glitch(ms); },
  };

  return E;
})();
