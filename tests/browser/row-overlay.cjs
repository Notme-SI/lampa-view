const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','mobile','tv']){
 const r=await setup(browser,{viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},mode},{beforePlugin:page=>page.evaluate(()=>{
  Lampa.Params.init();Lampa.Layer.init();Lampa.Storage.set('lampa_view_hero',false);Lampa.Api.main=(o,ok)=>ok(Array.from({length:3},(_,row)=>({title:'Подборка '+row,url:'qa/'+row,total_pages:2,results:Array.from({length:20},(_,n)=>({id:row*100+n+1,title:'Фильм '+n,poster_path:'/p.jpg',release_date:'2020-01-01',vote_average:8,source:'tmdb',media_type:'movie'}))})));
 })}),{page}=r;
 await page.evaluate(()=>{Lampa.Activity.push({component:'main',source:'tmdb'});});await page.waitForSelector('.activity--active .pt-overlay-row .minimal-row-more');await page.waitForTimeout(400);
 const row=page.locator('.activity--active .pt-overlay-row').first();
 const initial=await row.evaluate(root=>{const rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,height:b.height};},view=root.querySelector('.card__view'),more=root.querySelector('.minimal-row-more');return {view:rect(view),more:rect(more),last:more===more.parentElement.lastElementChild,inBody:more.parentElement.classList.contains('scroll__body')};});
 assert.equal(initial.last,true);assert.equal(initial.inBody,true);assert.ok(Math.abs(initial.more.height-initial.view.height)<2);
 assert.equal(await page.locator('.minimal-row-arrow').count(),0);
 if(mode==='tv'){
  const sizes=await row.evaluate(async root=>{
   const poster=root.querySelector('.card'),more=root.querySelector('.minimal-row-more');
   const before=more.offsetHeight;poster.style.transform='scale(1.8)';
   Lampa.Activity.active().activity.component.items[0].emit('visible');
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const during=more.offsetHeight;poster.style.transform='';return {before,during};
  });
  assert.equal(sizes.during,sizes.before,'Preview animation does not resize the last tile');
  await page.evaluate(()=>{Lampa.DeviceInput.init();Lampa.Controller.observe();Navigator.follow('focus',e=>Lampa.Controller.focus(e.elem));window.qaLine=Lampa.Activity.active().activity.component.items[0];qaLine.toggle();for(let i=0;i<20;i++)Lampa.Controller.enabled().controller.right();});await page.waitForTimeout(300);
  const visible=await row.evaluate(root=>{const more=root.querySelector('.minimal-row-more'),b=more.getBoundingClientRect(),v=root.querySelector('.scroll--horizontal').getBoundingClientRect();return more.classList.contains('focus') && b.left>=v.left-1 && b.right<=v.right+1;});assert.equal(visible,true,'Remote focus must reveal the final More tile');await page.evaluate(()=>Lampa.Controller.enabled().controller.left());
 }
 const bar=page.locator('.pt-page-scrollbar');
 if(mode==='desktop'){
  await bar.waitFor({state:'visible'});const thumb=page.locator('.pt-page-scrollbar__thumb'),box=await thumb.boundingBox(),track=await bar.boundingBox();
  const before=await bar.getAttribute('aria-valuenow');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,Math.min(track.y+track.height-4,box.y+box.height/2+track.height*.4),{steps:8});await page.mouse.up();await page.waitForTimeout(120);
  assert.ok(Number(await bar.getAttribute('aria-valuenow'))>Number(before),'Dragging controls the native page scroll');await bar.focus();await page.keyboard.press('Home');await page.waitForTimeout(120);assert.equal(await bar.getAttribute('aria-valuenow'),'0');
 }else assert.equal(await bar.isVisible(),false);
 if(mode!=='tv'){
  const view=row.locator('.scroll--horizontal'),box=await view.boundingBox();
  const before=await view.evaluate(n=>n.Scroll.position());
  assert.equal(await view.evaluate(n=>getComputedStyle(n).scrollbarWidth),'none');
  await page.mouse.move(box.x+box.width*.8,box.y+45);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.2,box.y+45,{steps:8});await page.mouse.up();
  assert.ok(await view.evaluate(n=>n.Scroll.position())<before,'Drag scrolls the row');
  assert.equal(await page.evaluate(()=>Lampa.Activity.active().component),'main','Drag must not open a poster');
  assert.equal(await page.locator('.activity--active .pt-overlay-row').nth(1).locator('.scroll--horizontal').evaluate(n=>n.Scroll.position()),0,'The neighbouring row does not move');
  for(let i=0;i<12;i++){
   await page.mouse.wheel(360,0);
   if(await row.evaluate(root=>root.querySelector('.minimal-row-more').getBoundingClientRect().right<=root.querySelector('.scroll--horizontal').getBoundingClientRect().right+1))break;
   await page.waitForTimeout(420);
  }
  await page.waitForTimeout(500);
  const end=await row.evaluate(root=>{const more=root.querySelector('.minimal-row-more').getBoundingClientRect(),v=root.querySelector('.scroll--horizontal').getBoundingClientRect();return {left:more.left,right:more.right,min:v.left,max:v.right};});assert.ok(end.left>=end.min-1 && end.right<=end.max+1,'More can be reached as the final tile: '+JSON.stringify(end));
  const depth=await page.evaluate(()=>Lampa.Activity.all().length);await row.locator('.minimal-row-more').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Lampa.Activity.active().component),'category_full');assert.equal(await page.evaluate(()=>Lampa.Activity.all().length),depth+1,'The final tile opens the native catalogue once');
 }
 assert.deepEqual(r.errors,[]);console.log(engine.name(),mode,'independent scroll, trailing More tile and page scrollbar passed');await r.context.close();
}}finally{await browser.close();}}})().catch(error=>{console.error(error);process.exitCode=1;});
