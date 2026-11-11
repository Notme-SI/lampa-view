const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{for(const theme of ['minimal','glass']){
 const r=await setup(browser,{viewport:{width:393,height:852},mode:'mobile',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1'},{plugin:process.env.LAMPA_QA_PLUGIN,beforePlugin:page=>page.evaluate(()=>{
  Object.defineProperty(navigator,'standalone',{value:true});
  Lampa.Params.init();Lampa.Menu.ready();Lampa.Search.init();Lampa.Layer.init();Lampa.Storage.set('animation',false);
  document.querySelector('.wrap').classList.add('layer--height','layer--width');
  document.querySelector('.wrap__content').classList.add('layer--height');
  const movies=['Red','Green'].map((title,i)=>({id:i+1,title:i?'Зелёный фильм':'Красный фильм',original_title:title,overview:'Описание фильма',poster_path:'/p.jpg',backdrop_path:'/'+title+'.jpg',source:'tmdb'}));
  Lampa.TMDB.image=path=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="'+(path.includes('Green')?'#00ff00':'#ff0000')+'"/></svg>');
  Lampa.Api.main=(options,success)=>success([{title:'QA',url:'qa',results:movies}]);
 })}),{page}=r;
 await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
 assert.deepEqual(await page.locator('.navigation-bar__item').evaluateAll(nodes=>nodes.map(n=>n.dataset.action)),['back','menu','main','settings']);
 assert.equal(await page.locator('.head__menu-icon').isVisible(),false);assert.equal(await page.locator('.head__backward').isVisible(),false);assert.equal(await page.locator('.head .open--home').isVisible(),false);
 const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
 const search=await page.locator('.head .open--search').evaluate(n=>n.getBoundingClientRect().toJSON());assert.ok(search.x<14 && search.right>viewport.width-15);
 await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForSelector('body.menu--open');
 const menu=await page.locator('.wrap__left').evaluate(n=>n.getBoundingClientRect().toJSON());
 const navTop=await page.locator('.navigation-bar').evaluate(n=>n.getBoundingClientRect().top);assert.ok(menu.bottom<=navTop,'Sidebar ends above bottom navigation');
 await page.locator('.navigation-bar [data-action=menu]').press('Enter');await page.waitForFunction(()=>!document.body.classList.contains('menu--open'));
 await page.locator('.navigation-bar [data-action=settings]').click();await page.waitForSelector('body.settings--open');
 const mirror=rect=>{assert.ok(Math.abs(viewport.width-rect.right-menu.left)<2,'Right inset mirrors the menu');assert.ok(Math.abs(rect.top-menu.top)<2);assert.ok(Math.abs(rect.width-menu.width)<2);assert.ok(rect.bottom<=navTop);};
 const panel=await page.locator('.settings__content').evaluate(n=>n.getBoundingClientRect().toJSON());mirror(panel);
 await page.evaluate(()=>{Lampa.Controller.back();Lampa.Select.show({title:'Действие',items:Array.from({length:3},(_,i)=>({title:'Действие '+i}))});});
 const action=await page.locator('.selectbox__content').evaluate(n=>n.getBoundingClientRect().toJSON());mirror(action);assert.ok(Math.abs(action.width-panel.width)<2);assert.ok(action.height<250,'Short actions have no unused panel below them');
 await page.evaluate(()=>{
  Lampa.Controller.back();
  document.body.style.setProperty('--pt-safe-top','44px');
  Lampa.Activity.push({component:'main',source:'tmdb'});
 });
 const expectTint=channel=>page.waitForFunction(channel=>{
  const shade=document.querySelector('meta[name="theme-color"]')?.content;
  const rgb=shade?.match(/\d+/g)?.map(Number);
  return rgb?.length===3 && rgb[channel]>rgb[1-channel]+20 && document.documentElement.style.getPropertyValue('--pt-ios-canvas')===shade;
 },channel,{timeout:6000});
 await expectTint(0);
 assert.equal(await page.locator('meta[name=apple-mobile-web-app-status-bar-style]').getAttribute('content'),'black-translucent');
 assert.equal(await page.locator('html.pt-ios-standalone').count(),1);
 assert.equal(await page.locator('html').evaluate(n=>n.style.getPropertyValue('--pt-ios-top-edge')),'','Screen dimensions do not force a black status-bar edge');
 const material=()=>page.locator('.head .open--search').evaluate(n=>{const s=getComputedStyle(n);return [s.backgroundColor,s.backgroundImage,s.backdropFilter || s.webkitBackdropFilter,s.boxShadow];});
 const homeMaterial=await material();
 assert.equal(await page.locator('.head').evaluate(n=>getComputedStyle(n).backgroundImage),'none','No full-width search strip');
 if(process.env.LAMPA_QA_OUTPUT)await page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-'+theme+'-home.png')});
 for(const size of [{width:393,height:852},{width:852,height:393}]){
  await page.setViewportSize(size);
  await page.evaluate(landscape=>{document.body.classList.add('true--mobile');document.body.classList.toggle('orientation--landscape',landscape);},size.width>size.height);
  const box=await page.waitForFunction(()=>{
   const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
   const search=rect('.head .open--search'),nav=rect('.navigation-bar'),scroll=rect('.activity--active > .activity__body .scroll:not(.scroll--horizontal)'),art=rect('.activity--active .pt-hero__artwork'),logo=rect('.activity--active .pt-hero__branding');
   if(search && nav && scroll && art && logo && Math.abs(scroll.bottom-innerHeight)<2)return {searchTop:search.top,searchBottom:search.bottom,artTop:art.top,logoGap:logo.top-art.bottom,direction:getComputedStyle(document.querySelector('.navigation-bar__body')).flexDirection};
  },null,{timeout:3500}).then(handle=>handle.jsonValue());
  assert.equal(box.direction,'row');
  assert.ok(Math.abs(await page.locator('.activity--active .pt-hero').evaluate(n=>n.getBoundingClientRect().top))<2,'The scene canvas starts at the viewport edge');
  assert.ok(box.searchTop>=44 && box.artTop>=box.searchBottom-1,JSON.stringify(box));
  assert.ok(Math.abs(box.logoGap)<26,JSON.stringify(box));
 }
 await page.locator('.activity--active .pt-hero__image').evaluate(img=>{img.src=Lampa.TMDB.image('/Green.jpg');});
 await expectTint(1);
 const icons=await page.evaluate(()=>['main','settings'].map(action=>['.wrap__left','.navigation-bar'].map(root=>document.querySelector(root+' [data-action='+action+'] svg')?.innerHTML)));
 for(const [menuIcon,phoneIcon] of icons){assert.ok(menuIcon);assert.equal(phoneIcon,menuIcon);}
 await page.setViewportSize({width:393,height:852});
 await page.evaluate(()=>{
  const movie={id:10,title:'Карточка',original_title:'Title',poster_path:'/p.jpg',backdrop_path:'/Red.jpg',source:'tmdb',production_companies:[],production_countries:[],spoken_languages:[],genres:[]};
  Lampa.Api.full=(p,ok)=>ok({movie,persons:{cast:[],crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
  Lampa.Activity.push({component:'full',id:10,method:'movie',source:'tmdb',card:movie});
 });
 await page.waitForTimeout(600);
 await page.waitForFunction(()=>{
  const art=document.querySelector('.activity--active .minimal-detail-header>.full-start__background.loaded'),search=document.querySelector('.head .open--search');
  return art && art.getBoundingClientRect().top>=search.getBoundingClientRect().bottom-1;
 },null,{timeout:3500});
 assert.deepEqual(await material(),homeMaterial,'Home and title details share one search material');
 assert.equal(await page.locator('.head').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
 // Match two different rectangles: the full CSS canvas, but innerHeight and
 // the dynamic/visual viewport are 59px shorter with a translucent status bar.
 // The host updates layer heights from innerHeight; content and dock must
 // nevertheless retain the complete CSS canvas until a keyboard is open.
 await page.evaluate(()=>{
  window.qaNativeGeometry={width:innerWidth,height:innerHeight,scale:visualViewport.scale,visualHeight:visualViewport.height};
  window.qaCanvasHeight=visualViewport.height;
  window.qaViewportState={height:qaCanvasHeight-59,offsetTop:0,scale:1};
  Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>Math.floor(qaCanvasHeight-59)});
  for(const name of ['height','offsetTop','scale'])Object.defineProperty(visualViewport,name,{configurable:true,get:()=>qaViewportState[name]});
  const style=document.createElement('style');style.textContent='body.lampa_view.pt-mobile {--pt-mobile-viewport:'+(qaCanvasHeight-59)+'px} body.lampa_view.pt-mobile .navigation-bar {bottom:96px!important}';document.head.appendChild(style);
  const input=document.createElement('input');input.id='qa-native-input';input.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;font-size:16px;opacity:0';document.body.appendChild(input);
  Lampa.Layer.update();
 });
 const canvasHeight=await page.evaluate(()=>qaCanvasHeight);
 for(const state of [{height:canvasHeight-59,offsetTop:0,scale:1},{height:canvasHeight*.58,offsetTop:0,scale:1,keyboard:true},{height:canvasHeight-25,offsetTop:25,scale:1},{height:canvasHeight-59,offsetTop:0,scale:1}]){
  await page.evaluate(state=>{const input=document.querySelector('#qa-native-input');if(state.keyboard)input.focus();else input.blur();Object.assign(qaViewportState,state);visualViewport.dispatchEvent(new Event('resize'));},state);
  const expected=state.keyboard?state.height:canvasHeight;
  await page.waitForFunction(bottom=>Math.abs(document.querySelector('.navigation-bar').getBoundingClientRect().bottom-bottom)<1,expected,{timeout:3500}).catch(async error=>{
   throw new Error(error.message+' '+JSON.stringify({engine:engine.name(),theme,state,geometry:await page.evaluate(()=>({body:document.body.className,height:innerHeight,width:innerWidth,native:qaNativeGeometry,bodyTransform:getComputedStyle(document.body).transform,zoom:getComputedStyle(document.body).zoom,viewport:qaViewportState,focus:document.activeElement?.tagName,frame:document.body.style.getPropertyValue('--pt-mobile-viewport'),probe:document.querySelector('.pt-ios-frame-probe')?.getBoundingClientRect().toJSON(),bar:document.querySelector('.navigation-bar').getBoundingClientRect().toJSON()}))}));
  });
  const roots=await page.evaluate(()=>['body','.wrap','.wrap__content','.activity--active>.activity__body .scroll:not(.scroll--horizontal)'].map(s=>document.querySelector(s).getBoundingClientRect().bottom));
  for(const bottom of roots)assert.ok(Math.abs(bottom-expected)<2,'The whole scene uses the same frame: '+JSON.stringify({state,expected,roots}));
  const gap=await page.locator('.navigation-bar').evaluate(n=>({outer:n.getBoundingClientRect().bottom,pill:n.firstElementChild.getBoundingClientRect().bottom,padding:parseFloat(getComputedStyle(n).paddingBottom)}));
  assert.ok(Math.abs(gap.outer-gap.pill-gap.padding)<1,'The safe bottom inset is counted once: '+JSON.stringify(gap));
 }
 await page.evaluate(()=>{document.querySelector('.navigation-bar').style.setProperty('font-size','24px','important');});
 await page.waitForFunction(()=>Math.abs(document.querySelector('.navigation-bar').getBoundingClientRect().bottom-qaCanvasHeight)<1);
 await page.evaluate(()=>{qaViewportState.scale=2;visualViewport.dispatchEvent(new Event('resize'));});
 await page.waitForFunction(()=>!document.body.classList.contains('pt-ios-dock-positioned'));
 await page.evaluate(()=>{qaViewportState.scale=1;window.dispatchEvent(new Event('pageshow'));});
 await page.waitForFunction(()=>document.body.classList.contains('pt-ios-dock-positioned') && Math.abs(document.querySelector('.navigation-bar').getBoundingClientRect().bottom-qaCanvasHeight)<1);
 if(process.env.LAMPA_QA_OUTPUT)await page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-'+theme+'-detail.png')});
 await page.evaluate(()=>Lampa.Storage.set('lampa_view_enabled',false));
 await page.waitForFunction(()=>!document.body.classList.contains('pt-ios-frame'));
 assert.equal(await page.locator('.pt-ios-frame-probe').count(),0);
 assert.equal(await page.locator('body').evaluate(n=>n.style.getPropertyValue('--pt-mobile-viewport')),'');
 assert.deepEqual(r.errors,[]);console.log(engine.name(),theme,'aligned panels, mobile viewport, nav icons and changing iOS tint passed');await r.context.close();
 }}finally{await browser.close();}}})().catch(error=>{console.error(error);process.exitCode=1;});
