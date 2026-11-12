const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');

async function run(browser,mode,theme){
 const r=await setup(browser,{mode,viewport:{width:1440,height:900}},{beforePlugin:page=>page.evaluate(()=>{
  Lampa.Params.init();Lampa.Search.init();Lampa.Listener.send('app',{type:'ready'});
 })});
 const {page}=r;
 try{
  await page.evaluate(theme=>{
   Lampa.Storage.set('lampa_view_theme',theme);
   Lampa.Params.init();Lampa.Layer.init();Lampa.DeviceInput.init();Lampa.Controller.observe();
   Lampa.Keypad.init();Lampa.Keypad.enable();Navigator.follow('focus',e=>Lampa.Controller.focus(e.elem));
   const root=document.createElement('main');
   root.id='qa-input';root.style.cssText='position:fixed;top:160px;left:100px;display:flex;gap:30px;z-index:60';
   document.body.appendChild(root);
   window.qaEnters=0;
   Lampa.Timeline.update({hash:Lampa.Utils.hash('Film'),time:915,percent:40,duration:2287});
   const data=[
    {id:8801,title:'Фильм',original_title:'Film',media_type:'movie',release_date:'2020-01-01',vote_average:8.3,poster_path:'/p.jpg',source:'test',quality:'4K'},
    {id:8802,name:'Сериал',original_name:'Series',media_type:'tv',first_air_date:'2020-01-01',poster_path:'/s.jpg',source:'test',quality:'1080p',seasons:[{season_number:2,episode_count:10}],last_episode_to_air:{season_number:2,episode_number:6,air_date:'2020-01-01'}}
   ];
   data.forEach(data=>{
    const card=Lampa.Utils.createInstance(Lampa.Maker.get('Card',{}),data);
    card.use({onEnter(){qaEnters++;}});card.create();
    const node=card.render(true);node.style.width='180px';root.appendChild(node);if(data.id===8801)node.querySelector('.card__icons-inner').insertAdjacentHTML('beforeend','<div class="card__icon icon--history"></div>');
   });
   Lampa.Controller.add('qa-cards',{
    toggle(){Lampa.Controller.collectionSet(root);Lampa.Controller.collectionFocus(root.firstElementChild,root);},
    right(){Navigator.move('right');},left(){Navigator.move('left');}
   });
  },theme);
  const film=page.locator('#qa-input .card').nth(0),series=page.locator('#qa-input .card').nth(1);
  await film.waitFor({state:'attached'});
  await page.waitForFunction(()=>document.querySelector('#qa-input .card.pt-poster-ready'));
  assert.equal(await page.locator('#qa-input .pt-poster-selection').count(),0,'No added Play layer on any poster');
  assert.equal(await film.locator('.icon--history').count(),1,'Keep the native continuation marker');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  if(mode==='desktop'){
   await film.hover();
   await page.waitForFunction(()=>{const label=document.querySelector('#qa-input .pt-card-watch');return label && getComputedStyle(label).visibility==='visible';});
   await page.waitForTimeout(330);
   assert.equal(await film.locator('.card__view').evaluate(n=>getComputedStyle(n).transform),'matrix(1, 0, 0, 1, 0, -3)');
   await page.mouse.move(2,2);
   await page.waitForTimeout(330);
   assert.equal(await film.locator('.card__view').evaluate(n=>getComputedStyle(n).transform),'none');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>document.body.dataset.ptCardMotion),'on','The requested card motion is enabled by default even with an OS reduction preference');
  const frames=await film.evaluate(node=>new Promise(resolve=>{
   const view=node.querySelector('.card__view'),frames=[],start=performance.now();
   function sample(){const s=getComputedStyle(view),halo=getComputedStyle(view,'::after');frames.push({t:performance.now()-start,y:s.transform==='none'?0:new DOMMatrix(s.transform).m42,shadow:s.boxShadow,haloShadow:halo.boxShadow,haloOpacity:Number(halo.opacity),animations:view.getAnimations().filter(a=>a.playState==='running').length});if(performance.now()-start<280)requestAnimationFrame(sample);else resolve(frames);}
   sample();Lampa.Controller.toggle('qa-cards');
  }));
  assert.ok(frames.some(f=>f.y<0 && f.y>-3 && f.animations>0),'Actual rendered frames show a gradual lift: '+JSON.stringify(frames));
  assert.ok(frames.some(f=>f.haloOpacity>0 && f.haloOpacity<1),'The halo fades across rendered frames');
  assert.ok(frames.every(f=>f.shadow==='none'),'No layout repaints an animated poster shadow');
  assert.equal(new Set(frames.map(f=>f.haloShadow)).size,1,'The halo uses one fixed shadow throughout the fade');
  assert.equal(frames.at(-1).y,-3);
  const hostAnimation=await page.evaluate(()=>Lampa.Storage.get('animation'));
  for(const motion of ['system','off']){
   await page.evaluate(motion=>Lampa.Storage.set('lampa_view_card_motion',motion),motion);
   await page.waitForFunction(motion=>document.body.dataset.ptCardMotion===motion,motion);
   const stopped=await film.locator('.card__view').evaluate(n=>{const s=getComputedStyle(n),halo=getComputedStyle(n,'::after');return {transform:s.transform,transition:s.transitionDuration,shadow:halo.boxShadow};});
   assert.equal(stopped.transform,'none',motion+' stops movement with OS reduction');assert.equal(stopped.transition,'0s');assert.match(stopped.shadow,/rgba\(255, 255, 255, 0.18\)/,'The static halo stays visible');
  }
  await page.evaluate(()=>Lampa.Storage.set('lampa_view_card_motion','on'));
  await page.waitForTimeout(280);
  assert.equal(await film.locator('.card__view').evaluate(n=>getComputedStyle(n).transform),'matrix(1, 0, 0, 1, 0, -3)','The setting restores movement immediately without reloading');
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const motion of ['off','system','on']){
   await page.evaluate(motion=>Lampa.Storage.set('lampa_view_card_motion',motion),motion);await page.waitForTimeout(260);
   assert.equal(await film.locator('.card__view').evaluate(n=>getComputedStyle(n).transform),motion==='off'?'none':'matrix(1, 0, 0, 1, 0, -3)',motion+' honors its own contract without OS reduction');
  }
  assert.equal(await page.evaluate(()=>Lampa.Storage.get('animation')),hostAnimation,'The poster setting never changes the host animation preference');
  assert.equal(await film.locator('.card__age').textContent(),'2020');
  assert.equal(await film.locator('.card__vote').evaluate(n=>getComputedStyle(n).opacity),'1','Our own rating remains visible');
  const paint=await film.locator('.card__view').evaluate(n=>({shadow:getComputedStyle(n,'::after').boxShadow,edge:getComputedStyle(n,'::after').borderColor}));
  assert.match(paint.shadow,/rgba\(255, 255, 255, 0.18\).*22px/);
  assert.equal(paint.edge,'rgba(255, 255, 255, 0.12)','The edge stays quieter than the diffuse halo');
  assert.equal(await film.locator('.icon--history').evaluate(n=>getComputedStyle(n).opacity),'1','Selection never hides the native continuation marker');
  await page.waitForFunction(()=>{const label=document.querySelector('#qa-input .pt-card-watch');return label && getComputedStyle(label).visibility==='visible';},null,{timeout:4000}).catch(async e=>{throw Error(e.message+' '+JSON.stringify(await page.evaluate(()=>({body:document.body.className,node:document.querySelector('#qa-input .card').outerHTML}))));});
  assert.equal(await film.locator('.pt-card-watch__time').textContent(),'15:15');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(330);
  assert.equal(await film.locator('.card__view').evaluate(n=>getComputedStyle(n).boxShadow),'none','The previous halo disappears after moving focus');
  assert.equal(await film.locator('.card__view').evaluate(n=>getComputedStyle(n,'::after').opacity),'0','The previous halo fades out completely');
  assert.equal(await series.locator('.card__view').evaluate(n=>getComputedStyle(n).transform),'matrix(1, 0, 0, 1, 0, -3)');
  await page.waitForFunction(()=>{
   const label=document.querySelector('#qa-input .card:nth-child(2) .pt-series-status');
   return label && getComputedStyle(label).display!=='none' && getComputedStyle(label).visibility==='visible';
  },null,{timeout:3500}).catch(async error=>{
   throw new Error(error.message+' '+JSON.stringify(await page.evaluate(()=>({
    layout:LampaView.layout,controller:Lampa.Controller.enabled().name,
    cards:[...document.querySelectorAll('#qa-input .card')].map(n=>({classes:n.className,label:n.querySelector('.pt-series-status')?.textContent,html:n.querySelector('.pt-series-status')?.outerHTML}))
   }))));
  });
  assert.equal(await series.locator('.pt-series-status').textContent(),'Сезон 2 • Серия 6/10');
  assert.equal(await page.locator('#qa-input .pt-card-touch').count(),0);
  await page.waitForTimeout(250);
  await series.locator('.card__title').click();
  await page.waitForFunction(()=>qaEnters>0,null,{timeout:3500});
  assert.equal(await page.locator('#qa-input .pt-card-touch').count(),0,'Mouse clicks on captions use the normal card action');

  await page.locator('#qa-input').evaluate(n=>n.remove());
  await page.locator('.head .open--settings').hover();
  await page.locator('.head .open--settings').focus();
  await page.evaluate(()=>{
   Lampa.Controller.toggle('head');
   Lampa.Controller.collectionFocus(document.querySelector('.head .open--search'),document.querySelector('.head'));
  });
  for(const key of ['ArrowLeft','ArrowRight','ArrowLeft','ArrowRight']){
   await page.keyboard.press(key);
   const controls=await page.locator('.head .selector').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>{
    const s=getComputedStyle(n);return {focus:n.classList.contains('focus'),material:[s.backgroundColor,s.borderColor,s.boxShadow]};
   }));
   assert.equal(controls.filter(c=>c.focus).length,1);
   const inactive=controls.filter(c=>!c.focus),focused=controls.find(c=>c.focus);
   for(const control of inactive)assert.deepEqual(control.material,inactive[0].material);
   if(mode==='tv')for(const control of inactive){
    assert.equal(control.material[0],'rgba(0, 0, 0, 0)','Inactive TV controls share the capsule background');
    assert.equal(control.material[1],'rgba(0, 0, 0, 0)','Inactive TV controls have no individual border');
   }
   assert.notDeepEqual(focused.material,inactive[0].material);
  }
  assert.equal(await page.evaluate(()=>document.activeElement.closest('.head')),null);
  if(mode==='tv'){
   await page.evaluate(()=>{Lampa.Storage.set('menu_always',true);Lampa.Controller.toggle('head');});
   await page.keyboard.press('ArrowRight');
   const pinned=await page.locator('body.pt-menu-pinned .head__body .selector:not(.focus)').evaluateAll(nodes=>nodes
    .filter(node=>node.getBoundingClientRect().width>0)
    .map(node=>getComputedStyle(node).borderColor));
   assert.ok(pinned.length>0 && pinned.every(color=>color==='rgba(0, 0, 0, 0)'),'The docked menu also keeps inactive controls borderless');
  }
  assert.deepEqual(r.errors,[]);
 }finally{await r.context.close();}
}
(async()=>{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch();
  try{for(const mode of ['desktop','tv'])for(const theme of ['minimal','glass']){
   await run(browser,mode,theme);
   console.log(engine.name(),mode,theme,'mouse and arrow metadata, normal caption actions and single header selection passed');
  }}finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
