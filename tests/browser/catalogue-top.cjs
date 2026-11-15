const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs'),response=require('../fixtures/discovery-response.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv']){
 const r=await setup(browser,{mode,viewport:mode==='tv'?{width:960,height:540}:{width:1440,height:900}}),{page}=r;
 try{
  await page.evaluate(fixture=>{
   const L=Lampa;for(const api of ['Params','Layer','DeviceInput'])L[api].init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
   const data=eval('('+fixture+')');L.Api.sources.tmdb.get=(url,p,ok)=>setTimeout(()=>ok(url.includes('_credits')?{cast:Array.from({length:67},(_,i)=>({id:i+1,title:'Проект '+i,popularity:100-i,poster_path:'/p.jpg'})),crew:[]}:/^(person|company)\//.test(url)?{id:690,name:'Проверка',profile_path:'/p.jpg',logo_path:'/p.jpg'}:{...data(url,p.page),total_pages:12}),10);
  },response.toString());
  for(const kind of ['movie','tv','cartoon','tvshow','actor','company']){
   await page.evaluate(kind=>Lampa.Activity.push({component:['actor','company'].includes(kind)?kind:'category',url:kind,id:690,source:'tmdb',title:'Проверка '+kind,page:1}),kind);
   await page.waitForSelector('.activity--active .card');await page.waitForTimeout(300);
   await page.evaluate(()=>{const c=Lampa.Activity.active().activity.component;Lampa.Controller.toggle('content');Lampa.Controller.collectionFocus(c.items[0].render(true),c.scroll.render(true));});
   await page.keyboard.press('ArrowUp');await page.waitForTimeout(260);
   const bar=page.locator('.activity--active .minimal-catalogue-controls'),initial=await bar.boundingBox();
   for(let i=0;i<4;i++){await page.keyboard.press('ArrowDown');await page.waitForTimeout(100);}
   const grid=page.locator('.activity--active .pt-browser-catalogue');
   assert.ok(await grid.evaluate(n=>n.scrollTop)>20,kind+': remote moves below the header '+JSON.stringify(await page.evaluate(()=>{const c=Lampa.Activity.active().activity.component;return {active:c.active,count:c.items.length,last:c.last?.textContent,controller:Lampa.Controller.enabled().name};})));
   for(let i=0;i<20;i++){if(await bar.locator('.focus').count())break;await page.keyboard.press('ArrowUp');await page.waitForTimeout(85);}
   assert.equal(await bar.locator('.focus').count(),1,kind+': remote reaches filters');
   await page.waitForFunction(()=>document.querySelector('.activity--active .pt-browser-catalogue').scrollTop<1);
   const restored=await bar.boundingBox();assert.ok(Math.abs(restored.y-initial.y)<2,kind+': filters return to their original visible position '+JSON.stringify({initial,restored}));
  }
  await page.evaluate(()=>Lampa.Storage.set('lampa_view_theme','glass'));
  const reading=await page.evaluate(()=>{
   const host=document.createElement('div');host.id='qa-reading';host.innerHTML='<div class="settings__content"></div><div class="selectbox__content"></div><div class="extensions"></div><div class="main-search"><div class="search"></div></div>';
   document.body.appendChild(host);const nodes=[document.querySelector('.wrap__left'),...host.querySelectorAll('.settings__content,.selectbox__content,.extensions,.search')];
   const result=nodes.map(n=>({fill:getComputedStyle(n).backgroundColor,filter:getComputedStyle(n).backdropFilter}));host.remove();return result;
  });
  for(const surface of reading){const alpha=Number(surface.fill.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] || 1);assert.ok(mode==='tv'?alpha>=.94:alpha<.8,'Reading surface density '+JSON.stringify({mode,surface}));if(mode==='tv')assert.equal(surface.filter,'none');}
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+': six catalogues return to original top; panel density PASS');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
