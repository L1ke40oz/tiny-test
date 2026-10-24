/* =========================================================
   找颜色 · Color Hunt —— 游戏逻辑
   纯原生 JS：getUserMedia + <video> + <canvas>，无框架、无后端、无模型。

   【为什么不需要多模态模型？】
   这个玩法只问一个问题：“取景框里的颜色是不是接近目标色？”
   这不是“识别物体”，而是“测量像素”。摄像头每一帧本来就是一组 RGB 数字，
   把中央一小块的像素平均一下、换算到 HSV、比较色相角度，
   几十行数学就能得到确定、可解释、毫秒级的结果：
     - 不用联网，不用下载几十 MB 的模型，低端手机也能 10 帧/秒稳定跑；
     - 判定规则透明，阈值可以直接调；
     - 画面不离开设备，没有隐私问题。
   模型擅长“这是什么东西”，而本游戏只关心“这是什么颜色”，用模型是杀鸡用牛刀。
   ========================================================= */
'use strict';

/* ---------------- 1. 参数配置 ---------------- */
const CONFIG = {
  ROUND_SECONDS: 10,        // 每关时长
  SAMPLE_INTERVAL_MS: 100,  // 抽帧间隔：约 10 次/秒
  HOLD_MS: 500,             // 需要持续匹配多久才算成功
  GRACE_MS: 150,            // 容忍单帧抖动：连续“不匹配”超过此时长才清零
  MATCH_THRESHOLD: 0.6,     // 匹配度 >= 60% 视为“接近”
  SAMPLE_RATIO: 0.6,        // 只分析取景框直径 60% 的中心圆（对应虚线圈）
  SAMPLE_SIZE: 32,          // 取色区域缩放到 32x32 像素再计算，既快又能平滑噪点
  SV_SOFT_BAND: 0.12,       // 饱和度/亮度低于下限时，在这段区间内平滑衰减而不是一刀切
};

/* ---------------- 2. 目标颜色与阈值设计 ----------------
   为什么用 HSV 而不是 RGB？
   - RGB 三个通道都受光照影响：同一件红衣服在阴影里是 (120,20,25)，在阳光下是 (240,60,70)，
     RGB 距离差很远，但人眼都认为是“红色”。
   - HSV 把颜色拆成 色相 H（是什么颜色，0~360°）、饱和度 S（多鲜艳）、明度 V（多亮）。
     光照变化主要改变 S 和 V，H 相对稳定 —— 所以主要看 H，S/V 只做“兜底”下限。

   每个颜色的参数：
   - hue      色相中心（度）。按手机摄像头实拍的经验值，而不是理论值（如黄色实拍常在 50~58°）。
   - hueCore  中心 ±hueCore 内匹配度 = 100%（“肯定是这个颜色”）
   - hueFall  再往外 hueFall 度线性降到 0%。配合 60% 阈值，实际接受范围约为
              ±(hueCore + 0.4 * hueFall)，例如红色约 337°~23°，绿色约 79°~171°。
   - sMin     饱和度下限：太灰的不算（排除白墙、灰地面）。
              红/橙的 sMin 更高：人的皮肤（手经常入镜）色相在 15~25°、饱和度约 0.3~0.4，
              不抬高下限会被误判为红/橙。
   - vMin     明度下限：太暗的不算（暗处任何颜色都接近黑色）。
              黄/橙的 vMin 更高，因为暗黄 = 橄榄色、暗橙 = 棕色，人眼不会叫它黄/橙。
   绿、蓝在色环上占的范围大，所以 hueCore 更宽；橙、黄夹在红绿之间，范围窄。
   不同目标的范围有少量重叠（如偏红的橙色），这是有意的：只要“人眼觉得差不多”就放行。 */
