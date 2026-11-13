const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile']){
 const r=await setup(browser,{viewport:mode==='tv'?{width:960,height:540}:mode==='mobile'?{width:390,height:844}:{width:1920,height:1080},mode}),{page}=r;
 try{
  await page.evaluate(()=>{const L=Lampa;L.Params.init();L.Layer.init();L.DeviceInput.init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));window.readableCase=(long)=>{
   const movie={id:long?92:91,name:long?'Очень длинное название произведения: '.repeat(12):'Сериал',original_name:long?'追放されたチート付与魔術師は気ままなセカンドライフを謳歌する。'.repeat(8):'Series',overview:long?'Полное описание произведения. '.repeat(100):'Короткое описание.',first_air_date:'2026-01-01',vote_average:8,production_countries:[],production_companies:[],spoken_languages:[],number_of_seasons:1,number_of_episodes:8,genres:[],source:'tmdb'};
   window.readableMovie=movie;L.Api.full=(p,ok)=>ok({movie,persons:{cast:[{id:77,name:'Актёр',profile_path:'/person.jpg',character:'Роль'}],crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});L.Activity.push({component:'full',id:movie.id,method:'tv',source:'tmdb',card:movie});};readableCase(false);});
  await page.waitForSelector('.activity--active .minimal-detail-heading');await page.waitForTimeout(150);
  for(const selector of ['.minimal-overview-action','.minimal-detail-heading','.minimal-identity-title','.minimal-title-action']){
   const node=page.locator('.activity--active '+selector);assert.equal(await node.getAttribute('role'),null,'Fitting text has no action: '+selector+' '+JSON.stringify(await node.evaluate(n=>({text:n.textContent,cw:n.clientWidth,sw:n.scrollWidth,ch:n.clientHeight,sh:n.scrollHeight,css:getComputedStyle(n).cssText,box:n.getBoundingClientRect().toJSON()}))));await node.dispatchEvent('click');assert.equal(await page.locator('.minimal-overview-full').count(),0);
  }
  await page.evaluate(()=>readableCase(true));await page.waitForSelector('.activity--active .minimal-title-action.selector');await page.waitForSelector('.activity--active .minimal-overview-action.selector');
  const root='.activity--active ',overview=page.locator(root+'.minimal-overview-action');
  for(const selector of ['.minimal-detail-heading','.minimal-identity-title','.minimal-title-action']){
   const node=page.locator(root+selector),box=await node.evaluate(n=>{const s=getComputedStyle(n);return {height:n.clientHeight,line:parseFloat(s.lineHeight),white:s.whiteSpace};});assert.equal(box.white,'nowrap');assert.ok(box.height<=box.line+2,JSON.stringify(box));
   await node.dispatchEvent('click');assert.equal(await page.locator('.minimal-overview-full').textContent(),await page.evaluate(selector=>selector==='.minimal-title-action'?readableMovie.original_name:readableMovie.name,selector));await page.evaluate(()=>Lampa.Controller.back());
  }
  await page.evaluate(()=>{const n=document.querySelector('.activity--active .minimal-overview-action');Lampa.Controller.toggle('full_start');Lampa.Controller.collectionFocus(jQuery(n),jQuery(n.closest('.full-start-new')));});await page.waitForTimeout(280);
  const style=await overview.evaluate(n=>{const s=getComputedStyle(n);return {shadow:s.textShadow,outline:s.outlineStyle,border:s.borderTopWidth,title:n.title,ring:n.querySelector('.minimal-overview-focus')!==null};});assert.notEqual(style.shadow,'none');assert.equal(style.outline,'none');assert.equal(style.border,'0px');assert.equal(style.title,'');assert.equal(style.ring,false);
  await page.keyboard.press('Enter');await page.waitForSelector('.minimal-overview-full');assert.equal(await page.locator('.minimal-overview-full').textContent(),await page.evaluate(()=>readableMovie.overview));await page.evaluate(()=>Lampa.Controller.back());assert.equal(await overview.evaluate(n=>n.classList.contains('focus')),true);
  const sizes=await page.locator(root+'.minimal-detail-columns').evaluate(n=>({cast:n.querySelector('.minimal-detail-cast').getBoundingClientRect().height,facts:n.querySelector('.minimal-detail-facts').getBoundingClientRect().height,align:getComputedStyle(n).alignItems}));if(mode!=='mobile'){assert.equal(sizes.align,'start');assert.ok(sizes.cast<sizes.facts,JSON.stringify(sizes));}
  if(process.env.LAMPA_QA_OUTPUT && mode==='desktop')await page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-readable-detail.png')});
  // A responsive heading becomes an action only after its actual box clips.
  await page.evaluate(()=>{document.querySelector('.activity--active .minimal-detail-heading').textContent='Название средней длины для проверки изменения размера окна';});
  await page.setViewportSize({width:2560,height:1440});await page.waitForTimeout(180);assert.equal(await page.locator(root+'.minimal-detail-heading').getAttribute('role'),null);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);const narrow=await page.locator(root+'.minimal-detail-heading').evaluate(n=>({role:n.getAttribute('role'),clips:n.scrollWidth>n.clientWidth+1}));assert.equal(narrow.role,narrow.clips?'button':null);
  assert.deepEqual(r.errors,[]);console.log(engine.name(),mode,'conditional text actions, single-line titles, glow and return focus passed');
 }finally{await r.context.close();}
 }}finally{await browser.close();}}})().catch(error=>{console.error(error);process.exitCode=1;});
