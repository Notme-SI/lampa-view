const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','mobile','tv']){
 const mobile=mode==='mobile',userAgent=mobile?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/605.1.15':undefined;
 const r=await setup(browser,{viewport:mobile?{width:393,height:852}:{width:1280,height:720},mode,isMobile:mobile,hasTouch:mobile,userAgent},{beforePlugin:page=>page.evaluate(touch=>{
  Lampa.Params.init();if(touch)Lampa.Platform.init();Lampa.Layer.init();Lampa.Storage.set('lampa_view_hero',false);Lampa.Api.main=(o,ok)=>ok(Array.from({length:3},(_,row)=>({title:'Подборка '+row,url:'qa/'+row,total_pages:2,results:Array.from({length:20},(_,n)=>({id:row*100+n+1,title:'Фильм '+n,poster_path:'/p.jpg',release_date:'2020-01-01',vote_average:8,source:'tmdb',media_type:'movie'}))})));
 },mobile)}),{page}=r;
 await page.evaluate(()=>{Lampa.Activity.push({component:'main',source:'tmdb'});});await page.waitForSelector('.activity--active .pt-overlay-row .minimal-row-more');await page.waitForTimeout(400);
 const row=page.locator('.activity--active .pt-overlay-row').first();
 const initial=await row.evaluate(root=>{const rect=n=>{const b=n.getBoundingClientRect();return {width:b.width,height:b.height,center:(b.top+b.bottom)/2};},view=root.querySelector('.card__view'),more=root.querySelector('.minimal-row-more'),slot=more.parentElement;return {view:rect(view),more:rect(more),slot:rect(slot),last:slot===slot.parentElement.lastElementChild,inBody:slot.parentElement.classList.contains('scroll__body'),background:getComputedStyle(slot).backgroundColor};});
 assert.equal(initial.last,true);assert.equal(initial.inBody,true);
 assert.ok(initial.more.height<initial.view.height/2,'A compact action does not draw a blank poster');
 assert.ok(Math.abs(initial.more.center-initial.slot.center)<1);
 assert.equal(initial.background,'rgba(0, 0, 0, 0)');
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
  const visible=await row.evaluate(root=>{const more=root.querySelector('.minimal-row-more'),b=more.getBoundingClientRect(),v=root.querySelector('.scroll--horizontal').getBoundingClientRect();return more.classList.contains('focus') && b.left>=v.left-1 && b.right<=v.right+1;});assert.equal(visible,true,'Remote focus must reveal the final More button');
  const partial=await row.evaluate(root=>{
   const clip=root.querySelector('.items-line__body').getBoundingClientRect();
   return [...root.querySelectorAll('.card__view')].map(card=>card.getBoundingClientRect()).some(rect=>
    rect.width>0 && rect.right>clip.left+1 && rect.left<clip.right-1 && (rect.left<clip.left-1 || rect.right>clip.right+1));
  });
  assert.equal(partial,false,'The TV focus halo leaves the previous offscreen poster clipped at the end of the row');
  await page.evaluate(()=>Lampa.Controller.enabled().controller.left());
  assert.ok(await page.evaluate(()=>qaLine.last===qaLine.items[19].render(true)),'Left returns to the final poster');
  await page.evaluate(()=>{Lampa.Controller.move('right');Lampa.Controller.enter();});
  await page.waitForFunction(()=>Lampa.Activity.active().component==='category_full');
  await page.evaluate(()=>Lampa.Activity.backward());
  await page.waitForFunction(()=>qaLine.last?.classList.contains('minimal-row-more') && qaLine.last.classList.contains('focus'));
 }
 const bar=page.locator('.pt-page-scrollbar');
 if(mode==='desktop'){
  // The online explorer places a hidden vertical source rail before its visible episode scroll.
  await page.evaluate(()=>{const hidden=new Lampa.Scroll({over:true}),active=document.querySelector('.activity--active');hidden.render(true).style.display='none';active.prepend(hidden.render(true));Lampa.Listener.send('activity',{type:'start'});});
  await bar.waitFor({state:'visible'});const thumb=page.locator('.pt-page-scrollbar__thumb'),box=await thumb.boundingBox(),track=await bar.boundingBox();
  const before=await bar.getAttribute('aria-valuenow');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,Math.min(track.y+track.height-4,box.y+box.height/2+track.height*.4),{steps:8});await page.mouse.up();await page.waitForTimeout(120);
  assert.ok(Number(await bar.getAttribute('aria-valuenow'))>Number(before),'Dragging controls the native page scroll');await bar.focus();await page.keyboard.press('Home');await page.waitForTimeout(120);assert.equal(await bar.getAttribute('aria-valuenow'),'0');
 }else assert.equal(await bar.isVisible(),false);
 if(mode!=='tv'){
  const view=row.locator('.scroll--horizontal'),box=await view.boundingBox();
  const before=await view.evaluate(n=>n.Scroll.position());
  assert.equal(await view.evaluate(n=>getComputedStyle(n).scrollbarWidth),'none');
  if(mode==='desktop'){
   await page.mouse.move(box.x+box.width*.6,box.y+45);
   await page.keyboard.down('Shift');await page.mouse.wheel(0,360);await page.keyboard.up('Shift');
   await page.waitForFunction(()=>!document.body.classList.contains('pt-wheel-active'));
   assert.ok(await view.evaluate(n=>n.Scroll.position())<before,'Shift + wheel scrolls the desktop rail');
   assert.equal(await view.evaluate(n=>n.querySelector('.scroll__body').style.getPropertyValue('--pt-rail-preview')),'','Native position is committed and the preview is cleared');
  }
  await page.mouse.move(box.x+box.width*.8,box.y+45);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.2,box.y+45,{steps:8});await page.mouse.up();
  assert.ok(await view.evaluate(n=>n.Scroll.position())<before,'Drag scrolls the row');
  assert.equal(await page.evaluate(()=>Lampa.Activity.active().component),'main','Drag must not open a poster');
  assert.equal(await page.locator('.activity--active .pt-overlay-row').nth(1).locator('.scroll--horizontal').evaluate(n=>n.Scroll.position()),0,'The neighbouring row does not move');
  if(mode==='mobile'){
   await view.evaluate(node=>{node.Scroll.immediate(node.querySelector('.minimal-row-tail'),false);});
  }else{
   for(let i=0;i<12;i++){
    await page.mouse.wheel(360,0);
    if(await row.evaluate(root=>root.querySelector('.minimal-row-more').getBoundingClientRect().right<=root.querySelector('.scroll--horizontal').getBoundingClientRect().right+1))break;
    await page.waitForTimeout(420);
   }
   await page.waitForTimeout(500);
  }
  const end=await row.evaluate(root=>{const more=root.querySelector('.minimal-row-more').getBoundingClientRect(),v=root.querySelector('.scroll--horizontal').getBoundingClientRect();return {left:more.left,right:more.right,min:v.left,max:v.right};});assert.ok(end.left>=end.min-1 && end.right<=end.max+1,'More can be reached as the final tile: '+JSON.stringify(end));
  const depth=await page.evaluate(()=>Lampa.Activity.all().length),more=row.locator('.minimal-row-more');
  if(mode==='mobile')await more.tap();else await more.click();
  await page.waitForFunction(()=>Lampa.Activity.active().component==='category_full',null,{timeout:5000});
  assert.equal(await page.evaluate(()=>Lampa.Activity.all().length),depth+1,'The final button opens the native catalogue once');
 }
 assert.deepEqual(r.errors,[]);console.log(engine.name(),mode,'independent scroll, compact More button and page scrollbar passed');await r.context.close();
}}finally{await browser.close();}}})().catch(error=>{console.error(error);process.exitCode=1;});
