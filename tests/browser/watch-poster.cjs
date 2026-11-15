const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit].filter(e=>!process.env.LAMPA_QA_ENGINE||e.name()===process.env.LAMPA_QA_ENGINE)){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile']){
 const r=await setup(browser,{mode,viewport:mode==='tv'?{width:960,height:540}:mode==='mobile'?{width:393,height:852}:{width:1020,height:800},hasTouch:mode==='mobile'}),{page}=r;
 try{
  await page.evaluate(mode=>{
   const host=document.createElement('div');host.id='qa-watch-posters';host.style.cssText='display:grid;grid-template-columns:repeat('+(mode==='tv'?7:mode==='mobile'?2:4)+',minmax(0,1fr));gap:16px;width:90%;margin:90px auto';document.body.appendChild(host);window.qaWatchCards=[];
   const definitions=[['Completed episode',3,5,true,false],['Partial episode',1,5,false,false],['Completed season',2,10,true,true],['Completed movie',0,0,true,false]];
   for(let i=0;i<definitions.length;i++){
    const [title,season,episode,done,all]=definitions[i],data={id:88100+i,title,name:season?title:undefined,original_title:title,original_name:season?title:undefined,media_type:season?'tv':'movie',source:'test',poster_path:'/p.jpg',release_date:'2025-01-01',quality:'4K',vote_average:8.2,...(season?{number_of_seasons:season,seasons:[{season_number:season,episode_count:10}],last_episode_to_air:{season_number:season,episode_number:10,air_date:'2020-01-01'}}:{})};
    if(all)for(let e=1;e<=episode;e++)Lampa.Timeline.update({hash:Lampa.Utils.hash(''+season+e+title),percent:95,time:0});
    else Lampa.Timeline.update({hash:Lampa.Utils.hash(season?''+season+episode+title:title),percent:done?95:42,time:done?0:1458,duration:3471});
    const card=Lampa.Maker.make('Card',data);card.create();const node=card.render(true);node.style.setProperty('width','100%','important');host.appendChild(node);card.visible();qaWatchCards.push(card);
   }
   for(const type of ['book','like','wath'])Lampa.Favorite.toggle(type,qaWatchCards[1].data);
  },mode);
  await page.waitForFunction(()=>document.querySelectorAll('#qa-watch-posters .card__view>.pt-card-watch__badge').length===4);
  const expected=['3 сезон · 5 серия','1 сезон · 5 серия','Сезон 2 просмотрен','Фильм просмотрен'];
  for(const theme of ['minimal','glass'])for(const size of ['small','normal','bigger']){
   await page.evaluate(({theme,size})=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.Storage.set('interface_size',size);}, {theme,size});
   await page.waitForTimeout(170);
   for(let index=0;index<4;index++){
    await page.evaluate(index=>{for(const card of qaWatchCards)card.render(true).classList.remove('focus','hover','pt-card-touch','pt-card-pointer');const n=qaWatchCards[index].render(true);n.classList.add('focus',...(document.body.classList.contains('pt-mobile')?['pt-card-touch']:[]));jQuery(n).triggerHandler('hover:focus');},index);
    await page.waitForFunction(index=>{
     const card=qaWatchCards[index].render(true),badge=card.querySelector('.card__view>.pt-card-watch__badge'),a=badge.getBoundingClientRect(),view=card.querySelector('.card__view').getBoundingClientRect(),vote=card.querySelector('.card__vote').getBoundingClientRect();
     const clear=[...card.querySelectorAll('.card__icon:not(.icon--history)')].every(n=>{const b=n.getBoundingClientRect();return !b.width||a.right<=b.left-.5||a.left>=b.right+.5||a.bottom<=b.top-.5||a.top>=b.bottom+.5;});
     return a.width>0&&a.left>=view.left-1&&a.right<=view.right+1&&a.bottom<=view.bottom+1&&(a.right<=vote.left-1||a.bottom<=vote.top-1)&&clear;
    },index,{timeout:4000}).catch(async e=>{throw new Error(e.message+' '+JSON.stringify({engine:engine.name(),mode,theme,size,index,geometry:await page.evaluate(index=>{const card=qaWatchCards[index].render(true);return [...card.querySelectorAll('.card__view,.pt-card-watch__badge,.card__vote,.card__icon')].map(n=>({class:n.className,rect:n.getBoundingClientRect().toJSON(),style:n.style.cssText}));},index)}));});
    const result=await page.evaluate(index=>{
     const card=qaWatchCards[index].render(true),badge=card.querySelector('.pt-card-watch__badge'),kind=card.querySelector('.pt-kind'),view=card.querySelector('.card__view'),a=badge.getBoundingClientRect();
     return {label:badge.querySelector('.pt-card-watch__label').textContent,time:badge.querySelector('.pt-card-watch__time').textContent,check:!badge.querySelector('.pt-card-watch__icon').hidden,visible:getComputedStyle(badge).visibility,footer:getComputedStyle(card.querySelector('.pt-card-watch')).display,font:getComputedStyle(badge).fontSize,kindFont:getComputedStyle(kind).fontSize,fill:getComputedStyle(badge).backgroundColor,kindFill:getComputedStyle(kind).backgroundColor,play:view.querySelector('.icon--history')&&getComputedStyle(view.querySelector('.icon--history')).display,lines:card.querySelectorAll('.time-line').length,icons:[...view.querySelectorAll('.card__icon:not(.icon--history)')].every(n=>{const b=n.getBoundingClientRect();return !b.width||a.right<=b.left-.5||a.left>=b.right+.5||a.bottom<=b.top-.5||a.top>=b.bottom+.5;})};
    },index);
    assert.equal(result.label,expected[index]);assert.equal(result.check,index!==1);assert.equal(result.time,index===1?'24:18':'');assert.equal(result.visible,'visible');assert.equal(result.footer,'none');assert.equal(result.font,result.kindFont);assert.equal(result.fill,result.kindFill);assert.equal(result.lines,1);assert.ok(result.icons,JSON.stringify({engine:engine.name(),mode,theme,size,index,result}));if(result.play)assert.equal(result.play,'none');
   }
  }
  if(process.env.LAMPA_QA_OUTPUT){require('node:fs').mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.evaluate(()=>{qaWatchCards.forEach(c=>c.render(true).classList.remove('focus','hover','pt-card-touch','pt-card-pointer'));qaWatchCards[1].render(true).classList.add('focus','pt-card-touch');});await page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-'+mode+'-watch-poster.png')});}
  await page.evaluate(()=>qaWatchCards.forEach(c=>c.render(true).classList.remove('focus','hover','pt-card-touch','pt-card-pointer')));
  assert.ok((await page.locator('#qa-watch-posters .pt-card-watch__badge').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).visibility))).every(v=>v==='hidden'));
  await page.evaluate(()=>Lampa.Timeline.update({hash:Lampa.Utils.hash('15Partial episode'),percent:95,time:3471,duration:3471}));
  await page.waitForFunction(()=>!qaWatchCards[1].render(true).querySelector('.pt-card-watch__icon').hidden);
  assert.equal(await page.locator('#qa-watch-posters .card').nth(1).locator('.pt-card-watch__label').textContent(),'1 сезон · 5 серия','A completed episode does not complete its season');
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+': four watch states, native materials, scales and corner collisions PASS');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
