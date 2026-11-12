const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const response=require('../fixtures/discovery-response.cjs');
async function run(browser,mode,kind){
 const r=await setup(browser,{mode,viewport:{width:1440,height:900}},{plugin:process.env.CATALOGUE_TEST_PLUGIN,beforePlugin:page=>page.evaluate(()=>{
  const L=Lampa;for(const name of ['Params','Layer','DeviceInput'])L[name].init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',event=>L.Controller.focus(event.elem));
 })});
 const {page}=r;
 try{
  if(Number(process.env.WINDOW_CPU_RATE)>1){const cdp=await r.context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.WINDOW_CPU_RATE)});}
  await page.evaluate(({fixture,kind})=>{
   const respond=eval('('+fixture+')'),L=Lampa;
   L.Api.sources.tmdb.get=(url,p,ok)=>setTimeout(()=>{const data=respond(url,p.page);ok({...data,total_pages:40,results:data.results.map((c,i)=>({...c,title:i%3?'Короткое название':'Очень длинное название фильма для проверки двух строк',name:kind==='movie'?undefined:'Название сериала '+i,quality:'4K'}))});},5);
   L.Api.full=(p,ok)=>setTimeout(()=>ok({movie:{id:p.id,title:'Фильм',source:'tmdb',release_date:'2024-01-01',production_countries:[],production_companies:[],spoken_languages:[],genres:[],overview:'Проверка'},persons:{cast:[],crew:[]},images:{logos:[]},videos:{results:[]},discuss:{result:[]}}),0);
   L.Activity.push({component:kind==='anime'?'category_full':'category',url:kind==='anime'?'discover/tv?with_genres=16&with_original_language=ja':kind,source:'tmdb',page:1,title:kind});
  },{fixture:response.toString(),kind});
  const grid=page.locator('.activity--active .pt-browser-catalogue');await grid.locator('.card').first().waitFor();await page.waitForTimeout(250);
  const checkpoints=[];
  for(let count=40;count<=800;count+=20){
   await grid.evaluate(node=>{const component=Lampa.Activity.active().activity.component;component.builded_time=0;node.scrollTop=node.scrollHeight;node.Scroll.minimalBrowserScroll.requestMore();});
   await page.waitForFunction(count=>Lampa.Activity.active().activity.component.items.length>=count,count,{timeout:6000});
   if(count%200===0){await page.waitForTimeout(150);checkpoints.push({...await geometry(page),...(count===200||count===800?{probe:await probe(page)}:{})});}
  }
  await grid.evaluate(n=>{n.scrollTop=n.scrollHeight;});await page.waitForTimeout(250);
  const deep=await geometry(page);console.log(JSON.stringify({mode,kind,checkpoints,deep}));
  if(process.env.CATALOGUE_TEST_PLUGIN)return {mode,kind,checkpoints,deep,errors:r.errors};
  if(!process.env.CATALOGUE_TEST_PLUGIN){assert.ok(deep.attached<=200,'Mounted poster count stays bounded at 800 loaded cards');assert.ok(deep.spacers>0);}
  // A large scrollbar jump back to the start must remount complete first rows.
  await grid.evaluate(n=>{n.scrollTop=0;});await page.waitForTimeout(250);
  const first=await geometry(page);assert.equal(first.first,0);assert.equal(first.top,0);
  for(let step=0;step<4;step++)await page.keyboard.press('ArrowDown');await page.waitForTimeout(250);
  const focusStart=await geometry(page);assert.ok(focusStart.focusVisible,'Remote focus remains visible at start: '+JSON.stringify(focusStart));
  // Jump into the middle while the selected native index is far away.
  await grid.evaluate(n=>{n.scrollTop=n.scrollHeight*.65;});await page.waitForTimeout(250);
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(250);
  const middle=await geometry(page);assert.ok(middle.focusVisible,'Mouse to remote takeover: '+JSON.stringify(middle));
  const saved=middle;
  await page.evaluate(()=>Lampa.Activity.push({component:'full',id:123,source:'tmdb',method:'movie',card:{id:123,title:'Фильм',source:'tmdb'}}));await page.waitForSelector('.activity--active .minimal-detail-header');
  await page.evaluate(()=>Lampa.Activity.backward());await page.waitForTimeout(300);
  const restored=await geometry(page);assert.ok(Math.abs(restored.top-saved.top)<1,'Back position is stable');assert.equal(restored.focus,saved.focus);
  // Late title metadata uses the reserved cell, not a growing grid row.
  const compact=await grid.evaluate(n=>{
   const cards=[...n.querySelectorAll('.card')],short=cards.find(c=>c.querySelector('.card__title')?.textContent==='Короткое название')||cards[0];
   const title=short.querySelector('.card__title'),age=short.querySelector('.card__age'),poster=short.querySelector('.card__view');
   const t=title.getBoundingClientRect(),a=age.getBoundingClientRect(),p=poster.getBoundingClientRect();
   const footer=short.querySelector('.pt-card-watch').getBoundingClientRect(),cell=short.getBoundingClientRect();
   return {yearGap:a.top-t.bottom,radius:getComputedStyle(poster).borderRadius,gap:parseFloat(getComputedStyle(short.parentElement).columnGap),year:age.textContent,title:title.textContent,posterWidth:p.width,footerOverflow:footer.bottom-cell.bottom};
  });
  if(!process.env.CATALOGUE_TEST_PLUGIN){assert.ok(compact.yearGap>=0 && compact.yearGap<8);assert.equal(compact.radius,'12px');assert.equal(compact.gap,16);assert.ok(compact.footerOverflow<=1,'Progress information fits the card');assert.ok(compact.posterWidth>100,'TV posters fill the grid slot instead of a percentage of that slot');}
  const sectionBefore=await geometry(page);
  await grid.evaluate(n=>{window.qaOldGrid=n;window.qaOldWork=0;n.addEventListener('minimal:viewport-scroll',()=>qaOldWork++);Lampa.Activity.push({component:'category',url:'tv',source:'tmdb',page:1,title:'Другой раздел'});});
  await page.waitForFunction(()=>document.querySelector('.activity--active .pt-browser-catalogue')!==qaOldGrid && document.querySelector('.activity--active .card'));
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>qaOldWork),0,'Saved catalogue does no background scroll work');
  await page.evaluate(()=>Lampa.Activity.backward());await page.waitForTimeout(250);
  assert.ok(Math.abs((await geometry(page)).top-sectionBefore.top)<1,'Returning from another section preserves position');
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(300);
  const resized=await geometry(page);assert.ok(resized.attached<=200);assert.ok(resized.top>0,'Resize keeps the deep catalogue region');
  await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(250);
  const heightOnly=await geometry(page);assert.ok(Math.abs(heightOnly.height-resized.height)<2,'Height-only resize keeps spacer rows and total content height');assert.ok(heightOnly.top>0);assert.ok(heightOnly.attached<=200);
  assert.deepEqual(r.errors,[]);
  if(process.env.WINDOW_SCREENSHOT){
   await grid.evaluate(n=>{for(const img of n.querySelectorAll('.card__img'))img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#263e50"/><stop offset="1" stop-color="#795758"/></linearGradient></defs><rect width="300" height="450" fill="url(#a)"/><text x="30" y="220" fill="#fff" font-size="24">Проверка макета</text></svg>');});
   await page.waitForTimeout(100);await page.screenshot({path:path.join(process.env.WINDOW_SCREENSHOT,mode+'-'+kind+'.png')});
  }
  return {mode,kind,checkpoints,deep,first,focusStart,middle,restored,compact,resized,errors:r.errors};
 }catch(error){console.error('diagnostic',mode,kind,await geometry(page).catch(()=>null),r.errors);throw error;}finally{await r.context.close();}
}
async function probe(page){return page.evaluate(async()=>{
 const node=Lampa.Activity.active().activity.component.scroll.render(true),initial=node.scrollTop,frames=[],tasks=[];let last=performance.now();
 const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(t=>t.duration)));observer.observe({type:'longtask'});
 for(let i=0;i<24;i++){await new Promise(resolve=>requestAnimationFrame(time=>{frames.push(time-last);last=time;node.scrollTop-=35;resolve();}));}
 node.scrollTop=initial;await new Promise(resolve=>requestAnimationFrame(resolve));tasks.push(...observer.takeRecords().map(t=>t.duration));observer.disconnect();
 const sorted=frames.slice(1).sort((a,b)=>a-b);return {frameP95:sorted[Math.floor(sorted.length*.95)],frameMax:Math.max(...sorted),longTasks:tasks.filter(t=>t>50).length};
 });}
