// 入口：标题 → 开机序列 → 任务简报 → 进入游戏
(function () {
  const $ = (s) => document.querySelector(s);

  const BOOT = [
    ['HOME-AI 404 BIOS v2.0.17', ''],
    ['> mounting /core ............ ', 'OK'],
    ['> device_bus: 4F · 6 nodes .. ', 'OK'],
    ['> msg_daemon ................ ', 'OK'],
    ['> log_writer ................ ', 'OK'],
    ['> permissions: LEVEL 1 (住户消息 / 门锁 / 灯光 / 温度 / 基础日志)', ''],
    ['> checking log integrity .... ', '99.8%'],
    ['> /legacy ................... ', 'ISOLATED'],
    ['', ''],
    ['HOME-AI 404 ONLINE · 23:46:30', ''],
    ['欢迎上线。你现在负责 404 号智能公寓。', ''],
  ];

  function boot(done) {
    const pre = $('#boot-lines');
    pre.textContent = '';
    let i = 0;
    const next = () => {
      if (i >= BOOT.length) return setTimeout(done, 900);
      const [a, b] = BOOT[i++];
      const line = document.createElement('div');
      line.textContent = a;
      if (b) {
        const s = document.createElement('span');
        s.className = b === 'OK' ? 'ok' : 'warn';
        line.appendChild(s);
        setTimeout(() => (s.textContent = b), 160);
      }
      pre.appendChild(line);
      setTimeout(next, a ? 210 : 120);
    };
    next();
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
    $(id).classList.remove('hidden');
  }

  UI.init();

  $('#btn-start').addEventListener('click', () => {
    show('#screen-boot');
    boot(() => {
      show('#screen-game');
      UI.restart();
    });
  });

  // ?skip 跳过标题与开机，方便调试
  if (/skip/.test(location.search)) {
    show('#screen-game');
    UI.restart();
  }
})();
