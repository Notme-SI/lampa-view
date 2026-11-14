const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');

(async()=>{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const {page,context,errors}=await setup(browser,{mode:'tv',viewport:{width:960,height:540}},{beforePlugin:page=>page.evaluate(()=>{
    const L=Lampa;L.Params.init();L.Layer.init();
    L.Storage.set('lampa_view_hero',false);
    window.nativeRowScans=0;
    const visible=L.Layer.visible;
    L.Layer.visible=function(where){
     const node=where?.nodeType?where:where?.[0];
     if(node?.matches('.scroll--horizontal'))window.nativeRowScans++;
     return visible.apply(this,arguments);
    };
    L.Api.main=(params,ok)=>setTimeout(()=>ok(Array.from({length:8},(_,row)=>({title:'Ряд '+row,url:'qa/'+row,results:Array.from({length:20},(_,id)=>({id:row*100+id+1,title:'Фильм '+row+' '+id,poster_path:'/poster.jpg',release_date:'2025-01-01',source:'tmdb'}))}))),10);
   })});
   try{
    await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));
    const scroll=page.locator('.activity--active .pt-browser-catalogue');
    await scroll.locator('.items-line').first().waitFor();
    // A visible row and its cards must run their real visible handlers and load
    // artwork without a nested native geometry scan.
    const ready=()=>page.waitForFunction(()=>{
     const root=document.querySelector('.activity--active .pt-browser-catalogue');
     const bounds=root.getBoundingClientRect();
     const rows=[...root.querySelectorAll('.items-line')].filter(row=>{const box=row.getBoundingClientRect();return box.top<bounds.bottom && box.bottom>bounds.top;});
     return rows.length && rows.every(row=>row.called_visible && [...row.querySelectorAll('.card')].slice(0,5).every(card=>card.called_visible && card.classList.contains('card--loaded')));
    },null,{timeout:5000});
    await ready();
    await page.waitForFunction(()=>document.querySelectorAll('.activity--active .minimal-posters-sized').length>=3);
    const layoutUpdates=await page.evaluate(()=>{
     const {activity}=Lampa.Activity.active(),list=activity.component;
     Navigator.follow('focus',event=>Lampa.Controller.focus(event.elem));
     list.items[0].toggle();
     const update=Lampa.Layer.update, spatialFocus=Navigator.focus;
     let calls=0,searches=0;
     Lampa.Layer.update=function(){calls++;return update.apply(this,arguments);};
     Navigator.focus=function(){searches++;return spatialFocus.apply(this,arguments);};
     try{
      Lampa.Controller.move('down');
      Lampa.Controller.move('down');
      const during=calls;
      document.dispatchEvent(new Event('minimal:tv-idle'));
      const target=list.items[2].items[0].render(true);
      return {during,after:calls,row:list.active,searches,focus:Navigator.getFocusedElement()===target && target.classList.contains('focus')};
     }finally{Lampa.Layer.update=update;Navigator.focus=spatialFocus;}
    });
    assert.deepEqual(layoutUpdates,{during:0,after:1,row:2,searches:0,focus:true},'Remote focuses the known poster with no spatial search and refreshes the shell once at idle');
    await page.waitForFunction(()=>!document.querySelector('.activity--active .pt-catalogue-moving'));
    await scroll.evaluate(node=>{node.scrollTop=120;});
    await page.waitForFunction(()=>document.querySelector('.activity--active .pt-catalogue-moving'));
    const deferred=await scroll.evaluate(async node=>{
     const list=Lampa.Activity.active().activity.component;
     const remaining=node.scrollHeight-node.clientHeight-node.scrollTop;
     const row={title:'Fetched row',results:[{id:999,title:'Fetched poster',poster_path:'/poster.jpg',source:'tmdb'}]};
     list.loaded.push([row]);
     list.scroll.onAnimateEnd();
     await new Promise(requestAnimationFrame);
     return {remaining,height:node.clientHeight,queued:list.loaded.some(batch=>batch.includes(row))};
    });
    assert.ok(deferred.remaining>deferred.height && deferred.queued,'A fetched TV row waits for a scroll step when there is still room ahead');
    await scroll.getByText('Fetched row',{exact:true}).waitFor();
    await scroll.evaluate(node=>{node.scrollTop=node.scrollHeight-node.clientHeight;});
    await ready();
    const saved=await scroll.evaluate(node=>node.scrollTop);
    // Pause disconnects the observer. Returning must observe any still-unseen
    // leaf posters as well as their already-visible parent row.
    await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));
    await page.waitForTimeout(150);
    await page.evaluate(()=>Lampa.Activity.backward());
    await scroll.waitFor();await ready();
    assert.equal(await scroll.evaluate(node=>node.scrollTop),saved);
    await scroll.evaluate(node=>{node.scrollTop=0;});await ready();
    assert.equal(await page.evaluate(()=>window.nativeRowScans),0,'Poster rows reuse observed visibility rather than invoking native nested scans');
    assert.deepEqual(errors,[]);
    console.log(engine.name()+': row artwork and visibility survive scrolling and pause/return without nested native scans');
   }finally{await context.close();}
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
