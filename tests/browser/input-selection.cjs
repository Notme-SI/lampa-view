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
    const node=card.render(true);node.style.width='180px';root.appendChild(node);
   });
   Lampa.Controller.add('qa-cards',{
    toggle(){Lampa.Controller.collectionSet(root);Lampa.Controller.collectionFocus(root.firstElementChild,root);},
    right(){Navigator.move('right');},left(){Navigator.move('left');}
   });
  },theme);
  const film=page.locator('#qa-input .card').nth(0),series=page.locator('#qa-input .card').nth(1);
  await film.locator('.pt-poster-selection').waitFor({state:'attached'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  if(mode==='desktop'){
   await film.hover();
   await page.waitForFunction(()=>{const label=document.querySelector('#qa-input .pt-card-watch');return label && getComputedStyle(label).visibility==='visible';});
   await page.waitForTimeout(330);
   assert.equal(await film.locator('.pt-poster-selection').evaluate(n=>getComputedStyle(n).opacity),'1');
   await page.mouse.move(2,2);
   await page.waitForTimeout(330);
   assert.equal(await film.locator('.pt-poster-selection').evaluate(n=>getComputedStyle(n).opacity),'0');
  }
  await page.evaluate(()=>Lampa.Controller.toggle('qa-cards'));
  await page.waitForTimeout(35);
  assert.equal(await film.locator('.pt-poster-selection').evaluate(n=>n.getAnimations().some(a=>a.playState==='running')),true,'The play layer animates over real frames');
  const entering=await film.locator('.pt-poster-selection').evaluate(n=>({opacity:Number(getComputedStyle(n).opacity),transform:getComputedStyle(n).transform}));
  assert.ok(entering.opacity>0 && entering.opacity<1,JSON.stringify(entering));
  await page.waitForTimeout(330);
  assert.equal(await film.locator('.pt-poster-selection__meta').count(),0);
  assert.equal(await film.locator('.card__age').textContent(),'2020');
  assert.equal(await film.locator('.card__vote').evaluate(n=>getComputedStyle(n).opacity),'1','Our own rating remains visible');
  assert.equal(await film.locator('.pt-poster-selection').evaluate(n=>getComputedStyle(n).opacity),'1');
  assert.equal(await film.locator('.pt-poster-selection').evaluate(n=>getComputedStyle(n).transform),'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(await film.locator('.card__view').evaluate(n=>getComputedStyle(n).transform),'matrix(1, 0, 0, 1, 0, -3)');
  await page.waitForFunction(()=>{const label=document.querySelector('#qa-input .pt-card-watch');return label && getComputedStyle(label).visibility==='visible';});
  assert.equal(await film.locator('.pt-card-watch__time').textContent(),'15:15');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(330);
  assert.equal(await film.locator('.pt-poster-selection').evaluate(n=>getComputedStyle(n).opacity),'0','The old overlay disappears after moving focus');
  assert.equal(await series.locator('.pt-poster-selection').evaluate(n=>getComputedStyle(n).opacity),'1');
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
   assert.notDeepEqual(focused.material,inactive[0].material);
  }
  assert.equal(await page.evaluate(()=>document.activeElement.closest('.head')),null);
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
