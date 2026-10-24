// 住户数据：只放静态设定，动态状态在 gameState 里
window.GameData = window.GameData || {};

GameData.characters = {
  '401': { id: '401', name: '林澈', job: '程序员', trait: '安静、敏感', avatar: '澈', color: '#4fa3ff', status: '在家' },
  '402': { id: '402', name: '陈雨', job: '自由摄影师', trait: '外向、好奇', avatar: '雨', color: '#ff9f5a', status: '外出' },
  '403': { id: '403', name: '周航', job: '医生', trait: '冷静、理性', avatar: '航', color: '#5ee0b0', status: '在家' },
  '404': { id: '404', name: '—', job: '', trait: '', avatar: '?', color: '#555c66', status: '空置', vacant: true },
  '405': { id: '405', name: '苏妍', job: '学生', trait: '容易紧张', avatar: '妍', color: '#ff6b9a', status: '在家' },
  '406': { id: '406', name: '老吴', job: '退休人员', trait: '话少、观察力强', avatar: '吴', color: '#c8b26a', status: '在家' },
};

GameData.roomOrder = ['401', '402', '403', '404', '405', '406'];
