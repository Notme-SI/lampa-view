const assert=require('node:assert/strict'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
const fixture=path.join(__dirname,'../fixtures/lampa-runtime/current-menu');
const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1';
const phones=[{name:'iphone-standalone',ua:ios,standalone:true},{name:'iphone-browser',ua:ios},{name:'android',ua:'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'}];
(async()=>{for(const engine of [chromium,webkit].filter(e=>!process.env.QA_ENGINE || e.name()===process.env.QA_ENGINE)){
 const browser=await engine.launch({headless:true});try{for(const phone of phones.filter(p=>(engine!==webkit||p.name!=='android')&&(!process.env.QA_PHONE||p.name===process.env.QA_PHONE))){
  const r=await setup(browser,{mode:'auto',viewport:{width:393,height:852},hasTouch:true,isMobile:true,deviceScaleFactor:3,userAgent:phone.ua},{app:path.join(fixture,'app.js.gz'),css:path.join(fixture,'app.css.gz'),plugin:process.env.LAMPA_QA_PLUGIN,beforePlugin:p=>p.evaluate(standalone=>{
   Object.defineProperty(navigator,'standalone',{value:!!standalone});const L=Lampa;L.Platform.init();L.Params.init();L.Menu.ready();L.Search.init();L.Layer.init();L.NavigationBar.init();
   window.qaOriginalMenu=document.querySelector('.menu');window.qaLastSelected=0;window.qaTrace=[];
   L.Controller.listener.follow('toggle',e=>qaTrace.push(e.name));
   L.Menu.addButton('<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>','Последний пункт проверки',()=>qaLastSelected++).attr('data-qa','last-menu-item');
  },phone.standalone)}),p=r.page;p.setDefaultTimeout(4500);
  try{
   await p.evaluate(()=>{const L=Lampa;L.DeviceInput.init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));});
   // DeviceInput accepts iPhone actions after its first real touch event.
   await p.touchscreen.tap(1,1);
   const dock=action=>p.locator('.navigation-bar [data-action='+action+']');
   // Windows WebKit mobile emulation drifts physical pointer coordinates.
   // Verify its DOM click routing separately from current-mobile-menu geometry.
   // Chromium exercises real touch dispatch and browser hit testing.
   const activate=node=>engine===chromium?node.click():node.dispatchEvent('click');
   const press=action=>engine===chromium?dock(action).tap():activate(dock(action));
   const state=()=>p.evaluate(()=>({menu:Lampa.Menu.opened(),settings:document.body.classList.contains('settings--open'),select:document.body.classList.contains('selectbox--open'),modals:document.querySelectorAll('.modal').length,controller:Lampa.Controller.enabled().name,owned:document.querySelector('.wrap__left .menu')===qaOriginalMenu,pointer:!!qaOriginalMenu._lampaViewPointer,profile:!!document.querySelector('[data-action=minimal_profile]')}));
   const clean=async()=>{await p.waitForFunction(()=>!Lampa.Menu.opened()&&!document.body.matches('.settings--open,.selectbox--open')&&!document.querySelector('.modal')).catch(async e=>{throw new Error(e.message+' '+JSON.stringify({state:await state(),trace:await p.evaluate(()=>qaTrace.slice(-45))}));});const s=await state();assert.ok(s.owned,JSON.stringify(s));};
   for(const [theme,size]of [['minimal','small'],['glass','normal'],['glass','bigger']]){
    await p.evaluate(({theme,size,standalone})=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.Storage.set('interface_size',size);document.body.style.setProperty('--pt-safe-top',standalone?'60px':'0px');},{theme,size,standalone:phone.standalone});await p.waitForTimeout(160);
    for(let cycle=0;cycle<Number(process.env.QA_CYCLES||2);cycle++){
     await press('settings');await p.waitForFunction(()=>document.body.classList.contains('settings--open'));
     const settings=await p.locator('.settings__content').evaluate(n=>{const b=n.getBoundingClientRect();return {top:b.top,height:b.height,width:b.width};});
     await press('menu');await p.waitForSelector('.menu-modal');
     let s=await state();assert.deepEqual([s.menu,s.settings,s.select,s.modals,s.controller],[true,false,false,1,'modal'],JSON.stringify(s));assert.equal(await p.locator('.settings__content').isVisible(),false);
     const menu=await p.locator('.modal:has(.menu-modal) .modal__content').evaluate(n=>{const b=n.getBoundingClientRect();return {top:b.top,height:b.height,width:b.width};});
     for(const key of ['top','height','width'])assert.ok(Math.abs(menu[key]-settings[key])<1,JSON.stringify({theme,size,menu,settings}));
     await press('settings');await p.waitForFunction(()=>document.body.classList.contains('settings--open')&&!document.querySelector('.menu-modal'));
     s=await state();assert.deepEqual([s.menu,s.settings,s.modals,s.controller,s.owned],[false,true,0,'settings',true],JSON.stringify(s));
     await press('settings');await clean();
     await press('menu');await p.waitForSelector('.menu-modal');await press('menu');await clean();
    }
    await press('settings');await p.waitForFunction(()=>document.body.classList.contains('settings--open'));
    await p.evaluate(()=>{Lampa.Settings.create('interface');Lampa.Select.show({title:'Настройка',items:[{title:'Проверка'}]});});
    await press('menu');await p.waitForSelector('.menu-modal');const s=await state();assert.deepEqual([s.settings,s.select,s.modals,s.controller],[false,false,1,'modal'],JSON.stringify(s));
    const range=await p.locator('.modal:has(.menu-modal) .modal__body>.scroll').evaluate(n=>{n.scrollTop=n.scrollHeight;return {height:n.clientHeight,body:n.scrollHeight,position:n.scrollTop,overflow:getComputedStyle(n).overflowY};});
    assert.ok(range.body>range.height&&range.position>0&&range.overflow==='auto',JSON.stringify(range));
    const last=p.locator('.menu-modal [data-qa=last-menu-item]');await last.scrollIntoViewIfNeeded();await p.waitForTimeout(350);
    const visible=await last.evaluate(n=>{const b=n.getBoundingClientRect(),v=n.closest('.scroll').getBoundingClientRect(),nav=document.querySelector('.navigation-bar').getBoundingClientRect();return b.top>=v.top-1&&b.bottom<=v.bottom+1&&b.bottom<=nav.top+1;});assert.ok(visible,'Last menu item is fully visible above navigation');
    const count=await p.evaluate(()=>qaLastSelected);await activate(last);await clean();await p.waitForTimeout(180);assert.equal(await p.evaluate(()=>qaLastSelected),count+1,'Original native extension action runs once');
    await press('menu');await p.waitForSelector('.menu-modal');await activate(dock('back'));await clean();await p.waitForTimeout(100);
   }
   await press('settings');await p.waitForFunction(()=>document.body.classList.contains('settings--open'));await press('main');await clean();assert.equal(await p.evaluate(()=>Lampa.Activity.active().component),'main');
   assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+phone.name+(engine===webkit?' DOM event routing':' touch/pointer')+': native dock switches, equal-height panels, nested settings cleanup, repeated toggles, native scrolling and last action PASS');
  }catch(e){console.error('TRACE '+JSON.stringify(await p.evaluate(()=>qaTrace.slice(-60))));throw e;}finally{await r.context.close();}
 }}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
