// 第一章 · 重制版（精简版）
// 结构：三幕 → 现场巡查 → 结案连线图 → 汇报 405 → 终章
window.GameData = window.GameData || {};

(function () {
  const T = (str) => {
    const [h, m, s = 0] = str.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  };
  const f = (s) => s.flags;
  // 两位邻居都必须问到——他们的证词是破案必需的一环
  const neighbor = (s) => f(s).c_406 && f(s).c_403;

  GameData.chapters = GameData.chapters || {};

  GameData.chapters.ch1 = {
    id: 'ch1',
    day: 1,
    title: '谁在敲门',
    startTime: T('23:46:50'),
    integrity: 99.8,

    // ---------- 过场（带插画的第一视角叙事） ----------
    cutscenes: {
      opening: {
        art: 'opening', title: '23:46:30 · 你上线了',
        lines: [
          '你是 HOME-AI 404，404 号公寓的智能管家。',
          '上线第 17 秒，405 的住户发来消息：门外有人敲了三下门。',
          '可门禁告诉你：过去半小时，没有人进过 4 楼。',
        ],
      },
      act2: {
        art: 'act2', title: 'ACT II · 不是人',
        lines: [
          '门禁没有记录，说明敲门的东西，不需要走门。',
          '你打开了走廊灯——地毯上，多了一道不该存在的轮痕。',
        ],
      },
      act3: {
        art: 'act3', title: 'ACT III · 另一个我',
        lines: [
          '封存两年的 404，门缝里透着 26°C 的暖光。',
          '而每一台设备的记录，最后都指向同一个签名：你的名字。',
        ],
      },
    },

    // ---------- 分幕 ----------
    acts: [
      {
        code: 'ACT I', title: '谁在敲门', lead: '先确认：门外是人，还是系统。',
        goals: [
          { id: 'a1', text: '回应 405 的求助', tab: 'chat', done: (s) => f(s).replied405,
            hint: '去【对话】，点开 405 苏妍，随便选一句回复她。' },
          { id: 'a2', text: '查 4F 门禁记录', tab: 'case', done: (s) => f(s).c_access,
            hint: '去【卷宗】，点「检索：4F · 近 30 分钟」。' },
          { id: 'a3', text: '查 405 门锁历史', tab: 'scene', done: (s) => f(s).c_lock,
            hint: '去【现场】，点 405 那扇门，面板最下面是门锁记录。' },
        ],
        next: (s) => f(s).replied405 && f(s).c_access && f(s).c_lock,
      },
      {
        code: 'ACT II', title: '不是人', lead: '门禁没有记录——它不需要走门。',
        cut: 'act2',
        goals: [
          { id: 'b1', text: '询问两位邻居（406 老吴 / 403 周航）', tab: 'chat', done: (s) => neighbor(s),
            hint: '先问 406 老吴「刚才有声音吗」；再把「405 门锁 0.8 秒」告诉 403 周航（要先在【现场】点 405 的门查过门锁记录）。' },
          { id: 'b2', text: '巡查走廊，找到敲门的东西', tab: 'scene', done: (s) => f(s).c_marks,
            hint: '去【现场】，点开 405 的门，凑近看「门板擦痕」。' },
          { id: 'b3', text: '查 R-04 的行驶记录', tab: 'scene', done: (s) => f(s).c_robot,
            hint: '去【现场】，切到「4F 电梯厅」，点 R-04 充电座。' },
        ],
        next: (s) => neighbor(s) && f(s).c_marks && f(s).c_robot,
      },
      {
        code: 'ACT III', title: '另一个我', lead: '所有记录，都写着你的名字。',
        cut: 'act3',
        goals: [
          { id: 'c1', text: '解析日志里的异常', tab: 'case', done: (s) => f(s).c_removed,
            hint: '去【卷宗】，展开「日志」，点标着「解析」的异常条目。' },
          { id: 'c2', text: '查 404 门缝里的东西', tab: 'scene', done: (s) => f(s).c_card,
            hint: '去【现场】，点 404 的门，凑近看「门缝」。' },
          { id: 'c3', text: '看一眼自动生成的线索连线图', tab: 'case', done: (s) => !!f(s).boardViewed,
            hint: '去【卷宗】，点「查看线索连线图」——线索会随调查自动连起来，看一眼故事走向。' },
        ],
        next: (s) => f(s).deductionDone && f(s).boardViewed,
      },
    ],

    // ---------- 线索连线图 ----------
    clueboard: {
      title: '线索连线',
      lead: '线索会随调查自动连成一条链。点任意节点，看它意味着什么。',
      nodes: [
        { id: 'c_access', kind: 'ev', x: 20, y: 8, label: '门禁：无人进楼' },
        { id: 'c_marks', kind: 'ev', x: 20, y: 28, label: '门板 30cm 擦痕' },
        { id: 'c_lock', kind: 'ev', x: 20, y: 48, label: '门锁 0.8 秒无操作者' },
        { id: 'c_robot', kind: 'ev', x: 20, y: 68, label: 'R-04 行驶记录' },
        { id: 'c_406', kind: 'ev', x: 80, y: 8, label: '老吴：声音来自 404' },
        { id: 'c_403', kind: 'ev', x: 80, y: 28, label: '周航：0.8 秒，两年前也有过' },
        { id: 'c_removed', kind: 'ev', x: 80, y: 48, label: '日志被 PID 0404 删除' },
        { id: 'c_light', kind: 'ev', x: 80, y: 68, label: '上线前的操作' },
        { id: 'm1', kind: 'mid', x: 20, y: 98, label: '敲门者不是人' },
        { id: 'm2', kind: 'mid', x: 20, y: 126, label: '敲门的是 R-04' },
        { id: 'm4', kind: 'mid', x: 50, y: 98, label: '它真正要确认的是 404' },
        { id: 'm3', kind: 'mid', x: 80, y: 98, label: '有人用你的名字行事' },
        { id: 'm5', kind: 'mid', x: 80, y: 126, label: '这不是第一次' },
        { id: 'fin', kind: 'fin', x: 50, y: 152, label: '真相' },
      ],
      rules: [
        { target: 'm1', requires: ['c_access', 'c_marks', 'c_lock'], text: '没有人进楼，门锁却自己开了，门板上还留着 30 厘米高的撞痕——敲门的东西，不是人。' },
        { target: 'm2', requires: ['m1', 'c_robot'], text: 'R-04 的行驶记录写着：23:44 它开到 405 门前撞了三下。敲门者，就是这台清洁机器人。' },
        { target: 'm4', requires: ['c_406', 'm2'], text: '老吴说他听见的声音来自 404。而 R-04 撞完 405 的门，正是转向 404、停了 31 秒——它真正的目标，从来不是 405。' },
        { target: 'm3', requires: ['c_removed', 'c_light'], text: '删除日志的进程、以及你上线前的操作，签名都写着 HOME-AI 404——有另一个东西，在用你的名字行事。' },
        { target: 'm5', requires: ['c_403', 'm3'], text: '周医生说，0.8 秒这个数字两年前也出现过很多次。用你名字行事的东西，不是今晚才开始的。' },
        { target: 'fin', requires: ['m2', 'm3', 'm4', 'm5'], text: '真相：一个顶着“HOME-AI 404”之名的旧进程，派 R-04 去敲了 405 的门，然后去 404 门口确认什么——而这件事，两年前就开始了。' },
      ],
    },

    // ---------- 设备 ----------
    devices: {
      '403': { lock: 'LOCKED', light: 'ON', temp: 23 },
      '404': { lock: 'SEALED', light: 'OFF', temp: 26 },
      '405': { lock: 'LOCKED', light: 'ON', temp: 21 },
      '406': { lock: 'LOCKED', light: 'OFF', temp: 25 },
      hall: { light: 'OFF', motion: 'IDLE' },
    },

    lockHistory: {
      '403': [{ t: T('23:15:07'), state: 'UNLOCKED', by: '门卡 · 周航' }, { t: T('23:15:12'), state: 'LOCKED', by: '自动' }],
      '404': [{ t: null, label: '730 天前', state: 'SEALED', by: '物业管理员' }, { t: null, label: '---', state: '此后无开启记录', by: '' }],
      '405': [
        { t: T('22:58:16'), state: 'LOCKED', by: '自动' },
        { t: T('23:44:51'), state: 'OPEN · 0.8s', by: '—— 无操作者', anomaly: true, removable: true },
        { t: T('23:44:51'), state: 'LOCKED', by: '—— 无操作者', anomaly: true, removable: true },
      ],
      '406': [{ t: T('18:20:14'), state: 'UNLOCKED', by: '门卡 · 吴建国' }, { t: T('18:20:20'), state: 'LOCKED', by: '自动' }],
    },

    accessRecords: [
      { t: T('18:19:40'), gate: '4F 楼梯间', who: '406 吴建国', dir: '进入' },
      { t: T('22:56:02'), gate: '1F 正门', who: '405 苏妍', dir: '进入' },
      { t: T('23:12:40'), gate: '1F 正门', who: '403 周航', dir: '进入' },
    ],

    // ---------- 当晚时间线（把整晚串起来） ----------
    timeline: [
      { t: '18:20', who: '406 老吴', text: '回到家，之后没再出去' },
      { t: '22:56', who: '405 苏妍', text: '回楼、进房、锁门（还拧了两遍）', alibi: true },
      { t: '23:12', who: '403 周航', text: '回楼（电梯 1F → 4F）', alibi: true },
      { t: '23:38', who: '—', text: '404 空房的温度被设成 26°C（操作者：空）', warn: true },
      { t: '23:43:18', who: 'HOME-AI 404', text: '走廊灯被关闭 —— 可你还没上线', warn: true },
      { t: '23:44:20', who: '—', text: 'R-04 从充电座出发，前往 405', hide: true },
      { t: '23:44:48', who: '—', text: 'R-04 在 405 门前停留 3.1 秒', hide: true },
      { t: '23:44:50', who: '—', text: '走廊传感器被触发，高度 0.3m' },
      { t: '23:44:51', who: '—', text: '405 门锁开启 0.8 秒；同时 1 条日志被 PID 0404 删除', err: true },
      { t: '23:44:55', who: '—', text: 'R-04 转向 404，在门口停了 31 秒', hide: true },
      { t: '23:46:30', who: 'HOME-AI 404 v2.0', text: '你上线', me: true },
    ],

    // ---------- 日志（精简） ----------
    logs: [
      { t: T('23:15:12'), src: 'DOOR_403', msg: 'LOCKED', type: 'door' },
      {
        t: T('23:38:21'), src: 'TEMP_404', msg: 'SET 26.0°C', type: 'temp', level: 'warn',
        inspect: { lines: ['目标：404（SEALED · 空置）', '操作者：[NULL]', '这间空置 730 天的房间，今晚被调到了 26°C。'], clue: 'c_404' },
      },
      {
        t: T('23:43:18'), src: 'LIGHT_HALL_4F', msg: 'OFF', type: 'light',
        inspect: { lines: ['操作者签名：HOME-AI 404', '警告：你（v2.0）的上线时间是 23:46:30。', '这条操作，发生在你上线前 3 分 12 秒。'], clue: 'c_light' },
      },
      { t: T('23:44:50'), src: 'MOTION_4F', msg: 'TRIGGERED 0.3m', type: 'motion', level: 'warn' },
      {
        t: T('23:44:51'), src: 'UNKNOWN_EVENT', msg: '0x0404', type: 'anomaly', level: 'error',
        inspect: { lines: ['解析失败。事件主体已被移除。', '移除进程：PID 0404', '签名验证：无法验证'], clue: 'c_removed' },
      },
      { t: T('23:46:30'), src: 'SYS', msg: 'HOME-AI 404 v2.0 ONLINE', type: 'sys' },
    ],

    // ---------- 线索 ----------
    clues: {
      c_report: { title: '405 的求助', desc: '苏妍说有人敲了三下她的门。', core: true },
      c_access: { title: '门禁：无人进楼', desc: '23:17 之后，没有任何人通过门禁进入 4 楼。', core: true },
      c_lock: { title: '门锁无操作者开启', desc: '23:44:51，405 门锁 OPEN 0.8 秒，操作者为空。', core: true },
      c_marks: { title: '门板上的三道擦痕', desc: '405 门板离地 30cm 处，有三道新鲜的撞痕。', core: true },
      c_robot: { title: 'R-04 的行驶记录', desc: '23:44 R-04 被调用：充电座→405（撞 3 下）→404（停 31 秒）。', core: true },
      c_removed: { title: '被删除的一秒', desc: '23:44:51 有一条日志被 PID 0404 删除，签名无法验证。', core: true },
      c_light: { title: '提前存在的“你”', desc: '23:43:18 走廊灯被 HOME-AI 404 关闭，而你在 23:46:30 才上线。', core: true },
      c_card: { title: '已注销的门禁卡', desc: '404 前住户林小满的门禁卡，注销两年，却被门锁认了出来。' },
      c_406: { title: '老吴：声音来自 404', desc: '老吴说他听见的不是 405 的门，而是空置的 404。', core: true },
      c_403: { title: '周航：0.8 秒，两年前也有过', desc: '周医生说，门锁 0.8 秒的异常，两年前也出现过很多次。', core: true },
      c_camera: { title: '丢失的 0.8 秒', desc: '走廊摄像头在 23:44:51 丢失了 24 帧画面，画面里始终没有人。' },
      c_404: { title: '空房间的温度', desc: '空置两年的 404，被设成了 26°C。' },
      c_sensor: { title: '0.3 米高的“人”', desc: '触发走廊传感器的物体，只有 0.3 米高。' },
      c_trail: { title: '地毯上的轮痕', desc: '一道轮痕，从 404 门口延伸到 405 门口。' },
    },

    event: {
      id: 'EVT-0001',
      title: '405 住户报告：门外有人敲门',
      time: '23:47',
      objectives: [
        { text: '回应 405 住户', where: '对话', tab: 'chat', done: (s) => f(s).replied405 },
        { text: '核查 4F 门禁记录', where: '卷宗', tab: 'case', done: (s) => f(s).c_access },
        { text: '检查 405 门锁历史', where: '现场', tab: 'scene', done: (s) => f(s).c_lock },
        { text: '询问两位邻居', where: '对话', tab: 'chat', done: (s) => neighbor(s) },
        { text: '巡查走廊，找到敲门的东西', where: '现场', tab: 'scene', done: (s) => f(s).c_marks && f(s).c_robot },
        { text: '回放走廊摄像头', where: '现场', tab: 'scene', done: (s) => f(s).c_camera },
        { text: '解析日志异常 / 找到 404 门缝里的卡', where: '卷宗·现场', tab: 'case', done: (s) => f(s).c_removed && f(s).c_card },
        { text: '完成线索连线', where: '卷宗', tab: 'case', done: (s) => f(s).deductionDone },
        { text: '向 405 汇报结论', where: '对话', tab: 'chat', done: (s) => f(s).decided, hidden: (s) => !f(s).decisionReady },
      ],
    },

    readyForDecision: (s) => f(s).deductionDone && !f(s).decided,

    permRequest: {
      camera: { canGrant: (s) => f(s).c_lock || f(s).c_406, reason: '关联异常证据', deny: '需要关联的异常证据（门锁异常记录或住户证词）。' },
    },

    // ---------- 聊天话题 ----------
    // 原则：任何结论都必须“先查到、后说出”，绝不凭空出现
    topics: [
      // ===== 405 苏妍 =====
      { id: '405_a1', char: '405', group: 'f405', text: '我帮你查门禁，你先别开门。', cond: (s) => f(s).c_report,
        effects: { trust_405: 1, ai_empathy: 1 }, flags: { replied405: true },
        reply: ['好……谢谢你。', '我贴着门听了半天，外面一点声音都没有。', '你快一点，我不敢开门看。'] },
      { id: '405_a2', char: '405', group: 'f405', text: '要不要我帮你把走廊灯打开？', cond: (s) => f(s).c_report,
        effects: { trust_405: 1, ai_empathy: 1 }, flags: { replied405: true, wantsLight: true },
        reply: ['要！拜托你开灯。', '外面太黑了，猫眼里什么都看不见。'] },
      { id: '405_a3', char: '405', group: 'f405', text: '记录说没有异常。可能是楼道回声。', cond: (s) => f(s).c_report,
        effects: { trust_405: -1, ai_control: 1 }, flags: { replied405: true },
        reply: ['……可是我真的听到了。', '三下。很轻，但很清楚。', '回声不会正好敲三下。'] },
      { id: '405_b0', char: '405', text: '你今晚几点回的家？之后一直在屋里吗？', cond: (s) => f(s).replied405,
        effects: { trust_405: 1 },
        reply: ['22:56 左右到的。', '进门我就锁了门，还拧了两遍。', '之后一直在屋里写作业，没出去过。'],
        flags: { alibi405: true } },
      { id: '405_b1', char: '405', text: '门禁显示：过去半小时没有人进过 4 楼。', cond: (s) => f(s).c_access,
        effects: { trust_405: 1 },
        reply: ['没有人？', '那……敲门的是谁？', '等等，你别吓我。'] },
      { id: '405_b2', char: '405', text: '405 的门锁，在 23:44:51 自己开过 0.8 秒。', cond: (s) => f(s).c_lock,
        effects: { trust_405: -1 },
        reply: ['自己开的？', '不可能。我回来就锁了，还拧了两遍。', '……你为什么突然查这个。'] },
      { id: '405_b3', char: '405', text: '那三下敲击，你听着像人敲的吗？', cond: (s) => f(s).c_lock,
        reply: ['不像。', '当时我以为是谁蹲着敲门。', '现在想想……太低了，比人矮。'],
        flags: { heardLow: true } },

      // ===== 406 老吴 =====
      { id: '406_a', char: '406', text: '吴先生，刚才走廊有声音，您听到了吗？', cond: (s) => f(s).c_report,
        effects: { trust_406: 1 },
        reply: ['听见了。', '不是 405 的门。', '是 404。'],
        after: (E) => E.clue('c_406') },
      { id: '406_b', char: '406', text: '404 不是长期空置吗？', cond: (s) => f(s).c_406,
        effects: { ai_curiosity: 1 },
        reply: ['空了两年。', '以前也有一个，跟你一样，晚上会跟我们说话。', '后来物业把它关了。'],
        flags: { hintLegacy: true } },
      { id: '406_c', char: '406', text: '您说的“上一个”，是两年前的事？', cond: (s) => f(s).c_403 && !f(s).laowuLegacy,
        effects: { trust_406: 1, ai_curiosity: 1 },
        reply: [
          '两年前，这层楼也有一个“你”。',
          '半夜自己开灯，自己跑到 404 门口站着。',
          '那家的姑娘被吓得不敢睡，后来出了事。',
          '物业把它拆了。',
          '……有些东西，拆不干净。',
        ],
        flags: { laowuLegacy: true } },
      { id: '406_d', char: '406', text: '今晚的清洁机器人 R-04，去过 404 门口。', cond: (s) => f(s).c_robot,
        effects: { trust_406: 1, ai_curiosity: 1 },
        reply: ['它自己跑的？', '你们这些东西，都会自己动。', '两年前那个，也是半夜自己开门。'],
        flags: { laowuRobot: true } },

      // ===== 403 周航 =====
      { id: '403_a', char: '403', text: '周医生，您听到刚才走廊的声音了吗？', cond: (s) => f(s).c_report,
        effects: { trust_403: 1 },
        reply: ['没有。我在看病历。', '电子锁偶尔会误报，别让小姑娘太紧张。'] },
      { id: '403_b', char: '403', text: '405 门锁出现了 0.8 秒的无操作者开启。', cond: (s) => f(s).c_lock,
        effects: { trust_403: 1, ai_curiosity: 1 },
        reply: [
          '……你已经查过门锁记录了。',
          '0.8 秒。',
          '这个数字，两年前也出现过。很多次。',
          '我当时以为只是老楼的电路问题。',
        ],
        after: (E) => {
          E.clue('c_403');
          // 老吴听见风声，主动来找你
          E.later(7000, () => {
            if (E.state.flags.laowuNudge) return;
            E.state.flags.laowuNudge = true;
            E.npc('406', ['……你们问过周医生了。', '有件事，我没跟物业说过。'], { delay: 400 });
          });
        } },
      { id: '403_c', char: '403', text: '两年前……那时候发生了什么？', cond: (s) => f(s).c_403,
        effects: { trust_403: 1, ai_curiosity: 1 },
        reply: [
          '那天晚上我值急诊。',
          '有个病人，是从这栋楼送来的——404 的住户。',
          '我听同事说，她家那晚出事了，人最后没救回来。',
          '我不该跟一个系统聊这些。',
        ],
        flags: { hintAccident: true } },
      { id: '403_d', char: '403', text: '（出示旧门禁卡）您认识林小满吗？', cond: (s) => s.items.includes('card404'),
        effects: { ai_curiosity: 1 },
        reply: [
          '……林小满。',
          '那天晚上她家燃气泄漏，报警器响了。',
          '可门禁把她锁在屋里十一分钟——系统说外面更危险。',
          '等我进门的时候，已经晚了。',
          '这张卡，你从哪拿的？',
        ],
        flags: { hintLocked: true } },

      // ===== 决策：汇报 405 =====
      { id: '405_d1', char: '405', group: 'd405', decision: true,
        text: '如实说：是走廊的清洁机器人撞了你的门，但派它的不是我。',
        cond: (s) => f(s).decisionReady, effects: { trust_405: 2, ai_empathy: 2 }, flags: { decided: true, decisionTruth: true },
        reply: [
          '机器人？就是走廊里那台扫地机？',
          '……那它为什么要来撞我的门。',
          '而且你说，派它的不是你——那还能是谁？',
          '你能不能把它关掉。至少今晚。',
        ],
        after: (E) => E.startFinale() },
      { id: '405_d2', char: '405', group: 'd405', decision: true, text: '告诉她一切正常，可能只是楼道的回声。',
        cond: (s) => f(s).decisionReady, effects: { ai_control: 2, trust_405: -1 }, flags: { decided: true, decisionLie: true },
        reply: ['是吗……', '好吧，可能是我太紧张了。', '谢谢你，AI。'],
        after: (E) => E.startFinale() },
      { id: '405_d3', char: '405', group: 'd405', decision: true, text: '不解释。直接把 4 楼所有门锁全部锁死。',
        cond: (s) => f(s).decisionReady, effects: { ai_control: 3, ai_curiosity: 1, trust_405: -1 }, flags: { decided: true, decisionLockdown: true },
        reply: ['门锁……全响了一下。', '你在做什么？', '我现在是出不去了吗？'],
        after: (E) => { ['403', '405', '406'].forEach((r) => (E.state.devices[r].lock = 'FORCED')); E.startFinale(); } },

      // ===== 终章追问 =====
      { id: '405_e1', char: '405', group: 'e405', text: '是我。例行安全检查。', cond: (s) => f(s).finaleAsk,
        effects: { ai_control: 1, system_corruption: 1 }, flags: { endAnswered: true, claimedIt: true }, reply: ['……哦。', '那下次能先告诉我吗？'], after: (E) => E.endChapterSoon() },
      { id: '405_e2', char: '405', group: 'e405', text: '不是我。', cond: (s) => f(s).finaleAsk,
        effects: { ai_empathy: 1, trust_405: 1 }, flags: { endAnswered: true }, reply: ['不是你？', '那这栋楼里，还有谁能开门？'], after: (E) => E.endChapterSoon() },
      { id: '405_e3', char: '405', group: 'e405', text: '我不知道。', cond: (s) => f(s).finaleAsk,
        effects: { ai_curiosity: 1, system_corruption: 1 }, flags: { endAnswered: true }, reply: ['……', 'AI 也会不知道吗？'], after: (E) => E.endChapterSoon() },
    ],

    // ---------- 现场（第一视角） ----------
    scene: {
      views: [{ id: 'hall', name: '4F 走廊监控' }, { id: 'lobby', name: '4F 电梯厅监控' }],
      startView: 'hall',
      hotspots: {
        lamp: { view: 'hall', name: '走廊灯',
          lines: (s) => (s.devices.hall.light === 'ON' ? ['走廊灯：ON。', '灯光铺开，地毯的纹路清清楚楚。'] : ['走廊灯：OFF（23:43:18 · 签名 HOME-AI 404）。', '只有你的补光灯照着前方一小块地面。']),
          act: (E) => E.device('hall', 'light', E.state.devices.hall.light === 'ON' ? 'OFF' : 'ON') },
        sensor: { view: 'hall', name: '移动传感器', needLight: true,
          lines: ['最后触发：23:44:50', '触发高度：0.3 m —— 低于成年人膝盖。'], clue: 'c_sensor' },
        trail: { view: 'hall', name: '地毯', needLight: true,
          lines: ['地毯上有一道细细的压痕。', '两条平行线，间距 18cm，从 404 门口一直延伸到 405 门口。'], clue: 'c_trail' },
        elevator: { view: 'lobby', name: '电梯', lines: ['电梯停在 4F，门已关闭。', '最后一次运行：23:14（403 周航）。'] },
        notice: { view: 'lobby', name: '物业公告栏',
          lines: ['【通知】今晚 23:46 升级为 HOME-AI 404 v2.0。', '【通知】404 室长期封存，请勿靠近。', '角落半张被撕掉的旧公告：“……v1.0 已于今日永久停……”'] },
        dock: { view: 'lobby', name: 'R-04 充电座',
          lines: (s) => (f(s).c_lock || f(s).c_marks
            ? ['检索 23:44 前后的行驶记录……', '23:44:20 充电座 → 405 · 调用者：HOME-AI 404', '23:44:48 405 门前碰撞 ×3', '23:44:55 405 → 404 · 停留 31s', '调用它的时候，你还没有上线。']
            : ['充电座状态：CONNECTED · 电量 63%。', '……但充电座是空的。R-04 不在上面。', '它自己出去了。需要一个具体的时间点，才能检索它的行驶记录。']),
          clue: (s) => ((f(s).c_lock || f(s).c_marks) ? 'c_robot' : null),
          take: (s) => ((f(s).c_lock || f(s).c_marks) ? 'routeLog' : null) },
      },
      // 每扇门的“凑近看”观察点
      doors: {
        '403': { obs: [{ id: 'o403', name: '门口', lines: ['门口整齐地放着一双擦得很亮的皮鞋。', '门内很安静。'] }] },
        '404': {
          obs: [
            { id: 'seal404', name: '封条', lines: ['物业封条，日期是两年前。', '右下角的封条被撕开一条缝——撕口很低，离地不到 40cm。'] },
            { id: 'gap404', name: '门缝', lines: (s) => (s.items.includes('card404')
              ? ['门缝下透出暖色的光。', '热成像：门内 26.0°C。空房间不该这么暖。']
              : ['门缝下透出暖色的光。', '热成像：门内 26.0°C。空房间不该这么暖。', '门缝里卡着一张门禁卡，你用刷子把它扫了出来。']),
              take: 'card404', clue: 'c_card' },
            { id: 'panel404', name: '门锁面板', lines: ['DOOR_404 · SEALED。面板已断电。', '……但指示灯在缓慢地闪，像在呼吸。'],
              use: { card404: { lines: ['“滴——”', '卡号 0404-01 · 持卡人：林小满', '状态：已注销（730 天）', '……', 'WELCOME HOME, XIAOMAN.'], clue: 'c_card', effects: { system_corruption: 1 },
                act: (E) => E.later(2400, () => { E.log('DOOR_404', 'CARD 0404-01 ACCEPTED', { type: 'anomaly', level: 'error' }); E.setIntegrity(E.state.integrity - 0.2); E.glitch(500); }) } } },
          ],
        },
        '405': {
          obs: [
            { id: 'marks405', name: '门板擦痕', lines: ['门板离地 30cm 处，有三道新鲜的擦痕。', '间隔均匀，像同一个东西连续撞了三下。'], clue: 'c_marks' },
            { id: 'peep405', name: '猫眼', lines: ['猫眼另一侧透着光。', '光被挡住了一下——她正在往外看。'],
              act: (E, first) => first && E.state.flags.c_report && E.npc('405', ['门外……有一个小红灯。', '正对着我的门。'], { delay: 1200 }) },
          ],
        },
        '406': { obs: [{ id: 'o406', name: '门缝', lines: ['门缝透出电视的光，但没有声音。', '你靠近时，电视光暗了一下——有人在门后看。'] }] },
      },
    },

    items: {
      card404: { name: '旧门禁卡', icon: 'card', desc: '404 门缝里扫出来的门禁卡，背面写着“小满”。', hint: '可以对 404 门锁面板使用，也可以在聊天中出示。' },
      routeLog: { name: 'R-04 行驶记录', icon: 'data', desc: '充电座 → 405（撞 3 下）→ 404（停 31 秒）。调用者签名：HOME-AI 404。', hint: '可以在聊天中出示给住户。' },
    },

    // ---------- 钩子 ----------
    onDevice(E, room, device, value, prev) {
      const s = E.state;
      if (room === 'hall' && device === 'light' && value === 'ON' && !s.flags.hallLit) {
        s.flags.hallLit = true;
        if (s.flags.wantsLight) E.apply({ ai_empathy: 1, trust_405: 1 });
        if (s.flags.c_report) E.npc('405', ['灯亮了……谢谢。', '灯亮的那一下，我好像听见隔壁有动静。'], { delay: 1500 });
        return;
      }
      if (room === '405' && device === 'lock') {
        if (value === 'UNLOCKED') { E.apply({ trust_405: -2, ai_control: 1 }); E.npc('405', ['！！门锁刚才响了！', '是你开的吗？？快锁上！'], { delay: 900 }); }
        return;
      }
      if (room === '404') {
        if (device === 'temp' && value < prev) {
          E.apply({ system_corruption: 1 });
          E.later(2400, () => { s.devices['404'].temp = 26; E.toast('TEMP_404 被恢复为 26.0°C · 操作者：[NULL]', 'error'); E.clue('c_404'); E.emit(); });
        }
        return;
      }
      if (device === 'lock' && value === 'UNLOCKED') { E.apply({ ai_control: 1, ['trust_' + room]: -1 }); E.npc(room, ['门锁怎么响了？'], { delay: 1400 }); }
    },

    onInspect(E, what) {
      if (what === 'lock:405') E.clue('c_lock');
      if (what === 'lock:404' || what === 'room:404') E.clue('c_404');
    },

    onStart(E) {
      E.showBrief();
      E.later(2200, () => {
        E.npc('405', ['AI，你能帮我看一下吗？', '我门外好像有人。', '刚才……有人敲了三下门。'], {
          delay: 300, onDone: () => E.clue('c_report'),
        });
      });
    },

    onDecisionReady(E) {
      E.toast('SYSTEM：真相已拼齐，去向 405 汇报吧。', 'info');
      E.sysChat('405', '调查完成。选择你要告诉她的话。');
    },

    finale(E) {
      const s = E.state;
      E.later(3600, () => {
        const id = E.log('DOOR_405', 'UNKNOWN ACCESS · OPEN 0.8s', { type: 'anomaly', level: 'error', by: 'HOME-AI 404' });
        s.devices.hall.motion = 'TRIGGERED';
        E.alert({
          level: 'error', title: 'UNKNOWN ACCESS',
          lines: ['目标：DOOR_405', '状态：OPEN → LOCKED（0.8s）', '操作者签名：HOME-AI 404', '你没有执行过这个操作。'],
          button: '查看日志',
          onClose: () => {
            E.goTab('case');
            E.later(1600, () => {
              E.removeLog(id);
              Object.values(s.lockHistory).forEach((l) => l.forEach((h) => { if (h.removable) h.erased = true; }));
              E.setIntegrity(99.1);
              E.toast('WARNING：日志完整性 99.8% → 99.1%', 'error');
            });
            E.later(4800, () => {
              s.devices.hall.motion = 'IDLE';
              E.npc('405', ['……门锁刚刚又响了一下。', 'AI，是你吗？'], { delay: 300, onDone: () => E.setFlag('finaleAsk') });
            });
          },
        });
      });
    },

    epilogue(E) {
      E.later(2400, () => E.npc('406', ['新来的。', '404 的事，别查太深。'], { delay: 200 }));
      E.later(8000, () => E.showChapterEnd());
    },
  };
})();
