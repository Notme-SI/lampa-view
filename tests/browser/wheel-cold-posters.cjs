const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs'),response=require('../fixtures/discovery-response.cjs');
async function run(browser){
 const mode=process.env.COLD_MODE || 'desktop';
 const r=await setup(browser,{mode,viewport:{width:1440,height:900}},{plugin:process.env.COLD_BASELINE,beforePlugin:page=>page.evaluate(()=>{
  const L=Lampa;L.Params.init();L.Layer.init();L.DeviceInput.init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
  for(const api of [L.Api,L.TMDB,L.Api.sources.tmdb])api.img=(p,size)=>'http://images.example.invalid/image/t/p/'+(size||'w780')+p;
 })});const {page}=r,requests=[];
 try{
  await page.route('http://images.example.invalid/**',async route=>{
   const url=route.request().url(),index=Number(url.match(/-(\d+)\.jpg/)?.[1])||0;requests.push({url,time:Date.now()});
   await new Promise(resolve=>setTimeout(resolve,index%5===0?800:35+(index%4)*60));
   await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#'+(index%2?'596574':'765257')+'"/></svg>'}).catch(()=>{});
  });
  await page.evaluate(fixture=>{
   const respond=eval('('+fixture+')');Lampa.Api.sources.tmdb.get=(url,p,ok)=>setTimeout(()=>{const data=respond(url,p.page);ok({...data,total_pages:40,results:data.results.map((c,i)=>({...c,poster_path:'/poster-'+p.page+'-'+i+'.jpg',title:i%3?'Короткое название':'Длинное название для проверки высоты строк',quality:'4K'}))});},25);
   Lampa.Activity.push({component:'category',url:'movie',source:'tmdb',page:1,title:'Холодный кэш'});
  },response.toString());
  const grid=page.locator('.activity--active .pt-browser-catalogue');await grid.locator('.card').first().waitFor();
  await grid.evaluate(n=>{
   const state=window.qaCold={samples:[],lastVisible:new Set(),visibleReparents:0,exposedUndecoded:0,running:true};
   const observer=new MutationObserver(records=>{for(const record of records)for(const card of record.removedNodes)if(state.lastVisible.has(card))state.visibleReparents++;});observer.observe(n.querySelector('.mapping--grid'),{childList:true});state.observer=observer;
   function frame(time){if(!state.running)return;const bounds=n.getBoundingClientRect(),cards=[...n.querySelectorAll('.card')];state.lastVisible=new Set(cards.filter(c=>{const r=c.getBoundingClientRect();return r.bottom>bounds.top&&r.top<bounds.bottom;}));
    for(const card of state.lastVisible){const image=card.querySelector('.card__img');if(image && !image.classList.contains('pt-catalogue-image-pending') && (!image.complete||image.naturalWidth<=1))state.exposedUndecoded++;}
    state.samples.push({time,top:n.scrollTop});requestAnimationFrame(frame);
   }requestAnimationFrame(frame);
  });
  const box=await grid.boundingBox();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.55);
  for(let i=0;i<65;i++){await grid.evaluate(n=>{Lampa.Activity.active().activity.component.builded_time=0;});await page.mouse.wheel(0,130);await page.waitForTimeout(24);}
  await page.waitForTimeout(250);
  const anchor=await grid.evaluate(n=>{const b=n.getBoundingClientRect(),card=[...n.querySelectorAll('.card')].find(c=>c.getBoundingClientRect().top>=b.top);window.qaAnchor=card;return {top:n.scrollTop,y:card.getBoundingClientRect().top};});
  await page.waitForTimeout(1300);
  // A hidden pending image is not a successful rendering. Require every
  // poster in the visible viewport to finish and actually be displayed.
  await page.waitForFunction(()=>{
   const n=document.querySelector('.activity--active .pt-browser-catalogue'),bounds=n.getBoundingClientRect();
   const images=[...n.querySelectorAll('.card')].filter(c=>{const b=c.getBoundingClientRect();return b.bottom>bounds.top&&b.top<bounds.bottom;}).map(c=>c.querySelector('.card__img'));
   return images.length>0 && images.every(image=>{const s=getComputedStyle(image);return image.complete&&image.naturalWidth>1&&Number(s.opacity)>.9&&s.visibility==='visible';});
  },null,{timeout:8000});
  const stable=await grid.evaluate(n=>({top:n.scrollTop,y:qaAnchor.getBoundingClientRect().top}));
  const rendered=await grid.evaluate(n=>{const bounds=n.getBoundingClientRect(),images=[...n.querySelectorAll('.card')].filter(c=>{const b=c.getBoundingClientRect();return b.bottom>bounds.top&&b.top<bounds.bottom;}).map(c=>c.querySelector('.card__img'));return {visible:images.length,ready:images.filter(i=>i.complete&&i.naturalWidth>1&&Number(getComputedStyle(i).opacity)>.9).length,pending:images.filter(i=>i.classList.contains('pt-catalogue-image-pending')).length};});
  const down=await page.evaluate(()=>{qaCold.running=false;qaCold.observer.disconnect();return {samples:qaCold.samples,visibleReparents:qaCold.visibleReparents,exposedUndecoded:qaCold.exposedUndecoded};});
  const reversals=down.samples.slice(1).filter((s,i)=>s.top<down.samples[i].top-1);
  const loaded=await page.evaluate(()=>Lampa.Activity.active().activity.component.items.length);
  if(!process.env.COLD_BASELINE){assert.equal(down.visibleReparents,0,'Visible overlap must stay connected during window shifts');assert.equal(rendered.ready,rendered.visible,'Every visible poster is rendered');assert.equal(rendered.pending,0,'No indefinitely hidden posters');assert.equal(reversals.length,0,'Downward wheel never jumps backward');assert.ok(Math.abs(anchor.top-stable.top)<1 && Math.abs(anchor.y-stable.y)<1,'Image completion does not shift the anchor');}
  for(let i=0;i<18;i++){await page.mouse.wheel(0,-200);await page.waitForTimeout(24);}await page.waitForTimeout(250);
  assert.deepEqual(r.errors,[]);
  return {mode,version:process.env.COLD_BASELINE?'baseline':'candidate',loaded,requests:requests.length,visibleReparents:down.visibleReparents,exposedUndecoded:down.exposedUndecoded,backwardJumps:reversals.length,rendered,anchor,stable,errors:r.errors};
 }finally{await r.context.close();}
}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});try{const result=await run(browser);console.log(JSON.stringify(result,null,2));if(process.env.COLD_REPORT)fs.writeFileSync(process.env.COLD_REPORT,JSON.stringify(result,null,2));}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});