const TARGETS = [
  { id: 'red',    name: '红色', swatch: '#e53935', hue: 0,   hueCore: 14, hueFall: 22, sMin: 0.45, vMin: 0.25 },
  { id: 'orange', name: '橙色', swatch: '#fb8c00', hue: 28,  hueCore: 9,  hueFall: 12, sMin: 0.50, vMin: 0.50 },
  { id: 'yellow', name: '黄色', swatch: '#fdd835', hue: 54,  hueCore: 11, hueFall: 12, sMin: 0.35, vMin: 0.45 },
  { id: 'green',  name: '绿色', swatch: '#43a047', hue: 125, hueCore: 38, hueFall: 20, sMin: 0.22, vMin: 0.18 },
  { id: 'blue',   name: '蓝色', swatch: '#1e88e5', hue: 215, hueCore: 28, hueFall: 18, sMin: 0.25, vMin: 0.18 },
];

/* ---------------- 3. DOM 引用 ---------------- */
const $ = (id) => document.getElementById(id);
const el = {
  startScreen: $('start-screen'),
  btnStart: $('btn-start'),
  startError: $('start-error'),
  gameScreen: $('game-screen'),
  video: $('camera'),
  canvas: $('sampler'),
  levelNum: $('level-num'),
  targetSwatch: $('target-swatch'),
  targetName: $('target-name'),
  timer: $('timer'),
  timerNum: $('timer-num'),
  timerFill: $('timer-fill'),
  reticle: $('reticle'),
  ringProgress: $('ring-progress'),
  currentSwatch: $('current-swatch'),
  currentName: $('current-name'),
  matchPct: $('match-pct'),
  matchFill: $('match-fill'),
  matchThreshold: $('match-threshold'),
  rgbText: $('rgb-text'),
  hsvText: $('hsv-text'),
  flash: $('flash'),
  result: $('result'),
  resultCard: $('result-card'),
  resultIcon: $('result-icon'),
  resultTitle: $('result-title'),
  resultDesc: $('result-desc'),
  btnNext: $('btn-next'),
  btnRetry: $('btn-retry'),
  btnSkip: $('btn-skip'),
};

// willReadFrequently：告诉浏览器我们会频繁 getImageData，让画布留在 CPU 内存，读取更快
el.canvas.width = CONFIG.SAMPLE_SIZE;
el.canvas.height = CONFIG.SAMPLE_SIZE;
const ctx = el.canvas.getContext('2d', { willReadFrequently: true });

const RING_LENGTH = 2 * Math.PI * 46; // 与 SVG 圆半径 r=46 对应

/* ---------------- 4. 游戏状态 ---------------- */
const state = {
  stream: null,
  phase: 'idle',      // idle | playing | success | fail
  level: 1,
  target: null,
  timeLeft: CONFIG.ROUND_SECONDS,
  holdStart: null,    // 本次连续匹配开始的时间
  lastMatchAt: 0,     // 最近一次匹配成功的时间（用于抖动容忍）
  lastFrameAt: 0,
  lastSampleAt: 0,
  loopStarted: false,
};

/* =========================================================
   5. 摄像头
   ========================================================= */

/**
 * 调用后置摄像头。
 *
 * getUserMedia 的 constraints 说明：
 * - facingMode: 'environment' 表示后置摄像头（'user' 是前置）。
 *   这里用 { ideal: 'environment' } 而不是 { exact: ... }：
 *   ideal 是“尽量满足”，在只有前置摄像头的设备（如笔记本）上会自动退回前置，不会直接报错；
 *   exact 则在没有后置摄像头时抛 OverconstrainedError。
 * - width/height 用 ideal 720p：足够取色，又不至于让低端机发热。
 * - audio: false：不需要麦克风，也避免多弹一次权限框。
 *
 * 注意：getUserMedia 只在“安全上下文”可用（HTTPS 或 localhost），
 * 用 http://IP 访问时 navigator.mediaDevices 直接是 undefined。
 */
