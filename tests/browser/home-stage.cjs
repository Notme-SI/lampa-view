const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(engineName==='chromium'?{args:['--blink-settings=minimumFontSize=8']}: {})});try{
   for(const device of [{mode:'desktop',width:1280,height:720},{mode:'desktop',width:1920,height:1080},{mode:'desktop',width:2048,height:1070},{mode:'desktop',width:2559,height:1338},{mode:'tv',width:960,height:540},{mode:'tv',width:1280,height:720},{mode:'tv',width:1920,height:1080},{mode:'tv',width:3840,height:2160}]){
    const r=await setup(browser,{viewport:{width:device.width,height:device.height},mode:device.mode},{beforePlugin:page=>page.evaluate(()=>{
     const L=Lampa;L.Params.init();L.Layer.init();L.Storage.set('lampa_view_hero',true);
     L.Api.main=(o,ok)=>ok(['Сейчас смотрят','Популярное'].map((title,row)=>({title,url:'qa/'+row,results:Array.from({length:20},(_,i)=>({id:row*100+i+1,title:'Очень длинное название фильма '+(i+1),overview:'Описание фильма для проверки первого экрана.',poster_path:'/poster'+i+'.jpg',backdrop_path:'/backdrop'+i+'.jpg',release_date:'2025-01-01',source:'tmdb'}))})));
    })}),{page}=r;
    await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));const frames=[];
    for(const size of ['small','normal','bigger']){
     await page.evaluate(size=>Lampa.Storage.set('interface_size',size),size);await page.waitForTimeout(1800);
     await page.waitForSelector('.activity--active .pt-hero + .minimal-home-first-row').catch(async e=>{console.error(JSON.stringify({engineName,device,size,errors:r.errors,dom:await page.evaluate(()=>({body:document.body.className,active:document.querySelector('.activity--active')?.className,hero:!!document.querySelector('.pt-hero'),rows:[...document.querySelectorAll('.activity--active .items-line')].map(n=>n.className)}))}));throw e;});
     if(device.mode==='tv')await page.locator('.activity--active .pt-hero').evaluate(hero=>{const logo=hero.querySelector('.pt-hero__logo');logo.classList.remove('pt-hidden');logo.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420"><rect width="1200" height="420" fill="white"/></svg>');hero.querySelector('.pt-hero__title').classList.add('pt-hidden');});await page.waitForTimeout(150);

     const value=await page.locator('.activity--active .pt-hero').evaluate(hero=>{
      const first=hero.nextElementSibling,second=first.nextElementSibling,view=first.querySelector('.scroll--horizontal').getBoundingClientRect(),rect=hero.getBoundingClientRect();
      const cards=[...first.querySelectorAll('.card')].filter(n=>{const r=n.getBoundingClientRect();return r.left>=view.left-1 && r.right<=view.right+1;});
      const b=hero.querySelector('.pt-hero__body').getBoundingClientRect();return {bodyTop:b.top-rect.top,bodyBottom:b.bottom-rect.top,posterWidth:parseFloat(getComputedStyle(first.querySelector('.card')).width),secondPosterWidth:second && parseFloat(getComputedStyle(second.querySelector('.card')).width),secondFitted:second && second.classList.contains('minimal-posters-sized'),hero:{top:rect.top,width:rect.width,height:rect.height},row:{top:first.getBoundingClientRect().top,bottom:first.getBoundingClientRect().bottom},secondTop:second&&second.getBoundingClientRect().top,maxCaptionBottom:Math.max(...cards.map(n=>n.querySelector('.card__age').getBoundingClientRect().bottom)),maxCardBottom:Math.max(...cards.map(n=>n.getBoundingClientRect().bottom)),viewport:innerHeight,count:cards.length};
     });
     assert.ok(value.hero.top>= -1,'Banner must remain at the top of the first screen: '+JSON.stringify(value));
     assert.ok(value.maxCaptionBottom<=value.viewport-2,'Posters, titles and year fit the first screen: '+JSON.stringify({device,size,value}));
     if(device.mode==='tv'){assert.ok(value.bodyTop>=-1 && value.bodyBottom<=value.hero.height+1,'TV carousel branding stays inside its frame at the WebView font floor: '+JSON.stringify({device,size,value}));}else {
     assert.ok(value.maxCaptionBottom<=value.viewport-2,'First row captions must fit vertically: '+JSON.stringify({device,size,value}));
     assert.ok(value.secondTop===null || value.secondTop>=value.viewport,'Next collection must not show a strip: '+JSON.stringify({device,size,value}));
     }
     assert.ok(value.secondFitted,'The next row uses the same fitting rules');if(device.mode==='tv')assert.ok(value.posterWidth<value.secondPosterWidth,'Hero preview is compact until entering the collection');else assert.ok(Math.abs(value.posterWidth-value.secondPosterWidth)<1,'Desktop first collection uses shared card size: '+JSON.stringify({device,size,value}));
     frames.push({...value.hero,count:value.count,posterWidth:value.posterWidth});
     if(process.env.LAMPA_QA_OUTPUT && device.width===2048){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engineName+'-home-'+size+'.png')});}
    }
    assert.ok(frames.every(frame=>Math.abs(frame.width-frames[0].width)<1),'Banner width stays consistent: '+JSON.stringify(frames));
    assert.ok(frames[0].height>=frames[2].height,'Carousel uses the space left by the actual scaled row: '+JSON.stringify(frames));
    assert.ok(frames[2].posterWidth>frames[1].posterWidth+2,'Bigger must increase real poster width: '+JSON.stringify(frames));
    assert.ok(frames[0].count>=frames[1].count && frames[1].count>=frames[2].count,'Bigger must not shrink the first-row posters: '+JSON.stringify(frames));
    await page.evaluate(()=>Lampa.Controller.toggle('lampa_view_hero'));await page.waitForTimeout(350);
    await page.locator('.activity--active .pt-hero').evaluate(h=>{h.dataset.qaSlide=h.querySelector('.pt-hero__dot.active').getAttribute('aria-label');});
    await page.setViewportSize({width:device.width,height:device.height+120});await page.waitForTimeout(350);
    if(device.mode==='desktop'){
     const settled=await page.locator('.activity--active .pt-hero').evaluate(h=>({viewport:innerHeight,top:h.getBoundingClientRect().top,rowHeight:h.nextElementSibling.offsetHeight,rowGap:parseFloat(getComputedStyle(h.nextElementSibling).marginBottom)||0,rowTop:h.nextElementSibling.getBoundingClientRect().top,ancestors:Array.from((function*(n){while(n){yield n;n=n.parentElement}})(h.parentElement)).slice(0,5).map(n=>({class:n.className,transform:getComputedStyle(n).transform,scrollTop:n.scrollTop})),height:h.getBoundingClientRect().height,next:h.nextElementSibling.nextElementSibling.getBoundingClientRect().top,slide:h.querySelector('.pt-hero__dot.active').getAttribute('aria-label'),before:h.dataset.qaSlide}));
     // Browser zoom and the minimum banner height can absorb part of a resize.
     // Verify the result: the banner grows and the next row meets the viewport edge.
     assert.ok(settled.height>frames[2].height+1,'Mounted banner uses the taller viewport: '+JSON.stringify({device,frames,settled}));assert.ok(settled.next>=settled.viewport && settled.next<=settled.viewport+Math.max(12,settled.rowGap)+2,'Next collection stays just below the screen after resize: '+JSON.stringify({device,settled}));assert.equal(settled.slide,settled.before,'Geometry settles without a slide change');
    }
    await page.locator('.activity--active .pt-hero').hover();await page.mouse.wheel(0,600);await page.waitForTimeout(600);
    const afterWheel=await page.locator('.activity--active .pt-hero').evaluate(n=>({top:n.getBoundingClientRect().top,offset:n.parentElement.style.transform,viewport:innerHeight}));assert.ok(afterWheel.top<frames[2].top-100,'The rest of the page remains accessible by scrolling: '+JSON.stringify({device,afterWheel,frame:frames[2]}));
    assert.deepEqual(r.errors,[]);await r.context.close();console.log(engineName+' '+device.mode+' '+device.width+'x'+device.height+': adaptive desktop first screen / TV hero preview at every native size');
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
