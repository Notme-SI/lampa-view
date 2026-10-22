const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{
 for(const [engineName,engine]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{for(const device of ['Windows','Android TV']){
  const r=await setup(browser,{viewport:{width:1440,height:900},mode:device==='Windows'?'desktop':'tv',userAgent:device==='Windows'?'Mozilla/5.0 (Windows NT 10.0; Win64; x64)':'Mozilla/5.0 (Linux; Android 12; Android TV)'},{app:process.env.QA_NATIVE_APP,beforePlugin:async page=>page.evaluate(device=>{
   const L=Lampa,is=L.Platform.is;L.Platform.is=name=>name==='android'?device==='Android TV':name==='apple'?false:is(name);L.Platform.desktop=()=>device==='Windows';window.qaLaunches=[];
   if(device==='Windows')window.require=name=>name==='fs'?{existsSync:()=>true}:name==='child_process'?{spawn:(path,args)=>{qaLaunches.push({path,args});return {on(){}};}}:{};
  },device)}),{page}=r;
  await page.evaluate(device=>{
   const L=Lampa;L.DeviceInput.init();L.Controller.observe();Navigator.follow('focus',event=>L.Controller.focus(event.elem));L.Storage.set('player_torrent',device==='Windows'?'other':'android');L.Storage.set('player_nw_path','C:\\Player\\mpv.exe');L.Storage.set('internal_torrclient',true);
   L.Android.openPlayer=(url,data)=>qaLaunches.push({url,episode:data.episode});
   const movie={id:99,name:'MobLand',original_name:'MobLand',original_title:'MobLand',first_air_date:'2025-03-30',number_of_seasons:1,seasons:[{season_number:1,episode_count:2}],genres:[]};
   const row={Title:'MobLand S01 WEB-DL 1080p',Tracker:'test',Size:1e9,Seeders:50,MagnetUri:'magnet:?xt=urn:btih:'+'a'.repeat(40)};
   L.Parser.get=(p,ok)=>setTimeout(()=>ok({Results:[row]}),0);L.Activity.push({component:'torrents',movie,search:'MobLand',url:'',page:1});
   L.Torserver.url=()=>true;L.Torserver.ip=()=>'/ts';L.Torserver.connected=ok=>ok();L.Torserver.hash=(p,ok)=>ok({hash:'a'.repeat(40)});L.Torserver.files=(h,ok)=>ok({file_stats:[1,7].map((id,i)=>({id,path:'MobLand/MobLand.S01E0'+(i+1)+'.mkv',length:1e9}))});L.Torserver.viewed=(h,ok)=>ok([]);
   L.Torserver.stream=(file,hash,id)=>'/ts/stream/file.mkv?link='+hash+'&index='+id+'&preload';L.Torserver.toPlayUrl=url=>url.replace('&preload','&play');
   L.Api.seasons=(card,seasons,ok)=>ok({1:{episodes:[1,2].map(episode_number=>({season_number:1,episode_number,name:'Episode '+episode_number}))}});
   window.qaPreloads=[];const network=testNetwork;window.testNetwork=(url,ok,error)=>/\/ts\/stream/.test(url)?setTimeout(()=>{qaPreloads.push(url);ok({preloaded_bytes:qaPreloads.length===1?20:100,preload_size:100});},30):network(url,ok,error);
  },device);
  await page.addScriptTag({content:fs.readFileSync(require.resolve('../../plugins/mpvplus-ios.js'),'utf8')});
  await page.locator('.torrent-item.tc-item').first().click();await page.waitForSelector('.torrent-files .torrent-serial',{timeout:7000});await page.waitForTimeout(400);
  await page.evaluate(()=>{const row=document.querySelectorAll('.torrent-serial')[1];Lampa.Controller.collectionFocus(row,document.querySelector('.torrent-files'));Lampa.Controller.long();});await page.waitForTimeout(400);
  assert.ok(await page.locator('.selectbox-item').first().evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('.selectbox-item');}),'native file actions must appear above the file dialog');
  await page.evaluate(()=>{Lampa.Select.hide();Lampa.Controller.toggle('modal');});await page.waitForTimeout(400);
  if(device==='Windows')await page.locator('.torrent-serial').nth(1).click();
  else await page.evaluate(()=>{const row=document.querySelectorAll('.torrent-serial')[1];Lampa.Controller.collectionFocus(row,document.querySelector('.torrent-files'));Lampa.Controller.enter();});
  await page.waitForFunction(()=>qaPreloads.length===1,{},{timeout:3000});
  assert.equal(await page.locator('.media-loading--standalone:not(.hide)').count(),1,'native preload is visible before launching');
  await page.waitForFunction(()=>qaLaunches.length===1,{},{timeout:5000});
  const result=await page.evaluate(()=>({launches:qaLaunches,preloads:qaPreloads}));assert.equal(result.preloads.length,2);assert.match(result.preloads[0],/index=7&preload$/);assert.match(result.preloads[1],/index=7&stat$/);assert.deepEqual(r.errors,[]);
  const launch=result.launches[0];assert.match(device==='Windows'?launch.args.at(-1):launch.url,/index=7&play$/);
  console.log(engineName+' '+device+': visible file actions, native selection, preload and external transport passed');await r.context.close();
 }}finally{await browser.close();}}
})().catch(e=>{console.error(e);process.exitCode=1;});
