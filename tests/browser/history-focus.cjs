const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{
 for(const mode of ['desktop','tv']){
  const r=await setup(browser,{viewport:{width:1020,height:800},mode}),{page}=r;
  if(mode==='tv')await page.evaluate(()=>document.body.classList.add('platform--android','light--version','advanced--animation'));
  await page.evaluate(()=>{
   const node=document.createElement('div');node.id='qa-history-card';node.className='card card--tv focus';node.style.cssText='position:fixed;top:100px;left:40px;width:154px;font-size:18px';
   node.innerHTML='<div class="card__view"></div><div class="card__title">English title</div><div class="pt-card-watch"></div><div class="card__age">2025</div>';document.body.appendChild(node);
   const data={id:740001,name:'Очень длинное русское название сериала для двух строк',title:'English title',original_name:'English title',first_air_date:'2025-01-01',source:'test',media_type:'tv',quality:'4K',seasons:[{season_number:10,episode_count:6}],last_episode_to_air:{season_number:10,episode_number:3,air_date:'2025-01-01'}};
   Lampa.Listener.send('line',{type:'visible',data:{results:[data]},items:[{data,render:()=>node}]});
  });
  await page.waitForSelector('#qa-history-card .pt-series-status');await page.waitForTimeout(100);
  const card=await page.locator('#qa-history-card').evaluate(node=>{
   const title=node.querySelector('.card__title'),age=node.querySelector('.card__age'),badge=node.querySelector('.pt-series-status'),b=badge.getBoundingClientRect(),v=node.querySelector('.card__view').getBoundingClientRect(),s=getComputedStyle(badge),frame=getComputedStyle(node.querySelector('.card__view'),':after');
   const tr=title.getBoundingClientRect(),yr=age.getBoundingClientRect(),ts=getComputedStyle(title);
   return {titleHeight:tr.height,titleLine:parseFloat(ts.lineHeight),yearGap:yr.top-tr.bottom,title:title.textContent,yearAfterTitle:age.previousElementSibling===title,footerAfterYear:age.nextElementSibling.classList.contains('pt-card-watch'),contentFits:badge.scrollWidth<=badge.clientWidth+1,badgeInside:b.left>=v.left && b.right<=v.right+1,oneLine:b.height<=parseFloat(s.lineHeight)+parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+3,border:frame.borderWidth};
  });
  assert.equal(card.title,'Очень длинное русское название сериала для двух строк');assert.ok(card.titleHeight>=card.titleLine*1.9 && card.titleHeight<=card.titleLine*2.1 && card.yearGap>=0 && card.yearGap<8,'Two full title lines and the year directly below: '+JSON.stringify(card));assert.ok(card.yearAfterTitle && card.footerAfterYear,'Year stays between title and progress');assert.ok(card.contentFits && card.badgeInside && card.oneLine,'Release badge stays on one line inside the poster');assert.equal(card.border,'2px');
  await page.locator('#qa-history-card').evaluate(node=>node.remove());
  // Real Lampa custom focus uses jQuery.trigger; dispatchEvent does not cover it.
  await page.evaluate(()=>{
   window.testNetwork=(url,ok)=>setTimeout(()=>ok(/\/tv\/740002\?/.test(url)?{id:740002,seasons:[{season_number:2,episode_count:10}],last_episode_to_air:{season_number:2,episode_number:6,air_date:'2025-01-01'}}:{results:[]}),25);
   const add=(id,data)=>{const n=document.createElement('div');n.id=id;n.className='card';n.style.cssText='position:fixed;z-index:50;top:100px;left:'+(id==='qa-movie'?240:40)+'px;width:154px;font-size:18px';n.innerHTML='<div class="card__view"></div><div class="card__title">'+(data.title || data.name)+'</div>';n.card_data=data;document.body.appendChild(n);return n;};
   add('qa-release',{id:740002,name:'Сериал',original_name:'Original series',first_air_date:'2025-01-01',media_type:'tv',source:'tmdb'});
   Lampa.Timeline.update({hash:Lampa.Utils.hash('Локальный фильм'),percent:40,time:969,duration:2400});
   add('qa-movie',{id:740003,title:'Локальный фильм',original_title:'Original movie',release_date:'2025-01-01',media_type:'movie',source:'test'});
  });
  await page.waitForSelector('#qa-release .pt-card-watch',{state:'attached'});
  await page.waitForSelector('#qa-movie .pt-card-watch',{state:'attached'});
  await page.locator('#qa-release').hover();
  await page.waitForSelector('#qa-release .pt-series-status');
  assert.equal(await page.locator('#qa-release .pt-series-status').textContent(),'Сезон 2 • Серия 6/10','Release metadata loads on native focus without opening the full card');
  await page.evaluate(()=>{jQuery('#qa-release').removeClass('focus');jQuery('#qa-movie').addClass('focus').triggerHandler('hover:focus');});
  await page.waitForSelector('#qa-movie .pt-card-watch--has-progress');
  assert.equal(await page.locator('#qa-movie .pt-card-watch__time').textContent(),'16:09','Saved movie aliases work without a native watched overlay');
  const progress=await page.locator('#qa-movie').evaluate(n=>{
   const line=n.querySelector('.time-line'),fill=line.firstElementChild,t=n.querySelector('.pt-card-watch__time'),r=line.getBoundingClientRect(),f=fill.getBoundingClientRect();
   return {width:r.width,height:r.height,fill:f.width,fillHeight:f.height,display:getComputedStyle(line).display,right:r.right,timeLeft:t.getBoundingClientRect().left};
  });
  assert.ok(progress.width>50 && progress.height>=2 && progress.fillHeight>=2,'Track and fill must have visible dimensions: '+JSON.stringify(progress));
  assert.ok(Math.abs(progress.fill/progress.width-.4)<.02 && progress.right<progress.timeLeft,'Fill and actual time share one row');
  await page.evaluate(()=>{document.querySelector('#qa-release').remove();document.querySelector('#qa-movie').remove();});

  await stage(page,false);
  const runtime=await page.locator('.nova-hero__runtime').evaluate(node=>{const r=node.getBoundingClientRect(),m=node.closest('.nova-hero__meta').getBoundingClientRect(),h=node.closest('.nova-hero').getBoundingClientRect();return {gap:r.top-m.bottom,right:r.right,edge:h.right,bottom:r.bottom,height:h.bottom};});
  assert.ok(runtime.gap>=2,'Runtime has a real gap below facts: '+JSON.stringify(runtime));assert.ok(runtime.right<=runtime.edge && runtime.bottom<=runtime.height);
  await page.evaluate(()=>{qaRoot.remove();document.querySelector('.nova-plus-root')?.remove();});
  await stage(page,true,2);await page.evaluate(()=>jQuery('[data-nova-focus=direction]').last().trigger('hover:enter'));
  const arrows=page.locator('.nova-episode-nav button');
  if(mode==='desktop'){
   await arrows.first().hover();assert.equal(await arrows.first().evaluate(n=>getComputedStyle(n).borderColor),'rgb(173, 217, 229)');
   await page.mouse.move(0,0);await page.keyboard.press('Tab');await arrows.last().focus();assert.equal(await arrows.last().evaluate(n=>getComputedStyle(n).borderColor),'rgb(173, 217, 229)');
  }else {const nav=page.locator('.nova-episode-nav');assert.ok(await nav.count()===0 || await nav.evaluate(n=>getComputedStyle(n).display)==='none');}
  assert.deepEqual(r.errors,[]);await r.context.close();console.log(mode+': localized history, year ordering, compact release badge, focus, runtime spacing and episode arrows passed');
 }
}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
