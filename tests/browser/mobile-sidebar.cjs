const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit].filter(e=>!process.env.LAMPA_QA_ENGINE||e.name()===process.env.LAMPA_QA_ENGINE)){const browser=await engine.launch({headless:true});try{for(const phone of ['android','iphone','android-desktop-ua']){
 const r=await setup(browser,{mode:'auto',viewport:{width:393,height:852},hasTouch:true,isMobile:true,userAgent:phone.startsWith('android')?(phone==='android-desktop-ua'?'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36':'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'):'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1'},{beforePlugin:p=>p.evaluate(()=>{Lampa.Params.init();Lampa.Menu.ready();Lampa.Search.init();Lampa.Layer.init();})}),{page}=r;
 try{
  for(const width of [320,393,852]){
   await page.setViewportSize({width,height:width===852?393:852});
   for(const theme of ['minimal','glass'])for(const pinned of [false,true]){
    const fonts=[];
    for(const size of ['small','normal','bigger']){
     await page.evaluate(({theme,pinned,size})=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.Storage.set('menu_always',pinned);Lampa.Storage.set('interface_size',size);}, {theme,pinned,size});
     await page.waitForTimeout(140);
     if(pinned){await page.mouse.move(1,1);await page.waitForFunction(()=>document.body.classList.contains('pt-menu-pinned')&&document.querySelector('.wrap__left').getBoundingClientRect().width<70,null,{timeout:3000});}
     await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForSelector('body.menu--open');await page.waitForFunction(()=>{const n=document.querySelector('.wrap__left');return Number(getComputedStyle(n).opacity)>.98 && Math.abs(n.getBoundingClientRect().width-document.querySelector('.settings__content').getBoundingClientRect().width)<1;});
     const capture=process.env.LAMPA_QA_OUTPUT && phone==='android' && width===393 && theme==='minimal' && !pinned && size==='normal';if(capture){require('node:fs').mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-phone-menu.png')});}
     const box=await page.locator('.wrap__left').evaluate(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect(),label=n.querySelector('[data-action=movie] .menu__text'),row=label.closest('.menu__item');return {width:r.width,left:r.left,right:r.right,top:r.top,bottom:r.bottom,font:parseFloat(getComputedStyle(label).fontSize),row:row.getBoundingClientRect().height,scale:parseFloat(s.getPropertyValue('--pt-interface-scale')),nav:document.querySelector('.navigation-bar').getBoundingClientRect().top};});
     assert.ok(box.right<=width-box.left+1,JSON.stringify({engine:engine.name(),phone,width,theme,pinned,size,box}));assert.ok(box.font>=14&&Math.abs(box.font-16*box.scale)<.2,'Phone menu type stays readable and follows native size '+JSON.stringify(box));assert.ok(box.row>=43.9&&box.bottom<=box.nav+1,JSON.stringify({engine:engine.name(),phone,width,theme,pinned,size,box}));fonts.push(box.font);
     await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForFunction(()=>!document.body.classList.contains('menu--open'));
     await page.locator('.navigation-bar [data-action=settings]').click();await page.waitForSelector('body.settings--open');
     if(capture)await page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-phone-settings.png')});
     const settings=await page.locator('.settings__content').evaluate(n=>{const r=n.getBoundingClientRect();return {viewport:innerWidth,body:document.body.getBoundingClientRect().toJSON(),root:document.querySelector('.settings').getBoundingClientRect().toJSON(),transform:getComputedStyle(document.body).transform,zoom:getComputedStyle(document.body).zoom,width:r.width,right:r.right,top:r.top,font:parseFloat(getComputedStyle(n.querySelector('.settings-folder__name')).fontSize)};});
     assert.ok(Math.abs(box.width-settings.width)<1 && Math.abs(box.left-(settings.body.right-settings.right))<1 && Math.abs(box.font-settings.font)<.2 && Math.abs(box.top-settings.top)<1,'Sidebar mirrors Settings geometry and readable type '+JSON.stringify({engine:engine.name(),phone,width,theme,pinned,size,box,settings}));
     await page.evaluate(()=>Lampa.Controller.back());
    }
    assert.ok(fonts[0]<fonts[1]&&fonts[1]<fonts[2]);
   }
  }
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+phone+': mirrored sidebar/settings, readable type, portrait/landscape and all native sizes PASS');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
