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
   return {titleHeight:tr.height,titleLine:parseFloat(ts.lineHeight),yearGap:yr.top-tr.bottom,title:title.textContent,yearAfterTitle:age.previousElementSibling===title,footerAfterYear:age.nextElementSibling.classList.contains('pt-card-watch'),contentFits:badge.scrollWidth<=badge.clientWidth+1,badgeInside:b.left>=v.left && b.right<=v.right+1,oneLine:b.height<=parseFloat(s.lineHeight)+parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+3,border:frame.borderWidth,contour:frame.backgroundImage};
  });
  assert.equal(card.title,'Очень длинное русское название сериала для двух строк');assert.ok(card.titleHeight>=card.titleLine*1.9 && card.titleHeight<=card.titleLine*2.1 && card.yearGap>=0 && card.yearGap<8,'Two full title lines and the year directly below: '+JSON.stringify(card));assert.ok(card.yearAfterTitle && card.footerAfterYear,'Year stays between title and progress');assert.ok(card.contentFits && card.badgeInside && card.oneLine,'Release badge stays on one line inside the poster');assert.equal(card.border,'0px');assert.match(card.contour,/svg/,'Selection uses a vector contour');
  for(const theme of ['minimal','glass']){
   await page.evaluate(theme=>{Lampa.Storage.set('lampa_view_theme',theme);document.body.classList.add('glass--style', 'platform--browser');const view=document.querySelector('#qa-history-card .card__view');view.querySelector('.card__icons')?.remove();view.insertAdjacentHTML('beforeend','<div class="card__icons"><div class="card__icons-inner"><div class="card__icon icon--book"></div><div class="card__icon icon--like"></div><div class="card__icon icon--wath"></div><div class="card__icon icon--history"></div></div></div>');},theme);await page.waitForTimeout(100);
   const icons=await page.locator('#qa-history-card .card__view').evaluate(view=>{const v=view.getBoundingClientRect();return [...view.querySelectorAll('.card__icon:not(.icon--history)')].map(icon=>{const r=icon.getBoundingClientRect(),s=getComputedStyle(icon);return {left:r.left-v.left,right:r.right-v.left,top:r.top-v.top,bottom:r.bottom-v.top,width:r.width,height:r.height,image:s.backgroundImage,bg:s.backgroundColor};});});
   const overlay=await page.locator('#qa-history-card .card__view').evaluate(view=>{const v=view.getBoundingClientRect(),play=view.querySelector('.icon--history').getBoundingClientRect();return {width:v.width,height:v.height,playX:(play.left+play.right)/2-v.left,playY:(play.top+play.bottom)/2-v.top,layers:[...view.querySelectorAll('.card__icons,.card__icons-inner')].map(node=>{const s=getComputedStyle(node);return {background:s.backgroundColor,filter:s.filter,backdrop:s.backdropFilter || s.webkitBackdropFilter || 'none',shadow:s.boxShadow};})};});
   for(const layer of overlay.layers){assert.equal(layer.backdrop,'none','Native glass must not blur a full-width icon wrapper: '+JSON.stringify({theme,mode,overlay}));assert.equal(layer.background,'rgba(0, 0, 0, 0)');assert.equal(layer.filter,'none');assert.equal(layer.shadow,'none');}
   assert.ok(Math.abs(overlay.playX-overlay.width*.5)<1 && Math.abs(overlay.playY-overlay.height*.60)<1,'Play marker is positioned against the poster, never a filtered icon wrapper: '+JSON.stringify({theme,mode,overlay}));
   assert.equal(icons.length,3);for(let i=0;i<icons.length;i++){assert.ok(icons[i].left>=0 && icons[i].right<=overlay.width+1 && icons[i].top>overlay.height*.7 && icons[i].bottom<=overlay.height+1,'Favorite markers stay along the lower edge: '+JSON.stringify({mode,theme,icons}));if(!i)assert.ok(icons[i].left<overlay.width*.15,'The first mark starts at the left');assert.ok(Math.abs(icons[i].width-icons[i].height)<.5,'Square favorite markers: '+JSON.stringify({mode,theme,icons}));assert.ok(icons[i].image.includes('data:image/svg+xml'));assert.notEqual(icons[i].bg,'rgba(0, 0, 0, 0)');for(const prior of icons.slice(0,i))assert.ok(icons[i].left>=prior.right-1 || icons[i].right<=prior.left+1 || icons[i].top>=prior.bottom-1 || icons[i].bottom<=prior.top+1,'Favorite markers never overlap');}
  }
  await page.evaluate(()=>Lampa.Storage.set('lampa_view_theme','minimal'));
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

  // Native Lampa's manual episode action persists 95%, not 100%.
  await page.evaluate(()=>{
   const data={id:740004,name:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',media_type:'tv',source:'test',seasons:[{season_number:2,episode_count:10}],last_episode_to_air:{season_number:2,episode_number:10,air_date:'2020-01-01'}};
   for(let episode=1;episode<=10;episode++)Lampa.Timeline.update({hash:Lampa.Utils.hash('2'+episode+data.original_name),percent:95,time:0,duration:0});
   const n=document.createElement('div');n.id='qa-native-season';n.className='card focus';n.style.cssText='position:fixed;z-index:50;top:100px;left:40px;width:154px;font-size:18px';n.innerHTML='<div class="card__view"></div><div class="card__title">'+data.name+'</div>';n.card_data=data;document.body.appendChild(n);
  });
  await page.waitForSelector('#qa-native-season .pt-card-watch--complete');
  assert.equal(await page.locator('#qa-native-season .pt-card-watch__label').textContent(),'Сезон 2 просмотрен');
  assert.equal(await page.locator('#qa-native-season .pt-card-watch__time').textContent(),'');
  assert.equal(await page.locator('#qa-native-season .time-line').evaluate(n=>getComputedStyle(n).display),'none','A completed season has no progress track');
  await page.evaluate(()=>Lampa.Timeline.update({hash:Lampa.Utils.hash('210Cyberpunk: Edgerunners'),percent:40,time:915,duration:2400}));
  await page.waitForFunction(()=>!document.querySelector('#qa-native-season .pt-card-watch--complete'));
  assert.equal(await page.locator('#qa-native-season .pt-card-watch__time').textContent(),'15:15');
  assert.notEqual(await page.locator('#qa-native-season .time-line').evaluate(n=>getComputedStyle(n).display),'none','A partial final episode must keep its track');
  await page.locator('#qa-native-season').evaluate(n=>n.remove());

  await stage(page,false);
  const runtime=await page.locator('.nova-hero__runtime').evaluate(node=>{const r=node.getBoundingClientRect(),m=node.closest('.nova-hero__meta').getBoundingClientRect(),h=node.closest('.nova-hero').getBoundingClientRect();return {gap:r.top-m.bottom,right:r.right,edge:h.right,bottom:r.bottom,height:h.bottom};});
  assert.ok(runtime.gap>=2,'Runtime has a real gap below facts: '+JSON.stringify(runtime));assert.ok(runtime.right<=runtime.edge && runtime.bottom<=runtime.height);
  await page.evaluate(()=>{qaRoot.remove();document.querySelector('.nova-plus-root')?.remove();});
  await stage(page,true,2,false,12);await page.evaluate(()=>jQuery('[data-nova-focus=direction]').last().trigger('hover:enter'));
  assert.equal(await page.locator('.nova-episode-nav').count(),0);
  if(mode==='desktop'){
   const strip=page.locator('.nova-plus__strip--clip');const box=await strip.boundingBox();
   await page.mouse.move(box.x+box.width*.5,Math.min(box.y+40,720));
   await page.mouse.wheel(400,0);
   await page.waitForFunction(()=>Number(document.querySelector('.nova-plus__strip--clip .nova__list').dataset.novaX)<0);
   const x=await strip.locator('.nova__list').getAttribute('data-nova-x');
   await page.mouse.down();await page.mouse.move(box.x+box.width*.2,Math.min(box.y+40,720),{steps:6});await page.mouse.up();
   assert.ok(Number(await strip.locator('.nova__list').getAttribute('data-nova-x'))<Number(x),'Mouse drag advances the episode strip');
  }
  assert.deepEqual(r.errors,[]);await r.context.close();console.log(mode+': localized history, year ordering, compact release badge, focus, runtime spacing and episode scroll passed');
 }
}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
