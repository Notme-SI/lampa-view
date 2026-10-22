const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const output=process.env.LAMPA_QA_OUTPUT;
if(output)fs.mkdirSync(output,{recursive:true});
async function check(page,mobile){
 const data=await page.evaluate(()=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const modal=document.querySelector('.modal'),row=modal.querySelector('.torrent-serial');
  return {modal:rect(modal.querySelector('.modal__content')),row:rect(row),image:rect(row.querySelector('img')),title:rect(row.querySelector('.torrent-serial__title')),detail:rect(row.querySelector('.torrent-serial__detail')),timeline:rect(row.querySelector('.time-line')),content:rect(row.querySelector('.torrent-serial__content')),width:innerWidth,height:innerHeight};
 });
 assert.ok(data.modal.left>=-1 && data.modal.right<=data.width+1,'file dialog fits horizontally');
 assert.ok(data.modal.top>=-1 && data.modal.bottom<=data.height+1,'file dialog fits vertically');
 const separate=(a,b)=>a.right<=b.left+1 || b.right<=a.left+1 || a.bottom<=b.top+1 || b.bottom<=a.top+1;
 assert.ok(separate(data.title,data.detail),'title and file details do not overlap');
 assert.ok(separate(data.image,data.timeline),'watch progress stays off the thumbnail');
 assert.ok(data.timeline.left>=data.content.left && data.timeline.right<=data.content.right+1,'progress stays inside content');
 if(mobile){assert.ok(data.title.height<=44,'long title takes at most two lines');assert.ok(data.row.height<175,'mobile file row stays compact');}
 return data;
}
(async()=>{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]].filter(v=>!process.env.QA_ENGINE||v[0]===process.env.QA_ENGINE)){
  const browser=await engine.launch({headless:true});
  try{for(const [mobile,virtual] of (process.env.QA_MOBILE?[[true,Boolean(process.env.QA_VIRTUAL)]]:[[true,false],[true,true],[false,false]])){
   const r=await setup(browser,mobile?{viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',mode:'mobile'}:{viewport:{width:1440,height:900},mode:'desktop'}),{page}=r;
   await page.evaluate(({mobile,virtual})=>{
    const L=Lampa;L.DeviceInput.init();L.Controller.observe();
    if(mobile){const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?virtual:type==='mobile' || screen(type);document.body.classList.add('true--mobile','touch-device','orientation--portrait');L.NavigationBar.init();}
    const movie={id:99,name:'Гангстерленд',original_name:'MobLand',original_title:'MobLand',source:'tmdb',first_air_date:'2025-03-30',number_of_seasons:1,seasons:[{season_number:1,episode_count:12}],genres:[]};
    const row={Title:'Гангстерленд / MobLand (2025) S01 WEB-DL 1080p TVShows',Tracker:'test',Size:4520453079,Seeders:50,Peers:10,MagnetUri:'magnet:?xt=urn:btih:0123456789012345678901234567890123456789'};
    L.Parser.get=(p,ok)=>setTimeout(()=>ok({Results:[row]}),0);L.Activity.push({component:'torrents',movie,search:'MobLand',url:'',page:1});
    L.Torserver.url=()=>true;L.Torserver.connected=ok=>ok();L.Torserver.hash=(p,ok)=>ok({hash:'0123456789012345678901234567890123456789'});
    L.Torserver.files=(hash,ok)=>ok({file_stats:Array.from({length:12},(_,i)=>({id:i+1,path:'MobLand.2025.S01.WEB-DL.1080p.TVShows/MobLand.S01E'+String(i+1).padStart(2,'0')+'.mkv',length:4520453079}))});
    L.Torserver.viewed=(hash,ok)=>ok([]);L.Torserver.stream=(file,hash,id)=>'http://localhost/stream?link='+hash+'&index='+id+'&play';
    const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#28454d"/></svg>');
    L.Api.seasons=(card,seasons,ok)=>ok({1:{episodes:Array.from({length:12},(_,i)=>({season_number:1,episode_number:i+1,name:i===0?'Пан или пропал: длинное название серии для проверки мобильного экрана':'Серия '+(i+1),air_date:'2025-03-30',runtime:60,img:image}))}});
    window.qaPlayed=[];window.qaPlaylist=[];L.Player.play=data=>qaPlayed.push({season:data.season,episode:data.episode,url:data.url});L.Player.playlist=data=>window.qaPlaylist=data;L.Player.callback=()=>{};
    window.qaStartFiles=()=>L.Torrent.start(row,movie);
   },{mobile,virtual});
   await page.waitForSelector('.torrent-item.tc-item');await page.evaluate(()=>qaStartFiles());
   await page.waitForSelector('.torrent-files .torrent-serial',{timeout:7000});await page.waitForTimeout(150);
   await page.evaluate(()=>document.querySelectorAll('.torrent-serial').forEach(row=>jQuery(row).trigger('visible')));
   await check(page,mobile);
   if(output)await page.screenshot({path:path.join(output,name+(mobile?'-phone'+(virtual?'-virtual':''):'-desktop')+'-files.png')});
   if(mobile){
    await page.setViewportSize({width:320,height:640});await page.waitForTimeout(150);await check(page,true);
    await page.setViewportSize({width:740,height:393});await page.waitForTimeout(150);await check(page,true);
    await page.setViewportSize({width:393,height:852});await page.waitForTimeout(400);
   }
   const last=page.locator('.torrent-files .torrent-serial').last();
   if(mobile && name==='chromium'){
    const client=await r.context.newCDPSession(page);
    const area=await page.locator('.modal__body .scroll').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.bottom-35,top:r.top+35,height:el.clientHeight,total:el.scrollHeight};});
    assert.ok(area.y<await page.evaluate(()=>innerHeight),'swipe starts inside the visible list');
    for(let gesture=0;gesture<7;gesture++){
     await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:area.x,y:area.y}]});
     for(let step=1;step<=10;step++){
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:area.x,y:area.y-(area.y-area.top)*step/10}]});
      await page.waitForTimeout(20);
     }
     await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);
    }
    assert.ok(await last.evaluate(el=>{const r=el.getBoundingClientRect(),s=el.closest('.scroll').getBoundingClientRect();return r.top<s.bottom && r.bottom>s.top;}),'swiping reaches the last episode');
    await client.detach();await page.waitForTimeout(700);
   }
   if(mobile && !virtual)await last.scrollIntoViewIfNeeded();else if(name!=='chromium' || !mobile)await last.evaluate(row=>{const scroll=Lampa.Modal.scroll();scroll.immediate(row);Lampa.Layer.visible(scroll.render(true));});
   const point=await last.evaluate(row=>{const r=row.getBoundingClientRect(),s=row.closest('.scroll').getBoundingClientRect();return {x:r.left+r.width/2,y:(Math.max(r.top,s.top)+Math.min(r.bottom,s.bottom))/2};});
   // Windows WebKit reports a fractional native DPR and its touch protocol uses device pixels.
   const scale=mobile && name==='webkit' && process.platform==='win32'?await page.evaluate(()=>devicePixelRatio):1;
   if(mobile && name==='webkit')await page.touchscreen.tap(point.x*scale,point.y*scale);else {await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);}await page.waitForTimeout(500);
   const played=await page.evaluate(()=>({played:qaPlayed,playlist:qaPlaylist.map(v=>v.episode)}));assert.equal(played.played.length,1);assert.equal(played.played[0].episode,12);assert.equal(played.played[0].season,1);assert.match(played.played[0].url,/index=12/);assert.equal(played.playlist.length,12);
   assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+' '+(mobile?'phone'+(virtual?' with virtual scroll':''):'desktop')+': native file layout, scrolling, playback and playlist passed');
  }}finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