async function openCamera() {
  if (!window.isSecureContext) {
    throw makeError('InsecureContext');
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    throw makeError('Unsupported');
  }

  // 预先检查是否有摄像头（授权前也能拿到设备种类，只是没有名称）
  if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (devices.length > 0 && !devices.some((d) => d.kind === 'videoinput')) {
        throw makeError('NotFoundError');
      }
    } catch (err) {
      if (err.name === 'NotFoundError') throw err;
      // 枚举失败不影响后续流程，交给 getUserMedia 自己判断
    }
  }

  const preferred = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferred);
  } catch (err) {
    // 个别老设备不接受分辨率约束，退回最宽松的 { video: true } 再试一次
    if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    throw err;
  }
}

function makeError(name) {
  const err = new Error(name);
  err.name = name;
  return err;
}

/** 把各种异常翻译成用户看得懂的提示 */
function describeCameraError(err) {
  switch (err && err.name) {
    case 'InsecureContext':
      return '当前页面不是 HTTPS 地址，浏览器禁止使用摄像头。请通过 https:// 开头的网址打开本页面。';
    case 'Unsupported':
      return '你的浏览器不支持调用摄像头。请使用最新版的 Chrome、Safari 或系统自带浏览器打开（部分 App 内置浏览器不支持）。';
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return '摄像头权限被拒绝了。请在浏览器的“网站设置 / 权限”里允许本网站使用摄像头，然后刷新页面再试。';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return '没有找到可用的摄像头。请确认设备有摄像头，或换一台手机试试。';
    case 'NotReadableError':
    case 'TrackStartError':
      return '摄像头正被其他应用占用（例如相机、视频通话）。请关闭它们后再试。';
    case 'AbortError':
      return '摄像头启动被中断了，请再试一次。';
    case 'TrackEnded':
      return '摄像头连接已断开，请重新开始。';
    default:
      return '摄像头启动失败（' + ((err && err.name) || '未知错误') + '），请刷新页面再试。';
  }
}

async function handleStart() {
  el.btnStart.disabled = true;
  el.btnStart.textContent = '正在打开摄像头…';
  el.startError.hidden = true;

  try {
    const stream = await openCamera();
    state.stream = stream;

    // 摄像头被系统收回（权限撤销、被其他应用抢占）时回到开始页
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => showStartError(makeError('TrackEnded')));
    });

    el.video.srcObject = stream;
    el.startScreen.hidden = true;
    el.gameScreen.hidden = false;
    await el.video.play();
    await waitForVideoFrame(el.video);

    startRound(false);
    if (!state.loopStarted) {
      state.loopStarted = true;
      requestAnimationFrame(loop);
    }
  } catch (err) {
    console.error(err);
    showStartError(err);
  }
}

/** 等到 video 真正有画面（有宽高、readyState >= HAVE_CURRENT_DATA）再开始计时 */
function waitForVideoFrame(video) {
  if (video.videoWidth > 0 && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('loadeddata', done);
      resolve();
    };
    video.addEventListener('loadeddata', done);
  });
}

function showStartError(err) {
  stopCamera();
  state.phase = 'idle';
  el.gameScreen.hidden = true;
  el.result.hidden = true;
  el.startScreen.hidden = false;
  el.startError.textContent = describeCameraError(err);
  el.startError.hidden = false;
  el.btnStart.disabled = false;
  el.btnStart.textContent = '重试';
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  el.video.srcObject = null;
}

/* =========================================================
   6. 抽帧与取色
   ========================================================= */

/**
 * 从 video 抽取一帧中“取景框中心区域”，返回平均颜色 {r,g,b}。
 *
 * 【如何从 video 抽帧到 canvas】
 * ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh) 会把 video 当前显示的那一帧
 * 的 (sx,sy,sw,sh) 区域画到 canvas 的 (dx,dy,dw,dh)。
 * 我们只截取中央那一小块，并且直接缩小到 32x32 —— 缩放时浏览器会对像素做插值，
 * 顺便起到降噪作用，后续只需遍历 1024 个像素，非常省电。
 *
 * 【屏幕坐标 → 视频坐标】
 * 视频是 object-fit: cover 铺满屏幕的，画面被等比放大并裁掉了两边（或上下）。
 * cover 的缩放比例 = max(元素宽/视频宽, 元素高/视频高)，
 * 画面在元素里居中，所以 屏幕坐标 = 视频坐标 * scale + 偏移。反算即可得到取景框
 * 在原始视频帧里的位置和大小，保证“框里看到的”就是“实际分析的”。
 */
