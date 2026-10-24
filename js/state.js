// gameState：所有会变化的数据都在这里，方便以后存档
window.GameState = {
  create(chapterId) {
    const ch = GameData.chapters[chapterId];
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const threads = {};
    const unread = {};
    GameData.roomOrder.forEach((r) => { threads[r] = []; unread[r] = 0; });

    return {
      chapterId,
      day: ch.day,
      clock: ch.startTime,          // 当天秒数
      integrity: ch.integrity,      // 日志完整性
      phase: 'play',                // play → finale → epilogue → end

      // 隐藏变量
      vars: {
        trust_401: 0, trust_402: 0, trust_403: 0, trust_405: 0, trust_406: 0,
        ai_empathy: 0, ai_control: 0, ai_curiosity: 0, system_corruption: 0,
      },

      flags: {},      // 剧情标记 & 线索（线索也是 flag）
      clues: [],      // 已发现线索，按发现顺序

      perms: {
        messages: true, locks: true, lights: true, temp: true, basicLog: true,
        access: false,   // 门禁历史
        camera: false,   // 公共区域摄像头
        anomaly: false,  // 异常行为记录
        history: false,  // 历史系统日志
        legacy: false,   // 上一代 AI 残留数据
      },

      devices: clone(ch.devices),
      lockHistory: clone(ch.lockHistory),
      logs: ch.logs.map((l, i) => Object.assign({ id: 'L' + i, by: null }, l)),

      threads,
      unread,
      usedTopics: {},
      usedGroups: {},
      busy: {},       // 某住户还有未发完的消息
      typing: {},

      processes: [
        { pid: '0001', name: 'home_core', st: 'RUNNING' },
        { pid: '0012', name: 'device_bus', st: 'RUNNING' },
        { pid: '0031', name: 'msg_daemon', st: 'RUNNING' },
        { pid: '0107', name: 'log_writer', st: 'RUNNING' },
      ],

      // 现场探索：R-04 所在位置、看过的热点、物品
      scene: { node: ch.scene ? ch.scene.start : null, visited: {}, examined: {}, override: false },
      items: [],
      selItem: null,  // 正在“使用”的物品

      newClue: false,
      newLog: false,
      newItem: false,
    };
  },
};
