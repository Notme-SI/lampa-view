const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile']){
 const r=await setup(browser,{viewport:mode==='tv'?{width:960,height:540}:mode==='mobile'?{width:390,height:844}:{width:1440,height:900},mode}),{page}=r;
 try{
  await page.evaluate(()=>{Lampa.Params.init();Lampa.Layer.init();Lampa.Api.full=(p,ok)=>ok({movie:{id:91,name:'Series',original_name:'Series',overview:'A readable series description.',backdrop_path:'/background.jpg',first_air_date:'2025-01-01',production_countries:[],production_companies:[],spoken_languages:[],number_of_seasons:2,number_of_episodes:20,vote_average:8,genres:[],source:'tmdb'},persons:{crew:[{id:90,name:'Native director',profile_path:'/director.jpg',job:'Director'}],cast:Array.from({length:18},(_,i)=>({id:100+i,name:'Native actor '+i,profile_path:'/person.jpg',character:'Role'}))},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});Lampa.Activity.push({component:'full',id:91,method:'tv',source:'tmdb',card:{id:91,name:'Series'}});});
  await page.waitForSelector('.minimal-detail-columns');
  for(const theme of ['minimal','glass']){
   await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);await page.waitForTimeout(450);
   const value=await page.locator('.activity--active').evaluate(root=>{const background=root.querySelector('.full-start__background');if(!background)return {nativeBackground:false};const b=background.getBoundingClientRect(),cast=root.querySelector('.minimal-detail-columns').getBoundingClientRect(),header=root.querySelector('.minimal-detail-header').getBoundingClientRect();return {backgroundBottom:b.bottom,castBottom:cast.bottom,headerBottom:header.bottom,headerTop:header.top,first:root.querySelector('.full-person__name').textContent,mask:getComputedStyle(root.querySelector('.full-start__background')).maskImage};});
   if(value.nativeBackground===false){assert.equal(mode,'mobile','Only the native mobile template may omit its backdrop');continue;}
   assert.ok(value.backgroundBottom>=value.castBottom-1,'Backdrop reaches beneath the complete cast/facts block: '+JSON.stringify({mode,theme,value}));assert.ok(value.backgroundBottom<=value.headerBottom+2,'Backdrop fades before comments/recommendations');assert.equal(value.first,'Native director');assert.ok(value.mask.includes('gradient'));
  }
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+': native credits and full-height fading backdrop in both themes');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
