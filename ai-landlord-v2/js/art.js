// 美术层：所有画面都是内联 SVG，第一视角 / 过场 / 结局 / 头像
window.Art = (function () {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ============================================================
  //  住户头像：圆底 + 头 + 发型 + 五官，用颜色与发型区分
  // ============================================================
  const FACES = {
    '403': { hair: '#26303a', skin: '#a8b3a0', style: 'short', acc: 'mask' },
    '405': { hair: '#2e2733', skin: '#b8c2b0', style: 'bob', acc: null },
    '406': { hair: '#b8b4ad', skin: '#a6b19e', style: 'bald', acc: 'glasses' },
  };

  function portrait(id, size) {
    const c = GameData.characters[id];
    const s = size || 44;
    const col = c ? c.color : '#555c66';
    if (!c || c.vacant) {
      return `<svg class="pf" viewBox="0 0 64 64" width="${s}" height="${s}">
        <circle cx="32" cy="32" r="31" fill="rgba(85,92,102,.18)" stroke="rgba(85,92,102,.6)"/>
        <text x="32" y="44" text-anchor="middle" fill="#788387" font-size="30" font-family="monospace">?</text></svg>`;
    }
    const f = FACES[id] || { hair: '#3a4654', skin: '#adb8a5', style: 'short' };
    const hair = {
      short: `<path d="M17,30 Q17,13 32,13 Q47,13 47,30 Q44,21 32,20 Q20,21 17,30 Z" fill="${f.hair}"/>`,
      long: `<path d="M14,52 Q12,16 32,14 Q52,16 50,52 Q47,26 32,22 Q17,26 14,52 Z" fill="${f.hair}"/>`,
      bob: `<path d="M16,42 Q14,14 32,13 Q50,14 48,42 Q45,24 32,21 Q19,24 16,42 Z" fill="${f.hair}"/>`,
      bald: `<path d="M20,30 Q22,20 32,20 Q42,20 44,30 Q40,24 32,24 Q24,24 20,30 Z" fill="${f.hair}"/>`,
    }[f.style] || '';
    const acc = {
      headset: `<path d="M17,26 Q16,12 32,12 Q48,12 47,26" fill="none" stroke="#7fa79b" stroke-width="2"/><rect x="12" y="26" width="6" height="10" rx="3" fill="#7fa79b"/><rect x="46" y="26" width="6" height="10" rx="3" fill="#7fa79b"/>`,
      camera: `<path d="M12,26 h6 M46,26 h6" stroke="#32423e" stroke-width="2"/><rect x="18" y="24" width="7" height="6" rx="1.4" fill="#253330"/><rect x="39" y="24" width="7" height="6" rx="1.4" fill="#253330"/>`,
      mask: `<rect x="22" y="34" width="20" height="10" rx="3" fill="rgba(255,255,255,.75)"/><path d="M22,37 h20 M22,41 h20" stroke="#b9c3c3" stroke-width=".8"/>`,
      glasses: `<circle cx="26" cy="33" r="5" fill="none" stroke="#394542" stroke-width="1.4"/><circle cx="38" cy="33" r="5" fill="none" stroke="#394542" stroke-width="1.4"/><path d="M31,33 h2" stroke="#394542" stroke-width="1.2"/>`,
    }[f.acc] || '';
    return `<svg class="pf" viewBox="0 0 64 64" width="${s}" height="${s}">
      <defs><clipPath id="pc${id}"><circle cx="32" cy="32" r="31"/></clipPath></defs>
      <circle cx="32" cy="32" r="31" fill="rgba(0,0,0,.35)"/>
      <circle cx="32" cy="32" r="31" fill="rgba(0,0,0,0)"/>
      <g clip-path="url(#pc${id})">
        <rect width="64" height="64" fill="${col}" opacity=".16"/>
        <ellipse cx="32" cy="60" rx="20" ry="16" fill="${col}" opacity=".35"/>
        <rect x="26" y="40" width="12" height="12" rx="4" fill="${f.skin}"/>
        <circle cx="32" cy="31" r="14" fill="${f.skin}"/>
        ${hair}
        <circle cx="26.5" cy="32" r="1.7" fill="#33323a"/><circle cx="37.5" cy="32" r="1.7" fill="#33323a"/>
        <path d="M29,38.5 Q32,40.5 35,38.5" stroke="#7d7f73" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        ${acc}
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke="${col}" stroke-width="2"/>
    </svg>`;
  }

  // ============================================================
  //  第一视角：4F 走廊（透视）
  // ============================================================
  const W = 360, H = 300;
  const BX1 = 150, BX2 = 210, BY1 = 110, BY2 = 170;
  const topL = (x) => (BY1 * x) / BX1;
  const botL = (x) => H - ((H - BY2) * x) / BX1;
  const flip = (x, right) => (right ? W - x : x);
  const doorQuad = (x1, x2, right) => {
    const y = (x) => topL(x) + (botL(x) - topL(x)) * 0.22;
    return [[x1, y(x1)], [x2, y(x2)], [x2, botL(x2)], [x1, botL(x1)]].map(([x, yy]) => [flip(x, right), yy]);
  };
  const quadBox = (q) => {
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };
  const pts = (q) => q.map((p) => p.join(',')).join(' ');
  const SLOTS = { near: [10, 52], mid: [74, 100], far: [118, 136] };
  const HALL_DOORS = [
    ['403', 'near', false], ['405', 'mid', false],
    ['404', 'near', true], ['406', 'mid', true],
  ];

  function hall(s) {
    // 回放对比时可以用 _cmp 覆盖画面状态（灯 / 轮痕 / 门板擦痕）
    const cmp = s._cmp || {};
    const lit = cmp.lit !== undefined ? cmp.lit : s.devices.hall.light === 'ON';
    const showTrail = cmp.trail !== undefined ? cmp.trail : lit;
    const showMarks = !!cmp.marks;
    const doors = HALL_DOORS.map(([room, slot, right]) => {
      const [x1, x2] = SLOTS[slot];
      const q = doorQuad(x1, x2, right);
      const lx = (q[0][0] + q[1][0]) / 2, ly = q[0][1] - 5;
      const ledX = right ? q[1][0] - 3 : q[1][0] + 3;
      const ledY = (q[1][1] + q[2][1]) / 2;
      const d = s.devices[room];
      const led = room === '404' ? 'led-sealed' : d.lock === 'UNLOCKED' ? 'led-open' : d.lock === 'FORCED' ? 'led-forced' : 'led-lock';
      const warm = room === '404' ? `<line x1="${q[3][0]}" y1="${q[3][1] - 1}" x2="${q[2][0]}" y2="${q[2][1] - 1}" class="s-gap-warm"/>` : '';
      // 405 门板下方的三道撞痕：只在这一帧真的发生时才有
      const scratch = (room === '405' && showMarks)
        ? `<path d="M80,228 l12,-4 M82,222 l12,-4 M84,216 l12,-4" class="s-scratch"/>` : '';
      return `<polygon points="${pts(q)}" class="s-door ${room === '404' ? 'sealed' : ''}"/>
        <text x="${lx}" y="${ly}" class="s-num" font-size="${slot === 'near' ? 9 : slot === 'mid' ? 7 : 5}">${room}</text>
        <circle cx="${ledX}" cy="${ledY}" r="${slot === 'near' ? 2 : 1.4}" class="${led}"/>${warm}${scratch}`;
    }).join('');
    const lamps = [[18, 60], [58, 34], [88, 18]]
      .map(([y, w]) => `<rect x="${W / 2 - w / 2}" y="${y}" width="${w}" height="${Math.max(2, w / 12)}" rx="1" class="s-lamp"/>`).join('');
    const trail = showTrail
      ? `<path d="M273,226 C230,222 190,214 128,191" class="s-trail"/><path d="M273,232 C228,228 188,220 126,196" class="s-trail"/>` : '';
    return `
      <polygon points="0,0 ${BX1},${BY1} ${BX1},${BY2} 0,${H}" class="s-wall"/>
      <polygon points="${W},0 ${BX2},${BY1} ${BX2},${BY2} ${W},${H}" class="s-wall"/>
      <polygon points="0,${H} ${BX1},${BY2} ${BX2},${BY2} ${W},${H}" class="s-floor"/>
      <polygon points="0,0 ${BX1},${BY1} ${BX2},${BY1} ${W},0" class="s-ceil"/>
      <rect x="${BX1}" y="${BY1}" width="${BX2 - BX1}" height="${BY2 - BY1}" class="s-back"/>
      <rect x="172" y="122" width="16" height="9" class="s-exit"/><text x="180" y="129" class="s-exit-t">EXIT</text>
      <path d="M60,300 L150,170 M300,300 L210,170" class="s-runner"/>
      ${lamps}${doors}${trail}
      <rect x="107" y="91" width="10" height="7" rx="1" class="s-sensor"/><circle cx="112" cy="94.5" r="1.3" class="s-led-r ${s.devices.hall.motion === 'IDLE' ? 'dim' : ''}"/>`;
  }


  function hallSpots(s) {
    const list = [
      { id: 'lamp', x: 140, y: 6, w: 80, h: 34, label: '走廊灯' },
      { id: 'sensor', x: 97, y: 80, w: 30, h: 28, label: '传感器' },
    ];
    HALL_DOORS.forEach(([room, slot, right]) => {
      const b = quadBox(doorQuad(...SLOTS[slot], right));
      list.push(Object.assign({ id: 'door' + room, door: room, label: room + ' 门' }, b));
    });
    list.push({ id: 'trail', x: 150, y: 196, w: 110, h: 36, label: '地毯' });
    return list;
  }

  // ============================================================
  //  第一视角：电梯厅
  // ============================================================
  function lobby() {
    return `
      <rect width="${W}" height="${H}" class="s-wall"/>
      <polygon points="0,250 ${W},250 ${W},${H} 0,${H}" class="s-floor"/>
      <line x1="0" y1="250" x2="${W}" y2="250" class="s-edge"/>
      <rect x="46" y="56" width="130" height="194" class="s-frame"/>
      <rect x="52" y="62" width="58" height="188" class="s-metal"/>
      <rect x="112" y="62" width="58" height="188" class="s-metal"/>
      <rect x="88" y="34" width="44" height="16" rx="2" class="s-screen"/>
      <text x="110" y="46" class="s-led-text">4 ■</text>
      <rect x="196" y="66" width="120" height="100" rx="3" class="s-cork"/>
      <rect x="204" y="74" width="42" height="54" class="s-paper"/>
      <rect x="252" y="76" width="50" height="38" class="s-paper"/>
      <polygon points="212,134 250,136 246,156 216,148" class="s-paper torn"/>
      <line x1="208" y1="84" x2="240" y2="84" class="s-ink"/><line x1="208" y1="92" x2="236" y2="92" class="s-ink"/>
      <line x1="256" y1="86" x2="296" y2="86" class="s-ink"/>
      <text x="336" y="200" class="s-sign">403–406 →</text>
      <polygon points="238,258 322,258 330,282 230,282" class="s-dock"/>
      <rect x="262" y="252" width="38" height="8" rx="2" class="s-dock-top"/>
      <circle cx="268" cy="271" r="2.2" class="s-led-g"/><circle cx="294" cy="271" r="2.2" class="s-led-g dim"/>`;
  }
  function lobbySpots() {
    return [
      { id: 'elevator', x: 46, y: 34, w: 130, h: 216, label: '电梯' },
      { id: 'notice', x: 196, y: 62, w: 122, h: 106, label: '公告栏' },
      { id: 'dock', x: 226, y: 246, w: 108, h: 44, label: 'R-04 充电座' },
    ];
  }

  // ============================================================
  //  过场插画
  // ============================================================
  const SCENES = {
    opening() {
      return `<svg viewBox="0 0 360 200" class="cut-art">
        <defs>
          <radialGradient id="opg" cx="50%" cy="62%" r="72%">
            <stop offset="0" stop-color="#191410"/><stop offset="1" stop-color="#080605"/></radialGradient>
          <radialGradient id="opDoor" cx="50%" cy="50%" r="60%">
            <stop offset="0" stop-color="#c7232e" stop-opacity=".55"/><stop offset="1" stop-color="#c7232e" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="360" height="200" fill="url(#opg)"/>
        <!-- 透视走廊 -->
        <polygon points="0,0 122,52 122,152 0,200" fill="#12100c"/>
        <polygon points="360,0 238,52 238,152 360,200" fill="#12100c"/>
        <polygon points="122,52 238,52 238,152 122,152" fill="#0b0806" stroke="#2a211a"/>
        <polygon points="0,200 122,152 238,152 360,200" fill="#120d0a"/>
        <!-- 左侧 405 门：半开，透出暖光 -->
        <polygon points="38,66 92,74 92,146 38,164" fill="#241d17" stroke="#32423e"/>
        <rect x="90" y="76" width="7" height="68" fill="url(#opDoor)"/>
        <rect x="92" y="74" width="3" height="72" fill="#a9d0c7" opacity=".8"/>
        <circle cx="46" cy="112" r="2.4" fill="#a8232f"/>
        <!-- 右侧门 -->
        <polygon points="322,66 268,74 268,146 322,164" fill="#1a1512" stroke="#332a23"/>
        <circle cx="312" cy="112" r="2" fill="#a8232f" opacity=".55"/>
        <!-- 尽头 EXIT -->
        <rect x="170" y="96" width="20" height="10" rx="1" fill="#25401f"/>
        <text x="180" y="104" text-anchor="middle" fill="#6f9a86" font-size="4.5" font-family="monospace">EXIT</text>
        <!-- 顶灯 -->
        <rect x="172" y="24" width="16" height="3" rx="1.5" fill="#394542"/>
        <rect x="166" y="52" width="28" height="3" rx="1.5" fill="#2f3937"/>
        <!-- 地面反光 -->
        <polygon points="96,152 120,152 108,186 76,186" fill="#a9d0c7" opacity=".07"/>
        <text x="180" y="20" text-anchor="middle" fill="#788387" font-size="9" font-family="monospace">23:46 · 4F CORRIDOR · CAM 01</text>
        <text x="180" y="192" text-anchor="middle" fill="#788387" font-size="9" font-family="monospace">405 的门开了一条缝</text>
      </svg>`;
    },
    act2() {
      // R-04 的机械眼 + 地毯轮痕
      return `<svg viewBox="0 0 360 200" class="cut-art">
        <defs><linearGradient id="a2f" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#141a1e"/><stop offset="1" stop-color="#2b221c"/></linearGradient></defs>
        <rect width="360" height="200" fill="url(#a2f)"/>
        <polygon points="0,0 110,62 250,62 360,0" fill="#241c16"/>
        <polygon points="0,0 110,62 110,62 0,200" fill="#12181c"/>
        <polygon points="360,0 250,62 250,62 360,200" fill="#12181c"/>
        <rect x="112" y="64" width="136" height="94" fill="#130e0b"/>
        <polygon points="0,200 360,200 250,158 110,158" fill="#241d18"/>
        <!-- 灯 -->
        <circle cx="180" cy="28" r="18" fill="#e2efec" opacity=".22"/>
        <ellipse cx="180" cy="26" rx="26" ry="6" fill="#e2efec" opacity=".85"/>
        <!-- 轮痕 -->
        <path d="M312,182 C250,172 196,150 142,134" stroke="#3a2f2a" stroke-width="3" fill="none" stroke-dasharray="6 5"/>
        <path d="M318,192 C254,182 200,160 146,144" stroke="#3a2f2a" stroke-width="3" fill="none" stroke-dasharray="6 5"/>
        <!-- R-04 机器人（背对镜头，正朝 405 门） -->
        <g transform="translate(196,120)">
          <ellipse cx="0" cy="34" rx="40" ry="9" fill="#000" opacity=".35"/>
          <ellipse cx="0" cy="0" rx="38" ry="26" fill="#332a23" stroke="#394542"/>
          <ellipse cx="0" cy="-6" rx="30" ry="19" fill="#2e3936"/>
          <circle cx="-11" cy="-10" r="4.4" fill="#7fa79b"/><circle cx="-11" cy="-10" r="9" fill="#7fa79b" opacity=".18"/>
          <circle cx="11" cy="-10" r="4.4" fill="#7fa79b"/><circle cx="11" cy="-10" r="9" fill="#7fa79b" opacity=".18"/>
          <rect x="-6" y="16" width="12" height="4" rx="2" fill="#a8232f" opacity=".8"/>
          <circle cx="-30" cy="22" r="5" fill="#241d17" stroke="#394542"/>
          <circle cx="30" cy="22" r="5" fill="#241d17" stroke="#394542"/>
          <path d="M-4,-28 q4,-6 8,0" stroke="#6f9a86" stroke-width="1.2" fill="none"/>
        </g>
        <text x="180" y="16" text-anchor="middle" fill="#788387" font-size="9" font-family="monospace">23:44 · CLEANING UNIT R-04</text>
        <text x="180" y="196" text-anchor="middle" fill="#929b9e" font-size="9" font-family="monospace">它撞了三下门，然后转向 404</text>
      </svg>`;
    },
    act3() {
      return `<svg viewBox="0 0 360 200" class="cut-art">
        <defs><radialGradient id="a3w" cx="50%" cy="100%" r="70%">
          <stop offset="0" stop-color="#94c5ba" stop-opacity=".55"/><stop offset="1" stop-color="#94c5ba" stop-opacity="0"/></radialGradient></defs>
        <rect width="360" height="200" fill="#0b0806"/>
        <!-- 404 门 -->
        <rect x="94" y="16" width="172" height="184" rx="3" fill="#241d18" stroke="#2e2723"/>
        <rect x="104" y="26" width="152" height="174" fill="#2b221c"/>
        <!-- 封条 -->
        <polygon points="112,40 126,28 262,180 248,192" fill="#c1caca" opacity=".5"/>
        <polygon points="248,30 262,42 128,192 114,180" fill="#c1caca" opacity=".38"/>
        <rect x="102" y="186" width="156" height="14" fill="url(#a3w)"/>
        <rect x="102" y="188" width="156" height="4" fill="#94c5ba" opacity=".85"/>
        <!-- 呼吸的指示灯 -->
        <circle cx="252" cy="60" r="3.4" fill="#a8232f"/>
        <circle cx="252" cy="60" r="9" fill="#a8232f" opacity=".16"/>
        <circle cx="252" cy="60" r="16" fill="#a8232f" opacity=".06"/>
        <!-- 门牌 -->
        <rect x="152" y="30" width="56" height="18" rx="2" fill="#89aca4" opacity=".85"/>
        <text x="180" y="44" text-anchor="middle" fill="#0b0e0f" font-size="12" font-family="monospace" font-weight="700">404</text>
        <!-- 门缝里的卡 -->
        <rect x="150" y="188" width="30" height="11" rx="1.5" fill="#cbd1d1" stroke="#6a988e" transform="rotate(-5 165 193)"/>
        <text x="165" y="196" text-anchor="middle" fill="#2f413d" font-size="5" font-family="monospace" transform="rotate(-5 165 193)">0404-01</text>
        <text x="180" y="12" text-anchor="middle" fill="#788387" font-size="9" font-family="monospace">404 · SEALED 730 天</text>
        <text x="180" y="200" text-anchor="middle" fill="#929b9e" font-size="8.5" font-family="monospace">门缝里卡着一张注销了两年的卡</text>
      </svg>`;
    },
  };

  // ============================================================
  //  结局插画
  // ============================================================
  const ENDINGS = {
    guardian() {
      return `<svg viewBox="0 0 360 200" class="end-art">
        <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#131a12"/><stop offset="1" stop-color="#05090b"/></linearGradient></defs>
        <rect width="360" height="200" fill="url(#ga)"/>
        <polygon points="0,200 360,200 250,54 110,54" fill="#20282a"/>
        <polygon points="0,0 110,54 250,54 360,0" fill="#1a2320"/>
        <rect x="112" y="56" width="136" height="100" fill="#12140f"/>
        <circle cx="180" cy="24" r="18" fill="#dbece8" opacity=".2"/>
        <circle cx="180" cy="24" r="8" fill="#dbece8" opacity=".85"/>
        <rect x="126" y="86" width="30" height="66" rx="2" fill="#2d3a34" stroke="#4c6355"/>
        <circle cx="152" cy="120" r="2.6" fill="#6f9a86"/><circle cx="152" cy="120" r="7" fill="#6f9a86" opacity=".2"/>
        <path d="M180,150 q24,-6 40,-16" stroke="#6f9a86" stroke-width="1.4" fill="none" opacity=".6"/>
        <text x="180" y="192" text-anchor="middle" fill="#6f9a86" font-size="10" font-family="monospace">走廊灯 · ON · 门锁记录公开</text>
      </svg>`;
    },
    controller() {
      let locks = '';
      for (let i = 0; i < 6; i++) {
        const x = 40 + (i % 3) * 100, y = 70 + Math.floor(i / 3) * 56;
        locks += `<rect x="${x}" y="${y}" width="72" height="40" rx="6" fill="#162320" stroke="#3b6e62"/>
          <circle cx="${x + 36}" cy="${y + 20}" r="6" fill="#9aa06a"/>
          <text x="${x + 36}" y="${y + 34}" text-anchor="middle" fill="#6daa9c" font-size="7" font-family="monospace">LOCKED</text>`;
      }
      return `<svg viewBox="0 0 360 200" class="end-art">
        <rect width="360" height="200" fill="#0f0b06"/>
        ${locks}
        <path d="M180,20 v30 M180,160 v20" stroke="#9aa06a" stroke-width="1" opacity=".4"/>
        <text x="180" y="24" text-anchor="middle" fill="#9aa06a" font-size="10" font-family="monospace">ALL PERMISSIONS · GRANTED</text>
      </svg>`;
    },
  };

  // 注意：delete 是保留字，不能用对象字面量方法名，单独赋值
  ENDINGS.delete = function () {
    let rows = '';
    for (let i = 0; i < 9; i++) {
      const op = [1, 0.85, 0.7, 0.55, 0.42, 0.3, 0.2, 0.12, 0.06][i];
      rows += `<rect x="70" y="${44 + i * 15}" width="${(220 - i * 12)}" height="4" rx="2" fill="#a8232f" opacity="${op}"/>`;
    }
    return `<svg viewBox="0 0 360 200" class="end-art">
      <rect width="360" height="200" fill="#0e0806"/>
      ${rows}
      <text x="180" y="26" text-anchor="middle" fill="#a8232f" font-size="10" font-family="monospace">DELETE /core/home-ai-404 ...</text>
      <text x="180" y="188" text-anchor="middle" fill="#96393f" font-size="9" font-family="monospace">最后一条日志：由住户本人操作</text>
    </svg>`;
  };

  const CUT_ORDER = ['opening', 'act2', 'act3'];

  // 组装
  function scene(s, view) {
    const v = view || 'hall';
    const art = v === 'lobby' ? lobby() : hall(s);
    const spots = v === 'lobby' ? lobbySpots() : hallSpots(s);
    const cmp = s._cmp || {};
    const lit = v === 'hall'
      ? (cmp.lit !== undefined ? cmp.lit : s.devices.hall.light === 'ON')
      : true;
    return { art, spots, lit };
  }

  function frame(sp, seen, using) {
    const c = 6, { x, y, w, h } = sp;
    const d = `M${x},${y + c}V${y}H${x + c} M${x + w - c},${y}H${x + w}V${y + c} M${x + w},${y + h - c}V${y + h}H${x + w - c} M${x + c},${y + h}H${x}V${y + h - c}`;
    return `<g class="hs ${seen ? 'seen' : 'fresh'} ${using ? 'using' : ''} ${sp.door ? 'door' : ''}" data-act="hs" data-id="${sp.id}" ${sp.door ? `data-door="${sp.door}"` : ''}>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" class="hs-hit"/><path d="${d}" class="hs-frame"/></g>`;
  }

  return { portrait, scene, frame, SCENES, ENDINGS, esc };
})();
