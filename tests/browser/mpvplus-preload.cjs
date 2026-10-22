const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const bridge=fs.readFileSync(require.resolve('../../plugins/mpvplus-ios.js'),'utf8');
(async()=>{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{for(const direct of [false,true]){
   const r=await setup(browser,{viewport:{width:393,height:852},isMobile:true,hasTouch:true,mode:'mobile',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1'}),{page}=r;
   await page.evaluate(({source,direct})=>{
    const L=Lampa;L.DeviceInput.init();L.Controller.observe();
    const screen=L.Platform.screen;L.Platform.screen=type=>type==='mobile' || type!=='tv'&&screen(type);document.body.classList.add('true--mobile','touch-device');
    L.Storage.set('player','mpvplus');L.Storage.set('player_torrent','mpvplus');
    window.qaLaunches=[];window.qaPreloads=[];window.qaStages=[];
    // Intercept the OS handoff only; Select, preload, autostart and clicks are native.
    const host={Lampa:L,appready:true,URL,Blob,document,navigator,setTimeout:setTimeout.bind(window),btoa:btoa.bind(window),location:{href:location.href,assign:url=>qaLaunches.push(url)}};
    if(!direct)new Function('window',source)(host);
    const movie={id:99,name:'Гангстерленд',original_name:'MobLand',original_title:'MobLand',source:'tmdb',first_air_date:'2025-03-30',number_of_seasons:1,seasons:[{season_number:1,episode_count:10}],genres:[]};
    const release={Title:'Гангстерленд / MobLand S01E01 WEB-DL 1080p',Tracker:'test',Size:1e9,Seeders:50,MagnetUri:'magnet:?xt=urn:btih:'+'a'.repeat(40)};
    L.Parser.get=(p,ok)=>setTimeout(()=>ok({Results:[release]}),0);L.Activity.push({component:'torrents',movie,search:'MobLand',url:'',page:1});
    L.Torserver.url=()=>true;L.Torserver.ip=()=>'/ts';L.Torserver.connected=ok=>{qaStages.push('connect');ok();};L.Torserver.hash=(p,ok)=>{qaStages.push('hash');ok({hash:'a'.repeat(40)});};
    L.Torserver.files=(hash,ok)=>ok({file_stats:(direct?[7,11,19]:[7]).map((id,i)=>({id,path:'MobLand/MobLand.S01E0'+(i+1)+'.mkv',length:1e9}))});
    L.Torserver.viewed=(hash,ok)=>ok([]);L.Torserver.stream=(file,hash,id)=>'/ts/stream/file.mkv?link='+hash+'&index='+id+'&preload';
    L.Torserver.toPlayUrl=url=>url.replace('&preload','&play');
    L.Api.seasons=(card,seasons,ok)=>ok({1:{episodes:[1,2,3].map(episode_number=>({season_number:1,episode_number,name:'Серия '+episode_number,runtime:60}))}});
    const network=testNetwork;window.testNetwork=(url,ok,error)=>/\/ts\/stream/.test(url)?setTimeout(()=>{qaPreloads.push(url);if(direct){error&&error({status:401});return;}ok({preloaded_bytes:qaPreloads.length===1?20:100,preload_size:100});},30):network(url,ok,error);
    if(direct)new Function('window',source)(host);
    // A host adapter may replace public Player methods after this plugin loaded.
    L.Player.play=()=>{};L.Player.playlist=()=>{};L.Player.callback=()=>{};
   },{source:bridge,direct});
   const release=page.locator('.activity--active .torrent-item.tc-item').first();await release.waitFor();
   const releasePoint=await release.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+25};});
   const scale=name==='webkit' && process.platform==='win32'?await page.evaluate(()=>devicePixelRatio):1;
   await page.touchscreen.tap(releasePoint.x*scale,releasePoint.y*scale);
   await page.waitForSelector('.torrent-files .torrent-serial',{timeout:7000});
   assert.deepEqual(await page.evaluate(()=>qaStages),['connect','hash'],'touching the release starts the native server connection');
   assert.equal(await page.locator('.torrent-files .torrent-serial').count(),direct?3:1);
   if(direct){
    await page.waitForTimeout(400);
    const episode=page.locator('.torrent-files .torrent-serial').nth(1);
    const p=await episode.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+25};});
    await page.touchscreen.tap(p.x*scale,p.y*scale);
   }
   if(!direct){await page.waitForFunction(()=>qaPreloads.length===1,{},{timeout:15000});assert.equal(await page.locator('.selectbox-item').count(),0,'no launch chooser while preload is incomplete');}
   const choice=page.locator('.selectbox-item').filter({hasText:'Открыть в mpv+'});
   await choice.waitFor({timeout:direct?15000:5000});await page.waitForTimeout(400);
   assert.equal(await page.evaluate(()=>qaLaunches.length),0,'autostart must wait for a new user gesture');
   assert.equal(await page.locator('.torrent-files').count(),0,'bridge dismisses the real native file dialog');
   const point=await choice.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
   assert.ok(await page.evaluate(p=>!!document.elementFromPoint(p.x,p.y)?.closest('.selectbox-item'),point),'the launch choice is not covered by the file modal');
   await page.touchscreen.tap(point.x*scale,point.y*scale);
   await page.waitForFunction(()=>qaLaunches.length===1,{},{timeout:3000});
   const result=await page.evaluate(()=>({launches:qaLaunches,requests:qaPreloads}));
   const doc=JSON.parse(Buffer.from(new URL(result.launches[0]).searchParams.get('data'),'base64url').toString());
   assert.equal(doc.items.length,direct?3:1);assert.equal(doc.items[doc.selected].episode,direct?2:1);assert.equal(doc.selected,direct?1:0);
   assert.match(doc.items[doc.selected].url,direct?/index=11&play$/:/index=7&play$/);
   if(direct)assert.deepEqual(result.requests,[],'a failing preload endpoint must not prevent handing the received playlist to mpv+');
   else {assert.ok(result.requests[0].endsWith('&preload'));assert.ok(result.requests[1].endsWith('&stat'));}
   assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+': release tap, '+(direct?'episode tap without preload':'one-file autostart with preload')+', visible chooser and touch handoff passed');
  }}finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