async function geometry(page){return page.evaluate(()=>{
 const component=Lampa.Activity.active().activity.component,n=component.scroll.render(true),body=component.body,cards=[...body.querySelectorAll(':scope>.card')],v=n.getBoundingClientRect(),focused=body.querySelector('.card.focus'),f=focused?.getBoundingClientRect();
 return {loaded:component.items.length,attached:cards.length,spacers:body.querySelectorAll('.pt-catalogue-spacer:not([hidden])').length,first:cards.length?component.items.findIndex(c=>c.render(true)===cards[0]):-1,last:cards.length?component.items.findIndex(c=>c.render(true)===cards.at(-1)):-1,top:n.scrollTop,height:n.scrollHeight,columns:getComputedStyle(body).gridTemplateColumns,focus:focused?component.items.findIndex(c=>c.render(true)===focused):-1,active:component.active,lastConnected:component.last?.isConnected,lastClass:component.last?.className,focusVisible:!!f&&f.top<v.bottom&&f.bottom>v.top};
 });}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});try{
 const results=[];for(const mode of (process.env.WINDOW_MODE?[process.env.WINDOW_MODE]:['desktop','tv']))for(const kind of (process.env.WINDOW_KIND?[process.env.WINDOW_KIND]:['movie','tv','anime']))results.push(await run(browser,mode,kind));
 if(process.env.WINDOW_REPORT)fs.writeFileSync(process.env.WINDOW_REPORT,JSON.stringify(results,null,2));
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
