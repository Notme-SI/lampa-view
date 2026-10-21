// Run with Playwright installed (or set PLAYWRIGHT_MODULE to its absolute path).
// PLAYWRIGHT_BROWSERS_PATH can point at an existing browser installation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const output=process.env.LAMPA_QA_OUTPUT;
if(output)fs.mkdirSync(output,{recursive:true});

async function verify(page,mobile){
 const data=await page.evaluate(()=>{
  const root=document.querySelector('.activity--active .minimal-torrent-view');
  const rect=n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};};
  const banner=root.querySelector('.minimal-torrent-banner'),head=root.querySelector('.explorer__files-head'),scroll=root.querySelector('.explorer__files-body>.scroll');
  const nav=document.querySelector('.navigation-bar');
  return {root:rect(root),banner:rect(banner),head:rect(head),scroll:rect(scroll),nav:nav&&rect(nav),first:rect(root.querySelector('.torrent-item')),sidebarScroll:getComputedStyle(root.querySelector('.explorer__left>.scroll')).display,width:innerWidth,height:innerHeight};
 });
 assert.equal(data.sidebarScroll,'none');
 assert.ok(data.scroll.height>90,'release list has usable scrolling space');
 assert.ok(data.scroll.right<=data.width+1,'list fits the viewport');
 assert.ok(data.head.top>=data.banner.bottom-1 || !mobile,'mobile controls follow the banner');
 assert.ok(data.head.bottom<=data.height,'controls are visible');
 assert.ok(data.first.top<data.scroll.bottom,'first release is on screen');
 if(mobile){
  assert.ok(data.head.top-data.banner.bottom<25,'no empty viewport below banner');
  assert.ok(data.scroll.bottom<=data.nav.top+1,'navigation does not cover the list: '+JSON.stringify(data)+'');
 }
 return data;
}

(async()=>{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{for(const mobile of [true,false]){
   const r=await setup(browser,mobile?{viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',mode:'mobile'}:{viewport:{width:1440,height:900},mode:'desktop'});
   const {page}=r;
   await page.evaluate(mobile=>{
    const L=Lampa;L.DeviceInput.init();L.Controller.observe();if(mobile){const screen=L.Platform.screen;L.Platform.screen=type=>type==='mobile' || type!=='tv'&&screen(type);document.body.classList.add('true--mobile','touch-device','orientation--portrait');L.NavigationBar.init();}
    window.qaStarts=[];L.Torrent.start=row=>window.qaStarts.push(row.Title);
    L.Parser.get=(p,ok)=>setTimeout(()=>ok({Results:Array.from({length:40},(_,i)=>({Title:'Film '+i+' (2026) WEB-DL 1080p',Tracker:'test',Size:1e9,Seeders:100-i,Peers:10,MagnetUri:'magnet:?xt=urn:btih:'+String(i).padStart(40,'0')}))}),0);
    L.Activity.push({component:'torrents',movie:{id:99,title:'Film',original_title:'Film',source:'tmdb',release_date:'2026-01-01',genres:[]},search:'Film',url:'',page:1});L.Layer.update();
   },mobile);
   await page.waitForTimeout(350);
   await verify(page,mobile);
   await page.locator('.activity--active .torrent-item').first()[mobile?'tap':'click']();
   await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>qaStarts.length),1,'release tap starts its selection');
   // Scroll far enough to trigger native onEnd pagination and reach later releases.
   for(let step=0;step<4;step++){
    await page.evaluate(mobile=>{const scroll=document.querySelector('.activity--active .explorer__files-body>.scroll');if(mobile){scroll.scrollTop=scroll.scrollHeight;scroll.dispatchEvent(new Event('scroll'));}else scroll.Scroll.wheel(10000);},mobile);await page.waitForTimeout(400);
   }
   const last=page.locator('.activity--active .torrent-item').last();
   assert.ok(await page.locator('.activity--active .torrent-item').count()>20,'scroll loads further releases: '+JSON.stringify(await page.evaluate(()=>{const s=document.querySelector('.activity--active .explorer__files-body>.scroll');return {rows:s.querySelectorAll('.torrent-item').length,scrollTop:s.scrollTop,scrollHeight:s.scrollHeight,offsetHeight:s.offsetHeight,params:s.Scroll.params(),viewport:s.Scroll.vieport(),end:s.Scroll.isEnd(),overflow:getComputedStyle(s).overflow};})));
   await last[mobile?'tap':'click']();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>qaStarts.length),2,'later releases remain clickable');
   if(output)await page.screenshot({path:path.join(output,name+(mobile?'-phone':'-desktop')+'.png')});
   if(mobile){
    await page.setViewportSize({width:740,height:393});
    await page.evaluate(()=>{document.body.classList.remove('orientation--portrait');document.body.classList.add('orientation--landscape');Lampa.Layer.update();});await page.waitForTimeout(150);
    // The left-hand navigation in landscape reduces width, rather than height.
    const landscape=await page.evaluate(()=>{const s=document.querySelector('.activity--active .explorer__files-body>.scroll').getBoundingClientRect();return {bottom:s.bottom,height:innerHeight,size:s.height};});
    assert.ok(landscape.size>70 && landscape.bottom<=landscape.height+1,'landscape list fits');
    await page.setViewportSize({width:393,height:852});await page.evaluate(()=>{document.body.classList.remove('orientation--landscape');document.body.classList.add('orientation--portrait');Lampa.Layer.update();});await page.waitForTimeout(150);
    // Return to the top before checking the first release again.
    await page.evaluate(()=>{document.querySelector('.activity--active .explorer__files-body>.scroll').scrollTop=0;});
    await verify(page,true);
   }
   assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+' '+(mobile?'phone':'desktop')+': layout, selection and pagination passed');
  }}finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
