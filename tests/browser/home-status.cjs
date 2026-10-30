const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [mode,hero] of [['desktop',true],['tv',true],['desktop',false]]){
  const r=await setup(browser,{viewport:{width:1280,height:720},mode},{beforePlugin:page=>page.evaluate(hero=>{const L=Lampa;L.Params.init();L.Layer.init();L.Storage.set('lampa_view_hero',hero);L.Api.main=(o,ok)=>setTimeout(()=>ok([{title:'Сейчас смотрят',url:'qa/first',results:Array.from({length:10},(_,i)=>({id:500+i,name:'Сериал '+i,original_name:'Series '+i,original_title:'Series '+i,overview:'Описание.',backdrop_path:'/banner.jpg',poster_path:'/poster.jpg',first_air_date:'2025-01-01',genre_ids:[18],source:'tmdb'}))}]),40);},hero)});
  await r.page.evaluate(()=>{Lampa.DeviceInput.init();Lampa.Controller.observe();Navigator.follow('focus',e=>Lampa.Controller.focus(e.elem));Lampa.Activity.push({component:'main',source:'tmdb'});});await r.page.waitForTimeout(900);
  const focus=await r.page.evaluate(()=>({controller:Lampa.Controller.enabled().name,focused:document.querySelector('.focus')?.className,details:!!document.querySelector('.pt-hero__actions .pt-hero__action.focus'),cards:document.querySelectorAll('.activity--active .card.focus').length}));
  console.log(mode,hero,focus);if(hero)assert.equal(focus.details,true);else assert.ok(focus.cards>0);
  if(hero){
   await r.page.evaluate(()=>{Lampa.TimeTable.get=()=>[{season_number:2,episode_number:8,air_date:'2020-01-01'}];Lampa.Api.sources.tmdb.get=(path,p,ok)=>ok({id:500,seasons:[{season_number:2,episode_count:10}],last_episode_to_air:{season_number:2,episode_number:8,air_date:'2020-01-01'}});Lampa.Storage.set('online_watched_last',{[Lampa.Utils.hash('Series 0')]:{season:2,episode:6}});Lampa.Controller.enabled().controller.down();Lampa.Controller.enabled().controller.down();});
   await r.page.waitForTimeout(350);const status=await r.page.locator('.activity--active .card.focus .pt-series-status').evaluate(n=>{const r=n.getBoundingClientRect(),p=n.closest('.card__view').getBoundingClientRect();return {text:n.textContent,font:parseFloat(getComputedStyle(n).fontSize),transform:getComputedStyle(n).transform,inside:r.left>=p.left-1 && r.right<=p.right+1 && r.top>=p.top-1 && r.bottom<=p.bottom+1};});
   assert.match(status.text,/Сезон 2 · Серия 6/);assert.match(status.text,/Вышло 8/);assert.equal(status.transform,'none');assert.equal(status.inside,true);console.log(mode,status);
   if(process.env.LAMPA_QA_OUTPUT && mode==='desktop')await r.page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,'lampa-series-status.png')});
  }
  assert.deepEqual(r.errors,[]);await r.context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
