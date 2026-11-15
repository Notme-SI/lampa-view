const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
const fixture=path.join(__dirname,'../fixtures/lampa-runtime/current-menu');
const profiles=[
 {name:'desktop',mode:'desktop',viewport:{width:1440,height:900}},
 {name:'tv',mode:'tv',viewport:{width:1920,height:1080}},
 {name:'phone',mode:'mobile',viewport:{width:320,height:720},isMobile:true,hasTouch:true},
 {name:'legacy-phone',mode:'mobile',viewport:{width:393,height:852},isMobile:true,hasTouch:true,legacy:true}
];
(async()=>{for(const engine of [chromium,webkit].filter(e=>!process.env.QA_ENGINE||e.name()===process.env.QA_ENGINE)){
 const browser=await engine.launch({headless:true});try{for(const profile of profiles){
  const r=await setup(browser,profile,{...(profile.legacy?{}:{app:path.join(fixture,'app.js.gz'),css:path.join(fixture,'app.css.gz')}),beforePlugin:p=>p.evaluate(()=>{Lampa.Platform.init();Lampa.Params.init();Lampa.Layer.init();Lampa.Storage.set('animation',false);})}),p=r.page;
  try{
   for(const [theme,size] of [['minimal','small'],['glass','normal'],['minimal','bigger']]){
    await p.evaluate(({theme,size})=>{
     const L=Lampa;L.Storage.set('lampa_view_theme',theme);L.Storage.set('interface_size',size);window.qaCancelled=0;
     L.Loading.start(()=>{window.qaCancelled++;L.Loading.stop();},'Подключение…',{media:{card:{title:'Проверка загрузки',backdrop_path:'/scene.jpg'}}});
    },{theme,size});
    const status=p.locator('.media-loading--standalone .media-loading__status');
    assert.match(await status.innerText(),/Подключение/,'Native stage messages remain readable');
    await p.evaluate(()=>Lampa.Loading.setProgress(73.2,{active_peers:23,total_peers:529,seeders:15,speed:'188 Мбит/с',preloaded:36600000,preload_size:50000000,eta:1}));
    const b=await status.evaluate(n=>{const rect=n=>n.getBoundingClientRect().toJSON();return {text:n.innerText.replace(/\s+/g,' ').trim(),rect:rect(n),speed:rect(n.querySelector('.media-loading__speed')),percent:rect(n.querySelector('.media-loading__percent')),peers:rect(n.querySelector('.media-loading__peers')),eta:n.querySelector('.media-loading__eta')?.textContent,extra:n.querySelector('.media-loading__row--extra')&&rect(n.querySelector('.media-loading__row--extra')),progress:n.closest('.media-loading').querySelector('.media-loading__mark-fill').style.width,width:innerWidth,height:innerHeight};});
    assert.equal(b.text,'188 Мбит/с 73%',JSON.stringify({profile:profile.name,theme,size,b}));
    assert.equal(b.peers.width,0,'Connection counts are not part of the compact status');
    if(!profile.legacy){assert.ok(b.eta.includes('1'),'Exercise a native host that actually produces the removed ETA');assert.equal(b.extra.height,0,'The extra row leaves no empty space');}
    assert.equal(b.progress,'73.2%','Native buffer progress is preserved');
    assert.ok(await status.locator('.media-loading__speed').evaluate(n=>{const b=n.getBoundingClientRect();return !!document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.media-loading--standalone');}),'The fullscreen loader stays above mobile bottom navigation');
    assert.ok(b.rect.left>=0&&b.rect.right<=b.width&&b.rect.bottom<=b.height,'The capsule fits even on a small phone');
    assert.ok(Math.abs(b.speed.top-b.percent.top)<2,'Speed and progress stay on one line');
    if(process.env.LAMPA_QA_OUTPUT&&theme==='glass'&&!profile.legacy){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await p.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-'+profile.name+'.png')});}
    await p.evaluate(()=>Lampa.Loading.setText('Открываем видео…'));assert.match(await status.innerText(),/Открываем видео/,'The native text channel still works');
    await p.evaluate(()=>Lampa.Controller.back());assert.equal(await p.evaluate(()=>qaCancelled),1);assert.equal(await p.locator('.media-loading--standalone').count(),0,'Back still cancels native preloading');
   }
   assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+profile.name+': compact speed/buffer, native messages/progress/cancel PASS');
  }finally{await r.context.close();}
 }}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
