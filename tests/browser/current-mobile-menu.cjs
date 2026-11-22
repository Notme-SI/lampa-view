const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
const fixture=path.join(__dirname,'../fixtures/lampa-runtime/current-menu');
const phones=[{name:'iphone-standalone',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1',standalone:true},{name:'iphone-browser',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1'},{name:'android',ua:'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'}];
(async()=>{for(const engine of [chromium,webkit].filter(e=>!process.env.QA_ENGINE||e.name()===process.env.QA_ENGINE)){
 const browser=await engine.launch({headless:true});try{for(const phone of phones.filter(p=>(!process.env.QA_PHONE||p.name===process.env.QA_PHONE) && (engine!==webkit || p.name!=='android'))){
  const r=await setup(browser,{mode:'auto',viewport:{width:393,height:852},hasTouch:true,isMobile:true,deviceScaleFactor:3,userAgent:phone.ua},{app:path.join(fixture,'app.js.gz'),css:path.join(fixture,'app.css.gz'),plugin:process.env.LAMPA_QA_PLUGIN,beforePlugin:p=>p.evaluate(standalone=>{
   Object.defineProperty(navigator,'standalone',{value:!!standalone});Lampa.Platform.init();Lampa.Params.init();Lampa.Menu.ready();Lampa.Search.init();Lampa.Layer.init();
   window.qaOriginalMenu=document.querySelector('.menu');
  },phone.standalone)}),{page}=r;
  try{
   const bounds=selector=>page.locator(selector).first().evaluate(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,radius:s.borderRadius,font:s.fontSize};});
   for(const width of process.env.QA_WIDTH?[Number(process.env.QA_WIDTH)]:[320,393,430]){
    await page.setViewportSize({width,height:852});await page.waitForTimeout(220);
    for(const theme of ['minimal','glass'])for(const size of ['small','normal','bigger']){
     await page.evaluate(({theme,size,safe})=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.Storage.set('interface_size',size);document.body.style.setProperty('--pt-safe-top',safe?'60px':'0px');},{theme,size,safe:phone.standalone});
     // Native layout/Activity refresh completes after the interface-size change.
     // Finish it before opening an overlay for the geometry measurement.
     await page.waitForTimeout(1600);
     await page.locator('.navigation-bar [data-action=settings]').click();await page.waitForSelector('body.settings--open');
     const settings=await bounds('.settings__content'),settingsText=await bounds('.settings__content .settings-folder__name'),settingsTitle=await bounds('.settings__title');
     if(process.env.LAMPA_QA_OUTPUT && width===393 && theme==='glass' && size==='normal' && phone.standalone){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-settings.png')});}
     await page.evaluate(()=>Lampa.Controller.toggle('content',true));await page.waitForFunction(()=>!document.body.classList.contains('settings--open'));
     await page.locator('.navigation-bar [data-action=menu]').click();await page.locator('.menu-modal').waitFor();
     const menu=await bounds('.modal:has(.menu-modal) .modal__content'),text=await bounds('.menu-modal [data-action=movie] .menu__text'),title=await bounds('.modal:has(.menu-modal) .modal__title');
     const canvas=await page.evaluate(()=>({right:document.body.getBoundingClientRect().right,nav:document.querySelector('.navigation-bar').getBoundingClientRect().top,controller:Lampa.Controller.enabled().name}));
     assert.ok(Math.abs(menu.width-settings.width)<1 && Math.abs(menu.left-(canvas.right-settings.right))<1 && Math.abs(menu.top-settings.top)<1,'Current native Modal mirrors Settings '+JSON.stringify({engine:engine.name(),phone:phone.name,width,theme,size,menu,settings,canvas}));
     assert.ok(Math.abs(menu.height-settings.height)<1,'Menu and Settings share the full available height '+JSON.stringify({menu,settings}));
     assert.ok(Math.abs(parseFloat(text.font)-parseFloat(settingsText.font))<.1);assert.ok(Math.abs(parseFloat(title.font)-parseFloat(settingsTitle.font))<.1);assert.equal(menu.radius,settings.radius);assert.ok(parseFloat(text.font)>=14 && menu.bottom<=canvas.nav+1);assert.equal(canvas.controller,'modal');
     if(process.env.LAMPA_QA_OUTPUT && width===393 && theme==='glass' && size==='normal' && phone.standalone)await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-menu.png')});
     // Interactive Back and dock transitions are covered in mobile-panel-switch.
     await page.evaluate(()=>Lampa.Menu.close());await page.waitForFunction(()=>!Lampa.Menu.opened());

     assert.ok(await page.evaluate(()=>document.querySelector('.wrap__left .menu')===qaOriginalMenu),'Closing returns the original live menu and handlers to its native owner');
    }
   }
   assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+phone.name+': real current-host menu, mirrored geometry/type, heading, safe area, native Menu.close and DOM ownership PASS');
  }finally{await r.context.close();}
 }}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
