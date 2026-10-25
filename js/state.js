// gameState：所有会变化的数据都在这里
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
      clock: ch.startTime,
      integrity: ch.integrity,
      phase: 'play',                // play → finale → epilogue → end

      actIndex: 0,
      briefShown: false,

      vars: {
        trust_403: 0, trust_405: 0, trust_406: 0,
        ai_empathy: 0, ai_control: 0, ai_curiosity: 0, system_corruption: 0,
      },

      flags: {},
      clues: [],

      // 线索连线图
      board: { edges: [], unlocked: {}, done: false },

      perms: { camera: false },

      devices: clone(ch.devices),
      lockHistory: clone(ch.lockHistory),
      logs: ch.logs.map((l, i) => Object.assign({ id: 'L' + i, by: null }, l)),

      threads,
      unread,
      usedTopics: {},
      usedGroups: {},
      busy: {},
      typing: {},

      processes: [
        { pid: '0001', name: 'home_core', st: 'RUNNING' },
        { pid: '0012', name: 'device_bus', st: 'RUNNING' },
        { pid: '0107', name: 'log_writer', st: 'RUNNING' },
      ],

      scene: { view: ch.scene.startView, examined: {}, override: false },
      items: [],
      selItem: null,

      newClue: false,
      newLog: false,
      newItem: false,
    };
  },
};
