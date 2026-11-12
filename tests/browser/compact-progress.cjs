const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs'),response=require('../fixtures/discovery-response.cjs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});const results=[];try{
 for(const mode of ['desktop','tv'])for(const layout of ['rows','grid']){
  const r=await setup(browser,{mode,viewport:{width:1440,height:900}},{plugin:process.env.SPACING_BASELINE,beforePlugin:page=>page.evaluate(()=>{
   const L=Lampa;L.Params.init();L.Layer.init();L.Storage.set('lampa_view_hero',false);
   document.querySelector('.wrap').classList.add('layer--height','layer--width');document.querySelector('.wrap__content').classList.add('layer--height');L.Layer.update();
   const image=()=> 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#364354"/></svg>');for(const api of [L.Api,L.TMDB,L.Api.sources.tmdb])api.img=image;
   L.Api.main=(q,ok)=>setTimeout(()=>ok(Array.from({length:3},(_,row)=>({title:row?'Следующая подборка':'История просмотра',url:'qa/'+row,results:Array.from({length:20},(_,i)=>({id:row*100+i+1,title:i%2?'Короткое название':'Очень длинное название сериала в две строки',poster_path:'/poster.jpg',release_date:'2026-01-01',source:'tmdb',vote_average:8,quality:'4K'}))}))),0);
  })});
  try{
   const {page}=r;
   await page.evaluate(({layout,fixture})=>{const respond=eval('('+fixture+')');Lampa.Api.sources.tmdb.get=(url,p,ok)=>setTimeout(()=>{const data=respond(url,p.page);ok({...data,results:data.results.map((c,i)=>({...c,title:i%2?'Короткое название':'Очень длинное название сериала для проверки двух строк',name:i%2?'Короткое название':'Очень длинное название сериала для проверки двух строк'}))});},0);Lampa.Activity.push(layout==='rows'?{component:'main',source:'tmdb'}:{component:'category',url:'tv',source:'tmdb',page:1,title:'Сериалы'});},{layout,fixture:response.toString()});
   await page.waitForSelector('.activity--active .card');await page.waitForTimeout(350);
   await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.activity--active .card')];
    for(const card of cards){const slot=card.querySelector('.pt-card-watch');if(!slot)continue;card.classList.add('focus');slot.classList.add('pt-card-watch--has-progress');slot.innerHTML='<div class="card-watched"><div class="card-watched__body"><div class="pt-card-watch__current"><div class="pt-card-watch__row"><span class="pt-card-watch__label"><span class="pt-card-watch__heading">Просмотрено:</span><span>Серия 10</span><span> • Сезон 2</span></span></div><div class="pt-card-watch__meter"><div class="time-line"><div style="width:35%"></div></div><span class="pt-card-watch__time">18:35</span></div></div></div></div>';}
   });
   await page.waitForTimeout(50);
   const geometry=await page.evaluate(layout=>{
    const cards=[...document.querySelectorAll('.activity--active .card')],viewport=document.querySelector('.activity--active .pt-browser-catalogue').getBoundingClientRect();
    const visible=cards.filter(c=>{const b=c.getBoundingClientRect();return b.top>=viewport.top && b.top<viewport.bottom;});
    const checks=visible.slice(0,8).map(card=>{const age=card.querySelector('.card__age').getBoundingClientRect(),label=card.querySelector('.pt-card-watch__label').getBoundingClientRect(),meter=card.querySelector('.pt-card-watch__meter').getBoundingClientRect(),bounds=card.getBoundingClientRect();return {gap:label.top-age.bottom,overflow:Math.max(label.bottom,meter.bottom)-bounds.bottom,label:card.querySelector('.pt-card-watch__label').textContent,time:card.querySelector('.pt-card-watch__time').textContent};});
    const rows=[...document.querySelectorAll('.activity--active .items-line')];const section=rows.length>1?rows[1].querySelector('.items-line__head').getBoundingClientRect().top-rows[0].querySelector('.pt-card-watch__meter').getBoundingClientRect().bottom:null;
    return {checks,section};
   },layout);
   if(!process.env.SPACING_BASELINE){for(const check of geometry.checks){assert.ok(check.gap>=0 && check.gap<5,JSON.stringify(check));assert.ok(check.overflow<1,'Progress fits card: '+JSON.stringify(check));assert.match(check.label,/Серия 10.*Сезон 2/);assert.equal(check.time,'18:35');}}
   if(process.env.SPACING_SCREENSHOT)await page.screenshot({path:path.join(process.env.SPACING_SCREENSHOT,mode+'-'+layout+'-progress.png')});
   assert.deepEqual(r.errors,[]);results.push({mode,layout,...geometry,errors:r.errors});
  }finally{await r.context.close();}
 }
 console.log(JSON.stringify(results,null,2));if(process.env.SPACING_REPORT)fs.writeFileSync(process.env.SPACING_REPORT,JSON.stringify(results,null,2));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
