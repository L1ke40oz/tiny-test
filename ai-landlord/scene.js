/* 可交互场景：SVG 负责空间与物体，HTML 热区保证触屏/键盘可用。 */
window.Scene404 = (() => {
  const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defs = `<defs>
    <linearGradient id="back" x2="0" y2="1"><stop stop-color="#303b39"/><stop offset="1" stop-color="#1a2526"/></linearGradient>
    <linearGradient id="left" x2="1" y2=".5"><stop stop-color="#101b20"/><stop offset="1" stop-color="#354341"/></linearGradient>
    <linearGradient id="right" x2="0" y2="1"><stop stop-color="#243431"/><stop offset="1" stop-color="#0e191d"/></linearGradient>
    <linearGradient id="ground" x2="0" y2="1"><stop stop-color="#343a34"/><stop offset="1" stop-color="#101b23"/></linearGradient>
    <linearGradient id="door" x2="1" y2="1"><stop stop-color="#65584b"/><stop offset="1" stop-color="#2c2f2d"/></linearGradient>
    <linearGradient id="lightBeam" x2="0" y2="1"><stop stop-color="#f1d89a" stop-opacity=".32"/><stop offset="1" stop-color="#f1d89a" stop-opacity="0"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#f3d291" stop-opacity=".55"/><stop offset="1" stop-color="#efc77e" stop-opacity="0"/></radialGradient>
    <pattern id="noise" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".5" fill="#b9c7b2" opacity=".14"/><circle cx="5" cy="4" r=".5" fill="#000" opacity=".3"/></pattern>
    <pattern id="tiles" width="76" height="76" patternUnits="userSpaceOnUse"><path d="M0 0h76v76H0z" fill="none" stroke="#64716a" stroke-opacity=".13"/></pattern>
    <pattern id="rain" width="38" height="62" patternUnits="userSpaceOnUse"><path d="m7 4-2 18m22 9-2 14" stroke="#89b8c9" opacity=".3"/></pattern>
    <filter id="blur"><feGaussianBlur stdDeviation="15"/></filter>
  </defs>`;
  const svg = content => `<svg class="environment-art" viewBox="0 0 900 700" preserveAspectRatio="none" aria-hidden="true">${defs}${content}</svg>`;
  function hall(s) {
    const p=s.scene, lit=s.hallLight;
    return svg(`
      <rect width="900" height="700" fill="#0c1318"/>
      <path d="M0 0 200 140H700L900 0" fill="#111b20"/>
      <path d="M0 0 200 140V490L0 700" fill="url(#left)"/>
      <path d="M900 0 700 140V490L900 700" fill="url(#right)"/>
      <path d="M200 140H700V490H200" fill="url(#back)"/>
      <path d="M0 700 200 490H700L900 700" fill="url(#ground)"/>
      <path d="M0 700 200 490H700L900 700" fill="url(#tiles)"/>
      <g stroke="#617568" stroke-opacity=".13"><path d="M450 490v210M300 490 200 700M600 490 700 700M150 550h600M90 610h720M30 670h840"/></g>
      <path d="M0 555 200 442M900 555 700 442M200 442H700" stroke="#728077" opacity=".2"/>
      <path d="M0 568 200 451M900 568 700 451M200 451H700" stroke="#0d171a" stroke-width="7"/>
      <g class="main-lamp"><path d="M358 67h184l-24 24H382z" fill="#7c897b" stroke="#a5afa0"/><path d="M381 77h137l-9 9H390z" fill="${lit?'#f5dfad':'#394b47'}"/>
      ${lit?'<ellipse cx="450" cy="88" rx="130" ry="60" fill="url(#glow)" filter="url(#blur)"/><path d="m390 88-150 500h420L510 88" fill="url(#lightBeam)"/>':''}</g>
      <g><path d="m25 174 151 56v307L25 610z" fill="#111b1d" stroke="#778078" stroke-width="5"/><path d="m34 190 132 47v293L34 591z" fill="url(#door)"/><path d="m46 209 75 29v274l-75 34z" fill="none" stroke="#9e8a6b" opacity=".22"/><path d="m130 355-19 2v24l19-4z" fill="#b6b6a1"/><ellipse cx="103" cy="290" rx="4" ry="5" fill="#9db5aa"/><path d="m65 211 48 17v24l-48-15z" fill="#b9ad8d"/><text x="75" y="232" fill="#2a3230" font-size="16" transform="rotate(16 75 232)">405</text><path d="m143 458-5 19m9-16-6 23m10-19-6 18" stroke="#ad9980" opacity="${lit?'.65':'.1'}"/><path d="m26 611 148-73" stroke="${lit?'#e0bd79':'#314347'}" stroke-width="3"/></g>
      <g><rect x="369" y="206" width="164" height="284" fill="#101b1d" stroke="#5e7068" stroke-width="5"/><rect x="378" y="217" width="146" height="273" fill="#28312e"/><path d="M390 233h121v241H390z" fill="none" stroke="#64776a" stroke-opacity=".18"/><rect x="415" y="182" width="70" height="25" rx="2" fill="#4e5c51"/><text x="436" y="199" fill="#b3bfa4" font-size="15" font-family="monospace">404</text><rect x="498" y="350" width="6" height="20" rx="2" fill="#7c8d80"/><circle cx="450" cy="303" r="3" fill="#102324"/><path d="M398 343 503 377m-103-2 99-34" stroke="#a6a48a" stroke-width="15" opacity=".22"/><text x="427" y="363" fill="#b6b599" font-size="12" transform="rotate(17 427 363)">封 存</text><path d="M380 492h143" stroke="#769c8c" stroke-opacity=".65"/></g>
      <g><path d="m752 231 124-45v423l-124-72z" fill="#111b1b" stroke="#5c7368" stroke-width="5"/><path d="m760 240 107-37v389l-107-61z" fill="#34443a"/><path d="m786 248 49-17v25l-49 14z" fill="#8a9680"/><text x="796" y="259" fill="#29372f" font-size="16" transform="rotate(-16 796 259)">406</text><path d="m773 358 18 3v23l-18-4z" fill="#a3ac91"/><circle cx="812" cy="311" r="3" fill="#98aa94"/><path d="m776 530 72 40" stroke="#91a18b" opacity=".25"/></g>
      <g><rect x="38" y="65" width="110" height="104" rx="3" fill="#27332f" stroke="#7d8b75" stroke-width="3"/><rect x="46" y="73" width="94" height="82" fill="${p.cabinetOpen?'#0d1b1c':'#3d5047'}" stroke="#8d9c80"/><path d="M83 88h20v10h10v20h-10v10H83v-10H73V98h10z" fill="#959d7b" opacity=".7"/><text x="57" y="148" fill="#a4b39b" font-size="10">应急维修 / 4F</text>${p.cabinetOpen&&!p.inventory.includes('fuse')&&!p.circuitRepaired?'<rect x="68" y="106" width="53" height="15" rx="3" fill="#a5d6c3" stroke="#dcf3de"/><path d="M73 108v11m41-11v11" stroke="#d5d2b1" stroke-width="7"/>':''}</g>
      <g><rect x="767" y="70" width="106" height="124" rx="3" fill="#28322d" stroke="#657769" stroke-width="3"/><rect x="777" y="83" width="86" height="83" fill="#142120"/><path d="M788 105h65m-65 18h65m-65 18h65" stroke="#596d5e" stroke-width="3"/><rect x="795" y="96" width="20" height="20" fill="${p.circuitRepaired?'#90c8ac':'#9f6354'}"/><rect x="835" y="127" width="14" height="24" fill="${lit?'#b1cdb3':'#596b60'}"/><text x="785" y="183" fill="#a0ad94" font-size="11">照明配电箱</text><circle cx="857" cy="80" r="3" fill="${p.circuitRepaired?'#79d7ce':'#d69876'}"/></g>
      <g><rect x="220" y="287" width="82" height="126" rx="3" fill="#101c1d" stroke="#788d81" stroke-width="2"/><rect x="228" y="297" width="66" height="57" fill="#29423e"/><path d="M237 310h34m-34 9h47m-47 9h27" stroke="#87b9a0" opacity=".6"/><text x="239" y="346" font-size="9" fill="#9dcbb6">ACCESS_4F</text><rect x="232" y="365" width="58" height="5" rx="2" fill="${p.chipRead?'#7bd8c4':'#65766a'}"/><circle cx="242" cy="388" r="4" fill="#7c9a86"/><circle cx="261" cy="388" r="4" fill="#61776b"/><circle cx="280" cy="388" r="4" fill="#61776b"/></g>
      <g><rect x="585" y="315" width="86" height="109" rx="2" fill="#273a35" stroke="#6d8272" stroke-width="2"/>${p.panelOpen?`<rect x="592" y="322" width="72" height="94" fill="#0a1a1c"/><path d="M600 331h55v75h-55zM604 354h48m-47 12h46m-28-34v72" stroke="#4b7b64" stroke-width="2"/>${!p.inventory.includes('chip')&&!p.chipRead?'<rect x="612" y="348" width="32" height="31" fill="#729785" stroke="#afd1b0"/><path d="M619 355h18v17h-18z" fill="#203d35"/>':''}<path d="m668 319 33 13v88l-33 4" fill="#4a5a4a" stroke="#87917a"/>`:'<path d="M598 330h59v53h-59z" fill="#142923" stroke="#697b65"/><path d="M607 393h40" stroke="#d0c69d" stroke-width="3"/><text x="599" y="408" font-size="9" fill="#a0af91">检修 / 刷卡开启</text>'}</g>
      <g><path d="M610 151h31v16h-31z" fill="#8c9b8b"/><path d="m641 154 13-5v20l-13-5" fill="#667b6d"/><circle cx="651" cy="156" r="2" fill="#8ce2c3"/><path d="M617 166v13h-10" fill="none" stroke="#91a28c" stroke-width="3"/></g>
      <g class="scene-mat"><path d="m405 552 170-6 61 80-232 9z" fill="${p.matLifted?'#253834':'#4a5144'}" stroke="#6d7863" stroke-width="2"/><path d="m418 567 145-4m-148 14 156-5m-157 17 167-6m-169 19 180-7m-181 20 190-8" stroke="#81866a" opacity=".24"/>${p.matLifted?'<path d="m406 553 92-4-70 55-28 31z" fill="#6a7157" stroke="#939175"/>':''}${p.matLifted&&!p.inventory.includes('card')?'<g transform="rotate(-16 539 584)"><rect x="510" y="566" width="65" height="40" rx="3" fill="#a4bfb0"/><rect x="516" y="573" width="12" height="12" fill="#4b7763"/><path d="M535 574h29m-29 7h22m-45 16h52" stroke="#547b67" stroke-width="3"/></g>':''}</g>
      <path d="M230 172h64m-50 5h42M560 176h77" stroke="#809280" opacity=".12"/>
      <text x="562" y="264" fill="#a8b69b" opacity=".25" font-size="17" font-family="monospace">4F</text>
      <g><ellipse cx="236" cy="654" rx="55" ry="17" fill="#060f16" opacity=".6"/><path d="M203 622h66v32h-66z" fill="#5a756d" stroke="#8ca897" stroke-width="2"/><path d="M212 619v-20h17l10 20" fill="#3d5b53" stroke="#94ac93" stroke-width="3"/><path d="m226 598 8-24 17-10m-18 9-8-9m25 0 9-2" fill="none" stroke="#9ba98c" stroke-width="4"/><rect x="214" y="632" width="27" height="6" fill="#9bd4b5"/><circle cx="211" cy="654" r="9" fill="#0e2124" stroke="#738b7b" stroke-width="3"/><circle cx="260" cy="654" r="9" fill="#0e2124" stroke="#738b7b" stroke-width="3"/><text x="245" y="642" font-size="7" fill="#b7ccb3">M04</text></g>
      <rect width="900" height="700" fill="url(#noise)" opacity=".8"/>
      ${!lit?'<rect width="900" height="700" fill="#030b18" opacity=".38"/><ellipse cx="450" cy="370" rx="400" ry="300" fill="#79b6a0" opacity=".025"/>':''}
    `);
  }
  function room(s) {
    const lit=s.devices['405'].light;
    return svg(`
      <rect width="900" height="700" fill="#18252c"/>
      <path d="M0 0h900v510H0z" fill="#38413e"/>
      <path d="M0 0 170 90v420L0 700" fill="#25353b"/>
      <path d="M170 90h730v420H170z" fill="#4a4c40"/>
      <path d="M0 700 170 510h730v190" fill="#252d2f"/>
      <g stroke="#586057" opacity=".25"><path d="M0 617h900M68 561h832M125 530h775M200 510 100 700m200-190v190m100-190 100 190m0-190 200 190"/></g>
      <rect x="210" y="170" width="183" height="340" fill="#172b2b" stroke="#8c8b6f" stroke-width="6"/>
      <rect x="219" y="182" width="165" height="328" fill="url(#door)"/>
      <path d="M230 195h144v300H230z" fill="none" stroke="#a39775" stroke-opacity=".2"/>
      <circle cx="300" cy="287" r="8" fill="#283d39" stroke="#a3b0a0" stroke-width="3"/>
      <rect x="354" y="362" width="12" height="41" rx="3" fill="#b0b5a3"/>
      <path d="M359 372h-26" stroke="#b8c1aa" stroke-width="7"/>
      <path d="M235 440 230 463m11-22-5 32m10-28-4 31" stroke="#b1a180" stroke-width="2"/>
      <path d="M220 511h165" stroke="${s.hallLight?'#f0d190':'#677965'}" stroke-width="3"/>
      <rect x="493" y="143" width="276" height="254" fill="#142934" stroke="#82958b" stroke-width="6"/>
      <rect x="502" y="151" width="258" height="235" fill="#1b3645"/>
      <path d="M502 324h258v62H502" fill="#142733"/>
      <g fill="#84a8ad" opacity=".25"><path d="M520 303v-65h42v65zm58 14v-116h47v116zm66-2v-92h26v92zm39 1v-128h45v128z"/></g>
      <g fill="#a6c1b8" opacity=".45"><path d="M534 251h5v8h-5zm12 0h5v8h-5zm48-32h5v8h-5zm13 30h5v8h-5zm90-41h5v8h-5z"/></g>
      <rect x="502" y="151" width="258" height="235" fill="url(#rain)"/>
      <path d="M630 145v249M496 275h270" stroke="#80978a" stroke-width="6"/>
      <path d="M474 130h38l-16 287h-47zM752 130h39l24 288h-51z" fill="#36494c" stroke="#658080" stroke-opacity=".3"/>
      <path d="M433 473h351l55 54H401z" fill="#766e54" stroke="#9d9579" stroke-width="2"/>
      <path d="M412 527h415v21H412z" fill="#4a4d3d"/><path d="M433 548v108m367-108v108" stroke="#434c42" stroke-width="13"/>
      <g><path d="M704 432v58m-40 0h80" stroke="#a5ac8c" stroke-width="5"/><path d="M667 425h73l-14-46h-45z" fill="${lit?'#dec58d':'#626c58'}" stroke="#a6a98c"/>${lit?'<ellipse cx="704" cy="471" rx="115" ry="83" fill="url(#glow)"/><path d="m679 425-75 99h214l-88-99" fill="url(#lightBeam)"/>':''}</g>
      <g transform="rotate(-7 530 492)"><rect x="473" y="474" width="125" height="23" rx="2" fill="#8a967a"/><rect x="478" y="469" width="116" height="10" fill="#c5c1a1"/><path d="M482 471h104" stroke="#6e826b"/><rect x="487" y="458" width="111" height="13" fill="#a78769"/><text x="506" y="468" font-size="8" fill="#e2ceab">公寓入住手册</text></g>
      <rect x="611" y="476" width="32" height="48" rx="5" fill="#0f2023" stroke="#8ba397" stroke-width="2"/><rect x="615" y="481" width="24" height="35" fill="#396f67"/><path d="M620 487h14m-14 6h10m-10 6h14" stroke="#95d9c1" stroke-width="2"/>
      <path d="M110 596 191 559l74 28v76l-77 37-78-29z" fill="#30464a" stroke="#526a67"/><path d="m110 596 77 31 78-40m-78 40v73" fill="none" stroke="#6e8176"/>
      <path d="M31 108h77v89H31z" fill="#425550" stroke="#7f9282"/><path d="m40 178 24-43 29 43" fill="#667c6a"/><circle cx="87" cy="125" r="10" fill="#9aaa89"/>
      <path d="M171 511h729" stroke="#101c21" stroke-width="6"/>
      <rect width="900" height="700" fill="url(#noise)"/>
      ${!lit?'<rect width="900" height="700" fill="#061221" opacity=".5"/>':''}
    `);
  }
  const hotspots = {
    hall: [
      ['cabinet','应急维修箱',10.5,17,15,19],['breaker','照明配电箱',91,19,17,22],
      ['door405','405 房门',10,57,20,46],['door404','封存的 404',50,49,20,44],['door406','406 房门',91,58,17,42],
      ['terminal','门禁终端',29,51,15,21],['panel','检修面板',70,54,16,20],['mat','走廊地垫',57,86,29,17],['camera','公共摄像头',70,23,14,12]
    ],
    room405: [ ['peephole','查看猫眼',33,40,16,17],['latch','检查门锁',40,56,15,17],['phone','苏妍的手机',70,72,18,17],['book','入住手册',59,67,22,16],['window','窗外',70,36,34,28] ]
  };
  const itemArt = {
    fuse:'<rect x="4" y="8" width="24" height="14" rx="3" fill="#7ba99a"/><path d="M8 8v14m16-14v14" stroke="#ded1a5" stroke-width="5"/><path d="m11 15 4-3 3 6 3-3" stroke="#d7efe2" fill="none"/>',
    card:'<rect x="2" y="5" width="28" height="22" rx="3" fill="#a3bbaa"/><rect x="6" y="9" width="7" height="6" fill="#486e5c"/><path d="M6 21h20m-10-9h10" stroke="#517360" stroke-width="2"/>',
    chip:'<path d="M9 1v5m7-5v5m7-5v5M9 26v5m7-5v5m7-5v5M1 9h5m-5 7h5m-5 7h5m20-14h5m-5 7h5m-5 7h5" stroke="#a5bca0" stroke-width="2"/><rect x="6" y="6" width="20" height="20" fill="#648f79"/><rect x="11" y="11" width="10" height="10" fill="#203e35"/>',
    note:'<path d="M7 2h18v28H7z" fill="#b9af8b"/><path d="M11 9h10m-10 5h10m-10 5h8" stroke="#776c50" stroke-width="2"/>'
  };
  const itemNames = {fuse:'备用保险丝',card:'维修门禁卡',chip:'门锁记录芯片',note:'旧版住户守则'};
  function next(s) {
    const p=s.scene;
    if (!p.inventory.includes('fuse')&&!p.circuitRepaired) return '照明回路没有响应。查看墙上的应急维修箱。';
    if (!p.circuitRepaired) return '选中道具栏里的保险丝，再点击照明配电箱。';
    if (!s.hallLight) return '回路已修复。在配电箱开启走廊照明。';
    if (!p.inventory.includes('card')) return '灯亮后，地垫边缘露出一角反光。翻开看看。';
    if (!p.panelOpen) return '维修卡可以打开 404 旁边的检修面板。';
    if (!p.inventory.includes('chip')&&!p.chipRead) return '检修面板里，有一枚仍在闪烁的记录芯片。';
    if (!p.chipRead) return '选中记录芯片，将它插入楼层门禁终端。';
    if (!s.evidence.logs) return '芯片读取成功。前往日志执行关联扫描。';
    if (s.anomaly==='visible') return '未知访问记录正在缓存中。去日志封存这份证据。';
    if (!s.evidence.report) return '联系 405 的苏妍，确认门内的情况。';
    if (!s.evidence.witness) return '406 的门后传来脚步。老吴似乎一直醒着。';
    return '现场证据已归档。前往事件中心，决定今晚的结局。';
  }
  function render(s,icon) {
    const p=s.scene, room=p.location==='room405';
    const last=s.chats['405'].filter(m=>m.who==='tenant').at(-1);
    const lines = s.outcome ? '今晚的事件已经结束。现场保留在最后一次记录中。' : next(s);
    const tag = (id) => {
      if(id==='cabinet'&&p.cabinetOpen&&!p.inventory.includes('fuse')&&!p.circuitRepaired) return '取出保险丝';
      if(id==='mat'&&p.matLifted&&!p.inventory.includes('card'))return '拾取维修卡';
      if(id==='panel'&&p.panelOpen&&!p.inventory.includes('chip')&&!p.chipRead)return '取出记录芯片';
      return null;
    };
    return `<div class="scene-layout"><section class="scene-main"><div class="scene-topline"><div><span class="dot"></span>${room?'405 室内':'4F 公共走廊'} <span class="scene-source">${room?'根据住户描述重建':'楼层数字孪生'} / 现场模式</span></div><button class="scene-help" data-action="scene-help">${icon('info')}玩法</button></div>
      <div class="environment ${s.hallLight?'lights-on':''} ${room?'room-environment':'hall-environment'}">
        ${room?window.Scene404.room(s):window.Scene404.hall(s)}
        <div class="scene-coordinate">${room?'ROOM_405 / 住户已接通':'HOME-AI 404 / 维护单元 M-04 已接入'}<br><span>${s.hallLight?'照明已恢复':'低照度 · 备用传感器在线'}</span></div>
        <div class="scene-vignette"></div>
        ${hotspots[p.location].map(([id,label,x,y,w,h])=>`<button class="scene-hotspot ${tag(id)?'has-item':''} ${p.examined.includes(id)?'examined':''}" style="--x:${x}%;--y:${y}%;--w:${w}%;--h:${h}%" data-action="scene-object" data-value="${id}" aria-label="${tag(id)||label}"><span class="hotspot-point">${tag(id)?'+':'·'}</span><span class="hotspot-label">${tag(id)||label}</span></button>`).join('')}
        ${room?'<button class="scene-return" data-action="scene-location" data-value="hall">← 返回走廊</button>':'<div class="scene-room-tag">405<span>门内有一位正在等待你的住户。</span></div>'}
      </div>
      <div class="scene-narration" role="status"><span class="scene-wave">▂▅▃▆▂</span><p>${lines}</p></div>
      <div class="inventory"><div class="inventory-heading"><span>现场道具</span><small>${p.selectedItem?'已选中：'+itemNames[p.selectedItem]:'点击道具，再点击场景物体使用'}</small></div><div class="inventory-slots">${['fuse','card','chip','note'].map(id=>p.inventory.includes(id)?`<button class="inventory-item ${p.selectedItem===id?'selected':''}" data-action="select-item" data-value="${id}" aria-pressed="${p.selectedItem===id}"><svg viewBox="0 0 32 32" aria-hidden="true">${itemArt[id]}</svg><span>${itemNames[id]}</span></button>`:`<div class="inventory-empty" aria-label="空道具槽"><span>+</span></div>`).join('')}</div>${p.circuitRepaired?'<span class="installed-part">✓ 备用保险丝已安装至照明配电箱</span>':''}</div></section>
      <aside class="scene-side"><section class="panel live-story"><div class="panel-head"><h2><span class="dot"></span>405 · 实时通讯</h2><span class="count">苏妍</span></div><div class="live-story-body"><div class="live-portrait">妍<span>声音很轻，呼吸急促。</span></div><p class="live-quote">“${escapeText(last?.text||'AI，你还在吗？').replace(/\n/g,'<br>')}”</p>${!s.evidence.report&&!s.outcome?'<button class="button primary" data-action="scene-talk" data-value="405">接通通话，让她远离房门</button>':'<button class="button" data-action="resident-scene" data-value="405">查看完整对话</button>'}<button class="text-btn" data-action="scene-location" data-value="room405">切换至 405 室内示意 ${icon('arrow')}</button></div></section><section class="panel scene-objectives"><div class="panel-head"><h3>现场任务</h3><span class="count">${[p.circuitRepaired,p.inventory.includes('card'),p.chipRead].filter(Boolean).length} / 3</span></div><div class="scene-task ${p.circuitRepaired?'done':''}"><span>${p.circuitRepaired?'✓':'01'}</span><div>修复照明回路<small>维修箱 → 保险丝 → 配电箱</small></div></div><div class="scene-task ${p.inventory.includes('card')?'done':''}"><span>${p.inventory.includes('card')?'✓':'02'}</span><div>找到维修卡<small>灯光 → 地垫 → 维修卡</small></div></div><div class="scene-task ${p.chipRead?'done':''}"><span>${p.chipRead?'✓':'03'}</span><div>读取门锁芯片<small>检修面板 → 芯片 → 门禁终端</small></div></div><button class="scene-evidence-link" data-action="tab" data-value="events">调查证据 ${Object.values(s.evidence).filter(Boolean).length} / 6 ${icon('arrow')}</button></section><p class="scene-side-note">你没有身体，但你可以通过设备看见、触碰，并改变这栋公寓。</p></aside></div>`;
  }
  return {render,hall,room,itemNames,next};
})();
