const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const output=process.env.LAMPA_QA_OUTPUT;
async function geometry(page){return page.locator('.activity--active .minimal-posters-sized').first().evaluate(root=>{
 const view=root.querySelector('.scroll--horizontal').getBoundingClientRect(),cards=[...root.querySelectorAll('.card')].map(node=>{const r=node.querySelector('.card__view').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};});
 const visible=cards.filter(r=>r.right>view.left+1 && r.left<view.right-1);
 const component=Lampa.Activity.active().activity.component,line=component.items.find(item=>item.render(true)===root),fit=line.scroll.minimalPosterFit;
 return {fit,view:{left:view.left,right:view.right,width:view.width},visible,partial:visible.filter(r=>r.left<view.left-1 || r.right>view.right+1),active:line.active,position:line.scroll.position(),scrollLeft:root.querySelector('.scroll--horizontal').scrollLeft,focused:[...root.querySelectorAll('.card.focus,.card.hover')].map(n=>[...root.querySelectorAll('.card')].indexOf(n)),total:cards.length,results:line.data.results.length};
});}
function whole(result,label){assert.deepEqual(result.partial,[],label+' crops a poster: '+JSON.stringify(result));assert.equal(result.visible.length,Math.min(result.fit.count,result.results),label+' must show a complete row: '+JSON.stringify(result));}
// Wait for actual geometry to settle: WebKit animation frames can lag behind
// a fixed wall-clock timeout on the shared Linux runner. Keep the same checks.
async function settled(page,label){
 let previous='',stable=0,result;
 for(let i=0;i<50;i++){
  result=await geometry(page);const key=JSON.stringify(result.visible);
  stable=key===previous && !result.partial.length?stable+1:0;previous=key;
  if(stable>=2)return whole(result,label);
  await page.waitForTimeout(40);
 }
 whole(result,label);
}
(async()=>{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.LAMPA_QA_ENGINE || name===process.env.LAMPA_QA_ENGINE)){
  const browser=await engine.launch({headless:true});try{
   for(const device of [{mode:'mobile',width:320,height:740},{mode:'mobile',width:393,height:852},{mode:'mobile',width:852,height:393},{mode:'desktop',width:768,height:1024},{mode:'desktop',width:1280,height:800},{mode:'desktop',width:1920,height:1080},{mode:'desktop',width:2559,height:1338},{mode:'tv',width:1920,height:1080},{mode:'tv',width:3840,height:2160}].filter(device=>!process.env.LAMPA_QA_DEVICE || device.mode+':'+device.width===process.env.LAMPA_QA_DEVICE)){
    const r=await setup(browser,{viewport:{width:device.width,height:device.height},mode:device.mode,isMobile:device.mode==='mobile',hasTouch:device.mode==='mobile'},{beforePlugin:page=>page.evaluate(()=>{
     const L=Lampa;L.Params.init();L.Layer.init();L.Storage.set('lampa_view_hero',false);
     L.Api.main=(o,ok)=>ok([{title:'Подборка',url:'test',results:Array.from({length:40},(_,i)=>({id:i+1,title:'Фильм '+(i+1),poster_path:'/poster'+i+'.jpg',release_date:'2025-01-01',source:'tmdb'}))}]);
    })}),{page}=r;
    await page.evaluate(()=>{Lampa.Activity.push({component:'main',source:'tmdb'});Lampa.DeviceInput.init();Lampa.Controller.observe();Lampa.Keypad.init();Lampa.Keypad.enable();Navigator.follow('focus',event=>Lampa.Controller.focus(event.elem));});
    const values=[];
    for(const size of ['small','normal','bigger']){
     await page.evaluate(size=>Lampa.Storage.set('interface_size',size),size);
     // The native setting rebuilds active screens after its 1 s debounce + 400 ms delay.
     await page.waitForTimeout(1800);await page.waitForSelector('.activity--active .minimal-posters-sized');
     await page.evaluate(()=>Lampa.Layer.visible(Lampa.Activity.active().activity.render(true)));await page.waitForTimeout(120);
     const label=engineName+' '+device.mode+' '+device.width+' '+size,result=await geometry(page);whole(result,label);values.push(result);
     const navigation=(device.mode==='desktop' && device.width===2559) || (device.mode==='tv' && device.width===1920) || (device.mode==='mobile' && device.width===393);
     if(navigation){
      await page.evaluate(()=>{const line=Lampa.Activity.active().activity.component.items[0];line.toggle();});
      for(let i=0;i<result.fit.count+2;i++)await page.keyboard.press('ArrowRight');await settled(page,label+' remote');
      for(let i=0;i<result.fit.count+2;i++)await page.keyboard.press('ArrowLeft');await settled(page,label+' remote return');
      if(device.mode==='desktop'){
       const arrows=page.locator('.activity--active .items-line .minimal-row-arrow');
       await arrows.last().click();await page.waitForTimeout(420);whole(await geometry(page),label+' next page');
       for(let i=0;i<3;i++){await arrows.last().click();await page.waitForTimeout(420);}whole(await geometry(page),label+' last page');
       for(let i=0;i<4;i++){await arrows.first().click();await page.waitForTimeout(420);}whole(await geometry(page),label+' previous page');
       await page.locator('.activity--active .items-line').hover();await page.mouse.wheel(267,0);await page.waitForTimeout(1000);whole(await geometry(page),label+' wheel settled');
      }
     }
     if(output && device.width===2559){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,engineName+'-poster-'+size+'.png')});}
    }
    assert.ok(values[0].fit.count>=values[1].fit.count && values[1].fit.count>=values[2].fit.count,'Larger UI uses no more poster slots');
    assert.deepEqual(r.errors,[]);await r.context.close();console.log(engineName+' '+device.mode+' '+device.width+': all native sizes fit complete poster rows ('+values.map(v=>v.fit.count).join('/')+')');
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
