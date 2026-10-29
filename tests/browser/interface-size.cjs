const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
(async()=>{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});try{
   for(const device of [{mode:'mobile',width:320,height:740},{mode:'mobile',width:393,height:852},{mode:'mobile',width:852,height:393},{mode:'desktop',width:768,height:1024},{mode:'desktop',width:1280,height:800},{mode:'desktop',width:1920,height:1080},{mode:'tv',width:1280,height:720},{mode:'tv',width:1920,height:1080},{mode:'tv',width:3840,height:2160}]){
    const r=await setup(browser,{viewport:{width:device.width,height:device.height},mode:device.mode,isMobile:device.mode==='mobile',hasTouch:device.mode==='mobile'},{beforePlugin:page=>page.evaluate(()=>{Lampa.Params.init();Lampa.Layer.init();})}),{page}=r;
    await page.evaluate(()=>{
     const rail=document.createElement('div');rail.className='items-line';rail.id='qa-scale-rail';rail.innerHTML='<div class="card"><div class="card__view"><img class="card__img"></div><div class="card__title">Название фильма</div></div>';document.body.appendChild(rail);
    });
    await stage(page,true,2);const values=[];
    for(const size of ['small','normal','bigger']){
     await page.evaluate(size=>Lampa.Storage.set('interface_size',size),size);await page.waitForTimeout(200);
     const value=await page.evaluate(()=>{
      const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};},head=document.querySelector('.head'),root=document.querySelector('.nova-plus-root'),bar=root.querySelector('.nova-plus__bar');
      const cols=[...root.querySelectorAll('.nova-card--wide')].map(rect);
      return {size:Lampa.Storage.get('interface_size'),font:parseFloat(getComputedStyle(document.body).fontSize),icon:rect(head.querySelector('.head__menu-icon svg')),menu:rect(head.querySelector('.head__menu-icon')),head:rect(head),poster:rect(document.querySelector('#qa-scale-rail .card')),bar:rect(bar),buttons:[...bar.querySelectorAll('.nova-chip')].map(rect),root:rect(root),cols};
     });
     assert.ok(value.font>0 && value.menu.right<=device.width+1);assert.ok(value.menu.bottom<=value.head.bottom+1);
     for(const button of value.buttons)assert.ok(button.left>=value.root.left-1 && button.right<=value.root.right+1,'toolbar stays inside '+JSON.stringify({device,size,value}));
     for(const col of value.cols)assert.ok(col.right<=value.root.right+1 && col.width>0,'episode grid stays inside '+JSON.stringify({device,size,value}));
     if(device.mode==='mobile')assert.ok(value.buttons.every(button=>button.height>=43.5),'touch targets retain their minimum '+JSON.stringify({device,size,buttons:value.buttons}));
     values.push(value);
     await page.evaluate(()=>Lampa.Settings.create('interface'));await page.waitForTimeout(120);
     const settings=await page.locator('.settings__content').evaluate(n=>({font:parseFloat(getComputedStyle(n).fontSize),width:n.getBoundingClientRect().width}));assert.ok(settings.width<=device.width+1);value.settings=settings;
     await page.evaluate(()=>{Lampa.Controller.back();Lampa.Controller.toggle('content');});
    }
    assert.ok(values[0].font<values[1].font && values[1].font<values[2].font,'native font sizes increase');
    assert.ok(values[0].icon.width<values[1].icon.width && values[1].icon.width<values[2].icon.width,'icons scale');
    assert.ok(values[0].poster.width<values[1].poster.width && values[1].poster.width<values[2].poster.width,'catalogue covers scale '+JSON.stringify(values.map(v=>({font:v.font,width:v.poster.width}))));
    assert.ok(values[0].settings.font<values[1].settings.font && values[1].settings.font<values[2].settings.font,'settings scale');
    if(process.env.LAMPA_QA_OUTPUT){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engineName+'-'+device.mode+'-'+device.width+'-bigger.png')});}
    assert.deepEqual(r.errors,[]);await r.context.close();console.log(engineName+' '+device.mode+' '+device.width+'x'+device.height+': all three native sizes, icons, covers and controls passed');
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
