const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs'),response=require('../fixtures/discovery-response.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile','tablet']){
 const r=await setup(browser,{mode,viewport:mode==='tv'?{width:960,height:540}:mode==='mobile'?{width:390,height:844}:mode==='tablet'?{width:834,height:1194}:{width:1440,height:1000}}),{page}=r;try{
  await page.evaluate(response=>{const L=Lampa;for(const name of ['Params','Layer','DeviceInput'])L[name].init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));window.qaResponse=eval('('+response+')');window.qaRequests=[];window.qaPages=[];L.Api.sources.tmdb.get=(url,p,ok)=>{qaRequests.push(url);qaPages.push(Number(p.page)||1);setTimeout(()=>ok(url.includes('_credits')?{cast:Array.from({length:url.includes('movie_credits')?67:3},(_,i)=>({id:i+1,title:'Проект '+i,name:'Проект '+i,popularity:100-i,poster_path:'/p.jpg'})),crew:[{id:1,title:'Дубликат'}]}:qaResponse(url,p.page)),0);};L.Activity.push({component:'category',url:'tv',source:'tmdb',title:'Сериалы',page:1});},response.toString());
  await page.waitForSelector('.activity--active .card');assert.equal(await page.locator('.activity--active .minimal-catalogue-control').count(),5);assert.equal(await page.locator('.activity--active .items-line').count(),0);
  const first=await page.evaluate(()=>{const c=Lampa.Activity.active().activity.component;return {count:c.items.length,requests:qaRequests.length,total:c.total_pages};});assert.equal(first.count,20);if(mode==='desktop'){await page.waitForFunction(()=>qaPages.includes(2));assert.equal(await page.evaluate(()=>Lampa.Activity.active().activity.component.items.length),20,'Warm the next page without mounting it');}else assert.equal(first.requests,1);
  await page.waitForTimeout(350);await page.keyboard.press('ArrowDown');await page.waitForTimeout(200);assert.equal(await page.locator('.activity--active .card.focus').count(),1);await page.keyboard.press('ArrowUp');await page.waitForTimeout(200);assert.equal(await page.locator('.minimal-catalogue-control.focus').count(),1);
  await page.locator('.activity--active').getByRole('button',{name:'Все жанры',exact:true}).click();await page.locator('.selectbox-item').filter({hasText:'Комедии'}).first().evaluate(n=>n.dispatchEvent(new Event('hover:enter')));await page.waitForFunction(()=>Lampa.Activity.active().minimal_browse.genre==='35');await page.waitForSelector('.activity--active .card');
  await page.locator('.activity--active').getByRole('button',{name:'Все годы',exact:true}).click();await page.locator('.selectbox-item').filter({hasText:'2024'}).first().evaluate(n=>n.dispatchEvent(new Event('hover:enter')));await page.waitForFunction(()=>Lampa.Activity.active().minimal_browse.period==='2024-2024');await page.waitForSelector('.activity--active .card');assert.ok((await page.evaluate(()=>qaRequests.at(-1))).includes('2024-01-01'));
  await page.locator('.activity--active .minimal-catalogue-control').nth(3).click();await page.locator('.selectbox-item').filter({hasText:'Свой диапазон'}).evaluate(n=>Lampa.Controller.collectionFocus(n,Lampa.Select.render(true)));await page.keyboard.press('Enter');await page.locator('.settings-input').waitFor({state:'visible'});assert.ok((await page.locator('.settings-input').innerText()).includes('Годы: от–до'));await page.evaluate(()=>Lampa.Controller.back());await page.waitForSelector('.activity--active .card');
  const box=await page.locator('.activity--active .minimal-catalogue-controls').boundingBox(),gridBox=await page.locator('.activity--active .mapping--grid').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=page.viewportSize().width+1);assert.ok(Math.abs(box.x-gridBox.x)<2,'Filters align with the native grid');
  if(mode==='desktop'){
   for(const width of [1440,1920,2560]){
    await page.setViewportSize({width,height:1000});
    await page.waitForTimeout(350);
    const row=await page.locator('.activity--active .mapping--grid').evaluate(grid=>{
     const cards=[...grid.querySelectorAll(':scope > .card')].map(n=>n.getBoundingClientRect());
     const first=cards.filter(r=>Math.abs(r.top-cards[0].top)<1),bounds=grid.getBoundingClientRect();
     return {count:first.length,slot:first[0].width,left:first[0].left-bounds.left,right:bounds.right-first.at(-1).right};
    });
    assert.ok(row.count>=4 && row.right>=-1 && row.right<row.slot+17,'Complete fixed-size posters fit without filling the unused track: '+JSON.stringify({width,row}));
   }
   for(const index of [0,1,2,4]){
    await page.locator('.activity--active .minimal-catalogue-control').nth(index).click();
    const labels=(await page.locator('.selectbox-item__title').allTextContents()).map(v=>v.trim());
    const ordered=index===2?labels:labels.slice(1);
    assert.deepEqual(ordered,ordered.slice().sort((a,b)=>a.localeCompare(b,'ru',{sensitivity:'base'})));
    if(index===4){assert.equal(labels.filter(v=>v==='Россия').length,1);assert.ok(!labels.includes('СССР'));}
    await page.evaluate(()=>Lampa.Controller.back());
   }
   for(const source of ['cub','tmdb','trakt']){
    await page.evaluate(source=>{
     Lampa.Activity.push({component:'category',url:'tv',source,minimal_browse:{country:'SU',sort:'rated'},title:'Россия'});
    },source);
    await page.waitForSelector('.activity--active .card');
    assert.equal(await page.locator('.activity--active .minimal-catalogue-control').nth(4).textContent(),'Россия');
    const merged=await page.evaluate(()=>({
     countries:qaRequests.map(url=>new URLSearchParams(url.split('?')[1]).get('with_origin_country')).filter(Boolean),
     ids:Lampa.Activity.active().activity.component.items.map(item=>item.data.id)
    }));
    assert.ok(merged.countries.includes('RU') && merged.countries.includes('SU'),JSON.stringify({source,merged}));
    assert.equal(new Set(merged.ids).size,merged.ids.length);
    await page.evaluate(()=>Lampa.Activity.backward());
    await page.waitForSelector('.activity--active .minimal-catalogue-controls');
   }
   await page.setViewportSize({width:1440,height:1000});
  }
  await page.evaluate(()=>Lampa.Activity.push({component:'category',url:'tvshow',source:'cub',title:'ТВ-шоу'}));await page.waitForSelector('.activity--active .card');assert.equal(await page.locator('.activity--active .minimal-catalogue-control').count(),5);assert.equal(await page.locator('.activity--active .items-line').count(),0);
  assert.equal(await page.locator('.activity--active .minimal-catalogue-source').count(),0);
  await page.locator('.activity--active').getByRole('button',{name:'Все страны',exact:true}).click();await page.locator('.selectbox-item').filter({hasText:'Франция'}).evaluate(n=>n.dispatchEvent(new Event('hover:enter')));await page.waitForFunction(()=>Lampa.Activity.active().minimal_browse.country==='FR');await page.waitForSelector('.activity--active .card');
  await page.locator('.activity--active').getByRole('button',{name:'Все жанры',exact:true}).click();await page.locator('.selectbox-item').filter({hasText:'Ток'}).evaluate(n=>n.dispatchEvent(new Event('hover:enter')));await page.waitForSelector('.activity--active .card');assert.equal(await page.locator('.activity--active .minimal-catalogue-control').nth(1).innerText(),'Ток-шоу');const showQuery=new URLSearchParams((await page.evaluate(()=>qaRequests.at(-1))).split('?')[1]);assert.equal(showQuery.get('with_genres'),'10767');assert.equal(showQuery.get('with_origin_country'),'FR');await page.evaluate(()=>Lampa.Activity.backward());await page.waitForSelector('.activity--active .minimal-catalogue-controls');
  for(const type of ['actor','company']){
   await page.evaluate(type=>Lampa.Activity.push({component:type,id:690,source:'tmdb',title:'Проекты'}),type);await page.waitForSelector('.activity--active .card');assert.equal(await page.locator('.activity--active .minimal-project-tabs button[aria-pressed=true]').innerText(),'Фильмы');
   if(type==='actor'){const pages=await page.evaluate(async()=>{const c=Lampa.Activity.active().activity.component,ids=c.items.map(i=>i.data.id);for(let p=2;p<=4;p++){c.object.page=p;const json=await new Promise((ok,fail)=>c.emit('next',ok,fail));ids.push(...json.results.map(r=>r.id));}return ids;});assert.equal(pages.length,67);assert.equal(new Set(pages).size,67);}
   await page.locator('.activity--active').getByRole('button',{name:'Сериалы',exact:true}).click();await page.waitForFunction(()=>Lampa.Activity.active().minimal_project_type==='tv');await page.waitForSelector('.activity--active .card');assert.equal(await page.locator('.activity--active .minimal-project-tabs button[aria-pressed=true]').innerText(),'Сериалы');
   assert.ok(await page.evaluate(()=>Lampa.Activity.active().activity.component.items.every(i=>i.data.media_type==='tv')));
   await page.evaluate(()=>Lampa.Activity.backward());await page.waitForSelector('.activity--active .minimal-catalogue-controls');
  }
  await page.evaluate(()=>Lampa.Activity.push({component:'category_full',source:'tmdb',url:'discover/tv',networks:7,title:'Канал',minimal_studio:{name:'Канал',kind:'network',id:7}}));await page.waitForSelector('.activity--active .card');assert.equal(await page.locator('.activity--active .minimal-project-tabs button[aria-pressed=true]').innerText(),'Сериалы');assert.ok(await page.evaluate(()=>qaRequests.some(url=>url.includes('with_networks=7'))));
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+': single grid, filters, archives, remote focus, full actor pagination and studio media tabs PASS');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
