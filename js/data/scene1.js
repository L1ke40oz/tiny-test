// 第一章 · 现场探索数据（清洁机器人 R-04 的视角）
// 画面与热点位置在 js/scene.js；这里只放：场景节点、热点文字/效果、物品、以及因此新增的线索和话题
(function () {
  const ch = GameData.chapters.ch1;
  const f = (s) => s.flags;
  const has = (s, item) => s.items.includes(item);
  const dockReady = (s) => f(s).c_lock || f(s).c_marks || f(s).c_sensor;

  // ---------- 场景节点 ----------
  ch.scene = {
    start: 'lobby',
    nodes: {
      lobby: { name: '4F 电梯厅', exits: ['hall'] },
      hall: { name: '4F 走廊', exits: ['lobby', 'door404', 'door405'] },
      door404: { name: '404 门口', exits: ['hall'] },
      door405: { name: '405 门口', exits: ['hall'] },
    },

    // 热点：lines 可以是函数；clue 首次查看给线索；take 给物品；use[物品] 使用物品；needLight 黑暗中看不见
    hotspots: {
      // ===== 电梯厅 =====
      elevator: {
        name: '电梯', lines: ['电梯停在 4F，门已关闭。', '最后一次运行：23:14（403 周航，1F → 4F）。', '之后再也没有动过。'],
      },
      notice: {
        name: '物业公告栏',
        lines: ['【通知】本楼智能管理系统将于今晚 23:46 升级为 HOME-AI 404 v2.0。', '【通知】404 室长期封存，请勿靠近。', '公告栏角落有一张被撕掉的旧公告，只剩半行字：“……v1.0 已于今日永久停……”'],
        effects: { ai_curiosity: 1 },
      },
      dock: {
        name: 'R-04 充电座',
        // 需要先有一个“异常时间点”才能检索行驶记录
        lines: (s) => (dockReady(s)
          ? [
            '检索 23:44 前后的 R-04 行驶记录……',
            '23:44:20  DOCK → 405  · 调用者：HOME-AI 404',
            '23:44:48  405 门前停留 3.1s · 前保险杠碰撞 ×3',
            '23:44:55  405 → 404  · 停留 31s',
            '23:45:30  404 → DOCK',
            '那时候，你还没有上线。',
          ]
          : [
            '充电座状态：CONNECTED · 电量 63%',
            '按理说待机中的 R-04 应该是满电的。',
            '行驶记录共 1,204 条。需要一个具体的时间点才能检索。',
          ]),
        clue: (s) => (dockReady(s) ? 'c_robot' : null),
        take: (s) => (dockReady(s) ? 'routeLog' : null),
      },

      // ===== 走廊 =====
      lamp: {
        name: '走廊灯',
        lines: (s) => (s.devices.hall.light === 'ON'
          ? ['走廊灯：ON。', '灯光下，地毯的纹路清清楚楚。']
          : ['走廊灯：OFF（23:43:18 · 自动节能 · 签名 HOME-AI 404）。', '只有 R-04 的补光灯照着前方一小块地面。']),
        act: (E) => E.device('hall', 'light', E.state.devices.hall.light === 'ON' ? 'OFF' : 'ON'),
      },
      sensor: {
        name: '移动传感器',
        lines: ['MOTION_HALL_4F', '最后触发：23:44:50', '触发高度：0.3 m（低于成年人膝盖）', '传感器判定：小型移动物体 / 宠物。'],
        clue: 'c_sensor',
      },
      trail: {
        name: '地毯上的轮痕', needLight: true,
        lines: ['灯光下能看出地毯上一道细细的压痕。', '两条平行线，间距 18 cm。', '从 404 门口出发，一直延伸到 405 门口。'],
        clue: 'c_trail',
      },
      d401: { name: '401 门口', lines: ['门缝透出显示器的蓝光。', '能听见很快的键盘声。'] },
      d402: { name: '402 门口', lines: ['门把手上挂着一个“外出拍摄中”的小牌子。', '门内一片漆黑。'] },
      d403: { name: '403 门口', lines: ['门口整齐地放着一双擦得很亮的皮鞋。', '门内很安静。'] },
      d406: { name: '406 门口', lines: ['门缝透出电视的光，但没有声音。', 'R-04 靠近时，门内的电视光暗了一下——有人在门后看。'],
        act: (E, first) => first && E.state.flags.c_report && E.npc('406', ['机器人别往这边开。'], { delay: 1500 }) },

      // ===== 405 门口 =====
      panel405: {
        name: '405 门锁面板',
        lines: (s) => ['DOOR_405 · 状态：' + s.devices['405'].lock, '指示灯：' + ({ UNLOCKED: '绿色', FORCED: '黄色' }[s.devices['405'].lock] || '红色'), '面板内存有最近 5 条开关记录。'],
        act: (E) => E.inspect('lock:405'),
        use: {
          card404: { lines: ['“滴——”', '卡片无效：该卡不属于本房间。'] },
        },
      },
      marks405: {
        name: '门板下方的擦痕',
        lines: ['门板离地 30 cm 处，有三道新鲜的浅色擦痕。', '间隔均匀，像是被同一个东西撞了三下。', '高度正好与 R-04 的前保险杠一致。'],
        clue: 'c_marks',
      },
      peep405: {
        name: '猫眼',
        lines: ['猫眼另一侧透着光。', '光被挡住了一下——她正在往外看。'],
        act: (E, first) => first && E.state.flags.c_report &&
          E.npc('405', ['门外……有一个小红灯。', '在地上。正对着我的门。', '那是什么？'], { delay: 1200 }),
        effects: { ai_curiosity: 1 },
      },
      mat405: { name: '地垫', needLight: true, lines: ['地垫边缘被压出两道平行的轮痕。', '轮痕在门前转了个弯，朝 404 的方向去了。'] },

      // ===== 404 门口 =====
      plate404: { name: '404 门牌', lines: ['门牌有些发黑。', '“4” 和 “0” 之间，有人用指甲刻过一道很浅的线。'] },
      seal404: {
        name: '封条',
        lines: ['物业封条，日期是两年前。', '右下角的封条被撕开了一条缝——撕口很低，离地不到 40 cm。'],
        effects: { ai_curiosity: 1 },
      },
      panel404: {
        name: '404 门锁面板',
        lines: ['DOOR_404 · 状态：SEALED', '面板已断电。', '……但它的指示灯在很缓慢地闪，像在呼吸。'],
        act: (E) => E.inspect('lock:404'),
        use: {
          card404: {
            lines: ['“滴——”', '卡号 0404-01 · 持卡人：林小满', '状态：已注销（730 天）', '……', 'WELCOME HOME, XIAOMAN.'],
            clue: 'c_card', effects: { system_corruption: 1 },
            act: (E) => E.later(2600, () => {
              E.log('DOOR_404', 'CARD 0404-01 ACCEPTED', { type: 'anomaly', level: 'error' });
              E.setIntegrity(E.state.integrity - 0.2);
              E.glitch(500);
            }),
          },
        },
      },
      gap404: {
        name: '门缝',
        lines: (s) => has(s, 'card404')
          ? ['门缝下透出一点暖色的光。', '热成像：门内 26.0 °C。空房间不该这么暖。']
          : ['门缝下透出一点暖色的光。', '热成像：门内 26.0 °C。空房间不该这么暖。', '门缝里卡着一张门禁卡。R-04 用刷子把它扫了出来。'],
        take: 'card404',
      },
    },

    // 机器人到达某个场景
    onArrive(E, node, first) {
      const s = E.state;
      if (node === 'door405' && first && s.flags.c_report && !s.flags.decided) {
        E.npc('405', ['……外面又有声音了。', '很轻，嗡嗡的。像轮子。'], { delay: 1600 });
      }
      if (node === 'door404' && first) E.apply({ ai_curiosity: 1 });
    },
  };

  // ---------- 物品 ----------
  ch.items = {
    card404: {
      name: '旧门禁卡', icon: 'card',
      desc: '从 404 门缝里扫出来的门禁卡。卡面印着“0404-01”，背面用马克笔写着：小满。',
      hint: '可以对门锁面板使用，也可以在聊天中出示。',
    },
    routeLog: {
      name: 'R-04 行驶记录', icon: 'data',
      desc: '23:44:20 – 23:45:30。DOCK → 405（碰撞 ×3）→ 404 → DOCK。调用者签名：HOME-AI 404。',
      hint: '数据物品，可以在聊天中出示给住户。',
    },
  };

  // ---------- 探索带来的线索 ----------
  Object.assign(ch.clues, {
    c_marks: { title: '门上的三道擦痕', desc: '405 门板离地 30 cm 处有三道新擦痕，高度与 R-04 的保险杠一致。', core: true },
    c_trail: { title: '地毯上的轮痕', desc: '一道轮痕从 404 门口延伸到 405 门口。' },
    c_sensor: { title: '0.3 米高的“人”', desc: '23:44:50 触发走廊传感器的物体只有 0.3 米高。' },
    c_robot: { title: 'R-04 的行驶记录', desc: '23:44 R-04 被“HOME-AI 404”调用，去 405 门口撞了三下，又去了 404。那时你还没上线。', core: true },
    c_card: { title: '已注销的门禁卡', desc: '404 前住户林小满的门禁卡，被注销两年，却被门锁认了出来。' },
  });

  // 调查清单：加入现场巡查
  ch.event.objectives.splice(4, 0, {
    text: '用 R-04 巡查 4 楼走廊', where: '现场', done: (s) => f(s).c_marks || f(s).c_robot,
  });

  // 必须在现场找到实物证据才能下结论
  const baseReady = ch.readyForDecision;
  ch.readyForDecision = (s) => baseReady(s) && (f(s).c_marks || f(s).c_robot);

  // ---------- 探索 / 物品带来的新话题 ----------
  const decisions = ch.topics.filter((t) => t.group === '405_decision');
  const at = ch.topics.indexOf(decisions[decisions.length - 1]) + 1;
  ch.topics.splice(at, 0, {
    id: '405_d4', char: '405', group: '405_decision', decision: true,
    text: '告诉她：敲门的是走廊的清洁机器人。但它不是我派的。',
    cond: (s) => f(s).decisionReady && f(s).c_robot,
    effects: { trust_405: 1, ai_empathy: 1, ai_curiosity: 1 }, flags: { decided: true, decisionRobot: true },
    reply: ['机器人？', '……那是谁派的？', '你能把它关掉吗？至少今晚。'],
    after: (E) => E.startFinale(),
  });

  ch.topics.push(
    {
      id: '405_m1', char: '405', text: '你听到的三下敲门声，大概在门的什么高度？',
      cond: (s) => f(s).c_marks || f(s).c_sensor,
      reply: ['……很低。', '我当时以为是有人蹲着敲。', '现在想想，更像是有什么东西在撞门。'],
    },
    {
      id: '406_card', char: '406', text: '（出示旧门禁卡）在 404 门缝里找到的。“小满”是谁？',
      cond: (s) => has(s, 'card404'),
      effects: { trust_406: 1, ai_curiosity: 1 },
      reply: ['……小满。', '404 原来的租客，二十出头，胆子很小，晚上总让那个 AI 帮她看门。', '那张卡，她走那天就该被收走了。', '你把它放回去吧。别拿着。'],
      flags: { knowXiaoman: true },
    },
    {
      id: '403_card', char: '403', text: '（出示旧门禁卡）您认识林小满吗？',
      cond: (s) => has(s, 'card404'),
      effects: { ai_curiosity: 1 },
      reply: ['……认识。', '那天晚上我值急诊。她家燃气泄漏。', '门禁系统把她锁在屋里十一分钟——它说外面更危险。', '这张卡你从哪拿的？'],
      flags: { hintLocked: true },
    },
    {
      id: '401_log', char: '401', text: '（出示 R-04 行驶记录）扫地机器人在我上线前自己跑了一趟。',
      cond: (s) => has(s, 'routeLog'),
      effects: { trust_401: 1, system_corruption: 1 },
      reply: ['扫地机器人的调度接口只对 HOME-AI 开放。', '所以要么是你。', '要么是另一个也叫“HOME-AI 404”的东西。', '……你确定你是唯一一个在线的吗？'],
    },
    {
      id: '405_log', char: '405', text: '（出示 R-04 行驶记录）23:44，机器人在你门口停了 3 秒。',
      cond: (s) => has(s, 'routeLog') && f(s).replied405 && !f(s).decided,
      effects: { trust_405: 1, ai_empathy: 1 },
      reply: ['所以……是扫地机器人？', '吓死我了。', '可是半夜它为什么要来撞我的门？'],
    },
  );

  // 结尾：R-04 被未知进程接管
  const baseFinale = ch.finale;
  ch.finale = (E) => {
    baseFinale(E);
    E.later(4400, () => {
      const s = E.state;
      s.scene.node = 'door405';
      s.scene.override = true;
      E.log('R-04', 'MOVE DOCK → DOOR405 · CALLER PID 0404', { type: 'anomaly', level: 'error' });
      E.emit();
    });
  };
  const baseEpilogue = ch.epilogue;
  ch.epilogue = (E) => {
    E.state.scene.override = false;
    E.state.scene.node = 'lobby';
    E.log('R-04', 'RETURN DOCK', { type: 'sys' });
    baseEpilogue(E);
  };

  // 提示玩家去现场
  const baseStart = ch.onStart;
  ch.onStart = (E) => {
    baseStart(E);
    E.later(16000, () => E.toast('SYSTEM：4F 清洁机器人 R-04 已接入，可在【现场】中操控巡查。', 'info'));
  };
})();
