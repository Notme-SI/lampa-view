const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');

(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   const r=await setup(browser,{viewport:{width:1280,height:720},mode:'tv'}),{page}=r;
   await page.waitForTimeout(180);
   await page.evaluate(()=>{
    const L=Lampa;L.DeviceInput.init();L.Controller.observe();L.Storage.set('keyboard_type','system');document.body.style.fontSize='24px';
    L.Parser.get=(p,ok)=>setTimeout(()=>ok({Results:[{Title:'Киберпанк / Cyberpunk: Edgerunners (1 сезон, 1-10 из 10) 1080p',Tracker:'kinozal',Seeders:10,Size:1e9}]}),0);
    const movie={id:105248,name:'Киберпанк: Бегущие по краю',title:'Cyberpunk: Edgerunners',original_name:'サイバーパンク エッジランナーズ',original_title:'Cyberpunk: Edgerunners',backdrop_path:'/backdrop.jpg',first_air_date:'2022-09-13',number_of_seasons:1,genres:[],source:'tmdb'};
    L.Activity.push({component:'torrents',movie,search:'Cyberpunk: Edgerunners',search_one:'Cyberpunk: Edgerunners',search_two:'Cyberpunk: Edgerunners',url:''});
   });
   await page.waitForSelector('.minimal-toolbar-label');
   const layout=await page.evaluate(()=>{
    const root=document.querySelector('.activity--active .minimal-torrent-view'),banner=root.querySelector('.minimal-torrent-banner'),files=root.querySelector('.explorer__files');
    const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
    const buttons=[...root.querySelectorAll('.minimal-torrent-toolbar .simple-button')].filter(el=>getComputedStyle(el).display!=='none');
    const history=root.querySelector('.watched-history');history.classList.add('focus');
    return {banner:rect(banner),files:rect(files),buttons:buttons.map(rect),labels:buttons.map(el=>el.innerText),historyFocus:getComputedStyle(history,'::after').display};
   });
   assert.ok(layout.banner.right<=layout.files.left+1,'The banner must not intrude into search or release rows: '+JSON.stringify(layout));
   assert.deepEqual(layout.labels,['Поиск','Сортировка','Фильтры']);
   assert.ok(Math.max(...layout.buttons.map(b=>b.height))-Math.min(...layout.buttons.map(b=>b.height))<1);
   for(const button of layout.buttons)assert.ok(button.left>=layout.files.left-1 && button.right<=1280);
   assert.equal(layout.historyFocus,'none','The history focus border must not extend beyond the row');
   if(process.env.LAMPA_QA_OUTPUT){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,name+'-tv-toolbar.png')});}
   await page.evaluate(()=>jQuery('.activity--active .filter--search').trigger('hover:enter'));
   const titles=await page.locator('.selectbox-item__title').allTextContents();
   assert.ok(titles.includes('Киберпанк: Бегущие по краю'));assert.ok(titles.includes('サイバーパンク エッジランナーズ'));
   assert.equal(titles.filter(title=>title==='Cyberpunk: Edgerunners').length,1);
   await page.evaluate(()=>jQuery('.selectbox-item').first().trigger('hover:enter'));
   await page.waitForSelector('.search-box');
   const overlay=await page.locator('.search-box').evaluate(el=>{const css=getComputedStyle(el),r=el.getBoundingClientRect();return {color:css.backgroundColor,zIndex:Number(css.zIndex),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,bodyZoom:getComputedStyle(document.body).zoom,rootZoom:getComputedStyle(document.documentElement).zoom,cssWidth:css.width,viewport:visualViewport.width};});
   if(process.env.LAMPA_QA_OUTPUT)await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,name+'-tv-search.png')});
   assert.equal(overlay.color,'rgb(8, 11, 16)');assert.ok(overlay.zIndex>70);assert.ok(Math.abs(overlay.left)<1 && overlay.right>=overlay.width-1 && Math.abs(overlay.top)<1 && overlay.bottom>=overlay.height-1,JSON.stringify(overlay));
   await page.evaluate(()=>Lampa.Controller.back());assert.equal(await page.locator('.search-box').count(),0);
   assert.deepEqual(r.errors,[]);await r.context.close();
   console.log(name+': TV banner containment, compact toolbar, multilingual search and opaque input overlay passed');
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
