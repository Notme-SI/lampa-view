const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   const r=await setup(browser,{viewport:{width:1280,height:720},mode:'tv'}),{page}=r;
   await page.evaluate(()=>{Lampa.DeviceInput.init();Lampa.Controller.observe();Lampa.Keypad.init();Lampa.Keypad.enable();Navigator.follow('focus',event=>Lampa.Controller.focus(event.elem));Lampa.Controller.toggle('settings');});
   async function reachBack(scope){
    for(let i=0;i<12;i++){
     if(await page.locator(scope+' .minimal-back--overlay.focus').count())return;
     await page.keyboard.press('ArrowUp');await page.waitForTimeout(40);
    }
    assert.fail(name+': remote cannot reach '+scope+' Back: '+await page.locator('.focus').evaluateAll(nodes=>nodes.map(n=>n.className+' '+n.textContent).join(' | ')));
   }
   await reachBack('.settings');await page.keyboard.press('Enter');await page.waitForTimeout(80);
   assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'head');
   await page.evaluate(()=>Lampa.Settings.create('lampa_view'));await page.waitForTimeout(80);await reachBack('.settings');
   await page.keyboard.press('Enter');await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'settings');
   await page.evaluate(()=>{Lampa.Controller.toggle('content');window.qaBacks=0;Lampa.Select.show({title:'Выбор',items:[{title:'Первый'},{title:'Второй'}],onSelect(){},onBack(){qaBacks++;Lampa.Select.hide();Lampa.Controller.toggle('content');}});});
   await reachBack('.selectbox');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>qaBacks),1);
   for(const buttons of [true,false]){
    await page.evaluate(buttons=>{Lampa.Modal.open({title:'Сведения',html:jQuery(buttons?'<div class="selector">Пункт</div>':'<p>Информация без кнопок</p>'),onBack(){qaBacks++;Lampa.Modal.close();Lampa.Controller.toggle('content');}});},buttons);
    await reachBack('.modal');await page.keyboard.press('Enter');
   }
   assert.equal(await page.evaluate(()=>qaBacks),3);
   await page.evaluate(()=>{
    const root=document.createElement('div');root.id='qa-selection';root.style.cssText='position:fixed;top:60px;left:40px;right:40px;display:flex;gap:30px;z-index:50;background:#080b10;padding:20px';
    for(let i=0;i<3;i++){const card=document.createElement('div');card.className='card selector';card.style.width='200px';card.innerHTML='<div class="card__view" style="height:280px"><img class="card__img" style="width:100%;height:100%" src="'+Lampa.TMDB.image('')+'"></div><div class="card__title">Фильм '+(i+1)+'</div>';root.appendChild(card);}document.body.appendChild(root);
    Lampa.Controller.add('qa-cards',{toggle(){Lampa.Controller.collectionSet(root);Lampa.Controller.collectionFocus(root.children[0],root);},left(){Navigator.move('left');},right(){Navigator.move('right');},back(){}});Lampa.Controller.toggle('qa-cards');
    root.children[0].classList.add('hover');
   });
   const settled=()=>page.waitForFunction(()=>[...document.querySelectorAll('#qa-selection .card__view')].every(n=>n.getAnimations().every(a=>a.playState!=='running')));
   await settled();const first=await page.locator('#qa-selection .card').nth(0).screenshot();
   for(let i=0;i<8;i++){await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');}
   await settled();
   const focus=await page.locator('#qa-selection .card').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n.querySelector('.card__view'),'::after'),t=getComputedStyle(n.querySelector('.card__title'));return {focus:n.classList.contains('focus'),border:s.borderWidth,borderColor:s.borderColor,indicator:s.backgroundImage,title:t.backgroundColor,color:t.color,haloOpacity:s.opacity,haloShadow:s.boxShadow,transform:getComputedStyle(n.querySelector('.card__view')).transform};}));
   assert.equal(focus.filter(n=>n.focus).length,1);assert.equal(focus[0].border,'1px');assert.equal(focus[0].borderColor,'rgba(255, 255, 255, 0.65)');assert.equal(focus[0].indicator,'none');assert.equal(focus[0].title,'rgba(0, 0, 0, 0)');assert.equal(focus[0].haloOpacity,'1');assert.match(focus[0].haloShadow,/rgba\(255, 255, 255, 0.18\).*22px/);assert.equal(focus[0].transform,'matrix(1, 0, 0, 1, 0, -3)');assert.ok(focus.slice(1).every(n=>n.haloOpacity==='0'),'Only the selected TV card has a visible halo');
   assert.ok(Number(await page.locator('#qa-selection .card.focus .card__view').evaluate(n=>getComputedStyle(n,'::after').zIndex))>0,'The ring must render above the poster rather than behind it');
   assert.equal(await page.locator('#qa-selection .card.focus .card__view').evaluate(n=>getComputedStyle(n).overflow),'visible','The fixed TV halo paints beyond the rounded poster');
   await settled();assert.equal(Buffer.compare(first,await page.locator('#qa-selection .card').nth(0).screenshot()),0,'Rapid remote navigation leaves no residual ring pixels');
   await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#qa-selection .card.focus').count(),1);
   await settled();
   const old=await page.locator('#qa-selection .card').nth(0).evaluate(n=>({opacity:getComputedStyle(n.querySelector('.card__view'),'::after').opacity,background:getComputedStyle(n.querySelector('.card__title')).backgroundColor,transform:getComputedStyle(n.querySelector('.card__view')).transform}));assert.equal(old.opacity,'0');assert.equal(old.transform,'none');assert.equal(old.background,'rgba(0, 0, 0, 0)');
   if(process.env.LAMPA_QA_OUTPUT){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,name+'-tv-selection.png')});}
   assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+': real arrow/OK navigation reaches Settings and Select Back; TV selection clears without residual pixels');
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
