const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const mode of ['desktop','tv','mobile']){
  const r=await setup(browser,{viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},mode},{beforePlugin:page=>page.evaluate(async()=>{await Lampa.Cache.openDatabase();Lampa.Params.init();Lampa.Menu.ready();Lampa.Notice.init();Lampa.Search.init();
   const list=document.querySelector('.menu__list');
   for(const [action,title] of [['sport','Спорт'],['shots','Shots'],['dorama','Дорамы']]){const item=document.createElement('li');item.className='menu__item selector';item.dataset.action=action;item.innerHTML='<div class="menu__ico"></div><div class="menu__text"></div>';item.lastElementChild.textContent=title;list.appendChild(item);}})});const {page}=r;
  await page.evaluate(()=>{document.querySelector('.wrap').classList.add('layer--width');Lampa.Layer.init();Lampa.Storage.set('lampa_view_theme','glass');Lampa.Storage.set('menu_always',true);});await page.waitForTimeout(120);
  const dock=await page.evaluate(()=>{const p=document.querySelector('.wrap__left'),c=document.querySelector('.wrap__content'),rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};};return {panel:rect(p),content:rect(c),visibility:getComputedStyle(p).visibility,button:getComputedStyle(p.querySelector('.head__menu-icon')).display,first:p.querySelector('.menu').firstElementChild.classList.contains('head__menu-icon'),count:document.querySelectorAll('.head__menu-icon').length,empty:p.getBoundingClientRect().bottom-[...p.querySelectorAll('.menu__item')].filter(item=>item.getClientRects().length).at(-1).getBoundingClientRect().bottom,sheen:getComputedStyle(p).backgroundImage};});
  assert.equal(dock.button,'flex');assert.equal(dock.visibility,'visible');assert.equal(dock.count,1);assert.ok(dock.first && dock.empty<18,'The same button sits inside the dock, which hugs the menu');assert.match(dock.sheen,/linear-gradient/);assert.ok(dock.panel.width<90,'Pinned rail contains icons only');assert.ok(dock.content.left>=dock.panel.right-1);assert.ok(Math.abs(dock.content.right-(mode==='mobile'?393:1280))<1,'Menu width must only be subtracted once');console.log(mode,'dock',dock);
  if(mode==='desktop'){
   await page.setViewportSize({width:1280,height:1050});
   const tall=await page.locator('.wrap__left').evaluate(panel=>({bottom:panel.getBoundingClientRect().bottom,tail:panel.querySelector('.menu').getBoundingClientRect().bottom}));
   assert.ok(tall.bottom<1000 && Math.abs(tall.bottom-tall.tail)<12,'A taller viewport leaves no blank panel footer');
   await page.setViewportSize({width:1280,height:720});
  }
  await page.locator('.wrap__left').hover();await page.waitForTimeout(100);
  const expanded=await page.locator('.wrap__left').evaluate(n=>({width:n.getBoundingClientRect().width,text:getComputedStyle(n.querySelector('.menu__text')).display,groups:[...n.querySelectorAll('.menu__case')].map(g=>[...g.querySelectorAll('.menu__item')].map(i=>i.dataset.action)),content:document.querySelector('.wrap__content').getBoundingClientRect().left,iconPositions:[...n.querySelectorAll('.menu__case .menu__ico')].map(icon=>icon.getBoundingClientRect()).filter(box=>box.width).map(box=>box.left)}));
  assert.ok(expanded.width>dock.panel.width*2);assert.equal(expanded.text,'block');assert.ok(Math.max(...expanded.iconPositions)-Math.min(...expanded.iconPositions)<1,'All groups share one icon column');assert.equal(expanded.content,dock.content.left,'Expansion must not push page content');assert.deepEqual(expanded.groups[0],['minimal_profile','pt_notice']);assert.ok(expanded.groups.at(-1).includes('edit'));assert.ok(expanded.groups.some(g=>['settings','about','console'].every(action=>g.includes(action))));await page.mouse.move(1,1);
  await page.locator('.head__menu-icon').click();assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'menu');assert.ok(await page.locator('.wrap__left').evaluate(n=>n.getBoundingClientRect().width)>dock.panel.width*2,'Remote entry expands the same rail');
  const measure=()=>page.locator('.wrap__left').evaluate(n=>{const rect=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};},item=n.querySelector('[data-action=movie]');return {panel:rect(n),item:rect(item),icon:rect(item.querySelector('.menu__ico')),font:getComputedStyle(item).fontSize,search:rect(document.querySelector('.head .open--search'))};});
  const pinnedOpen=await measure();assert.ok(pinnedOpen.panel.top>=pinnedOpen.search.bottom+4,'Expanded pinned menu starts below search');
  await page.evaluate(()=>{Lampa.Storage.set('menu_always',false);Lampa.Controller.toggle('menu');});
  const normalOpen=await measure();assert.equal(pinnedOpen.font,normalOpen.font);assert.ok(Math.abs(pinnedOpen.item.height-normalOpen.item.height)<1,'Both expanded states share row heights');assert.ok(Math.abs(pinnedOpen.icon.width-normalOpen.icon.width)<1,'Both expanded states share icon sizes');
  await page.evaluate(()=>{Lampa.Controller.toggle('content');Lampa.Storage.set('menu_always',true);Lampa.Controller.toggle('menu');});
  await page.route(/^https?:\/\/posters\.test\//,route=>route.request().url().endsWith('/missing.png')?route.abort():route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="purple"/></svg>'}));
  await page.evaluate(()=>{
   const get=Lampa.Api.sources.tmdb.get;
   Lampa.Api.sources.tmdb.get=function(path,params,ok,fail,options){
    if(path==='tv/602'){ok({poster_path:'/recovered.png'});return;}
    if(path.startsWith('find/tt1234567')){ok({movie_results:[{poster_path:'/other-film.png'}],tv_results:[{poster_path:'/matching-series.png'}]});return;}
    return get.call(this,path,params,ok,fail,options);
   };
   const image=Lampa.TMDB.image;
   Lampa.TMDB.image=path=>/\/(recovered|other-film|matching-series)\.png$/.test(path)?'https://posters.test/'+path.split('/').pop():image(path);
   Lampa.Notice.display='all';
   Lampa.Notice.get('cub').notices=[{title:'Проверка уведомления',text:'Новая серия',time:Date.now(),poster:'//posters.test/missing.png',card:{id:601,poster_path:'https://posters.test/poster.png'},labels:['S - 1','E - 2']},
    {title:'Без адреса постера',text:'Новая серия',time:Date.now()-100,card:{id:602,source:'tmdb',seasons:{1:5}}},
    {title:'Постер по IMDb',text:'Новая серия',time:Date.now()-200,card:{id:603,source:'cub',imdb_id:'tt1234567',seasons:{1:1}}}];
  });
  await page.locator('[data-action=pt_notice]').click();
  await page.locator('.pt-notices .modal__title').waitFor();
  assert.equal(await page.locator('.modal__title').textContent(),'Уведомления');
  await page.locator('.pt-notices .notice--card').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('.pt-notices .notice__img img')?.naturalWidth===80,{},{timeout:5000}).catch(async error=>{console.error(await page.locator('.pt-notices .notice__img img').first().evaluate(img=>({src:img.getAttribute('src'),width:img.naturalWidth,complete:img.complete})));throw error;});
  assert.match(await page.locator('.pt-notices .notice__img img').first().getAttribute('src'),/posters\.test\/poster\.png$/);
  for(const file of ['recovered','matching-series']){
   const image=page.locator('.pt-notices .notice__img img[src$="/'+file+'.png"]');
   await image.waitFor({state:'visible'});
   await page.waitForFunction(el=>el.naturalWidth===80,await image.elementHandle());
  }
  await page.evaluate(()=>Lampa.Controller.back());
  await page.evaluate(()=>Lampa.Controller.toggle('menu'));await page.locator('[data-action=edit]').click();await page.locator('.menu-edit-list').waitFor();assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'modal','Native editor owns sorting and visibility');
  const editorItems=page.locator('.menu-edit-list__title');
  const names=await editorItems.allTextContents();
  for(const name of ['Спорт','Shots','Дорамы','Лента','Каталог','Персоны','Релизы'])assert.ok(!names.includes(name),name+' is absent from the editor');
  const movies=page.locator('.wrap__left [data-action=movie]');
  const nextAction=await movies.evaluate(n=>n.nextElementSibling?.dataset.action);
  const editor=page.locator('.menu-edit-list__item').filter({has:page.getByText('Фильмы',{exact:true})}).first();
  await editor.locator('.move-down').evaluate(n=>jQuery(n).trigger('hover:enter'));
  await editor.locator('.toggle').evaluate(n=>jQuery(n).trigger('hover:enter'));
  await page.evaluate(()=>Lampa.Controller.back());await page.waitForTimeout(550);
  assert.equal(await movies.evaluate(n=>n.previousElementSibling?.dataset.action),nextAction,'Move updates the live sidebar');
  assert.equal(await movies.isVisible(),false);
  const saved=await page.evaluate(()=>({order:Lampa.Storage.get('menu_sort',[]),hidden:Lampa.Storage.get('menu_hide',[])}));
  assert.ok(saved.order.includes('Фильмы') && saved.hidden.includes('Фильмы'));
  await page.locator('[data-action=edit]').click();
  await editor.locator('.toggle').evaluate(n=>jQuery(n).trigger('hover:enter'));
  await page.evaluate(()=>Lampa.Controller.back());
  assert.equal(await movies.isVisible(),true,'Hidden items can be restored in the editor');
  await page.evaluate(()=>{document.body.appendChild(Lampa.Search.render(true));Lampa.Search.open();});
  await page.locator('.main-search .search__sources').waitFor();
  const search=await page.locator('.main-search .search__body').evaluate(n=>({width:n.getBoundingClientRect().width,viewport:innerWidth,tab:n.querySelector('.search-source').getBoundingClientRect().height,field:n.querySelector('.simple-keyboard-input').getBoundingClientRect().height}));
  assert.ok(search.width<=search.viewport && search.tab>=40 && search.field>=44);
  await page.evaluate(()=>Lampa.Search.close());
  if(mode==='desktop'){
   await page.evaluate(()=>{Lampa.Storage.set('navigation_type','mouse');Lampa.Storage.set('search_history',['Удалить запрос','Оставить запрос']);Lampa.DeviceInput.init();Lampa.Controller.observe();window.qaHistoryDeletes=[];Lampa.Socket.listener.follow('send',event=>{if(event.method==='storage' && event.data.params.name==='search_history')qaHistoryDeletes.push({...event.data.params});});Lampa.Search.open();});
   await page.locator('.search-history-key').filter({hasText:'Удалить запрос'}).click({button:'right'});
   const deleted=await page.evaluate(()=>({stored:Lampa.Storage.get('search_history',[]),disk:JSON.parse(localStorage.getItem('search_history')),sent:qaHistoryDeletes}));
   assert.deepEqual(deleted.stored,['Оставить запрос']);assert.deepEqual(deleted.disk,deleted.stored);assert.ok(deleted.sent.some(item=>item.value==='Удалить запрос' && item.remove===true),'Right click sends the native cloud deletion');
   await page.evaluate(()=>{Lampa.Search.close();Lampa.Search.open();});assert.deepEqual(await page.locator('.search-history-key').allTextContents(),['Оставить запрос']);await page.evaluate(()=>Lampa.Search.close());
  }
  const centers=await page.evaluate(()=>{const host=document.querySelector('.activitys__slides'),hero=document.createElement('div'),row=document.createElement('div');hero.className='pt-hero';row.className='items-line';row.textContent='Подборка';host.appendChild(hero);host.appendChild(row);const content=document.querySelector('.wrap__content').getBoundingClientRect(),expected=(content.left+content.right)/2;const result=[hero,row].map(n=>{const b=n.getBoundingClientRect();return {delta:Math.abs((b.left+b.right)/2-expected),display:getComputedStyle(n).display,rect:{left:b.left,right:b.right},style:n.getAttribute('style')};});hero.remove();row.remove();return result;});console.log(mode,'centers',centers);assert.ok(centers.every(n=>n.delta<1),'Hero and film rails are centered in the remaining area');
  await page.evaluate(()=>Lampa.Storage.set('menu_always',false));assert.equal(await page.locator('.head .head__menu-icon').count(),1);await page.waitForTimeout(1600);await stage(page,true,2);
  const toolbar=await page.locator('.nova-plus__bar').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,buttons:[...n.querySelectorAll('.nova-chip')].map(b=>({key:b.dataset.novaFocus,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),outside:[...n.querySelectorAll('.nova-chip')].some(b=>b.getBoundingClientRect().right>innerWidth+1)}));assert.equal(toolbar.outside,false);if(mode==='mobile'){assert.ok(toolbar.height<51);assert.equal(toolbar.buttons.filter(b=>['view','direction'].includes(b.key)).length,2);}console.log(mode,'toolbar',toolbar);
  const glyphs=await page.locator('.nova-plus__bar').evaluate(bar=>{
   const get=key=>bar.querySelector('[data-nova-focus="'+key+'"]');
   const source=get('source'),badge=source.querySelector('.nova-chip__badge');
   return {sizes:['view','direction','source','voice'].map(key=>get(key).querySelector('.nova-chip__glyph').getBoundingClientRect().width),
    order:!badge && source.firstElementChild.classList.contains('nova-chip__glyph') && source.firstElementChild.nextElementSibling.classList.contains('nova-chip__label'),
    icons:!!source.querySelector('.nova-chip__glyph rect') && !!get('voice').querySelector('.nova-chip__glyph path')};
  });
  if(mode==='desktop'){
   await page.evaluate(()=>{
    const sources=['VidSrc','VidLink','Videasy','MovPI'].map(name=>({title:name+' (ENG)',source:name.toLowerCase()}));
    qaFilter.set('sort',[{title:'Test - 4K',source:'test',selected:true},...sources]);
   });
   await page.waitForFunction(()=>Lampa.Storage.get('minimal_online_sources_v1',[]).filter(row=>row.name.includes('(ENG)')).length===4);
   await page.evaluate(()=>LampaView.onlineSources.menu());
   await page.getByText('Английский',{exact:true}).waitFor();
   assert.equal(await page.locator('.selectbox-item').filter({hasText:'Английский'}).locator('.selectbox-item__subtitle').textContent(),'4');
   await page.evaluate(()=>Lampa.Select.hide());
  }
  assert.ok(glyphs.order && glyphs.icons);assert.ok(Math.max(...glyphs.sizes)-Math.min(...glyphs.sizes)<1,'Toolbar glyphs share one size: '+glyphs.sizes);
  assert.deepEqual(r.errors,[]);await r.context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
