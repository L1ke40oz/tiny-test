// 现场画面：R-04 视角的场景插画 + 可点击热点（只负责“画”，规则在 Engine）
window.Scene = (function () {
  const W = 360, H = 300;

  // ---------- 走廊透视 ----------
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
    ['401', 'near', false], ['403', 'mid', false], ['405', 'far', false],
    ['402', 'near', true], ['404', 'mid', true], ['406', 'far', true],
  ];

  // ---------- 每个场景：画面 + 热点几何 ----------
  const nodes = {
    lobby: {
      art: () => `
        <rect width="${W}" height="${H}" class="s-wall"/>
        <polygon points="0,250 ${W},250 ${W},${H} 0,${H}" class="s-floor"/>
        <line x1="0" y1="250" x2="${W}" y2="250" class="s-edge"/>
        <rect x="50" y="60" width="125" height="190" class="s-frame"/>
        <rect x="56" y="66" width="56" height="184" class="s-metal"/>
        <rect x="113" y="66" width="56" height="184" class="s-metal"/>
        <rect x="92" y="38" width="40" height="16" rx="2" class="s-screen"/>
        <text x="112" y="50" class="s-led-text">4 ■</text>
        <rect x="183" y="150" width="8" height="18" rx="2" class="s-frame"/>
        <rect x="210" y="70" width="110" height="95" rx="3" class="s-cork"/>
        <rect x="218" y="78" width="40" height="52" class="s-paper"/>
        <rect x="264" y="80" width="48" height="36" class="s-paper"/>
        <polygon points="226,136 262,138 258,158 230,150" class="s-paper torn"/>
        <line x1="222" y1="88" x2="252" y2="88" class="s-ink"/><line x1="222" y1="96" x2="248" y2="96" class="s-ink"/>
        <line x1="268" y1="90" x2="304" y2="90" class="s-ink"/>
        <text x="330" y="205" class="s-sign">401–406 →</text>
        <polygon points="240,262 320,262 328,284 232,284" class="s-dock"/>
        <rect x="262" y="256" width="36" height="8" rx="2" class="s-dock-top"/>
        <circle cx="268" cy="274" r="2.2" class="s-led-g"/><circle cx="292" cy="274" r="2.2" class="s-led-g dim"/>`,
      spots: [
        { id: 'elevator', x: 50, y: 40, w: 125, h: 210 },
        { id: 'notice', x: 206, y: 66, w: 118, h: 102 },
        { id: 'dock', x: 228, y: 248, w: 106, h: 42 },
      ],
      dim: true,
    },

    hall: {
      art: (s) => {
        const lit = s.devices.hall.light === 'ON';
        const doors = HALL_DOORS.map(([room, slot, right]) => {
          const [x1, x2] = SLOTS[slot];
          const q = doorQuad(x1, x2, right);
          const lx = (q[0][0] + q[1][0]) / 2, ly = q[0][1] - 5;
          const ledX = right ? q[1][0] - 3 : q[1][0] + 3;
          const ledY = (q[1][1] + q[2][1]) / 2;
          const d = s.devices[room];
          const led = room === '404' ? 'led-sealed' : d.lock === 'UNLOCKED' ? 'led-open' : d.lock === 'FORCED' ? 'led-forced' : 'led-lock';
          const glow = !lit && (room === '401' || room === '406')
            ? `<line x1="${q[3][0]}" y1="${q[3][1] - 1}" x2="${q[2][0]}" y2="${q[2][1] - 1}" class="s-gap-blue"/>` : '';
          const warm = room === '404' ? `<line x1="${q[3][0]}" y1="${q[3][1] - 1}" x2="${q[2][0]}" y2="${q[2][1] - 1}" class="s-gap-warm"/>` : '';
          return `<polygon points="${pts(q)}" class="s-door ${room === '404' ? 'sealed' : ''}"/>
            <text x="${lx}" y="${ly}" class="s-num" font-size="${slot === 'near' ? 9 : slot === 'mid' ? 7 : 5}">${room}</text>
            <circle cx="${ledX}" cy="${ledY}" r="${slot === 'near' ? 2 : 1.4}" class="${led}"/>${glow}${warm}`;
        }).join('');
        const lamps = [[18, 60], [58, 34], [88, 18]]
          .map(([y, w]) => `<rect x="${W / 2 - w / 2}" y="${y}" width="${w}" height="${Math.max(2, w / 12)}" rx="1" class="s-lamp"/>`).join('');
        const trail = lit
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
      },
      spots: () => {
        const list = [
          { id: 'lamp', x: 140, y: 6, w: 80, h: 34 },
          { id: 'sensor', x: 97, y: 80, w: 30, h: 28 },
        ];
        HALL_DOORS.forEach(([room, slot, right]) => {
          const b = quadBox(doorQuad(...SLOTS[slot], right));
          const go = room === '404' || room === '405' ? 'door' + room : null;
          list.push(Object.assign({ id: go ? 'go_' + room : 'd' + room, go }, b));
        });
        list.push({ id: 'trail', x: 150, y: 198, w: 110, h: 34 });
        return list;
      },
    },

    door405: {
      art: (s) => {
        const lock = s.devices['405'].lock;
        const led = lock === 'UNLOCKED' ? 'led-open' : lock === 'FORCED' ? 'led-forced' : 'led-lock';
        return `${closeDoor('405', false)}
          <rect x="232" y="135" width="24" height="48" rx="3" class="s-panel"/>
          <circle cx="244" cy="148" r="3.2" class="${led}"/><rect x="237" y="158" width="14" height="18" rx="1" class="s-screen"/>
          <circle cx="180" cy="100" r="5" class="s-peep"/><circle cx="180" cy="100" r="2" class="s-peep-in"/>
          <path d="M146,252 l14,-5 M164,256 l14,-5 M182,260 l14,-5" class="s-scratch"/>
          ${s.devices.hall.light === 'ON' ? '<path d="M110,296 Q170,286 250,290 M110,292 Q170,282 250,286" class="s-trail"/>' : ''}`;
      },
      spots: [
        { id: 'peep405', x: 164, y: 84, w: 32, h: 32 },
        { id: 'panel405', x: 226, y: 128, w: 36, h: 62 },
        { id: 'marks405', x: 136, y: 238, w: 70, h: 32 },
        { id: 'mat405', x: 86, y: 280, w: 188, h: 20 },
      ],
    },

    door404: {
      art: (s) => `${closeDoor('404', true)}
        <polygon points="98,52 112,40 262,232 248,246" class="s-tape"/>
        <polygon points="248,40 262,52 116,240 102,226" class="s-tape"/>
        <polygon points="196,160 226,190 232,185 205,154" class="s-tape torn"/>
        <text x="180" y="146" class="s-tape-t">封</text>
        <rect x="232" y="135" width="24" height="48" rx="3" class="s-panel"/>
        <circle cx="244" cy="148" r="3.2" class="led-breath"/>
        <text x="244" y="172" class="s-tiny">SEALED</text>
        <rect x="95" y="279" width="170" height="4" class="s-gap-warm2"/>
        ${s.items.includes('card404') ? '' : '<rect x="150" y="281" width="26" height="9" rx="1" transform="rotate(-6 163 285)" class="s-card"/>'}`,
      spots: [
        { id: 'plate404', x: 150, y: 28, w: 60, h: 30 },
        { id: 'seal404', x: 112, y: 62, w: 110, h: 140 },
        { id: 'panel404', x: 226, y: 128, w: 36, h: 62 },
        { id: 'gap404', x: 92, y: 268, w: 176, h: 28 },
      ],
    },
  };

  function closeDoor(num, sealed) {
    return `
      <rect width="${W}" height="${H}" class="s-wall"/>
      <rect x="0" y="282" width="${W}" height="18" class="s-floor"/>
      <rect x="86" y="6" width="188" height="278" class="s-frame"/>
      <rect x="95" y="12" width="170" height="270" class="s-door-big ${sealed ? 'sealed' : ''}"/>
      <rect x="110" y="200" width="140" height="70" class="s-kick"/>
      <rect x="155" y="34" width="50" height="20" rx="2" class="s-plate"/>
      <text x="180" y="49" class="s-plate-t">${num}</text>
      <rect x="222" y="165" width="8" height="30" rx="3" class="s-handle"/>`;
  }

  // 热点：四角取景框
  function spot(sp, s, using) {
    const examined = s.scene.examined[sp.id] || (sp.go && s.scene.visited[sp.go]);
    const c = 6, { x, y, w, h } = sp;
    const d = `M${x},${y + c}V${y}H${x + c} M${x + w - c},${y}H${x + w}V${y + c} M${x + w},${y + h - c}V${y + h}H${x + w - c} M${x + c},${y + h}H${x}V${y + h - c}`;
    return `<g class="hs ${examined ? 'seen' : 'fresh'} ${using ? 'using' : ''} ${sp.go ? 'go' : ''}" data-act="hs" data-id="${sp.id}" ${sp.go ? `data-go="${sp.go}"` : ''}>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" class="hs-hit"/><path d="${d}" class="hs-frame"/></g>`;
  }

  // 整个场景 SVG
  function svg(s) {
    const n = nodes[s.scene.node];
    const dark = s.devices.hall.light !== 'ON';
    const raw = typeof n.spots === 'function' ? n.spots() : n.spots;
    const spots = raw.filter((sp) => sp.go || Engine.hotspotVisible(sp.id));
    return `
      <svg viewBox="0 0 ${W} ${H}" class="scene-svg ${dark ? 'dark' : 'lit'} node-${s.scene.node}">
        <defs>
          <radialGradient id="vig" cx="50%" cy="100%" r="85%">
            <stop offset="0" stop-color="#000" stop-opacity="0"/>
            <stop offset=".35" stop-color="#000" stop-opacity=".35"/>
            <stop offset="1" stop-color="#000" stop-opacity="${n.dim ? 0.55 : 0.93}"/>
          </radialGradient>
        </defs>
        ${n.art(s)}
        ${dark ? `<rect width="${W}" height="${H}" fill="url(#vig)" pointer-events="none"/>
          <ellipse cx="180" cy="${H - 10}" rx="140" ry="46" class="s-beam" pointer-events="none"/>` : ''}
        ${spots.map((sp) => spot(sp, s, !!s.selItem && !sp.go)).join('')}
      </svg>`;
  }

  return { svg };
})();
