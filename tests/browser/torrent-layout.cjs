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
  const labelSizes=['dubbing','subtitles'].map(kind=>getComputedStyle(root.querySelector('.tc-tag-group--'+kind+' .tc-group-label')).fontSize);
  const tagSizes=['dubbing','subtitles'].map(kind=>getComputedStyle(root.querySelector('.tc-tag-group--'+kind+' .tc-tag')).fontSize);
  return {root:rect(root),banner:rect(banner),head:rect(head),scroll:rect(scroll),nav:nav&&rect(nav),first:rect(root.querySelector('.torrent-item')),labelSizes,tagSizes,sidebarScroll:getComputedStyle(root.querySelector('.explorer__left>.scroll')).display,back:getComputedStyle(root.querySelector('.filter--back')).display,buttons:[...root.querySelectorAll('.filter--search,.filter--sort,.filter--filter')].map(rect),width:innerWidth,height:innerHeight};
 });
 assert.equal(data.sidebarScroll,'none');
 assert.equal(data.back,'none','redundant card return button is hidden');
 assert.equal(data.labelSizes[0],data.labelSizes[1],'dubbing and subtitle labels use the same scale');assert.equal(data.tagSizes[0],data.tagSizes[1],'language tags use the same scale');
 assert.ok(data.scroll.height>90,'release list has usable scrolling space');
 assert.ok(data.scroll.right<=data.width+1,'list fits the viewport');
 assert.ok(data.head.top>=data.banner.bottom-1 || !mobile,'mobile controls follow the banner');
 assert.ok(data.head.bottom<=data.height,'controls are visible');
 assert.ok(data.first.top<data.scroll.bottom,'first release is on screen');
 if(mobile){
  const leftGap=data.first.left-data.root.left,rightGap=data.root.right-data.first.right;
  assert.ok(Math.abs(leftGap-rightGap)<=1,'release list has equal horizontal gutters: '+JSON.stringify({leftGap,rightGap}));
  assert.ok(Math.abs(data.first.left-data.banner.left)<=1 && Math.abs(data.first.right-data.banner.right)<=1,'release cards align with the banner');
  assert.ok(Math.abs(data.buttons[0].left-data.banner.left)<=1 && Math.abs(data.buttons[2].right-data.banner.right)<=1,'toolbar aligns with the banner and release cards');
  assert.equal(data.buttons.length,3);
  assert.ok(data.banner.width>=data.width-12,'banner stays full width when its height is capped');
  for(const button of data.buttons){assert.ok(button.left>=-1 && button.right<=data.width+1,'every toolbar button fits');assert.ok(button.height>=43,'buttons remain large enough to tap');}
  assert.ok(Math.max(...data.buttons.map(b=>b.top))-Math.min(...data.buttons.map(b=>b.top))<2,'toolbar uses one row');
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
    L.Parser.get=(p,ok)=>setTimeout(()=>ok({Results:Array.from({length:40},(_,i)=>({Title:'Гангстерленд / MobLand (2025) WEB-DL [H.264/1080p] (сезон 1, серия '+(i+1)+' из 40) TVShows AC-3 E-AC-3 5.1 RUS/ENG',ffprobe:[{codec_type:'subtitle',tags:{language:'rus'}}],Tracker:'rutor',PublishDate:'2025-04-01',Size:4520453079,Seeders:435-i,Peers:109,MagnetUri:'magnet:?xt=urn:btih:'+String(i).padStart(40,'0')}))}),0);
    L.Activity.push({component:'torrents',movie:{id:99,title:'Гангстерленд',name:'Гангстерленд',original_name:'MobLand',number_of_seasons:1,seasons:[{season_number:1,episode_count:40}],source:'tmdb',first_air_date:'2025-01-01',genres:[]},search:'MobLand',url:'',page:1});L.Layer.update();
   },mobile);
   await page.waitForTimeout(350);
   await verify(page,mobile);
   const ring=await page.locator('.activity--active .torrent-item').first().evaluate(item=>{item.classList.add('focus');const s=getComputedStyle(item);return {shadow:s.boxShadow,outline:s.outlineStyle,after:getComputedStyle(item,'::after').display};});
   assert.ok(ring.shadow.includes('inset'),'Torrent focus stays inside the release: '+JSON.stringify(ring));assert.equal(ring.outline,'none');assert.equal(ring.after,'none');
   const marks=[];
   for(const moved of [false,true]){
    marks.push(await page.evaluate(moved=>{
     const item=document.querySelector('.activity--active .torrent-item');
     let mark=item.querySelector('.torrent-item__viewed');if(!mark){mark=document.createElement('div');mark.className='torrent-item__viewed';mark.innerHTML=Lampa.Template.get('icon_viewed',{},true);item.appendChild(mark);}
     if(moved)item.querySelector('.tc-head').appendChild(mark);
     const r=mark.getBoundingClientRect(),box=item.getBoundingClientRect(),size=item.querySelector('.tc-size').getBoundingClientRect();
     return {left:r.left-box.left,right:box.right-r.right,top:r.top-box.top,bottom:r.bottom-box.top,sizeGap:r.left-size.right};
    },moved));
   }
   for(const mark of marks){assert.ok(mark.left>0 && mark.right>0 && mark.top>0,'Viewed mark must remain inside the release');assert.ok(mark.sizeGap>=0,'Viewed mark must not overlap the file size');}
   assert.deepEqual(marks[0],marks[1],'Moving the native mark during an update cannot change its position');
   if(output)await page.screenshot({path:path.join(output,name+(mobile?'-phone':'-desktop')+'-top.png')});
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
    await page.setViewportSize({width:320,height:640});await page.evaluate(()=>{Lampa.Layer.update();document.querySelector('.activity--active .explorer__files-body>.scroll').scrollTop=0;});await page.waitForTimeout(150);await verify(page,true);
    await page.setViewportSize({width:740,height:393});
    await page.evaluate(()=>{document.body.classList.remove('orientation--portrait');document.body.classList.add('orientation--landscape');Lampa.Layer.update();});await page.waitForTimeout(150);
    // The left-hand navigation in landscape reduces width, rather than height.
    const landscape=await page.evaluate(()=>{const root=document.querySelector('.activity--active .minimal-torrent-view'),r=root.getBoundingClientRect(),s=root.querySelector('.explorer__files-body>.scroll').getBoundingClientRect(),item=root.querySelector('.torrent-item').getBoundingClientRect();return {bottom:s.bottom,height:innerHeight,size:s.height,leftGap:item.left-r.left,rightGap:r.right-item.right};});
    assert.ok(landscape.size>70 && landscape.bottom<=landscape.height+1,'landscape list fits');
    assert.ok(Math.abs(landscape.leftGap-landscape.rightGap)<=1,'landscape release cards remain centered inside the available area');
    await page.setViewportSize({width:393,height:852});await page.evaluate(()=>{document.body.classList.remove('orientation--landscape');document.body.classList.add('orientation--portrait');Lampa.Layer.update();});await page.waitForTimeout(150);
    // Return to the top before checking the first release again.
    await page.evaluate(()=>{document.querySelector('.activity--active .explorer__files-body>.scroll').scrollTop=0;});
    await verify(page,true);
   }
   assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+' '+(mobile?'phone':'desktop')+': layout, selection and pagination passed');
  }}finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
