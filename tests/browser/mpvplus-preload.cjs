const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const bridge=fs.readFileSync(require.resolve('../../plugins/mpvplus-ios.js'),'utf8');
(async()=>{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{for(const direct of [false,true]){
   const r=await setup(browser,{viewport:{width:393,height:852},isMobile:true,hasTouch:true,mode:'mobile'}),{page}=r;
   await page.evaluate(({source,direct})=>{
    const L=Lampa;L.DeviceInput.init();L.Controller.observe();
    const screen=L.Platform.screen;L.Platform.screen=type=>type==='mobile' || type!=='tv'&&screen(type);document.body.classList.add('true--mobile','touch-device');
    L.Storage.set('player','mpvplus');L.Storage.set('player_torrent','mpvplus');
    window.qaLaunches=[];window.qaPreloads=[];
    // Intercept the OS handoff only; Select, preload, autostart and clicks are native.
    const host={Lampa:L,appready:true,URL,Blob,document,navigator,setTimeout:setTimeout.bind(window),btoa:btoa.bind(window),location:{href:location.href,assign:url=>qaLaunches.push(url)}};
    if(!direct)new Function('window',source)(host);
    const movie={id:99,name:'Гангстерленд',original_name:'MobLand',original_title:'MobLand',source:'tmdb',first_air_date:'2025-03-30',number_of_seasons:1,seasons:[{season_number:1,episode_count:10}],genres:[]};
    const release={Title:'Гангстерленд / MobLand S01E01 WEB-DL 1080p',Tracker:'test',Size:1e9,Seeders:50,MagnetUri:'magnet:?xt=urn:btih:'+'a'.repeat(40)};
    L.Parser.get=(p,ok)=>setTimeout(()=>ok({Results:[release]}),0);L.Activity.push({component:'torrents',movie,search:'MobLand',url:'',page:1});
    L.Torserver.url=()=>true;L.Torserver.ip=()=>'/ts';L.Torserver.connected=ok=>ok();L.Torserver.hash=(p,ok)=>ok({hash:'a'.repeat(40)});
    L.Torserver.files=(hash,ok)=>ok({file_stats:[{id:7,path:'MobLand/MobLand.S01E01.mkv',length:1e9}]});
    L.Torserver.viewed=(hash,ok)=>ok([]);L.Torserver.stream=(file,hash,id)=>'/ts/stream/file.mkv?link='+hash+'&index='+id+'&preload';
    L.Torserver.toPlayUrl=url=>url.replace('&preload','&play');
    L.Api.seasons=(card,seasons,ok)=>ok({1:{episodes:[{season_number:1,episode_number:1,name:'Пан или пропал',runtime:60}]}});
    const network=testNetwork;window.testNetwork=(url,ok,error)=>/\/ts\/stream/.test(url)?setTimeout(()=>{qaPreloads.push(url);if(direct){error&&error({status:401});return;}ok({preloaded_bytes:qaPreloads.length===1?20:100,preload_size:100});},30):network(url,ok,error);
    if(direct)new Function('window',source)(host);
    // A host adapter may replace public Player methods after this plugin loaded.
    L.Player.play=()=>{};L.Player.playlist=()=>{};L.Player.callback=()=>{};
    L.Torrent.opened(()=>{L.Modal.close();L.Controller.toggle('content');});
    window.qaStart=()=>L.Torrent.start(release,movie);
   },{source:bridge,direct});
   await page.waitForSelector('.torrent-item.tc-item');await page.evaluate(()=>qaStart());
   await page.waitForSelector('.torrent-files .torrent-serial',{timeout:7000});
   assert.equal(await page.locator('.torrent-files .torrent-serial').count(),1,'one-episode release contains one file');
   if(!direct){await page.waitForFunction(()=>qaPreloads.length===1,{},{timeout:15000});assert.equal(await page.locator('.selectbox-item').count(),0,'no launch chooser while preload is incomplete');}
   const choice=page.locator('.selectbox-item').filter({hasText:'Открыть в mpv+'});
   await choice.waitFor({timeout:direct?15000:5000});await page.waitForTimeout(400);
   assert.equal(await page.evaluate(()=>qaLaunches.length),0,'autostart must wait for a new user gesture');
   assert.equal(await page.locator('.torrent-files').count(),0,'host already returned from file dialog');
   const point=await choice.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
   const scale=name==='webkit' && process.platform==='win32'?await page.evaluate(()=>devicePixelRatio):1;
   await page.touchscreen.tap(point.x*scale,point.y*scale);
   await page.waitForFunction(()=>qaLaunches.length===1,{},{timeout:3000});
   const result=await page.evaluate(()=>({launches:qaLaunches,requests:qaPreloads}));
   const doc=JSON.parse(Buffer.from(new URL(result.launches[0]).searchParams.get('data'),'base64url').toString());
   assert.equal(doc.items.length,1);assert.equal(doc.items[0].episode,1);assert.equal(doc.selected,0);
   assert.match(doc.items[0].url,/index=7&play$/);
   if(direct)assert.deepEqual(result.requests,[],'a failing preload endpoint must not prevent handing the received playlist to mpv+');
   else {assert.ok(result.requests[0].endsWith('&preload'));assert.ok(result.requests[1].endsWith('&stat'));}
   assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+': native one-file autostart, '+(direct?'no preload dependency':'legacy preload polling')+', host return and touch handoff passed');
  }}finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
