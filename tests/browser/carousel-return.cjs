const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile'])for(const theme of mode==='mobile'?['minimal','glass']:['minimal']){
 const viewport=mode==='mobile'?{width:390,height:844}:mode==='tv'?{width:960,height:540}:{width:2559,height:1410};
 const r=await setup(browser,{viewport,mode},{beforePlugin:page=>page.evaluate(()=>{
  const profile=document.createElement('div');profile.className='head__action selector open--profile';profile.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';document.querySelector('.head__actions').appendChild(profile);const L=Lampa;L.Params.init();L.Layer.init();L.Search.init();L.DeviceInput.init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
  L.TMDB.image=()=> 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#174458"/><circle cx="1400" cy="90" r="70" fill="white"/><rect x="1480" y="800" width="100" height="80" fill="yellow"/></svg>');
  L.Api.main=(o,ok)=>ok(['Сейчас смотрят','История'].map((title,row)=>({title,url:'qa/'+row,results:Array.from({length:20},(_,i)=>({id:row*100+i+1,title:'Film '+i,overview:'A description of the film.',poster_path:'/p.jpg',backdrop_path:'/b.jpg',release_date:'2025-01-01',source:'tmdb'}))})));
  L.Api.full=(p,ok)=>ok({movie:{id:p.id,title:'Film',overview:'Overview',backdrop_path:'/b.jpg',release_date:'2025-01-01',production_companies:[],production_countries:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{cast:[],crew:[]},images:{logos:[]},discuss:{result:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
 })}),{page}=r;
 try{
  await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
  if(mode==='mobile'){await page.setViewportSize({width:320,height:740});await page.waitForTimeout(180);const controls=await page.locator('.head__actions>.head__action').evaluateAll(nodes=>nodes.map(n=>({class:n.className,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width})).filter(n=>n.width>0));for(const n of controls)assert.ok(n.left>=0 && n.right<=320,'Native head controls fit the narrow phone: '+JSON.stringify(controls));await page.setViewportSize(viewport);await page.waitForTimeout(180);}
  await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));await page.waitForSelector('.activity--active .pt-hero__image[src]');await page.waitForTimeout(450);
  const geometry=()=>page.locator('.activity--active .pt-hero').evaluate(h=>({height:h.offsetHeight,row:h.nextElementSibling.offsetTop,width:h.offsetWidth,fit:getComputedStyle(h.querySelector('.pt-hero__image')).objectFit,image:[h.querySelector('.pt-hero__image').naturalWidth,h.querySelector('.pt-hero__image').naturalHeight]}));
  const initial=await geometry();const zoom=await page.locator('.activity--active .pt-hero__image').evaluate(n=>({transform:getComputedStyle(n).transform,origin:getComputedStyle(n).transformOrigin}));assert.match(zoom.transform,mode==='desktop'?/matrix\(1\.12,/:/matrix\(1\.06,/);assert.match(zoom.origin,/ 0px$/,'Zoom anchors the top edge');
  if(mode==='mobile'){const mobile=await page.locator('.activity--active .pt-hero').evaluate(h=>{const i=h.querySelector('.pt-hero__image').getBoundingClientRect(),p=h.querySelector('.pt-hero__body').getBoundingClientRect();return {gap:p.top-i.bottom,position:getComputedStyle(h.querySelector('.pt-hero__body')).position};});assert.equal(mobile.position,'relative');assert.ok(mobile.gap<=20 && mobile.gap>=-25,'No empty image/logo gap: '+JSON.stringify(mobile));}
  assert.equal(initial.fit,'contain','The source keeps its aspect ratio inside the frame');assert.deepEqual(initial.image,[1600,900]);
  if(mode!=='mobile'){
   await page.locator('.activity--active .pt-hero').evaluate(h=>{h.style.marginBottom='2em';document.dispatchEvent(new Event('minimal:hero-layout'));});await page.waitForTimeout(200);const old=await geometry();
   await page.locator('.activity--active .pt-hero').evaluate(h=>{h.style.marginBottom='';document.dispatchEvent(new Event('minimal:hero-layout'));});await page.waitForTimeout(200);
   assert.ok(initial.height>=old.height+4,'Carousel gains real height from the former gap');assert.ok(Math.abs(initial.row-old.row)<=1,'Growing the banner does not push the collection down');
  }
  if(mode==='desktop'){
   await page.evaluate(()=>Lampa.Storage.set('lampa_view_layout','auto'));await page.setViewportSize({width:390,height:844});await page.waitForTimeout(650);
   const flow=await page.locator('.activity--active .pt-hero').evaluate(h=>({mobile:document.body.classList.contains('pt-mobile'),inline:h.style.height,bodyBottom:h.querySelector('.pt-hero__body').getBoundingClientRect().bottom,heroBottom:h.getBoundingClientRect().bottom,dotsTop:h.querySelector('.pt-hero__dots').getBoundingClientRect().top,actionBottom:h.querySelector('.pt-hero__action').getBoundingClientRect().bottom}));
   assert.equal(flow.mobile,true);assert.equal(flow.inline,'','Desktop frame height is released on mobile');assert.ok(flow.heroBottom>=flow.bodyBottom-1 && flow.dotsTop>flow.actionBottom,'Mobile content and dots stay inside their natural frame: '+JSON.stringify(flow));
   await page.evaluate(()=>Lampa.Storage.set('lampa_view_layout','desktop'));await page.setViewportSize(viewport);await page.waitForTimeout(650);assert.ok(Math.abs((await geometry()).height-initial.height)<=1,'Responsive round trip restores desktop geometry');
  }
  // Simulate the native Activity entrance transform without changing layout.
  await page.locator('.activity--active .pt-hero').evaluate(h=>{const host=h.closest('.activity__body');window.qaEntrance=host.animate([{transform:'translateY(120px)'},{transform:'translateY(120px)'}],{duration:10000});document.dispatchEvent(new Event('minimal:hero-layout'));});await page.waitForTimeout(120);
  assert.equal((await geometry()).height,initial.height,'An ancestor entrance animation cannot shrink the frame');await page.evaluate(()=>qaEntrance.cancel());
  await page.locator('.activity--active .pt-hero__action').click();await page.waitForSelector('.activity--active .minimal-detail-header');await page.waitForTimeout(300);await page.evaluate(()=>Lampa.Activity.backward());await page.waitForSelector('.activity--active .pt-hero');
  const samples=[];for(const wait of [60,160,450]){await page.waitForTimeout(wait);samples.push(await geometry());}
  for(const value of samples){assert.ok(Math.abs(value.height-initial.height)<=1,'Returning from a card keeps the first slide height: '+JSON.stringify({mode,initial,value}));assert.ok(Math.abs(value.row-initial.row)<=1,'First collection does not jump on return');}
  const secondDot=page.locator('.activity--active .pt-hero__dot').nth(1);await secondDot.click();await secondDot.and(page.locator('.active')).waitFor();await page.waitForTimeout(150);assert.equal((await geometry()).height,initial.height,'Advancing a slide cannot repair/change frame geometry');
  if(mode==='mobile'){
   // Different artwork proportions and text lengths used to resize the natural-flow panel.
   for(const width of [320,390,430]){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(160);
    const samples=[];
    for(const variant of ['fallback','wide','tall','square','translated','pending','loaded']){
     const sample=await page.locator('.activity--active .pt-hero').evaluate(async(h,variant)=>{
      const logo=h.querySelector('.pt-hero__logo'),title=h.querySelector('.pt-hero__title'),overview=h.querySelector('.pt-hero__overview');
      logo.className='pt-hero__logo'+(['fallback','pending'].includes(variant)?' pt-hidden':'')+(variant==='translated'?' pt-hero__logo--translated':'');
      title.className='pt-hero__title'+(['fallback','pending','translated'].includes(variant)?'':' pt-hidden')+(variant==='translated'?' pt-hero__title--translation':'');
      title.textContent='A long localized title for the current movie';
      overview.textContent=variant==='wide'?'Short synopsis.':variant==='fallback'?'':'A much longer synopsis which wraps across several lines and is clamped without moving the action or the collection. '.repeat(8);
      h.querySelector('.pt-hero__meta>span').textContent=variant==='translated'?'2026 · A longer translated media type · 8.0':'2026 · Film · 8.0';
      if(!['fallback','pending'].includes(variant)){
       const [w,ht]=variant==='tall'?[250,500]:variant==='square'?[500,500]:[1990,449];
       logo.src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${ht}"><rect width="${w}" height="${ht}" fill="white"/></svg>`);await logo.decode();
      }
      const b=n=>{const r=n.getBoundingClientRect();return {top:r.top-h.getBoundingClientRect().top,height:r.height};};
      return {variant,panel:b(h.querySelector('.pt-hero__body')),brand:b(h.querySelector('.pt-hero__branding')),meta:b(h.querySelector('.pt-hero__meta')),overview:b(overview),action:b(h.querySelector('.pt-hero__action')),dots:b(h.querySelector('.pt-hero__dots')),row:h.nextElementSibling.offsetTop,hero:h.offsetHeight,padding:parseFloat(getComputedStyle(h.querySelector('.pt-hero__body')).paddingTop),font:parseFloat(getComputedStyle(h).fontSize)};
     },variant);samples.push(sample);
    }
    const first=samples[0];for(const sample of samples){
     for(const key of ['panel','brand','meta','overview','action','dots'])for(const axis of ['top','height'])assert.ok(Math.abs(sample[key][axis]-first[key][axis])<=1,`${engine.name()} ${theme} ${width}: ${key}.${axis} stays fixed after ${sample.variant}: `+JSON.stringify(samples));
     assert.ok(Math.abs(sample.row-first.row)<=1 && Math.abs(sample.hero-first.hero)<=1,'Content and late logo decode do not move the collection');
     assert.ok(sample.padding>=1.4*sample.font,'Logo has a modest, consistent gap from the image');
     assert.ok(sample.dots.top>=sample.panel.top+sample.panel.height+4,'Phone carousel controls stay below the whole description pane');
    }
   }
   await page.setViewportSize(viewport);await page.waitForTimeout(160);
  }
  if(process.env.LAMPA_QA_OUTPUT){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,'return-'+engine.name()+'-'+mode+'.png')});}
  const layers=await page.locator('.activity--active .pt-hero').evaluate(h=>({image:getComputedStyle(h.querySelector('.pt-hero__image')).zIndex,shade:getComputedStyle(h,':before').zIndex,body:getComputedStyle(h.querySelector('.pt-hero__body')).zIndex}));assert.deepEqual(layers,{image:'0',shade:'1',body:'2'},'Artwork, shade and content use explicit layers');
  assert.match(await page.locator('.activity--active .pt-hero').evaluate(n=>getComputedStyle(n).clipPath),/inset\(/,'Scaled artwork is clipped at the compositor boundary');
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+' '+theme+': gently zoomed artwork, ancestor animation and main/full/Back/slide keep identical geometry');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
