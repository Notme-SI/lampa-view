const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{
 for(const mode of ['desktop','tv']){
  const r=await setup(browser,{viewport:{width:1280,height:800},mode},{beforePlugin:page=>page.evaluate(()=>{
   const L=Lampa;L.Params.init();L.Layer.init();window.qaReloads=0;window.qaMainRequests=0;window.qaHistoryVersion=1;
   window.lampa_settings.account_use=true;window.lampa_settings.account_sync=true;L.Storage.set('account_use',true,true);L.Storage.set('account',{email:'viewer@example.test',token:'isolated-test',profile:{id:7}},true);L.Timeline.read();
   L.Account.Timeline.update=()=>{};L.Account.Bookmarks.update=cb=>setTimeout(()=>cb && cb(),10);
   // This is the current production Activity rule that made favorite/read reload
   // every screen. Keep it active throughout initial and repeated background pulls.
   L.Listener.follow('state:changed',e=>{if(e.target==='favorite' && ['read','profile','clear'].includes(e.reason)){qaReloads++;L.Activity.refresh(true);}});
   L.Account.Api.watchHistory=(p,ok)=>setTimeout(()=>ok({results:(qaHistoryVersion===1?[2,1]:[1,2]).map(id=>({id,title:'История '+id,original_title:'History '+id,poster_path:'/poster.jpg',source:'tmdb',watch_history:{watched_at:qaHistoryVersion*100+id}})),page:p.page,total_pages:1}),80);
   L.Plugins.get=()=>[{url:'http://lampac.test/timecode.js'}];
   jQuery.ajax=p=>{const timer=setTimeout(()=>p.success && p.success({rows:[],version:0,truncated:false}),5);return {abort(){clearTimeout(timer);}};};
   L.Api.main=(params,ok)=>{qaMainRequests++;setTimeout(()=>ok([{title:'Сейчас смотрят',url:'qa/first',results:Array.from({length:10},(_,id)=>({id:id+100,title:'Фильм '+id,original_title:'Movie '+id,poster_path:'/poster.jpg',backdrop_path:'/banner.jpg',overview:'Описание',source:'tmdb'}))}]),5);};
  })}),{page}=r;
  await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));
  await page.waitForFunction(()=>Lampa.Activity.active().activity.component.items.some(row=>row.data.url==='minimal:continue'));
  assert.deepEqual(await page.evaluate(()=>Lampa.Activity.active().activity.component.items.find(row=>row.data.url==='minimal:continue').data.results.map(card=>card.id)),[2,1],'First render already has CUB order');
  await page.evaluate(()=>{window.qaMainNode=document.querySelector('.activity--active');window.qaClock=Date.now;});
  for(let tick=1;tick<=3;tick++){
   await page.evaluate(tick=>{qaHistoryVersion++;Date.now=()=>qaClock()+tick*31000;LampaView.sync.refresh();},tick);await page.waitForTimeout(130);
   const state=await page.evaluate(()=>({reloads:qaReloads,requests:qaMainRequests,same:qaMainNode===document.querySelector('.activity--active'),cards:qaMainNode.querySelectorAll('.card').length}));
   assert.equal(state.reloads,0);assert.equal(state.requests,1);assert.equal(state.same,true);assert.ok(state.cards>=10);
  }
  // Explicit navigation uses the refreshed cache, while idle sync keeps the old
  // row and focus intact instead of replacing the whole home activity.
  await page.evaluate(()=>Lampa.Activity.replace({component:'main',source:'tmdb'}));await page.waitForTimeout(160);
  assert.deepEqual(await page.evaluate(()=>Lampa.Activity.active().activity.component.items.find(row=>row.data.url==='minimal:continue').data.results.map(card=>card.id)),[1,2]);
  assert.deepEqual(r.errors,[]);await r.context.close();console.log(engine.name()+' '+mode+': one initial load, silent repeated sync, stable home DOM and fresh next opening');
 }
 }finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
