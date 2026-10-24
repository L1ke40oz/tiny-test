async (page) => {
  const results=[], errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=(ok,label)=>{if(!ok)throw new Error(label);results.push(label);};
  const button=name=>page.getByRole('button',{name,exact:true});
  const nav=id=>page.locator(`nav [data-value="${id}"]`).click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('home-ai-404-v1')));
  await nav('system');await button('重新开始').click();await page.locator('dialog [data-action="reset"]').click();
  check(await page.getByRole('heading',{name:'公寓现场',exact:true}).isVisible(),'开局直接进入可探索场景');
  await button('照明配电箱').click();await button('继续探索').click();
  check(!(await read()).hallLight,'未修复回路无法开启照明');
  await button('走廊地垫').click();
  check(!(await read()).scene.matLifted,'黑暗中不能提前发现维修卡');
  await button('应急维修箱').click();await button('取出保险丝').click();
  check((await read()).scene.inventory.includes('fuse'),'场景容器中的保险丝可拾取');
  await button('照明配电箱').click();
  check((await read()).scene.circuitRepaired&&!(await read()).scene.inventory.includes('fuse'),'使用道具真正修复回路并消耗保险丝');
  await button('照明配电箱').click();
  check((await read()).hallLight&&await page.locator('.environment.lights-on').isVisible(),'开灯改变场景照明并触发苏妍消息');
  await page.screenshot({path:'output/playwright/scene-lit-mobile.png',fullPage:true});
  await button('走廊地垫').click();await button('拾取维修卡').click();
  check((await read()).scene.inventory.includes('card'),'翻开地垫才可拾取隐藏维修卡');
  await button('检修面板').click();
  check((await read()).scene.panelOpen,'使用维修卡打开面板');
  await button('取出记录芯片').click();
  check((await read()).scene.inventory.includes('chip'),'面板内芯片可拾取');
  await button('门禁终端').click();
  check((await read()).scene.chipRead&&!(await read()).scene.inventory.includes('chip'),'芯片接入终端，实际解锁数据');
  await button('继续探索').click();
  await button('405 房门').click();await button('接通通话，进入室内示意').click();
  check((await read()).scene.location==='room405'&&(await read()).evidence.report,'门内通话推进剧情并切换室内场景');
  await button('入住手册').click();await button('继续探索').click();
  check((await read()).scene.inventory.includes('note'),'室内可调查手册并收集旧规则');
  await button('查看猫眼').click();await button('继续探索').click();
  await page.screenshot({path:'output/playwright/room405-mobile.png',fullPage:true});
  await button('← 返回走廊').click();
  await button('406 房门').click();await button('询问刚才的敲门声').click();
  check((await read()).evidence.witness,'在场景中敲门询问老吴可取得证词');
  await nav('logs');await button('关联扫描').click();await page.locator('.anomaly-banner strong').waitFor();
  await button('确认并封存证据 →').click();await page.reload();
  await page.getByText('LOG_REMOVED / 原始访问条目已删除',{exact:true}).waitFor();
  check((await read()).anomaly==='removed','现场主线可进入未知记录消失剧情，刷新可续接');
  const checkpoint=JSON.stringify(await read());
  for(const [route,title]of [['guardian','守护者'],['controller','控制者'],['shutdown','删除自己']]){
    await page.evaluate(s=>localStorage.setItem('home-ai-404-v1',s),checkpoint);await page.reload();await nav('events');
    await button('提交处置决定').click();await page.locator(`dialog [data-value="${route}"]`).click();await button('确认执行').click();
    check(await page.getByRole('heading',{name:title,exact:true}).isVisible(),`场景主线可抵达${title}结局`);
    const s=await read();
    check(s.outcome===route,`${title}存档正确`);
    if(route==='shutdown')check(Object.values(s.devices).every(d=>!d.locked),'关机结局恢复本地控制');
  }
  await page.evaluate(s=>localStorage.setItem('home-ai-404-v1',s),checkpoint);await page.reload();
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const tab of ['scene','residents','events','devices','logs','camera','system']){
      await nav(tab);
      const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      check(size.scroll<=size.width,`${width}px ${tab} 无横向溢出`);
    }
  }
  check(errors.length===0,'场景、道具与章节运行无浏览器异常');
  await nav('system');await button('重新开始').click();await page.locator('dialog [data-action="reset"]').click();
  await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:'output/playwright/scene-final-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/playwright/scene-final-mobile.png',fullPage:true});
  return{results,errors};
}
