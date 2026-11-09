const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile']){
 const r=await setup(browser,{viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},mode}),{page}=r;
 for(const theme of ['minimal','glass']){
  await page.evaluate(theme=>{
   window.lampa_settings.account_use=true;Lampa.Storage.set('lampa_view_theme',theme);document.querySelector('#qa-posters')?.remove();const host=document.createElement('div');host.id='qa-posters';host.style.cssText='display:grid;grid-template-columns:repeat('+(document.body.classList.contains('pt-mobile')?2:4)+',minmax(0,1fr));width:90%;margin:100px auto;gap:12px';document.body.appendChild(host);window.qaCards=[];
   for(const [id,kind,genre,language] of [[501,'movie',18,'en'],[502,'tv',18,'en'],[503,'movie',16,'en'],[504,'tv',16,'ja']]){
    const data={id,media_type:kind,title:'Название '+id,original_title:'Name '+id,...(kind==='tv'?{name:'Название '+id,original_name:'Name '+id,first_air_date:'2020-01-01'}:{release_date:'2020-01-01'}),genre_ids:[genre],original_language:language,quality:'4K',vote_average:8.6,source:'tmdb',poster_path:'/p.jpg'};
    const card=Lampa.Maker.make('Card',data);card.create();const node=card.render(true);node.style.cssText='flex:1 1 0;min-width:0';host.appendChild(node);qaCards.push(card);card.visible();
   }
   const card=qaCards[1],data=card.data;for(const key of ['book','like','wath','history'])if(!Lampa.Favorite.check(data)[key])Lampa.Favorite.toggle(key,data);
  },theme);
  await page.waitForTimeout(250);
  const badges=await page.locator('#qa-posters .card').evaluateAll(cards=>cards.map(card=>{
   const view=card.querySelector('.card__view'),v=view.getBoundingClientRect(),rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
   const kind=card.querySelector('.pt-kind'),quality=card.querySelector('.pt-quality'),vote=card.querySelector('.card__vote');
   return {type:kind?.textContent,kind:kind&&rect(kind),quality:quality&&rect(quality),vote:vote&&rect(vote),kindStyle:['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius'].map(key=>parseFloat(getComputedStyle(kind)[key])),kindFont:getComputedStyle(kind).fontSize,qualityFont:getComputedStyle(quality).fontSize,kindFill:getComputedStyle(kind).backgroundColor,qualityFill:getComputedStyle(quality).backgroundColor,voteFill:getComputedStyle(vote).backgroundColor,voteText:getComputedStyle(vote).color,voteSheen:getComputedStyle(vote).backgroundImage,voteFilter:getComputedStyle(vote).backdropFilter,playFill:card.querySelector('.icon--history') && getComputedStyle(card.querySelector('.icon--history')).backgroundColor,source:vote?.dataset.ratingSource,label:vote&&getComputedStyle(vote,':after').content,view:rect(view),icons:[...card.querySelectorAll('.card__icon:not(.icon--history)')].map(rect),play:card.querySelector('.icon--history')&&rect(card.querySelector('.icon--history'))};
  }));
  assert.deepEqual(badges.map(b=>b.type),['Фильм','Сериал','Мультфильм','Аниме']);
  for(const b of badges){
   assert.ok(b.kind && b.quality && b.vote);assert.equal(b.source,'TMDB');assert.equal(b.label,'"TMDB"');assert.ok(b.kind.left>b.view.left && b.kind.left-b.view.left<9,'Kind badge sits next to the left edge');assert.ok(b.kindStyle.every(radius=>radius>0),'All four corners are rounded');assert.equal(b.kindFill,b.voteFill);assert.equal(b.qualityFill,b.voteFill);
   assert.match(b.voteFill,theme==='glass'?(mode==='tv'?/^rgba\(18, 18, 18, 0\.85/:/^rgba\(18, 18, 18, 0\.24/):/^rgba\(25, 23, 21, 0\.9/);
   assert.equal(b.voteText,'rgb(255, 255, 255)');assert.equal(b.voteSheen.startsWith('linear-gradient'),theme==='glass');assert.equal(b.voteFilter,'none');assert.ok(b.quality.left>b.kind.right);assert.equal(b.qualityFont,b.kindFont,"Type and quality use the same text size");assert.ok(Math.abs(b.quality.height-b.kind.height)<1,"Type and quality use the same height");assert.ok(Math.abs(b.quality.top-b.kind.top)<1,"Type and quality share a top edge");
   const inset=mode==='tv'?parseFloat(b.kindFont)*.35:6;assert.ok(b.view.right-b.quality.right>=inset);assert.ok(b.view.bottom-b.vote.bottom>=inset);assert.ok(b.vote.top>b.view.top+b.view.height/2);
  }
  assert.equal(badges[1].icons.length,3);for(const icon of badges[1].icons)assert.ok(icon.right<badges[1].vote.left && icon.bottom<=badges[1].view.bottom+1);assert.ok(badges[1].play.width>10);assert.equal(badges[1].playFill,badges[1].voteFill,'The play button uses the same tint as the score');
  if(theme==='glass'){
   const surfaces=await page.evaluate(()=>{
    const sample=document.createElement('div');sample.className='minimal-detail-header';sample.innerHTML='<div class="full-start-new__reactions"><div class="reaction">1</div></div>';document.body.appendChild(sample);
    const surface=node=>{const s=getComputedStyle(node);return [s.backgroundImage,s.backgroundColor,s.borderColor,s.boxShadow,s.backdropFilter];};
    const reaction=surface(sample.querySelector('.reaction')),badges=[...document.querySelectorAll('#qa-posters .pt-kind,#qa-posters .pt-quality,#qa-posters .card__vote,#qa-posters .pt-series-status')].map(surface);sample.remove();return {reaction,badges};
   });
   for(const badge of surfaces.badges){assert.deepEqual([badge[0],...badge.slice(2)],[surfaces.reaction[0],...surfaces.reaction.slice(2)],'Badges retain the reaction sheen and edge');assert.equal(badge[1],mode==='tv'?'rgba(18, 18, 18, 0.85)':'rgba(18, 18, 18, 0.24)','Poster tags use the device-specific readable tint');}
  }
  const narrow=await page.locator('#qa-posters .card').nth(1).evaluate(card=>{
   document.body.classList.add('pt-wheel-active');
   card.style.width=(parseFloat(getComputedStyle(card).fontSize)*6.7)+'px';
   const view=card.querySelector('.card__view'),score=view.querySelector('.card__vote').getBoundingClientRect();
   const icons=[...view.querySelectorAll('.card__icon:not(.icon--history)')].map(icon=>icon.getBoundingClientRect());
   const clear=icons.every(icon=>score.left-icon.right>=5);
   card.style.removeProperty('width');document.body.classList.remove('pt-wheel-active');
   document.dispatchEvent(new Event('minimal:wheel-idle'));
   return {clear,wrap:new Set(icons.map(icon=>icon.top)).size>1};
  });
  assert.equal(narrow.clear,true,'Favorites must clear the score even while measurements are paused');
  assert.equal(narrow.wrap,true,'A narrow poster wraps the third favorite icon');
  const states=await page.evaluate(()=>{
   const card=qaCards[1],data=card.data,menu=card.menu_list.find(row=>row.title===Lampa.Lang.translate('settings_input_links')),premium=Lampa.Account.hasPremium,states=[];Lampa.Account.hasPremium=()=>false;
   const entries=menu.menu().filter(i=>['look','viewed','scheduled','continued','thrown'].includes(i.where)),locked=entries.length===5 && entries.every(i=>i.noenter);Lampa.Account.hasPremium=()=>true;
   for(const where of ['look','viewed','scheduled','continued','thrown']){
    const item=menu.menu().find(i=>i.where===where);item.onSelect(item);const state=Lampa.Favorite.check(data),marker=card.render(true).querySelector('.card__marker');states.push({where,active:['look','viewed','scheduled','continued','thrown'].filter(key=>state[key]),marker:marker?.textContent,kept:['book','like','wath'].every(key=>state[key]),saved:Lampa.Favorite.get({type:where}).some(c=>c.id===data.id)});
   }
   const selected=menu.menu().find(i=>i.where==='thrown');selected.onSelect(selected);const cleared=!card.render(true).querySelector('.card__marker');Lampa.Account.hasPremium=premium;return {locked,states,cleared};
  });
  assert.equal(states.locked,true);assert.equal(states.cleared,true);assert.deepEqual(states.states.map(s=>s.marker),['Смотрю','Просмотрено','Запланировано','Продолжение следует','Брошено']);for(const s of states.states){assert.deepEqual(s.active,[s.where]);assert.equal(s.kept,true);assert.equal(s.saved,true);}
  await page.evaluate(()=>{qaCards.forEach(c=>c.destroy());document.querySelector('#qa-posters').remove();});console.log(engine.name(),mode,theme,'badges, independent favorites and five native statuses OK');
 }
 assert.deepEqual(r.errors,[]);await r.context.close();
}}finally{await browser.close();}}})().catch(error=>{console.error(error);process.exitCode=1;});
