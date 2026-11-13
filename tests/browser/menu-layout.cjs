const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const mode of ['desktop','tv','mobile']){
  const r=await setup(browser,{viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},mode},{beforePlugin:page=>page.evaluate(async()=>{await Lampa.Cache.openDatabase();Lampa.Params.init();Lampa.Menu.ready();Lampa.Notice.init();Lampa.Search.init();
   const list=document.querySelector('.menu__list');
   for(const [action,title] of [['sport','Спорт'],['shots','Shots'],['dorama','Дорамы']]){const item=document.createElement('li');item.className='menu__item selector';item.dataset.action=action;item.innerHTML='<div class="menu__ico"></div><div class="menu__text"></div>';item.lastElementChild.textContent=title;list.appendChild(item);}})});const {page}=r;
  await page.evaluate(()=>{document.querySelector('.wrap').classList.add('layer--width');Lampa.Layer.init();Lampa.Storage.set('lampa_view_theme','glass');Lampa.Storage.set('menu_always',true);});await page.waitForTimeout(300);
  const measure=()=>page.locator('.wrap__left').evaluate(n=>{const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {panel:rect(n),content:rect(document.querySelector('.wrap__content')),item:rect(n.querySelector('[data-action=movie]')),radius:getComputedStyle(n).borderRadius,icon:n.querySelector('.menu__ico').getBoundingClientRect().left};});
  const dock=await measure();assert.ok(dock.panel.width<90);assert.equal(dock.content.left,0);assert.equal(await page.locator('.head .head__menu-icon').isVisible(),false);
  await page.locator('.wrap__left').hover();await page.waitForTimeout(300);
  const expanded=await measure();assert.ok(expanded.panel.width>dock.panel.width*2);
  for(const key of ['left','top','height'])assert.ok(Math.abs(expanded.panel[key]-dock.panel[key])<1,'Dock only changes width');
  assert.equal(expanded.radius,dock.radius);assert.equal(expanded.item.height,dock.item.height);assert.equal(expanded.icon,dock.icon);assert.deepEqual(expanded.content,dock.content);
  await page.mouse.move(1,1);await page.waitForTimeout(300);
  if(mode==='mobile'){
   await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'menu');
   await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.body.matches('.menu--open,.pt-menu-hover')),false);
  }
  await page.evaluate(()=>{Lampa.Storage.set('menu_always',false);Lampa.Controller.toggle('menu');});
  await page.evaluate(()=>{Lampa.Controller.toggle('content');Lampa.Storage.set('menu_always',true);Lampa.Controller.toggle('menu');});
  const fixture={contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="purple"/></svg>'};
  await page.route(/^https?:\/\/posters\.test\//,route=>route.request().url().endsWith('/missing.png')?route.abort():route.fulfill(fixture));
  await page.route('https://image.tmdb.org/t/p/w185/actor.jpg',route=>route.fulfill(fixture));
  await page.route('https://cub.best/img/icons/premium_two.svg',route=>route.fulfill(fixture));
  await page.evaluate(()=>{
   const get=Lampa.Api.sources.tmdb.get;
   Lampa.Api.sources.tmdb.get=function(path,params,ok,fail,options){
    if(path==='tv/602'){ok({poster_path:'/recovered.png'});return;}
    if(path.startsWith('find/tt1234567')){ok({movie_results:[{poster_path:'/other-film.png'}],tv_results:[{poster_path:'/matching-series.png'}]});return;}
    return get.call(this,path,params,ok,fail,options);
   };
   const image=Lampa.TMDB.image;
   Lampa.TMDB.image=path=>path.endsWith('/actor.jpg')?'https://posters.test/missing.png':/\/(recovered|other-film|matching-series)\.png$/.test(path)?'https://posters.test/'+path.split('/').pop():image(path);
   Lampa.Notice.display='all';
   Lampa.Notice.get('cub').notices=[{title:'Проверка уведомления',text:'Новая серия',time:Date.now(),poster:'//posters.test/missing.png',card:{id:601,poster_path:'https://posters.test/poster.png'},labels:['S - 1','E - 2'],author:{ru:{name:'Актёр',text:'Премьера',img:'/actor.jpg'}}},
    {title:'Без адреса постера',text:'Новая серия',time:Date.now()-100,card:{id:602,source:'tmdb',seasons:{1:5}}},
    {title:'Постер по IMDb',text:'Новая серия',time:Date.now()-200,card:{id:603,source:'cub',imdb_id:'tt1234567',seasons:{1:1}}},
    {id:'extend_premium_2026_10',title:'Продлите CUB Premium',text:'Напоминание',time:Date.now()-300,icon:'http://posters.test/missing.png'}];
  });
  await page.locator('[data-action=pt_notice]').click();
  await page.locator('.pt-notices .modal__title').waitFor();
  assert.equal(await page.locator('.modal__title').textContent(),'Уведомления');
  await page.locator('.pt-notices .notice--card').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('.pt-notices .notice__img img')?.naturalWidth===80,{},{timeout:5000}).catch(async error=>{console.error(await page.locator('.pt-notices .notice__img img').first().evaluate(img=>({src:img.getAttribute('src'),width:img.naturalWidth,complete:img.complete})));throw error;});
  assert.match(await page.locator('.pt-notices .notice__img img').first().getAttribute('src'),/posters\.test\/poster\.png$/);
  const actor=page.locator('.pt-notices .image-author--loaded .notice__author-img img');
  await actor.waitFor();assert.equal(await actor.getAttribute('src'),'https://image.tmdb.org/t/p/w185/actor.jpg');
  assert.equal(await page.locator('.pt-notices .notice__author-name').textContent(),'Актёр');
  assert.equal(await page.locator('.pt-notices .notice__author-text').textContent(),'Премьера');
  for(const file of ['recovered','matching-series']){
   const image=page.locator('.pt-notices .notice__img img[src$="/'+file+'.png"]');
   await image.waitFor({state:'visible'});
   await page.waitForFunction(el=>el.naturalWidth===80,await image.elementHandle());
  }
  const premium=page.locator('.pt-notices .notice.image--icon').filter({hasText:'Продлите CUB Premium'});
  await premium.evaluate(row=>jQuery(row).trigger('visible'));
  const premiumIcon=premium.locator('img[src="https://cub.best/img/icons/premium_two.svg"]');
  await premiumIcon.waitFor();await page.waitForFunction(img=>img.naturalWidth===80,await premiumIcon.elementHandle());
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
    icons:!!source.querySelector('.nova-chip__glyph path') && !!get('voice').querySelector('.nova-chip__glyph path')};
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
  assert.ok(glyphs.order && glyphs.icons);assert.ok(Math.abs(glyphs.sizes[0]-glyphs.sizes[1])<1 && Math.abs(glyphs.sizes[2]-glyphs.sizes[3])<1 && Math.abs(glyphs.sizes[2]-glyphs.sizes[0])<1,'Source/audio glyphs are equally enlarged: '+glyphs.sizes);
  assert.deepEqual(r.errors,[]);await r.context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
