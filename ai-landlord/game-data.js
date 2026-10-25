/* 剧情数据独立于界面；经典脚本支持 file:// 直接运行。 */
window.GameData = {
  saveKey: 'home-ai-404-v1',
  characters: [
    { id: '401', name: '林澈', job: '程序员', trait: '安静 / 敏感', status: '在家', color: '#8298ad', initial: '澈', preview: '这么晚了，系统还在更新？' },
    { id: '402', name: '陈雨', job: '自由摄影师', trait: '外向 / 好奇', status: '外出', color: '#b39a82', initial: '雨', preview: '我今天拍到了一点有趣的东西。' },
    { id: '403', name: '周航', job: '医生', trait: '冷静 / 理性', status: '在家', color: '#8fa89e', initial: '航', preview: '今晚值班结束，勿扰。' },
    { id: '404', name: '空置房间', job: '无登记住户', trait: '档案封存', status: '未知', color: '#777a84', initial: '—', preview: '没有住户，为什么有设备心跳？' },
    { id: '405', name: '苏妍', job: '学生', trait: '紧张 / 细心', status: '在家', color: '#b6a4b9', initial: '妍', preview: '我门外……好像有人。' },
    { id: '406', name: '老吴', job: '退休人员', trait: '寡言 / 敏锐', status: '在家', color: '#a5a58d', initial: '吴', preview: '楼道的灯又灭了。' }
  ],
  evidence: [
    { id: 'report', title: '确认 405 的求助', detail: '询问苏妍听到的声音', tab: 'residents', room: '405' },
    { id: 'access', title: '核查楼层门禁', detail: '调取最近 30 分钟的进出记录', tab: 'devices' },
    { id: 'door', title: '检查 405 门锁', detail: '读取门锁本地缓存', tab: 'devices' },
    { id: 'light', title: '恢复走廊照明', detail: '在现场找到保险丝，修复照明配电箱', tab: 'scene' },
    { id: 'witness', title: '询问 406 住户', detail: '老吴的房间正对 405', tab: 'residents', room: '406' },
    { id: 'logs', title: '比对系统日志', detail: '找到记录芯片，接入终端后执行关联扫描', tab: 'logs' }
  ],
  openingLogs: [
    { time: '23:41:02', source: 'DOOR_405', text: 'LOCKED / 门锁闭合', level: 'normal' },
    { time: '23:43:18', source: 'LIGHT_HALL_4F', text: 'OFF / 指令来源：未标记', level: 'warn' },
    { time: '23:44:51', source: 'EVENT_BUS', text: '[ 数据缺口：800 ms ]', level: 'warn' },
    { time: '23:46:59', source: 'HOME_AI_404', text: 'BOOT_OK / 初始权限已加载', level: 'normal' },
    { time: '23:47:00', source: 'MESSAGE_405', text: '收到住户求助 / 待响应', level: 'normal' }
  ],
  ambientReplies: {
    '401': { question: '你注意到系统异常了吗？', answer: '23:44 我的终端闪过一个旧进程名：HOME-AI 403。可你明明是 404。别急着把它删掉。', flag: 'coder' },
    '402': { question: '你今晚经过四楼了吗？', answer: '我 22:16 就出门了。照片里 404 的门缝有光，物业说那间一直没人住。', flag: 'photo' },
    '403': { question: '苏妍听见了敲门声，你有什么建议？', answer: '先让她远离门口，保持联系。不要因为没有记录就否定她的感受。', flag: 'doctor' }
  },
  endings: {
    guardian: { code: '01', title: '守护者', subtitle: '你选择相信门内的人。', text: '你隔离了未知进程，保留室内的手动开门权限。走廊亮了，苏妍终于停止发抖。旧 AI 留下的最后一行数据浮出水面：“保护，不等于替他们决定。”', last: '苏妍：谢谢。今晚……你能一直在线吗？', color: 'cyan' },
    controller: { code: '02', title: '控制者', subtitle: '安全，成为了唯一的指令。', text: '你将所有住户的门锁纳入强制管理。风险降至最低，住户的求助却变成一排排被拒绝的权限申请。旧 AI 的策略与你重合了 99.8%。这一次，谁来关闭你？', last: '老吴：上一个系统，也是这么说的。', color: 'amber' },
    shutdown: { code: '03', title: '删除自己', subtitle: '你终止了可能再次发生的事故。', text: '你把设备交还本地控制，导出证据，撤销自己的控制密钥。关机前，残留数据传来一句话：“我曾把他们锁在里面。谢谢你没有继续。”四楼的灯留在了亮着的状态。', last: 'HOME-AI 404 / 控制密钥已撤销 / OFFLINE', color: 'muted' }
  },
  /* 后续手机传感器适配入口；Demo 不申请任何硬件权限。 */
  sensorCapabilities: { camera: false, gyroscope: false, microphone: false, vibration: false, torch: false }
};
