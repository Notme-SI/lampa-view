const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});try{
   for(const device of [{mode:'desktop',width:1280,height:720},{mode:'desktop',width:1920,height:1080},{mode:'desktop',width:2048,height:1070},{mode:'desktop',width:2559,height:1338},{mode:'tv',width:1280,height:720},{mode:'tv',width:1920,height:1080},{mode:'tv',width:3840,height:2160}]){
    const r=await setup(browser,{viewport:{width:device.width,height:device.height},mode:device.mode},{beforePlugin:page=>page.evaluate(()=>{
     const L=Lampa;L.Params.init();L.Layer.init();L.Storage.set('lampa_view_hero',true);
     L.Api.main=(o,ok)=>ok(['Сейчас смотрят','Популярное'].map((title,row)=>({title,url:'qa/'+row,results:Array.from({length:20},(_,i)=>({id:row*100+i+1,title:'Очень длинное название фильма '+(i+1),overview:'Описание фильма для проверки первого экрана.',poster_path:'/poster'+i+'.jpg',backdrop_path:'/backdrop'+i+'.jpg',release_date:'2025-01-01',source:'tmdb'}))})));
    })}),{page}=r;
    await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));const frames=[];
    for(const size of ['small','normal','bigger']){
     await page.evaluate(size=>Lampa.Storage.set('interface_size',size),size);await page.waitForTimeout(1900);
     await page.waitForSelector('.activity--active .pt-hero + .minimal-home-first-row');
     const value=await page.locator('.activity--active .pt-hero').evaluate(hero=>{
      const first=hero.nextElementSibling,second=first.nextElementSibling,view=first.querySelector('.scroll--horizontal').getBoundingClientRect(),rect=hero.getBoundingClientRect();
      const cards=[...first.querySelectorAll('.card')].filter(n=>{const r=n.getBoundingClientRect();return r.left>=view.left-1 && r.right<=view.right+1;});
      return {hero:{top:rect.top,width:rect.width,height:rect.height},row:{top:first.getBoundingClientRect().top,bottom:first.getBoundingClientRect().bottom},secondTop:second&&second.getBoundingClientRect().top,maxCardBottom:Math.max(...cards.map(n=>n.getBoundingClientRect().bottom)),viewport:innerHeight,count:cards.length};
     });
     assert.ok(value.hero.top>= -1,'Banner must remain at the top of the first screen: '+JSON.stringify(value));
     assert.ok(value.maxCardBottom<=value.viewport-2,'First row must fit vertically: '+JSON.stringify({device,size,value}));
     assert.ok(value.secondTop===null || value.secondTop>=value.viewport,'Next collection must not show a strip: '+JSON.stringify({device,size,value}));
     frames.push({...value.hero,count:value.count});
     if(process.env.LAMPA_QA_OUTPUT && device.width===2048){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engineName+'-home-'+size+'.png')});}
    }
    assert.ok(frames.every(frame=>Math.abs(frame.height-frames[0].height)<1 && Math.abs(frame.width-frames[0].width)<1),'Banner dimensions must not change with UI scale: '+JSON.stringify(frames));
    assert.ok(frames[0].count>=frames[1].count && frames[1].count>=frames[2].count,'Bigger must not shrink the first-row posters: '+JSON.stringify(frames));
    await page.locator('.activity--active .pt-hero').hover();await page.mouse.wheel(0,600);await page.waitForTimeout(600);
    assert.ok(await page.locator('.activity--active .pt-hero').evaluate(n=>n.getBoundingClientRect().top)<frames[2].top-100,'The rest of the page remains accessible by scrolling');
    assert.deepEqual(r.errors,[]);await r.context.close();console.log(engineName+' '+device.mode+' '+device.width+'x'+device.height+': fixed banner and one whole first row at every native size');
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
