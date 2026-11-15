const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit].filter(e=>!process.env.LAMPA_QA_ENGINE||e.name()===process.env.LAMPA_QA_ENGINE)){const browser=await engine.launch({headless:true});try{for(const phone of ['android','iphone']){
 const r=await setup(browser,{mode:'auto',viewport:{width:393,height:852},hasTouch:true,isMobile:true,userAgent:phone==='android'?'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1'},{beforePlugin:p=>p.evaluate(()=>{Lampa.Params.init();Lampa.Menu.ready();Lampa.Search.init();Lampa.Layer.init();})}),{page}=r;
 try{
  for(const width of [320,393,852]){
   await page.setViewportSize({width,height:width===852?393:852});
   for(const theme of ['minimal','glass'])for(const pinned of [false,true]){
    const fonts=[];
    for(const size of ['small','normal','bigger']){
     await page.evaluate(({theme,pinned,size})=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.Storage.set('menu_always',pinned);Lampa.Storage.set('interface_size',size);}, {theme,pinned,size});
     await page.waitForTimeout(140);
     if(pinned){await page.mouse.move(1,1);await page.waitForFunction(()=>document.body.classList.contains('pt-menu-pinned')&&document.querySelector('.wrap__left').getBoundingClientRect().width<70,null,{timeout:3000});}
     await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForSelector('body.menu--open');
     const box=await page.locator('.wrap__left').evaluate(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect(),label=n.querySelector('[data-action=movie] .menu__text'),row=label.closest('.menu__item');return {width:r.width,left:r.left,right:r.right,bottom:r.bottom,font:parseFloat(getComputedStyle(label).fontSize),row:row.getBoundingClientRect().height,scale:parseFloat(s.getPropertyValue('--pt-interface-scale')),nav:document.querySelector('.navigation-bar').getBoundingClientRect().top};});
     assert.ok(box.width<=252*box.scale+1 && box.right<=width-48+1,JSON.stringify({engine:engine.name(),phone,width,theme,pinned,size,box}));assert.ok(box.font>=14&&Math.abs(box.font-16*box.scale)<.2,'Phone menu type stays readable and follows native size '+JSON.stringify(box));assert.ok(box.row>=43.9&&box.bottom<=box.nav+1,JSON.stringify({engine:engine.name(),phone,width,theme,pinned,size,box}));fonts.push(box.font);
     await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForFunction(()=>!document.body.classList.contains('menu--open'));
    }
    assert.ok(fonts[0]<fonts[1]&&fonts[1]<fonts[2]);
   }
  }
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+phone+': compact sidebar, readable type, portrait/landscape and all native sizes PASS');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
