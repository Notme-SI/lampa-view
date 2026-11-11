const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile','tablet']){
 const r=await setup(browser,{mode,viewport:mode==='tv'?{width:960,height:540}:mode==='mobile'?{width:390,height:844}:mode==='tablet'?{width:834,height:1194}:{width:1440,height:900}}),{page}=r;
 try{
  await page.route('http://project-assets.test/**',route=>{
   const url=route.request().url();
   if(url.includes('missing') || url.includes('unreadable') && route.request().headers().origin)return route.abort();
   const fill=url.includes('dark') || url.includes('unreadable')?'#101010':url.includes('white')?'#ffffff':'#d83d39';
   return route.fulfill({contentType:'image/svg+xml',headers:url.includes('unreadable')?{}:{'access-control-allow-origin':'*'},body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect x="10" y="10" width="380" height="180" fill="'+fill+'"/></svg>'});
  });
  await page.evaluate(()=>{const L=Lampa;L.Params.init();L.Layer.init();L.DeviceInput.init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));window.qaRequests=[];L.TMDB.image=path=>'http://project-assets.test'+path;
   L.Api.sources.tmdb.get=(url,p,ok,fail)=>{qaRequests.push(url);const id=Number(url.match(/(?:person|company|network)\/(\d+)/)?.[1] || new URLSearchParams(url.split('?')[1]).get('with_companies') || 213);
    if(/^person\/\d+$/.test(url))return setTimeout(()=>ok({name:'Актёр '+id,profile_path:id===74?'/missing.jpg':'/portrait.jpg'}),0);
    if(/^(company|network)\/\d+$/.test(url))return setTimeout(()=>ok({name:id===213?'Netflix':id===78?'Очень длинное название студии для проверки переноса имени на небольшом экране':'Студия '+id,logo_path:({74:'/missing.png',75:'/dark.png',76:'/white.png',77:'/unreadable.png'})[id] || '/logo.png'}),0);
    const tv=url.includes('tv_credits') || url.startsWith('discover/tv'),empty=id===71&&!tv || id===72;
    const cards=empty?[]:Array.from({length:20},(_,i)=>({id:i+1,title:'Фильм '+i,name:'Сериал '+i,popularity:20-i,poster_path:'/poster.jpg',release_date:'2025-01-01',first_air_date:'2025-01-01'}));setTimeout(()=>ok(url.includes('_credits')?{cast:cards,crew:[]}:{results:cards,page:p.page || 1,total_pages:9}),0);
   };
  });
  for(const component of ['actor','company']){
   await page.evaluate(component=>Lampa.Activity.push({component,id:70,source:'tmdb'}),component);await page.waitForSelector('.activity--active .card');await page.waitForSelector('.activity--active .minimal-project-art:not([hidden])');
   assert.equal(await page.locator('.activity--active .minimal-project-title').isVisible(),true);
   const layout=await page.locator('.activity--active .minimal-project-header').evaluate(header=>{
    const identity=header.querySelector('.minimal-project-identity').getBoundingClientRect(),tabs=header.querySelector('.minimal-project-tabs').getBoundingClientRect(),art=header.querySelector('.minimal-project-art').getBoundingClientRect(),title=header.querySelector('.minimal-project-title').getBoundingClientRect();
    const current=getComputedStyle(header.querySelector('[aria-pressed=true]')),other=getComputedStyle(header.querySelector('[aria-pressed=false]'));
    return {identity:{right:identity.right,bottom:identity.bottom},tabs:{left:tabs.left,top:tabs.top},artBottom:art.bottom,titleTop:title.top,current:current.borderBottomColor,other:other.borderBottomColor};
   });
   if(mode==='mobile')assert.ok(layout.tabs.top>=layout.identity.bottom,'Narrow layout places tabs on their own row');
   else assert.ok(layout.tabs.left>=layout.identity.right && layout.tabs.top<layout.identity.bottom,'Wide layout puts tabs beside the name');
   assert.ok(layout.titleTop>=layout.artBottom,'The portrait or studio logo is above the name');
   assert.notEqual(layout.current,layout.other,'An underline distinguishes the selected tab');
   const outline=await page.locator('.activity--active .minimal-project-tabs button').first().evaluate(n=>{
    n.classList.add('focus');
    const focused=getComputedStyle(n).backgroundColor;
    n.classList.remove('focus');
    const style=getComputedStyle(n);
    return {focused,fill:style.backgroundColor,outline:style.outlineStyle,shadow:style.boxShadow};
   });
   assert.notEqual(outline.focused,outline.fill);
   assert.deepEqual([outline.outline,outline.shadow],['none','none'],'The old tab has no remaining focus ring');
   const image=await page.locator('.activity--active .minimal-project-art').evaluate(n=>({src:n.src,box:n.getBoundingClientRect().toJSON(),width:innerWidth,em:parseFloat(getComputedStyle(n).fontSize)}));assert.ok(image.src.includes(component==='actor'?'/w500/portrait.jpg':'/w500/logo.png'));assert.ok(image.box.right<=image.width+1 && image.box.left>=0);assert.ok(image.box.height/image.em>=(component==='actor'?(mode==='mobile'?6.9:8.9):(mode==='mobile'?4.5:5.5)),'Project artwork has the requested size');
   for(const theme of ['minimal','glass']){
    await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
    await page.evaluate(()=>{const grid=Lampa.Activity.active().activity.component;Lampa.Controller.toggle('content');Lampa.Controller.collectionFocus(grid.items[0].render(true),grid.scroll.render(true));});
    await page.keyboard.press('ArrowUp');await page.waitForTimeout(350);
    assert.equal(await page.locator('.activity--active .minimal-project-tabs .focus').count(),1,'Remote reaches the media tabs');
    await page.keyboard.press('ArrowDown');await page.waitForTimeout(350);
    const first=await page.locator('.activity--active .card.focus').evaluate(node=>{const r=node.getBoundingClientRect(),scroll=node.closest('.scroll').getBoundingClientRect();return {top:r.top,bottom:r.bottom,viewTop:Math.max(0,scroll.top),viewBottom:Math.min(innerHeight,scroll.bottom)};});
    assert.ok(first.top>=first.viewTop-1 && first.bottom<=first.viewBottom+1,'The first focused card fits in the viewport');
   }
   if(component==='company'){assert.ok(await page.locator('.head__navigator').count());assert.equal(await page.locator('.head__navigator').isVisible(),false);const next=await page.evaluate(async()=>{const c=Lampa.Activity.active().activity.component;c.object.page=2;return new Promise((ok,fail)=>c.emit('next',json=>ok(json.page),fail));});assert.equal(next,2,'Removing the header counter retains page loading');}
   await page.locator('.activity--active').getByRole('button',{name:'Сериалы',exact:true}).click();await page.waitForFunction(()=>Lampa.Activity.active().minimal_project_type==='tv');await page.waitForSelector('.activity--active .minimal-project-art:not([hidden])');
   assert.equal(await page.evaluate(component=>qaRequests.filter(url=>url===(component==='actor'?'person/70':'company/70')).length,component),1,'The profile is reused across tabs');
   await page.evaluate(component=>Lampa.Activity.push({component,id:71,source:'tmdb'}),component);await page.waitForFunction(()=>Lampa.Activity.active().id===71 && Lampa.Activity.active().minimal_project_type==='tv');await page.waitForSelector('.activity--active .card');assert.equal(await page.locator('.activity--active button[aria-pressed=true]').innerText(),'Сериалы');
  }
  await page.evaluate(()=>Lampa.Activity.push({component:'category_full',networks:213,url:'discover/tv',source:'tmdb'}));await page.waitForSelector('.activity--active .card');await page.waitForSelector('.activity--active .minimal-project-art:not([hidden])');assert.equal(await page.locator('.activity--active button[aria-pressed=true]').innerText(),'Сериалы');assert.equal(await page.locator('.activity--active .minimal-project-title').innerText(),'Netflix');assert.ok(await page.evaluate(()=>qaRequests.some(url=>url.includes('with_networks=213'))));assert.equal(await page.evaluate(()=>qaRequests.some(url=>url.includes('with_companies=213'))),false);
  for(const [id,expected] of [[75,'pt-studio-white'],[76,''],[77,'pt-studio-unreadable'],[78,'']]){
   await page.evaluate(id=>Lampa.Activity.push({component:'company',id,source:'tmdb'}),id);await page.waitForSelector('.activity--active .card');await page.waitForSelector('.activity--active .minimal-project-art:not([hidden])');
   if(expected)await page.waitForFunction(expected=>document.querySelector('.activity--active .minimal-project-art')?.classList.contains(expected),expected);
   const art=await page.locator('.activity--active .minimal-project-art').evaluate(node=>({white:node.classList.contains('pt-studio-white'),filter:getComputedStyle(node).filter,background:getComputedStyle(node).backgroundColor}));
   assert.equal(art.white,id===75,'Only a dark monochrome logo becomes white');
   if(id===75)assert.match(art.filter,/brightness\(0\).*invert\(1\)/);
   if(id===77)assert.notEqual(art.background,'rgba(0, 0, 0, 0)','Unreadable CORS images keep a light backing');
   assert.ok(await page.locator('.activity--active .minimal-project-header').evaluate(node=>{const r=node.getBoundingClientRect(),title=node.querySelector('.minimal-project-title').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1 && title.right<=innerWidth+1;}),'Long names and logos fit the screen');
  }
  for(const component of ['actor','company']){await page.evaluate(component=>Lampa.Activity.push({component,id:74,source:'tmdb'}),component);await page.waitForSelector('.activity--active .card');await page.waitForFunction(()=>document.querySelector('.activity--active .minimal-project-art')?.complete);assert.equal(await page.locator('.activity--active .minimal-project-title').isVisible(),true);assert.equal(await page.locator('.activity--active .minimal-project-art').isVisible(),false);}
  await page.evaluate(()=>Lampa.Activity.push({component:'actor',id:72,source:'tmdb'}));await page.waitForFunction(()=>Lampa.Activity.active().id===72 && Lampa.Activity.active().minimal_project_type==='tv');await page.waitForSelector('.activity--active .empty');assert.equal(await page.evaluate(()=>qaRequests.filter(url=>/^person\/72\/(movie|tv)_credits$/.test(url)).length),2,'Both empty media types stop after one fallback');
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+': actor portraits, studio/network logos, missing-art fallback and automatic TV selection PASS');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
