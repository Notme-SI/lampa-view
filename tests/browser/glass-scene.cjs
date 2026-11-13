const assert = require('node:assert/strict');
const {chromium, webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup} = require('../fixtures/native-browser.cjs');

async function samplePixels(page, points) {
 const screenshot=await page.screenshot({animations:'disabled',scale:'css'});
 return page.evaluate(async ({png,points})=>{
  const image=new Image();
  image.src='data:image/png;base64,'+png;
  await image.decode();
  const canvas=document.createElement('canvas');
  canvas.width=image.width;
  canvas.height=image.height;
  const context=canvas.getContext('2d');
  context.drawImage(image,0,0);
  return points.map(([x,y])=>Array.from(context.getImageData(Math.round(x*image.width),Math.round(y*image.height),1,1).data).slice(0,3));
 },{png:screenshot.toString('base64'),points});
}

async function run(engine, browser, mode) {
 const viewport = mode === 'tv' ? {width:960,height:540} : {width:1440,height:900};
 const {page,context,errors} = await setup(browser, {mode,viewport}, {beforePlugin:page => page.evaluate(() => {
  const L = Lampa;
  L.Params.init(); L.Layer.init(); L.Search.init(); L.Menu.ready();
  // Desktop profiles can retain Background=false from the host/older builds.
  // Our own banner tint remains independent without rewriting that preference.
  L.Storage.set('background',false);
  document.querySelector('.wrap').classList.add('layer--height','layer--width');
  document.querySelector('.wrap__content').classList.add('layer--height');
  L.Layer.update();
  const data = [
   {id:1,title:'Красная главная',original_title:'Красная главная',overview:'Banner',poster_path:'/poster.jpg',backdrop_path:'/home.jpg',source:'tmdb'},
   {id:2,title:'Зелёный фильм',original_title:'Зелёный фильм',overview:'Movie',poster_path:'/poster.jpg',backdrop_path:'/detail.jpg',source:'tmdb'},
   {id:3,title:'Синий фильм',original_title:'Синий фильм',overview:'Movie',poster_path:'/poster.jpg',backdrop_path:'/other.jpg',source:'tmdb'}
  ];
  window.sceneMovies = data;
  const anime=[{id:41,name:'Синее аниме',original_name:'Blue anime',overview:'Anime',poster_path:'/poster.jpg',backdrop_path:'/other.jpg',source:'tmdb'},{id:42,name:'Жёлтое аниме',original_name:'Yellow anime',overview:'Anime',poster_path:'/poster.jpg',backdrop_path:'/yellow.jpg',source:'tmdb'}];
  L.TMDB.image = path => 'http://scene.example.invalid'+path;
  L.Api.main = (options,success) => success([{title:'QA',url:'qa',results:data}]);
  L.Api.category = (options,success) => success([{title:'QA',url:'qa',results:data}]);
  L.Api.full = (p,ok) => ok({movie:{...data[1],production_countries:[],production_companies:[],spoken_languages:[],genres:[]},persons:{crew:[],cast:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
  L.Api.sources.tmdb.get = (url,p,ok) => ok(url.includes('_credits') ? {cast:data,crew:[]} : {results:url.includes('with_original_language=ja')?anime:data,total_pages:1,page:1});
  const network=window.testNetwork;window.testNetwork=(url,ok,fail)=>/shikimori\.(io|one)\/api\/animes\?/.test(url)?ok([{id:123,kind:'tv',name:'Shikimori anime',russian:'Аниме из Shikimori',image:{original:'/poster.jpg'}}]):network(url,ok,fail);
  L.Storage.set('lampa_view_theme','glass');
  L.Storage.set('background',false);
  L.Storage.set('animation',true);
 })});
 try {
  const requests = [];
  await page.route('http://scene.example.invalid/**', route => {
   const url = route.request().url();
   requests.push(url);
   const color = url.endsWith('/home.jpg')?'#ff0000':url.endsWith('/dark-home.jpg')?'#201510':url.endsWith('/detail.jpg')?'#00ff00':url.endsWith('/other.jpg')?'#0000ff':url.endsWith('/yellow.jpg')?'#ffff00':'#505050';
   return route.fulfill({contentType:'image/svg+xml',headers:{'Access-Control-Allow-Origin':'*'},body:'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="'+color+'"/></svg>'});
  });
  await page.evaluate(() => {
   const L = Lampa;
   const Category = L.Component.get('category');
   for (const type of ['torrents','alc_auto_view']) L.Component.add(type, function(object) {return new Category({...object, url:'movie'});});
   L.Activity.push({component:'main',source:'tmdb'});
  });
  const expectColor = channel => page.waitForFunction(channel => {
   const rgb = document.body.style.getPropertyValue('--pt-scene-rgb').split(',').map(Number);
   const background = getComputedStyle(document.querySelector('.wrap')).backgroundImage;
   return rgb.length === 3 && rgb[channel] > Math.max(...rgb.filter((_,i)=>i!==channel)) + 30 &&
    background.includes('radial-gradient') && !background.includes('url(');
  }, channel, {timeout:10000});
  await expectColor(0);
  assert.equal(await page.evaluate(()=>Lampa.Storage.value('background')),'false');
  const materials=[];
  for(const strength of ['0','25','100','50']){
   await page.evaluate(strength=>Lampa.Storage.set('lampa_view_artwork_tint',strength),strength);await page.waitForTimeout(70);
   materials.push(await page.evaluate(()=>({scene:document.body.getAttribute('data-pt-scene'),rgb:document.body.style.getPropertyValue('--pt-material-rgb'),strength:Number(document.body.style.getPropertyValue('--pt-scene-strength'))})));
  }
  assert.equal(materials[0].scene,null);assert.equal(materials[0].rgb,'');assert.ok(materials[2].strength>materials[1].strength);assert.notEqual(materials[2].rgb,materials[1].rgb);await expectColor(0);
  const proxy='http://proxy.example.invalid/t/p/original/tint-test.jpg';
  const thumbnail='https://image.tmdb.org/t/p/w300/tint-test.jpg';
  const sample={contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="blue"/></svg>'};
  await page.route(proxy,route=>route.fulfill(sample));
  await page.route(thumbnail,route=>route.fulfill({...sample,headers:{'Access-Control-Allow-Origin':'*'}}));
  const home=page.locator('.activity--active .pt-hero__image');
  const initialSource=await home.getAttribute('src');
  await home.evaluate(async (img,src)=>{img.src=src;await img.decode();},proxy);
  await expectColor(2);
  await home.evaluate(async (img,src)=>{img.src=src;await img.decode();},initialSource);
  await expectColor(0);
  assert.equal(await page.locator('.activity--active .pt-hero__image').count(),1);
  const hero=await page.locator('.activity--active .pt-hero').evaluate(node=>{
   const image=node.querySelector('.pt-hero__image'), art=image.parentElement;
   return {width:art.clientWidth/node.clientWidth,fit:getComputedStyle(image).objectFit,bottom:art.getBoundingClientRect().bottom};
  });
  assert.ok(hero.width>=.66 && hero.width<=.70,JSON.stringify(hero));
  assert.equal(hero.fit,'cover');
  const artwork=page.locator('.activity--active .pt-hero__image'),original=await artwork.getAttribute('src');
  for(const theme of ['minimal','glass']){
   await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
   await page.waitForFunction(()=>{
    const hero=document.querySelector('.activity--active .pt-hero'),copy=hero.querySelector('.pt-hero__body'),card=hero.nextElementSibling.querySelector('.card');
    return card && Math.abs(copy.getBoundingClientRect().left-card.getBoundingClientRect().left)<1;
   },null,{timeout:3500});
   if(theme==='glass'){
    const surfaces=await page.evaluate(()=>['.head .head__body','.activity--active .pt-hero__dots'].map(selector=>{
     const s=getComputedStyle(document.querySelector(selector));return {color:s.backgroundColor,image:s.backgroundImage,filter:s.backdropFilter || s.webkitBackdropFilter,shadow:s.boxShadow};
    }));
    assert.deepEqual(surfaces[1],surfaces[0],'The carousel switcher uses the same Glass material as the header');
    console.log(engine,mode,'matching carousel/header material',JSON.stringify(surfaces[0]));
    if(process.env.LAMPA_QA_OUTPUT)await page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,engine+'-'+mode+'-home.png')});
   }
   for(const image of [original,'http://scene.example.invalid/dark-home.jpg']){
    await artwork.evaluate(async (img,src)=>{img.src=src;await img.decode();},image);
    const edge=await artwork.evaluate(img=>img.parentElement.getBoundingClientRect().left/innerWidth);
    const [middle,fade]=await artwork.evaluate(img=>{const box=img.parentElement.getBoundingClientRect();return [.42,.76].map(p=>(box.top+box.height*p)/innerHeight);});
    const [left,right,center,lower,inner,feather]=await samplePixels(page,[[edge-.003,.105],[edge+.003,.105],[.94,.105],[.94,middle],[edge+.51*(1-edge),middle],[.94,fade]]);
    assert.ok(left.every((channel,i)=>Math.abs(channel-right[i])<=4),JSON.stringify({engine,mode,theme,image,left,right}));
    if(image===original)assert.ok(center[0]>right[0]+30,'The bright image stays visible on the right');
    if(image===original){
     for(const rgb of [lower,inner])assert.ok(rgb[0]>=250 && rgb[1]<=4 && rgb[2]<=4,'The source color stays intact outside the edge blends: '+JSON.stringify({mode,theme,rgb}));
     assert.ok(feather[0]>70 && feather[0]<220,'The bottom edge eases out through a translucent region: '+JSON.stringify({mode,theme,feather}));
     const bottom=await artwork.evaluate(img=>img.parentElement.getBoundingClientRect().bottom/innerHeight);
     const [underLogo,leftOfBanner,tintedPage]=await samplePixels(page,[[.14,middle],[.27,.12],[.94,bottom+.012]]);
     assert.ok(underLogo[0]>Math.max(underLogo[1],underLogo[2])+3 && [...underLogo,...leftOfBanner].every(channel=>channel<=55),'The text area stays dark while picking up the banner tint: '+JSON.stringify({mode,theme,underLogo,leftOfBanner}));
     assert.ok(tintedPage[0]>Math.max(tintedPage[1],tintedPage[2])+8,'Artwork tint continues under the right side of the banner: '+JSON.stringify({mode,theme,tintedPage}));
     const fadeSamples=await samplePixels(page,[.27,.33,.39,.45,.51,.57].map(x=>[x,bottom+.012]));
     const steps=fadeSamples.slice(1).map(([red],i)=>red-fadeSamples[i][0]);
     assert.ok(steps.every(step=>Math.abs(step)<=24) && fadeSamples[5][0]>fadeSamples[0][0]+12,'The tint spreads evenly across the page: '+JSON.stringify({mode,theme,fadeSamples}));
     const corner=edge+.08*(1-edge);
     const colors=await samplePixels(page,[[.94,bottom-.004],[.94,bottom+.004],[corner,bottom-.004],[corner,bottom+.004]]);
     for(const [above,below] of [[colors[0],colors[1]],[colors[2],colors[3]]]){
      assert.ok(above.every((value,i)=>Math.abs(value-below[i])<=4),'The lower edge and corner fade into the same background: '+JSON.stringify({mode,theme,above,below}));
     }
    }
   }
  }
  // A light ambient background exposes the shade at the left edge of the
  // bottom fade, even where the artwork itself is completely transparent.
  const wrap=page.locator('.wrap');
  await wrap.evaluate(n=>n.style.setProperty('background','#888','important'));
  try{
   const edgePoints=await artwork.evaluate(img=>{
    const box=img.parentElement.getBoundingClientRect();
    return [.85,.89,.92,.95,.97].flatMap(fraction=>{
     const y=(box.top+box.height*fraction)/innerHeight;
     return [[(box.left-3)/innerWidth,y],[(box.left+3)/innerWidth,y]];
    });
   });
   const colors=await samplePixels(page,edgePoints);
   for(let i=0;i<colors.length;i+=2){
    const [left,right]=colors.slice(i,i+2);
    assert.ok(left.every((value,channel)=>Math.abs(value-right[channel])<=3),
     'The bottom shade must also fade at the left edge: '+JSON.stringify({mode,left,right}));
   }
  }finally{await wrap.evaluate(n=>n.style.removeProperty('background'));}
  await artwork.evaluate(async (img,src)=>{img.src=src;await img.decode();},original);
  await expectColor(0);
  const bottom=await page.evaluate(y=>y/innerHeight,hero.bottom);
  const [[above],[below]]=await samplePixels(page,[[.94,bottom-.004],[.94,bottom+.004]]);
  assert.ok(Math.abs(above-below)<=4,'The lower edge fades into the page: '+[above,below]);
  await page.evaluate(()=>Lampa.Activity.push({component:'company',id:18,source:'tmdb'}));
  await expectColor(0);
  await page.evaluate(()=>Lampa.Activity.backward());
  await expectColor(0);
  const homeRequests = requests.filter(u=>u.endsWith('/home.jpg')).length;
  for (const url of ['movie','tv']) {
   await page.evaluate(url=>Lampa.Activity.push({component:'category',url,source:'tmdb'}), url);
   await expectColor(0);
   if(url==='movie'){
    const ratio=await page.locator('.activity--active .minimal-catalogue-control').first().evaluate(n=>n.clientHeight/parseFloat(getComputedStyle(n).fontSize));
    assert.ok(ratio<=2.25,'Catalogue filters fit a compact row');
   }
  }
  assert.ok(requests.filter(u=>u.endsWith('/home.jpg')).length<=homeRequests+1,'Returning activities may retry an interrupted home image once');
  await page.evaluate(()=>Lampa.Activity.push({component:'full',id:2,method:'movie',source:'tmdb',card:sceneMovies[1]}));
  const backdrop = page.locator('.activity--active .full-start__background');
  await backdrop.evaluate(img => img.decode());
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.activity--active .full-start__background')).opacity)>.45);
  for (const theme of ['minimal','glass']) {
   await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
   const strip = await page.locator('.head').evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.equal(strip,'rgba(0, 0, 0, 0)','Detail artwork is visible through the top bar');
   const before=await samplePixels(page,[[.04,.007],[.04,.07]]);
   if(theme==='glass'){
    const point=await page.locator('.head .open--search').evaluate(n=>{
     const r=n.getBoundingClientRect();
     return [(r.left+r.width*.62)/innerWidth,(r.top+r.height/2)/innerHeight];
    });
    const [[r,g,b]]=await samplePixels(page,[point]);
    assert.ok(g>Math.max(r,b)+18,'The backdrop is visible through the search area: '+[r,g,b]);
   }
   await page.locator('.head .open--settings').click();
   await page.waitForSelector('body.settings--open');
   const settings=await samplePixels(page,[[.04,.007],[.04,.07]]);
   await page.evaluate(()=>Lampa.Controller.back());
   await page.waitForSelector('body.settings--open',{state:'detached'});
   await page.evaluate(()=>Lampa.Select.show({title:'Actions',items:[{title:'Sample'}]}));
   await page.waitForSelector('body.selectbox--open');
   const actions=await samplePixels(page,[[.04,.007],[.04,.07]]);
   await page.evaluate(()=>Lampa.Select.hide());
   for(const [name,colors] of Object.entries({before,settings,actions})){
    assert.ok(colors.every(([r,g,b])=>g>Math.max(r,b)+20),name+' loses artwork at the viewport top: '+JSON.stringify(colors));
    assert.ok(Math.abs(colors[0][1]-colors[1][1])<=7,name+' introduces a horizontal seam');
   }
  }
  for (const component of ['alc_auto_view','torrents','actor','company','category_full']) {
   await page.evaluate(component=>Lampa.Activity.push({component,id:17,networks:component==='category_full'?17:undefined,
    movie:['alc_auto_view','torrents'].includes(component)?sceneMovies[1]:undefined,source:'tmdb'}),component);
   await expectColor(1);
   if (['actor','company'].includes(component)) {
    await page.locator('.activity--active').getByRole('button',{name:'Сериалы',exact:true}).click();
    await page.waitForFunction(()=>Lampa.Activity.active().minimal_project_type==='tv');
    await expectColor(1);
   }
   await page.evaluate(()=>Lampa.Activity.backward());
  }
  await page.evaluate(()=>Lampa.Activity.push({component:'torrents',movie:sceneMovies[2],source:'tmdb'}));
  await expectColor(2);
  await page.evaluate(()=>Lampa.Activity.push({component:'torrents',search:'unlinked',from_search:true,source:'tmdb'}));
  assert.equal(await page.locator('body[data-pt-scene]').count(),0);
  await page.evaluate(()=>Lampa.Activity.push({component:'category',url:'anime',source:'tmdb'}));
  await expectColor(2);
  const animeHero=page.locator('.activity--active .minimal-anime-controls + .pt-hero');
  assert.equal(await animeHero.getAttribute('aria-label'),'Аниме');
  const animeLayout=await animeHero.evaluate(node=>({top:node.getBoundingClientRect().top,art:node.querySelector('.pt-hero__artwork').getBoundingClientRect().top,tabs:node.previousElementSibling.getBoundingClientRect().top,header:document.querySelector('.head .head__body').getBoundingClientRect().bottom}));
  assert.ok(Math.abs(animeLayout.top)<2 && Math.abs(animeLayout.art)<2 && animeLayout.tabs>=animeLayout.header-2,JSON.stringify({mode,animeLayout}));
  assert.equal(await animeHero.locator('.pt-hero__dot').count(),2,'Only distinct anime from catalogue rows appear in the carousel');
  await page.evaluate(()=>Lampa.Controller.enabled().controller.down());
  assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'lampa_view_hero');
  let releaseArtwork;
  const delayArtwork=new Promise(resolve=>{releaseArtwork=resolve;});
  await page.route('**/yellow.jpg',async route=>{await delayArtwork;await route.fallback();});
  await animeHero.locator('.pt-hero__dot').nth(1).click();
  assert.equal(await animeHero.locator('.pt-hero__title').textContent(),'Синее аниме');
  assert.equal(await animeHero.locator('.pt-hero__dot').first().getAttribute('aria-pressed'),'true');
  releaseArtwork();
  await page.waitForFunction(()=>{const [r,g,b]=document.body.style.getPropertyValue('--pt-scene-rgb').split(',').map(Number);return r>b+30 && g>b+30;});
  await page.evaluate(()=>{Lampa.Controller.enabled().controller.down();Lampa.Controller.enabled().controller.up();});
  assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'lampa_view_hero');
  await page.evaluate(()=>Lampa.Controller.enabled().controller.up());
  assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'minimal_anime_tabs');
  await page.locator('.activity--active [data-catalogue=shikimori]').click();
  await expectColor(2);
  assert.equal(await page.locator('.activity--active [data-catalogue=shikimori]').getAttribute('aria-selected'),'true');
  assert.equal(await animeHero.locator('.pt-hero__title').textContent(),'Синее аниме');
  await page.evaluate(()=>Lampa.Activity.push({component:'category_full',url:'order=popularity',title:'Аниме',source:'minimal_shiki',page:1}));
  await page.waitForFunction(()=>Lampa.Activity.active().component==='category_full' && !document.body.classList.contains('pt-anime-home') && !document.body.style.getPropertyValue('--pt-scene-rgb') && !document.body.style.getPropertyValue('--pt-material-rgb') && !document.body.style.getPropertyValue('--pt-home-atmosphere'));
  assert.equal(await page.locator('.activity--active .pt-hero').count(),0);
  await page.evaluate(()=>Lampa.Activity.backward());
  await expectColor(2);
  await animeHero.locator('.pt-hero__action').click();
  await page.waitForFunction(()=>Lampa.Activity.active().component==='full',null,{timeout:4000});
  const selected=await page.evaluate(()=>{const active=Lampa.Activity.active();return {id:Number(active.id),source:active.source};});
  assert.deepEqual(selected,{id:41,source:'tmdb'});
  await expectColor(1);
  await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));
  await expectColor(0);
  await page.waitForSelector('.activity--active .card__view');
  await page.evaluate(() => {
   const panel = document.createElement('div');
   panel.className='nova-plus-root';
   panel.id='qa-nova-preview';
   panel.innerHTML='<div class="nova__list--grid"><div class="nova-card"><div class="nova-card__thumb" style="width:100px;height:140px;background:#666"></div></div></div>';
   document.body.appendChild(panel);
   for(const watched of [false,true]) {
    const title=watched?'Watched fixture':'Unwatched fixture';
    const data={...sceneMovies[0],id:watched?9990:9991,title,original_title:title};
    if(watched)Lampa.Favorite.toggle('history',data);
    const card=Lampa.Maker.make('Card',data);
    card.create();
    const rendered=card.render(true);
    rendered.id=watched?'qa-native-history':'qa-native-unwatched';
    if(!watched)rendered.style.cssText='position:fixed;left:150px;top:180px;z-index:150';
    panel.before(rendered);
    card.visible();
   }
  });
  for (const theme of ['minimal','glass']) {
   await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme), theme);
   await page.waitForFunction(theme=>document.body.dataset.lampaTheme===theme, theme);
   const marker=page.locator('#qa-native-history .icon--history');
   assert.equal(await marker.count(),1);
   const normal=await marker.evaluate(node=>{
    const rect=node.getBoundingClientRect(), poster=node.closest('.card__view').getBoundingClientRect();
    return {width:rect.width,height:rect.height,x:(rect.left+rect.width/2-poster.left)/poster.width,
     y:(rect.top+rect.height/2-poster.top)/poster.height,glyph:getComputedStyle(node).backgroundImage,legacy:getComputedStyle(node,'::before').content};
   });
   assert.ok(Math.abs(normal.x-.5)<.02 && Math.abs(normal.y-.6)<.02,JSON.stringify(normal));
   assert.ok(normal.width>8 && normal.width<39 && normal.height<39,JSON.stringify(normal));
   assert.match(normal.glyph,/data:image\/svg\+xml/);
   assert.equal(normal.legacy,'none');
   await page.locator('#qa-native-history').evaluate(n=>n.classList.add('focus'));
   assert.equal(await marker.count(),1);
   assert.match(await page.locator('#qa-native-history .card__view').evaluate(n=>getComputedStyle(n,'::after').boxShadow),/1px inset/);
   await page.locator('#qa-native-history').evaluate(n=>n.classList.remove('focus'));
   for (const [target,view] of [['#qa-native-unwatched','.card__view'],['#qa-nova-preview .nova-card','.nova-card__thumb']]) {
    const card = page.locator(target).first();
    await page.mouse.move(2,2);
    await card.evaluate(n=>n.classList.remove('focus','hover'));
    await card.evaluate((node,view)=>new Promise(resolve=>{function settled(){const n=node.querySelector(view),s=getComputedStyle(n);if(!n.getAnimations().some(a=>a.playState==='running') && s.transform==='none')resolve();else requestAnimationFrame(settled);}settled();}),view);
    const before = await card.evaluate((n,view)=>({outer:n.offsetTop,art:n.querySelector(view).getBoundingClientRect().y-n.getBoundingClientRect().y}),view);
    await card.evaluate(n=>n.classList.add('focus'));
    await page.waitForTimeout(35);
    const moving=await card.evaluate((n,view)=>n.querySelector(view).getAnimations().some(animation=>animation.playState==='running'),view);
    assert.equal(moving,true,'The poster moves over actual animation frames');
    await page.waitForTimeout(260);
    const after = await card.evaluate((n,view)=>{
     const art=n.querySelector(view), face=getComputedStyle(art,'::after');
     return {outer:n.offsetTop,art:art.getBoundingClientRect().y-n.getBoundingClientRect().y,transform:getComputedStyle(art).transform,halo:face.boxShadow,opacity:face.opacity,indicator:face.backgroundImage,edge:face.borderTopColor};
    },view);
    assert.equal(after.outer,before.outer,target);
    assert.ok(Math.abs(after.art-before.art+3)<.1,JSON.stringify({before,after,theme,target}));
    assert.match(after.transform,/matrix\(1, 0, 0, 1, 0, -3\)/);
    assert.equal(after.indicator,'none');assert.match(after.halo,/1px inset/,'The inset contour follows the poster radius');
    assert.equal(await card.locator('.icon--history').count(),0);
    assert.match(after.halo,/rgba\(255, 255, 255, 0.18\)/);
    assert.equal(after.opacity,'1');

    await card.evaluate(n=>n.classList.remove('focus'));
   }
   const face=page.locator('#qa-native-unwatched .card__view');
   if(mode==='desktop'){
    const neighbor=await page.locator('#qa-native-history').evaluate(node=>node.getBoundingClientRect().toJSON());
    await page.locator('#qa-native-unwatched').hover();await page.waitForTimeout(260);
    assert.match(await face.evaluate(node=>getComputedStyle(node).transform),/matrix\(1, 0, 0, 1, 0, -4\.5\)/);
    assert.deepEqual(await page.locator('#qa-native-history').evaluate(node=>node.getBoundingClientRect().toJSON()),neighbor);
    await page.mouse.move(2,2);await page.waitForTimeout(260);
   }
   await page.locator('#qa-native-unwatched').evaluate(node=>node.classList.add('focus'));
   await page.waitForTimeout(260);
   const nativeAnimation=await page.evaluate(()=>Lampa.Storage.get('animation'));
   await page.evaluate(()=>Lampa.Storage.set('animation',false));
   const stoppedNativeAnimation=await page.evaluate(()=>Lampa.Storage.get('animation'));
   await page.emulateMedia({reducedMotion:'reduce'});
   for(const motion of ['on','system','off','on']){
    await page.evaluate(motion=>Lampa.Storage.set('lampa_view_card_motion',motion),motion);await page.waitForTimeout(260);
    const style=await face.evaluate(node=>{const s=getComputedStyle(node),halo=getComputedStyle(node,'::after');return {transform:s.transform,duration:s.transitionDuration,halo:halo.boxShadow,edge:halo.backgroundImage};});
    if(motion==='on'){assert.match(style.transform,/matrix\(1, 0, 0, 1, 0, -3\)/);assert.notEqual(style.duration,'0s');}
    else{assert.equal(style.transform,'none');assert.equal(style.duration,'0s');}
    assert.equal(style.edge,'none');assert.match(style.halo,/1px inset/);
    assert.match(style.halo,/rgba\(255, 255, 255, 0.18\)/,'All card motion modes preserve the readable glow');
    assert.equal(await page.evaluate(()=>Lampa.Storage.get('animation')),stoppedNativeAnimation,'The plugin mode does not change the host preference');
   }
   await page.evaluate(value=>Lampa.Storage.set('animation',value),nativeAnimation);
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.locator('#qa-native-unwatched').evaluate(node=>node.classList.remove('focus'));
  }
  assert.deepEqual(errors,[]);
  console.log(engine,mode,'scene sources, theme styles and poster focus passed');
 } finally {await context.close();}
}
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{for(const mode of ['desktop','tv']) await run(engine.name(),browser,mode);}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
