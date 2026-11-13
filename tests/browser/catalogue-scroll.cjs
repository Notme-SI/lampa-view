const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const response=require('../fixtures/discovery-response.cjs');

(async()=>{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   for(const mode of ['desktop','tv','mobile']){
    const {page,context,errors}=await setup(browser,{mode,hasTouch:mode==='mobile',viewport:{width:mode==='mobile'?390:1280,height:520}});
    try{
     await page.evaluate(fixture=>{
      const L=Lampa;
      for(const api of ['Params','Layer','DeviceInput'])L[api].init();
      L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
      const data=eval('('+fixture+')');
      L.Api.sources.tmdb.get=(url,p,ok)=>setTimeout(()=>ok({...data(url,p.page),total_pages:12}),20);
      L.Api.full=(p,ok)=>setTimeout(()=>ok({movie:{id:p.id,title:'Тестовый фильм',source:'tmdb',release_date:'2024-01-01',production_countries:[],production_companies:[],spoken_languages:[],genres:[],overview:'Проверка возврата'},persons:{cast:[],crew:[]},images:{logos:[]},videos:{results:[]},discuss:{result:[]}}),10);
      L.Activity.push({component:'category',url:'movie',source:'tmdb',page:1,title:'Фильмы'});
     },response.toString());
     const grid=page.locator('.activity--active .pt-browser-catalogue');
     await grid.locator('.card').first().waitFor({timeout:6000});
     if(mode!=='mobile'){
      await page.waitForTimeout(180);
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(()=>document.querySelector('.activity--active .card.focus'),null,{timeout:4500});
     }
     await page.waitForTimeout(1000);
     const box=await grid.boundingBox();
     if(mode==='desktop'){
      await grid.evaluate(node=>{
       const positions=[node.scrollTop],read=event=>{if(event.target===node)positions.push(node.scrollTop);};
       document.addEventListener('scroll',read,true);
       window.takeScrollPositions=()=>{document.removeEventListener('scroll',read,true);return positions;};
      });
      await page.mouse.move(box.x+box.width*.6,box.y+Math.min(150,box.height/2));
      for(let i=0;i<24;i++){
       await page.mouse.wheel(0,420);await page.waitForTimeout(120);
       if(await page.evaluate(()=>Lampa.Activity.active().activity.component.items.length>80))break;
      }
      const positions=await page.evaluate(()=>takeScrollPositions());
      assert.ok(positions.length>1 && positions.every((top,index)=>!index || top>=positions[index-1]),'Downward wheel input never moves the catalogue backwards: '+positions.join(', '));
     }else{
      await grid.evaluate(async node=>{
       for(let i=0;i<16;i++){node.scrollTop+=420;await new Promise(r=>setTimeout(r,120));}
      });
     }
     await page.waitForFunction(()=>Lampa.Activity.active().activity.component.items.length>80,null,{timeout:7500});
     await page.waitForTimeout(280);
     const later=await grid.evaluate(node=>({top:node.scrollTop,position:node.Scroll.position(),transform:getComputedStyle(node.Scroll.body(true)).transform}));
     assert.ok(later.top>1000,JSON.stringify(later));assert.equal(later.position,-later.top);assert.equal(later.transform,'none');
     await grid.evaluate(node=>{
      const first=node.querySelector('.card');node.Scroll.update(first,true);node.Scroll.immediate(first);node.Scroll.restorePosition();
      Lampa.Activity.active().activity.component.resize();Lampa.Controller.toggle('content');
     });
     await page.waitForTimeout(160);
     assert.equal(await grid.evaluate(node=>node.scrollTop),later.top,'Stale selection and resize do not move the page');
     if(mode!=='mobile'){
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(()=>{
       const node=document.querySelector('.activity--active .pt-browser-catalogue'),focused=node.querySelector('.card.focus');
       if(!focused)return false;
       const a=node.getBoundingClientRect(),b=focused.getBoundingClientRect();return b.top<a.bottom && b.bottom>a.top;
      },null,{timeout:4500});
     }
     // Record the settled position; a visible card may still be finishing
     // the last few pixels of the focus animation.
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     await page.waitForFunction(()=>!document.querySelector('.activity--active .pt-catalogue-moving'));
     const before=await grid.evaluate(node=>node.scrollTop);
     assert.ok(Math.abs(before-later.top)<box.height,'Remote resumes in the visible region '+JSON.stringify({before,later,box,state:await grid.evaluate(n=>{const c=Lampa.Activity.active().activity.component;return {active:c.active,last:c.last?.className,focus:n.querySelector('.card.focus')?.textContent};})}));
     if(mode==='tv')for(const theme of ['minimal','glass']){
      await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
      if(theme==='glass'){
       await grid.evaluate(node=>{node.scrollTop=Math.max(0,node.scrollTop-2*node.clientHeight);});
       await page.waitForFunction(()=>!document.querySelector('.activity--active .pt-catalogue-moving'));
       await page.keyboard.press('ArrowDown');
       await page.waitForTimeout(320);
      }
      await grid.evaluate(node=>{
       const positions=[node.scrollTop];
       const record=event=>{if(event.target===node)positions.push(node.scrollTop);};
       document.addEventListener('scroll',record,true);
       window.takeTvScrollPositions=()=>{document.removeEventListener('scroll',record,true);return positions;};
      });
      for(let i=0;i<5;i++){await page.keyboard.press('ArrowDown');await page.waitForTimeout(55);}
      await page.waitForTimeout(320);
      const positions=await page.evaluate(()=>takeTvScrollPositions());
      assert.ok(positions.length>=4 && positions.every((top,i)=>!i || top>=positions[i-1]),theme+': downward remote scroll advances across frames '+positions.join(', '));
     }
     const beforeBack=await grid.evaluate(node=>node.scrollTop);
     if(mode==='mobile'){
      await page.waitForFunction(()=>!document.querySelector('.activity--active .pt-catalogue-moving'));
      const target=await grid.evaluate(node=>{
       const bounds=node.getBoundingClientRect();
       for(const poster of node.querySelectorAll('.card__view')){
        if(!poster.closest('.card').bind_events)continue;
        const rect=poster.getBoundingClientRect(),x=rect.left+rect.width/2;
        const top=Math.max(rect.top,bounds.top+80),bottom=Math.min(rect.bottom,bounds.bottom-16);
        if(bottom-top<30)continue;
        const y=(top+bottom)/2;
        if(poster.contains(document.elementFromPoint(x,y)))return {x,y};
       }
       return null;
      });
      assert.ok(target,'A poster can be tapped in the visible part of the catalogue');
      await page.touchscreen.tap(target.x,target.y);
     }else await page.evaluate(()=>Lampa.Activity.push({component:'full',id:123,source:'tmdb',method:'movie',card:{id:123,title:'Тестовый фильм',source:'tmdb'}}));
     await page.waitForSelector('.activity--active .minimal-detail-header');
     await page.evaluate(()=>Lampa.Activity.backward());
     await grid.waitFor();await page.waitForTimeout(200);
     assert.equal(await grid.evaluate(node=>node.scrollTop),beforeBack,'Back restores this grid position');
     if(mode==='desktop'){
      const scrollbar=page.getByRole('scrollbar',{name:'Прокрутка страницы'});
      await scrollbar.waitFor();
      assert.equal(Number(await scrollbar.getAttribute('aria-valuenow')),Math.round(beforeBack));
      await scrollbar.focus();await scrollbar.press('Home');
      await page.waitForFunction(()=>document.querySelector('.activity--active .pt-browser-catalogue').scrollTop===0);
     }
     if(mode==='mobile' && engine.name()==='chromium'){
      await grid.evaluate(node=>{node.scrollTop=0;});
      await page.waitForFunction(()=>!document.querySelector('.activity--active .pt-catalogue-moving'));
       const touch=await context.newCDPSession(page),x=Math.round(box.x+box.width/2),y=Math.round(box.y+box.height*.8);
       await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
       for(let i=1;i<=8;i++){
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*24}]});
        await page.waitForTimeout(20);
       }
       await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
       assert.ok(await grid.evaluate(node=>node.scrollTop>0),'A real touch pan scrolls the catalogue');
     }
     assert.deepEqual(errors,[]);
     console.log(engine.name(),mode,'browser catalogue scroll, stable pagination, focus and return passed');
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