function sampleCenterColor() {
  const video = el.video;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return null;

  const vRect = video.getBoundingClientRect();
  const rRect = el.reticle.getBoundingClientRect();

  const scale = Math.max(vRect.width / vw, vRect.height / vh);
  const offsetX = (vRect.width - vw * scale) / 2;   // cover 裁切后为负数
  const offsetY = (vRect.height - vh * scale) / 2;

  // 取景框中心（相对 video 元素）→ 视频帧坐标
  const cx = (rRect.left + rRect.width / 2 - vRect.left - offsetX) / scale;
  const cy = (rRect.top + rRect.height / 2 - vRect.top - offsetY) / scale;
  // 只取直径 60% 的中心区域，避免框边缘混入背景色
  const size = Math.min(rRect.width * CONFIG.SAMPLE_RATIO / scale, vw, vh);

  const sx = clamp(cx - size / 2, 0, vw - size);
  const sy = clamp(cy - size / 2, 0, vh - size);

  const N = CONFIG.SAMPLE_SIZE;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, N, N);

  let data;
  try {
    data = ctx.getImageData(0, 0, N, N).data; // [r,g,b,a, r,g,b,a, ...]
  } catch (e) {
    return null;
  }

  /* 【如何计算取景区域平均颜色】
     取景区域是圆形，所以只累加落在内切圆里的像素（方形四角会混入背景），
     然后 R、G、B 各自求算术平均。 */
  const radius = N / 2;
  const r2 = radius * radius;
  let r = 0, g = 0, b = 0, count = 0;
  for (let y = 0; y < N; y++) {
    const dy = y + 0.5 - radius;
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - radius;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * N + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  if (count === 0) return null;
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

/* =========================================================
   7. 颜色数学
   ========================================================= */

/**
 * RGB → HSV
 * 输入 r,g,b ∈ [0,255]；输出 h ∈ [0,360)，s,v ∈ [0,1]。
 * - V（明度）= 三通道最大值：最亮的那个通道决定整体亮度
 * - S（饱和度）= (max - min) / max：三个通道差得越多越鲜艳，全相等就是灰色
 * - H（色相）= 看哪个通道最大，在色环的对应 120° 扇区内按另外两个通道的差值插值：
 *     R 最大 → 红色附近（0°），G 最大 → 绿色附近（120°），B 最大 → 蓝色附近（240°）
 */
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** 色环上两个角度的最短距离（考虑 359° 和 1° 只差 2°） */
function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 低于下限 min 时在 [min - band, min] 区间平滑地从 1 降到 0 */
function softFloor(value, min) {
  return clamp((value - (min - CONFIG.SV_SOFT_BAND)) / CONFIG.SV_SOFT_BAND, 0, 1);
}

/**
 * 计算当前颜色与目标的匹配度 0~1。
 * 匹配度 = 色相得分 × 饱和度系数 × 明度系数
 * - 色相是主要依据：中心 ±hueCore 满分，之后线性下降
 * - 饱和度/明度只要“够鲜艳、够亮”就是 1，不追求和色块一模一样
 *   （摄像头的自动曝光/白平衡会让颜色普遍偏淡，所以下限设得比较宽容）
 */
function matchScore(hsv, target) {
  const dh = hueDistance(hsv.h, target.hue);
  const hueScore = clamp(1 - Math.max(0, dh - target.hueCore) / target.hueFall, 0, 1);
  return hueScore * softFloor(hsv.s, target.sMin) * softFloor(hsv.v, target.vMin);
}

/** 给当前颜色起一个通俗名字（仅用于展示，不参与判定） */
function describeColor({ h, s, v }) {
  if (v < 0.18) return '黑色';
  if (s < 0.15) return v > 0.78 ? '白色' : '灰色';
  if (s < 0.25 && v < 0.5) return '灰色';
  if (h < 15 || h >= 340) return s < 0.45 && v > 0.7 ? '粉色' : '红色';
  if (h < 40) return v < 0.5 ? '棕色' : s < 0.45 ? '米色' : '橙色';
  if (h < 70) return v < 0.45 ? '橄榄色' : '黄色';
  if (h < 165) return '绿色';
  if (h < 190) return '青色';
  if (h < 255) return '蓝色';
  if (h < 290) return '紫色';
  return '品红色';
}

function clamp(x, min, max) {
  return Math.min(max, Math.max(min, x));
}

/* =========================================================
   8. 主循环与判定
   ========================================================= */

/**
 * requestAnimationFrame 驱动的主循环：
 * - 每帧更新倒计时（顺滑）
 * - 每 ~100ms 抽一次帧取色（省电）
 * 切到后台时浏览器会暂停 rAF，dt 被限制在 200ms 内，所以倒计时会自然“暂停”。
 */
function loop(now) {
  requestAnimationFrame(loop);

  const dt = state.lastFrameAt ? Math.min(now - state.lastFrameAt, 200) : 0;
  state.lastFrameAt = now;

  if (state.phase === 'playing') {
    state.timeLeft = Math.max(0, state.timeLeft - dt / 1000);
    renderTimer();
  }

  if (now - state.lastSampleAt >= CONFIG.SAMPLE_INTERVAL_MS) {
    state.lastSampleAt = now;
    sampleAndJudge(now);
  }

  // 放在取色之后：最后一刻刚好对准也算成功
  if (state.phase === 'playing' && state.timeLeft <= 0) {
    endRound(false);
  }
}

function sampleAndJudge(now) {
  if (state.phase === 'idle') return;
  const rgb = sampleCenterColor();
  if (!rgb) return;

  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const score = matchScore(hsv, state.target);
  const matched = score >= CONFIG.MATCH_THRESHOLD;

  renderReadout(rgb, hsv, score, matched);

  if (state.phase !== 'playing') return;

  /* 持续匹配判定：
     - 匹配时记录开始时间，之后每次匹配刷新 lastMatchAt
     - 不匹配超过 GRACE_MS（约 1~2 帧）才清零，防止手抖一帧就前功尽弃
     - 连续匹配 >= HOLD_MS 才成功 → 镜头快速扫过不会误判 */
  if (matched) {
    if (state.holdStart === null) state.holdStart = now;
    state.lastMatchAt = now;
  } else if (state.holdStart !== null && now - state.lastMatchAt > CONFIG.GRACE_MS) {
    state.holdStart = null;
  }

  const held = state.holdStart === null ? 0 : now - state.holdStart;
  setRingProgress(held / CONFIG.HOLD_MS);

  if (matched && held >= CONFIG.HOLD_MS) {
    endRound(true);
  }
}

/* =========================================================
   9. 关卡流程
   ========================================================= */

function pickTarget(exclude) {
  const pool = TARGETS.filter((t) => t !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 开始一关。keepColor = true 时沿用当前颜色（失败后重试） */
function startRound(keepColor) {
  if (!keepColor || !state.target) {
    state.target = pickTarget(state.target);
  }
  state.timeLeft = CONFIG.ROUND_SECONDS;
  state.holdStart = null;
  state.lastMatchAt = 0;
  state.phase = 'playing';

  document.documentElement.style.setProperty('--target', state.target.swatch);
  el.targetName.textContent = state.target.name;
  el.levelNum.textContent = state.level;
  el.result.hidden = true;
  el.flash.classList.remove('on');
  setRingProgress(0);
  renderTimer();
}

function endRound(success) {
  state.phase = success ? 'success' : 'fail';
  setRingProgress(success ? 1 : 0);

  el.resultCard.classList.toggle('is-success', success);
  el.resultCard.classList.toggle('is-fail', !success);
  el.resultIcon.textContent = success ? '✓' : '✕';
  el.resultTitle.textContent = success ? '挑战成功' : '时间到';
  el.resultDesc.textContent = success
    ? '用时 ' + (CONFIG.ROUND_SECONDS - state.timeLeft).toFixed(1) + ' 秒找到了' + state.target.name + '！'
    : '没能在 ' + CONFIG.ROUND_SECONDS + ' 秒内找到' + state.target.name + '，再试一次？';
  el.btnNext.hidden = !success;
  el.btnRetry.hidden = success;
  el.btnSkip.hidden = success;
  el.result.hidden = false;

  if (success) {
    // 重新触发闪光动画：先移除 class，强制回流，再加回来
    el.flash.classList.remove('on');
    void el.flash.offsetWidth;
    el.flash.classList.add('on');
    vibrate(200);
  } else {
    vibrate([60, 60, 60]);
  }
}

/** 震动：iOS Safari 等不支持 navigator.vibrate，静默跳过，不报错 */
function vibrate(pattern) {
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch (e) {
    /* 忽略 */
  }
}

/* =========================================================
   10. 渲染
   ========================================================= */

function renderTimer() {
  el.timerNum.textContent = Math.ceil(state.timeLeft);
  el.timerFill.style.transform = 'scaleX(' + state.timeLeft / CONFIG.ROUND_SECONDS + ')';
  el.timer.classList.toggle('urgent', state.phase === 'playing' && state.timeLeft <= 3);
}

function renderReadout(rgb, hsv, score, matched) {
  const pct = Math.round(score * 100);
  el.currentSwatch.style.background = 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
  // 达到匹配时直接显示目标名，避免“判定是红色、名字却写橙色”这种边界情况让玩家困惑
  el.currentName.textContent = matched ? state.target.name : describeColor(hsv);
  el.matchPct.textContent = pct;
  el.matchFill.style.width = pct + '%';
  el.matchFill.classList.toggle('is-match', matched);
  el.reticle.classList.toggle('is-match', matched && state.phase === 'playing');
  el.rgbText.textContent = 'RGB ' + rgb.r + ',' + rgb.g + ',' + rgb.b;
  el.hsvText.textContent =
    'HSV ' + Math.round(hsv.h) + '°,' + Math.round(hsv.s * 100) + '%,' + Math.round(hsv.v * 100) + '%';
}

function setRingProgress(p) {
  p = clamp(p, 0, 1);
  el.ringProgress.style.strokeDashoffset = RING_LENGTH * (1 - p);
  // 圆头线帽在长度为 0 时仍会画出一个点，进度为 0 时直接隐藏
  el.ringProgress.style.opacity = p > 0 ? 1 : 0;
}

/* =========================================================
   11. 事件绑定
   ========================================================= */

el.matchThreshold.style.left = CONFIG.MATCH_THRESHOLD * 100 + '%';

el.btnStart.addEventListener('click', handleStart);
el.btnNext.addEventListener('click', () => {
  state.level += 1;
  startRound(false);
});
el.btnRetry.addEventListener('click', () => startRound(true));
el.btnSkip.addEventListener('click', () => startRound(false));

// 从后台切回来时，部分手机（尤其 iOS）会暂停视频，这里尝试恢复播放
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.stream && el.video.paused) {
    el.video.play().catch(() => {});
  }
});

// 打开页面时就提前提示明显不可用的环境，省得用户点了按钮才发现
if (!window.isSecureContext) {
  el.startError.textContent = describeCameraError(makeError('InsecureContext'));
  el.startError.hidden = false;
} else if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
  el.startError.textContent = describeCameraError(makeError('Unsupported'));
  el.startError.hidden = false;
}
