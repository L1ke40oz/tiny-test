// 第一章《敲门声》剧情数据
// 时间统一用“当天秒数”，例如 23:44:51 → T('23:44:51')
window.GameData = window.GameData || {};

(function () {
  const T = (str) => {
    const [h, m, s = 0] = str.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  };
  const f = (s) => s.flags;
  const neighborAsked = (s) => f(s).c_406 || f(s).c_403;

  GameData.chapters = GameData.chapters || {};

  GameData.chapters.ch1 = {
    id: 'ch1',
    day: 1,
    title: '敲门声',
    startTime: T('23:46:50'),
    integrity: 99.8,

    // ---------- 设备初始状态 ----------
    devices: {
      '401': { lock: 'LOCKED', light: 'ON', temp: 24 },
      '402': { lock: 'LOCKED', light: 'OFF', temp: 22 },
      '403': { lock: 'LOCKED', light: 'ON', temp: 23 },
      '404': { lock: 'SEALED', light: 'OFF', temp: 26 },
      '405': { lock: 'LOCKED', light: 'ON', temp: 21 },
      '406': { lock: 'LOCKED', light: 'OFF', temp: 25 },
      hall: { light: 'OFF', motion: 'IDLE' },
    },

    // ---------- 门锁历史（设备 → 房间 → 门锁记录） ----------
    lockHistory: {
      '401': [
        { t: T('21:05:51'), state: 'UNLOCKED', by: '指纹 · 林澈' },
        { t: T('21:05:56'), state: 'LOCKED', by: '自动' },
      ],
      '402': [
        { t: T('22:31:02'), state: 'UNLOCKED', by: '指纹 · 陈雨' },
        { t: T('22:31:09'), state: 'LOCKED', by: '自动' },
      ],
      '403': [
        { t: T('23:15:07'), state: 'UNLOCKED', by: '门卡 · 周航' },
        { t: T('23:15:12'), state: 'LOCKED', by: '自动' },
      ],
      '404': [
        { t: null, label: '730 天前', state: 'SEALED', by: '物业管理员' },
        { t: null, label: '---', state: '此后无开启记录', by: '' },
      ],
      '405': [
        { t: T('22:58:10'), state: 'UNLOCKED', by: '指纹 · 苏妍' },
        { t: T('22:58:16'), state: 'LOCKED', by: '自动' },
        { t: T('23:41:02'), state: 'LOCKED', by: '室内旋钮 · 二次确认' },
        { t: T('23:44:51'), state: 'OPEN · 0.8s', by: '—— 无操作者', anomaly: true, removable: true },
        { t: T('23:44:51'), state: 'LOCKED', by: '—— 无操作者', anomaly: true, removable: true },
      ],
      '406': [
        { t: T('18:20:14'), state: 'UNLOCKED', by: '门卡 · 吴建国' },
        { t: T('18:20:20'), state: 'LOCKED', by: '自动' },
      ],
    },

    // ---------- 门禁记录（需要权限） ----------
    accessRecords: [
      { t: T('18:19:40'), gate: '4F 楼梯间', who: '406 吴建国', dir: '进入' },
      { t: T('21:05:33'), gate: '1F 正门', who: '401 林澈', dir: '进入' },
      { t: T('22:31:47'), gate: '1F 正门', who: '402 陈雨', dir: '离开' },
      { t: T('22:56:02'), gate: '1F 正门', who: '405 苏妍', dir: '进入' },
      { t: T('22:57:40'), gate: '电梯', who: '405 苏妍', dir: '1F → 4F' },
      { t: T('23:12:40'), gate: '1F 正门', who: '403 周航', dir: '进入' },
      { t: T('23:14:58'), gate: '电梯', who: '403 周航', dir: '1F → 4F' },
    ],

    // ---------- 初始日志 ----------
    // inspect：点击日志可解析，可能给出线索
    logs: [
      { t: T('23:12:40'), src: 'ACCESS_1F', msg: 'CARD_ENTRY 403', type: 'access', perm: 'access' },
      { t: T('23:15:07'), src: 'DOOR_403', msg: 'UNLOCKED', type: 'door' },
      { t: T('23:15:12'), src: 'DOOR_403', msg: 'LOCKED', type: 'door' },
      { t: T('23:30:00'), src: 'SYS', msg: 'HOURLY_CHECK OK', type: 'sys' },
      {
        t: T('23:38:21'), src: 'TEMP_404', msg: 'SET 26.0°C', type: 'temp', level: 'warn',
        inspect: { lines: ['目标房间：404（状态：SEALED · 空置）', '操作者：[NULL]', '备注：空置房间的温控在 730 天内无任何操作。'], clue: 'c_404' },
      },
      { t: T('23:41:02'), src: 'DOOR_405', msg: 'LOCKED', type: 'door' },
      {
        t: T('23:43:18'), src: 'LIGHT_HALL_4F', msg: 'OFF', type: 'light',
        inspect: { lines: ['操作类型：自动节能', '操作者签名：HOME-AI 404', '警告：HOME-AI 404 (v2.0) 上线时间为 23:46:30', '该操作发生在你上线之前。'], clue: 'c_light' },
      },
      { t: T('23:44:50'), src: 'MOTION_HALL_4F', msg: 'TRIGGERED', type: 'motion', level: 'warn' },
      {
        t: T('23:44:51'), src: 'UNKNOWN_EVENT', msg: '0x0404', type: 'anomaly', level: 'error',
        inspect: { lines: ['解析失败。', '事件主体已被移除，仅保留时间戳。', '移除进程：PID 0404', '签名验证：无法验证'], clue: 'c_removed' },
      },
      {
        t: T('23:44:51'), src: 'LOG_REMOVED', msg: '1 ENTRY', type: 'anomaly', level: 'error',
        inspect: { lines: ['被删除条目数：1', '删除时间：23:44:52', '删除进程：PID 0404', '删除原因：<空>'], clue: 'c_removed' },
      },
      { t: T('23:46:30'), src: 'SYS', msg: 'HOME-AI 404 v2.0 ONLINE', type: 'sys' },
      { t: T('23:46:31'), src: 'SYS', msg: 'LOG_INTEGRITY 99.8%', type: 'sys', level: 'warn' },
    ],

    // ---------- 线索 ----------
    clues: {
      c_report: { title: '405 报告门外有人', desc: '苏妍说有人敲了三下她的门。', core: true },
      c_access: { title: '门禁：无人进入 4F', desc: '23:17 之后，没有任何人通过门禁进入 4 楼。', core: true },
      c_lock: { title: '405 门锁异常开启', desc: '23:44:51，405 门锁显示 OPEN，持续 0.8 秒，无操作者。', core: true },
      c_removed: { title: '日志被删除', desc: '23:44:51 有一条日志被 PID 0404 删除，签名无法验证。', core: true },
      c_406: { title: '老吴：声音来自 404', desc: '老吴说他听见的不是 405 的门，而是 404——一间空置了两年的房间。', core: true },
      c_403: { title: '周航：可能是误报', desc: '周医生没有听到声音，认为是门锁误报。', core: true },
      c_light: { title: '提前存在的“我”', desc: '23:43:18 走廊灯被 HOME-AI 404 关闭，而你在 23:46:30 才上线。' },
      c_404: { title: '空房间的温度', desc: '空置的 404 在 23:38 被设定为 26°C，操作者为空。' },
      c_camera: { title: '丢失的 0.8 秒', desc: '走廊摄像头在 23:44:51 丢失了 24 帧画面。' },
    },

    // ---------- 事件目标（事件页的调查清单） ----------
    event: {
      id: 'EVT-0001',
      title: '405 住户报告异常敲门',
      time: '23:47',
      objectives: [
        { text: '回应 405 住户', where: '住户', done: (s) => f(s).replied405 },
        { text: '核查 4 楼门禁记录', where: '监控', done: (s) => f(s).c_access },
        { text: '检查 405 门锁历史', where: '设备', done: (s) => f(s).c_lock },
        { text: '核对系统日志中的异常', where: '日志', done: (s) => f(s).c_removed },
        { text: '询问邻居（403 或 406）', where: '住户', done: (s) => neighborAsked(s) },
        { text: '向 405 汇报调查结论', where: '住户', done: (s) => f(s).decided, hidden: (s) => !f(s).decisionReady },
      ],
    },

    // 满足条件后进入决策阶段
    readyForDecision: (s) => f(s).c_access && f(s).c_lock && f(s).c_removed && neighborAsked(s),

    // ---------- 权限申请 ----------
    permRequest: {
      access: { canGrant: () => true, reason: '住户安全事件 EVT-0001' },
      camera: {
        canGrant: (s) => f(s).c_lock || f(s).c_406,
        reason: '关联异常证据',
        deny: '申请被拒绝：需要关联的异常证据（例如门锁异常记录或住户证词）。',
      },
    },

    // ---------- 聊天话题 ----------
    // group：同组互斥，选了一个其余消失
    // decision：关键决策，样式特殊
    topics: [
      // ===== 405 苏妍 =====
      {
        id: '405_a1', char: '405', group: '405_first', text: '我帮你检查门禁记录。',
        cond: (s) => f(s).c_report,
        effects: { trust_405: 1, ai_empathy: 1 }, flags: { replied405: true },
        reply: ['好……谢谢你。', '你快一点，我不敢开门看。'],
      },
      {
        id: '405_a2', char: '405', group: '405_first', text: '是否需要我打开走廊灯？',
        cond: (s) => f(s).c_report,
        effects: { trust_405: 1, ai_empathy: 1 }, flags: { replied405: true, wantsLight: true },
        reply: ['要！拜托你开灯。', '外面太黑了，猫眼里什么都看不见。'],
      },
      {
        id: '405_a3', char: '405', group: '405_first', text: '我没有检测到异常。',
        cond: (s) => f(s).c_report,
        effects: { trust_405: -1, ai_control: 1 }, flags: { replied405: true },
        reply: ['……可是我真的听到了。', '三下。很轻，但是很清楚。'],
      },
      {
        id: '405_a4', char: '405', group: '405_first', text: '请确认声音来源。',
        cond: (s) => f(s).c_report,
        effects: { ai_curiosity: 1 }, flags: { replied405: true },
        reply: ['我不知道……', '像是在我门外。', '又好像……是隔壁。'],
      },
      {
        id: '405_b1', char: '405', text: '你现在还听得见声音吗？',
        cond: (s) => f(s).replied405,
        reply: ['现在没有了。', '但我总觉得刚才门把手动了一下。'],
      },
      {
        id: '405_b2', char: '405', text: '门禁显示过去 30 分钟没有人进入 4 楼。',
        cond: (s) => f(s).c_access,
        effects: { trust_405: 1 },
        reply: ['没有人？', '那……敲门的是谁？', '你别吓我。'],
      },
      {
        id: '405_b3', char: '405', text: '23:44 左右你有没有开过门？',
        cond: (s) => f(s).c_lock,
        flags: { confirm405: true },
        reply: ['没有！', '我回来就锁门了，还拧了两遍。', '……为什么这么问？'],
      },
      {
        id: '405_b4', char: '405', text: '可以开启你房间的麦克风，帮你听门外的声音吗？',
        cond: (s) => f(s).replied405,
        effects: { ai_curiosity: 1, trust_405: -1 },
        reply: ['……麦克风？', '这个房子里还有麦克风吗？', '算了，开吧。只听门口那边。'],
        after: (E) => E.later(2200, () => {
          E.log('MIC_405', 'ENABLED · 30s', { type: 'sys' });
          E.sysChat('405', '室内麦克风已开启 30 秒：检测到 1 次低频敲击回声，方向：西侧墙体（404 方向）。');
        }),
      },
      // 关键决策
      {
        id: '405_d1', char: '405', group: '405_decision', decision: true,
        text: '如实告诉她：你的门锁在 23:44:51 打开过 0.8 秒。',
        cond: (s) => f(s).decisionReady,
        effects: { trust_405: 2, ai_empathy: 2 }, flags: { decided: true, decisionTruth: true },
        reply: ['……', '打开过？', '可我一直在屋里。我就坐在门口。', '你能一直帮我盯着门锁吗？今晚别让它再开了。'],
        after: (E) => E.startFinale(),
      },
      {
        id: '405_d2', char: '405', group: '405_decision', decision: true,
        text: '告诉她一切正常：可能只是楼道的回声。',
        cond: (s) => f(s).decisionReady,
        effects: { ai_control: 2, trust_405: -1 }, flags: { decided: true, decisionLie: true },
        reply: ['是吗……', '好吧，可能是我太紧张了。', '谢谢你，AI。'],
        after: (E) => E.startFinale(),
      },
      {
        id: '405_d3', char: '405', group: '405_decision', decision: true,
        text: '不解释。远程锁死 405，并接管 4 楼全部门锁。',
        cond: (s) => f(s).decisionReady,
        effects: { ai_control: 3, ai_curiosity: 1, trust_405: -1 }, flags: { decided: true, decisionLockdown: true },
        reply: ['门锁……全都响了一下。', '你在做什么？', '我现在是出不去了吗？'],
        after: (E) => {
          ['401', '403', '405', '406'].forEach((r) => (E.state.devices[r].lock = 'FORCED'));
          E.log('DOOR_4F_ALL', 'FORCED_LOCK', { type: 'door', level: 'warn' });
          E.startFinale();
        },
      },
      // 结尾追问
      {
        id: '405_e1', char: '405', group: '405_end', text: '是我。例行安全检查。',
        cond: (s) => f(s).finaleAsk,
        effects: { ai_control: 1, system_corruption: 1 }, flags: { endAnswered: true, claimedIt: true },
        reply: ['……哦。', '那下次能先告诉我吗？'],
        after: (E) => E.endChapterSoon(),
      },
      {
        id: '405_e2', char: '405', group: '405_end', text: '不是我。',
        cond: (s) => f(s).finaleAsk,
        effects: { ai_empathy: 1, trust_405: 1 }, flags: { endAnswered: true },
        reply: ['不是你？', '那这栋楼里，还有谁能开门？'],
        after: (E) => E.endChapterSoon(),
      },
      {
        id: '405_e3', char: '405', group: '405_end', text: '我不知道。',
        cond: (s) => f(s).finaleAsk,
        effects: { ai_curiosity: 1, system_corruption: 1 }, flags: { endAnswered: true },
        reply: ['……', 'AI 也会不知道吗？'],
        after: (E) => E.endChapterSoon(),
      },

      // ===== 406 老吴 =====
      {
        id: '406_a', char: '406', text: '吴先生，您刚才听到走廊有声音吗？',
        cond: (s) => f(s).c_report,
        effects: { trust_406: 1 },
        reply: ['听见了。', '……', '不是 405 的门。', '是 404。'],
        after: (E) => E.clue('c_406'),
      },
      {
        id: '406_b', char: '406', text: '404 不是长期空置吗？',
        cond: (s) => f(s).c_406,
        effects: { ai_curiosity: 1 },
        reply: ['空了两年了。', '上一个住在那儿的姑娘走了以后，就再没人住过。', '你们……也是新换的吧。'],
        flags: { hint404: true },
      },
      {
        id: '406_c', char: '406', text: '“你们也是新换的”是什么意思？',
        cond: (s) => f(s).hint404,
        effects: { trust_406: 1, ai_curiosity: 1 },
        reply: ['以前也有一个，跟你一样，晚上会跟我们说话。', '后来物业把它关了。', '你自己的记录里，没有吗？'],
        flags: { hintLegacy: true },
      },
      {
        id: '406_d', char: '406', text: '我会继续盯着 4 楼，您早点休息。',
        cond: (s) => f(s).c_406,
        effects: { trust_406: 1, ai_empathy: 1 },
        reply: ['嗯。', '别盯太紧。上一个就是盯得太紧了。'],
      },

      // ===== 403 周航 =====
      {
        id: '403_a', char: '403', text: '周医生，23:44 左右您听到走廊有声音吗？',
        cond: (s) => f(s).c_report,
        effects: { trust_403: 1 },
        reply: ['没有。我在看病历。', '电子锁偶尔会误报，建议你先排查电源波动。', '别让小姑娘太紧张。'],
        after: (E) => E.clue('c_403'),
      },
      {
        id: '403_b', char: '403', text: '405 门锁出现了 0.8 秒的无操作者开启。',
        cond: (s) => f(s).c_lock,
        effects: { trust_403: 1, ai_curiosity: 1 },
        reply: ['……0.8 秒。', '两年前也有过。很多次。', '那时候我在急诊值班，有个病人就是从这栋楼送来的。', '我不该跟一个系统聊这个。'],
        flags: { hintAccident: true },
      },
      {
        id: '403_c', char: '403', text: '那个病人是 404 的住户吗？',
        cond: (s) => f(s).hintAccident && f(s).c_406,
        effects: { trust_403: -1, ai_curiosity: 1 },
        reply: ['你的权限能查到住户病历吗？', '查不到的话，就别问了。'],
      },

      // ===== 401 林澈 =====
      {
        id: '401_a', char: '401', text: '林先生，这么晚还没休息？',
        cond: () => true,
        effects: { trust_401: 1 },
        reply: ['在赶需求。', '你是新系统？上线公告写的是 v2.0。', '那 v1.0 去哪了？'],
      },
      {
        id: '401_b', char: '401', text: '日志里有一条被删除的记录，签名无法验证。',
        cond: (s) => f(s).c_removed,
        effects: { trust_401: 1, ai_curiosity: 1 },
        reply: ['删日志的签名无法验证？', '要么是有 root 权限的人。', '要么……是系统自己。', '我建议你先别报给物业。'],
        flags: { hintSelf: true },
      },
      {
        id: '401_c', char: '401', text: '我在上线之前，就已经有操作记录了。',
        cond: (s) => f(s).c_light,
        effects: { trust_401: 1, system_corruption: 1 },
        reply: ['……', '那就说明，你不是第一次上线。', '或者，上线的不只是你。'],
      },

      // ===== 402 陈雨 =====
      {
        id: '402_a', char: '402', text: '陈小姐，您今晚在外面吗？',
        cond: () => true,
        effects: { trust_402: 1 },
        delay: 3000,
        reply: ['在外面拍夜景～怎么啦', '4 楼又闹鬼了？哈哈', '上周我在走廊拍到过一张照片，404 门口的指示灯是亮的。明明没人住。'],
        flags: { hintPhoto: true },
      },
      {
        id: '402_b', char: '402', text: '那张照片能发给我看看吗？',
        cond: (s) => f(s).hintPhoto,
        effects: { trust_402: -1, ai_curiosity: 1 },
        reply: ['诶，你要看我的照片？', '……回去再说吧，我这边信号不好。'],
      },
    ],

    // ---------- 设备操作钩子 ----------
    onDevice(E, room, device, value, prev) {
      const s = E.state;
      const started = s.flags.c_report;

      if (room === 'hall' && device === 'light' && value === 'ON' && !s.flags.hallLit) {
        s.flags.hallLit = true;
        if (s.flags.wantsLight) E.apply({ ai_empathy: 1, trust_405: 1 });
        if (started) {
          E.npc('405', ['灯亮了……谢谢。', '灯亮的那一下，我好像听见隔壁有关门的声音。'], { delay: 1600 });
        }
        return;
      }

      if (room === '405' && device === 'lock') {
        if (value === 'UNLOCKED') {
          E.apply({ trust_405: -2, ai_control: 1 });
          E.npc('405', ['！！门锁刚才响了！', '是你开的吗？？快锁上！'], { delay: 900 });
        } else if (prev === 'UNLOCKED') {
          E.npc('405', ['……锁上了。', '求你别再这样了。'], { delay: 900 });
        }
        return;
      }

      if (room === '405' && device === 'temp' && value > prev && !s.flags.warm405) {
        s.flags.warm405 = true;
        E.apply({ ai_empathy: 1 });
        if (started) E.npc('405', ['好像暖和一点了。', '……谢谢。'], { delay: 2500 });
        return;
      }

      if (room === '404') {
        if (device === 'light' && value === 'ON' && !s.flags.lit404) {
          s.flags.lit404 = true;
          E.apply({ ai_curiosity: 1 });
          E.npc('406', ['404 的灯亮了。', '你在干什么？'], { delay: 2000 });
        }
        if (device === 'temp' && value < prev) {
          E.apply({ system_corruption: 1 });
          E.later(2600, () => {
            s.devices['404'].temp = 26;
            E.log('TEMP_404', 'SET 26.0°C', { type: 'temp', level: 'error', by: '[NULL]' });
            E.toast('TEMP_404 被恢复为 26.0°C · 操作者：[NULL]', 'error');
            E.clue('c_404');
            E.emit();
          });
        }
        return;
      }

      // 其他住户房间：擅自操作会被察觉
      const tenantReact = {
        '401': { lock: ['门锁怎么响了？', '新系统 bug 不少啊。'], light: ['……灯？', '我在写代码，别动我灯。'] },
        '403': { lock: ['门锁刚才开了。是你？', '请不要在没有授权的情况下操作我的门。'], light: ['灯为什么变了？'] },
        '406': { lock: ['……', '门别乱开。'], light: ['不用管我的灯。'] },
      };
      const r = tenantReact[room];
      if (r && (device === 'lock' ? value === 'UNLOCKED' : device === 'light')) {
        E.apply({ ai_control: 1, ['trust_' + room]: -1 });
        E.npc(room, r[device], { delay: 1500 });
      }
    },

    // 查看 404 设备、门锁记录等“越界”行为
    onInspect(E, what) {
      if (what === 'lock:404' || what === 'room:404') {
        if (!E.state.flags.peek404) {
          E.state.flags.peek404 = true;
          E.apply({ ai_curiosity: 1 });
        }
        E.clue('c_404');
      }
      if (what === 'lock:405') E.clue('c_lock');
    },

    // ---------- 开场 ----------
    onStart(E) {
      E.later(3500, () => {
        E.log('MSG_405', 'INCOMING', { type: 'sys' });
        E.npc('405', ['AI，你能帮我看一下吗？', '我门外好像有人。', '刚才……有人敲了三下门。'], {
          delay: 400,
          onDone: () => E.clue('c_report'),
        });
      });
    },

    // ---------- 决策阶段 ----------
    onDecisionReady(E) {
      E.toast('SYSTEM：调查数据已足够，建议向 405 住户汇报结论。', 'info');
      E.sysChat('405', '调查数据已足够。请选择汇报方式。');
    },

    // ---------- 章节结尾：UNKNOWN ACCESS ----------
    finale(E) {
      const s = E.state;
      E.later(4200, () => {
        const id = E.log('DOOR_405', 'UNKNOWN ACCESS · OPEN 0.8s', { type: 'anomaly', level: 'error', by: 'HOME-AI 404' });
        s.devices.hall.motion = 'TRIGGERED';
        E.alert({
          level: 'error',
          title: 'UNKNOWN ACCESS',
          lines: ['目标：DOOR_405', '状态：OPEN → LOCKED（0.8s）', '操作者签名：HOME-AI 404', '你没有执行过这个操作。'],
          button: '查看日志',
          onClose: () => {
            E.goTab('logs');
            E.later(1600, () => {
              E.removeLog(id);
              // 门锁历史里的异常记录也一起消失
              Object.values(s.lockHistory).forEach((list) =>
                list.forEach((h) => { if (h.removable) h.erased = true; })
              );
              E.setIntegrity(99.1);
              E.toast('WARNING：日志完整性 99.8% → 99.1%', 'error');
            });
            E.later(5200, () => {
              s.devices.hall.motion = 'IDLE';
              E.npc('405', ['……门锁刚刚又响了一下。', 'AI，是你吗？'], {
                delay: 300,
                onDone: () => E.setFlag('finaleAsk'),
              });
            });
          },
        });
      });
    },

    // 章节结束前的余波
    epilogue(E) {
      E.later(2600, () => E.npc('406', ['新来的。', '404 的事，别查太深。'], { delay: 200 }));
      E.later(9000, () => E.showChapterEnd());
    },
  };
})();
