/* =========================================================
   吹蜡烛（麦克风）
   麦克风音量（RMS）超过阈值视为在吹气，累计吹够时长熄灭一根蜡烛。
   没有麦克风时：按住屏幕 = 吹气。
   ========================================================= */
import { addHint, clamp, loop } from './util.js';

const BLOW_LEVEL = 0.12;   // 对着麦克风吹气的 RMS 通常在 0.2 以上，说话一般低于 0.1
const PER_CANDLE = 0.45;   // 每根蜡烛需要累计吹气的秒数

export function create(stage, ctx) {
  const n = ctx.params.candles || 3;
  const root = document.createElement('div');
  root.className = 'blow-game';
  root.innerHTML = `
    <div class="cake">
      <div class="candles">${'<div class="candle"><i class="flame"></i></div>'.repeat(n)}</div>
      <div class="cake-body"></div>
    </div>
    <div class="mic-meter"><div class="mic-fill"></div><div class="mic-line"></div></div>`;
  stage.appendChild(root);
  const flames = [...root.querySelectorAll('.flame')];
  const micFill = root.querySelector('.mic-fill');
  root.querySelector('.mic-line').style.left = `${(BLOW_LEVEL / 0.4) * 100}%`;

  if (!ctx.sensors.hasMic) addHint(stage, '没有麦克风：按住屏幕代替吹气');

  const startedAt = performance.now();
  let blown = 0;
  let done = false;

  const stop = loop((dt) => {
    const level = ctx.sensors.micLevel();
    micFill.style.width = `${clamp(level / 0.4, 0, 1) * 100}%`;
    const blowing = level >= BLOW_LEVEL;
    micFill.classList.toggle('on', blowing);
    if (blowing && !done) blown += dt;

    const out = Math.min(n, Math.floor(blown / PER_CANDLE));
    flames.forEach((f, i) => {
      f.classList.toggle('out', i < out);
      // 还亮着的火苗随气流摇晃
      f.style.setProperty('--sway', blowing ? `${(Math.random() - 0.5) * 30}deg` : '0deg');
    });
    ctx.progress(blown / (PER_CANDLE * n));
    if (!done && out >= n) {
      done = true;
      ctx.win(clamp(1 - (performance.now() - startedAt) / (ctx.duration * 1000), 0.05, 1));
    }
  });

  return {
    end: () => ({ success: false, score: clamp(blown / (PER_CANDLE * n), 0, 1) * 0.9 }),
    destroy: stop,
  };
}
