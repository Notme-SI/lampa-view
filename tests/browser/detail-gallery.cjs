const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const {shardFor}=require('../../src/frame-catalogue.cjs');
const {normalize}=require('../../tools/update-frame-catalogue.cjs');

async function open(page,movie){
 await page.evaluate(movie=>{
  const L=Lampa;
  L.Layer.init();L.DeviceInput.init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();
  Navigator.follow('focus',event=>L.Controller.focus(event.elem));
  window.frameRequests=[];
  const image=L.TMDB.image;
  L.TMDB.image=(path,options)=>{frameRequests.push(path);return image(path,options);};
  L.Api.sources.tmdb.get=(path,params,done)=>{
   frameRequests.push(path);
   if(path==='tv/91/season/1')return done({episodes:[
    {season_number:1,episode_number:1,air_date:'2024-01-01',still_path:'/early-episode-cover.jpg'},
    {season_number:1,episode_number:2,air_date:'2099-01-01'}
   ]});
   if(!path.endsWith('/images?include_image_language=null'))return done({stills:[]});
   if(path.includes('/season/1/episode/1/'))return done({stills:[{file_path:'/early-episode-cover.jpg'},
    ...Array.from({length:12},(_,i)=>({file_path:'/early-scene-'+i+'.jpg',width:1920}))]});
   if(!path.includes('/episode/1/'))return done({stills:[]});
   done({stills:[{file_path:'/episode-cover.jpg'},{file_path:'/art0.jpg'},
    ...Array.from({length:9},(_,i)=>({file_path:'/episode-still'+(i+1)+'.jpg',width:1920}))]});
  };
  const artwork=Array.from({length:movie?25:6},(_,i)=>({file_path:'/art'+i+'.jpg',width:1280,aspect_ratio:16/9}));
  const card={id:91,source:'tmdb',backdrop_path:'/art0.jpg',production_countries:[],production_companies:[],spoken_languages:[],genres:[],
   ...(movie?{title:'Новый Человек-паук: Высокое напряжение',original_title:'Gallery Film',release_date:'2025-01-01'}:
    {name:'Проверка сериала',first_air_date:'2024-01-01',seasons:[{season_number:1,air_date:'2024-01-01'},{season_number:2,air_date:'2025-01-01'}]})};
  window.detailFixture={movie:card,persons:{cast:[],crew:[]},images:{backdrops:artwork},videos:{results:[]},
   ...(movie?{collection:{results:[card,{id:92,title:'Фильм 2',release_date:'2025-02-01'},
    {id:96,title:'Продолжение',release_date:'2099-01-01'}]}}:
    {episodes:{name:'Суперсезон',episodes:[
     ...Array.from({length:5},(_,i)=>({season_number:2,episode_number:i+1,air_date:'2025-01-01',still_path:i===0?'/episode-cover.jpg':null})),
     {season_number:2,episode_number:6,air_date:'2099-11-13'}]}})};
  L.Activity.push({component:'full',source:'tmdb',id:card.id,method:movie?'movie':'tv',card});
 },movie);
 const row=page.locator('.activity--active .minimal-detail-screenshots');
 await row.waitFor();
 if(await page.locator('body.pt-desktop').count()){
  const gap=await page.evaluate(()=>{const cast=document.querySelector('.minimal-detail-columns').getBoundingClientRect(),frames=document.querySelector('.minimal-detail-screenshots').getBoundingClientRect();return {distance:frames.top-cast.bottom,font:parseFloat(getComputedStyle(document.body).fontSize)};});
  assert.ok(gap.distance>=gap.font*2,JSON.stringify(gap));
 }
 assert.equal(await row.locator('[data-minimal-screenshot]').count(),15);
 assert.equal(await row.locator('.items-line__title').textContent(),movie?'Кадры из фильма':'Кадры из сериала');
 assert.ok(await row.locator('.full-episode:not([hidden])').count()<=15);
 if(movie){
  await page.getByRole('button',{name:'Связанные'}).waitFor();
  assert.equal(await page.getByText('Коллекция',{exact:true}).count(),0);
 }else{
  assert.equal(await page.getByText('Суперсезон',{exact:true}).count(),0);
  assert.equal(await page.locator('time.minimal-detail-next-episode').getAttribute('datetime'),'2099-11-13');
  const requests=await page.evaluate(()=>frameRequests);
  assert.ok(requests.includes('tv/91/season/1/episode/1/images?include_image_language=null'));
  assert.ok(requests.includes('tv/91/season/2/episode/1/images?include_image_language=null'));
  assert.ok(!requests.some(path=>path.includes('/season/2/episode/6/') || path.includes('/season/1/episode/2/')));
 }
 return row;
}

(async()=>{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   for(const mode of ['desktop','tv','mobile']){
    const mobile=mode==='mobile',tv=mode==='tv';
    const viewport=mobile?{width:390,height:844}:tv?{width:960,height:540}:{width:1280,height:800};
    const {page,context,errors}=await setup(browser,{mode,viewport,hasTouch:mobile},{beforePlugin:page=>page.evaluate(tv=>{
     Lampa.Api.full=(p,done)=>done(window.detailFixture);
     if(tv)Lampa.TMDB.image=path=>'https://frames.example'+path;
    },tv)});
    try{
     await page.route('https://notme-si.github.io/lampa-view/frames/v1/*.json',route=>{
      const name=new URL(route.request().url()).pathname.split('/').at(-1);
      const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/frames/v1',name),'utf8'));
      const fixture=normalize({media:'movie',tmdb:91,title:'Gallery Film',year:2025,source:'test',priority:1,origin:'https://frames.example/',
       frames:Array.from({length:25},(_,i)=>({url:'https://film-grab.com/wp-content/uploads/photo-gallery/real-frame-'+i+'.jpg'}))});
      const archive=normalize({media:'movie',title:'QA Archive Film',year:2025,source:'bluscreens',priority:40,origin:'https://www.bluscreens.net/',
       frames:Array.from({length:14},(_,i)=>({url:'https://www.bluscreens.net/uploads/qa-frame-'+i+'.jpg'}))});
      for(const entry of [fixture,archive])for(const key of entry.keys)if(shardFor(key)+'.json'===name){data.entries[key]=[entry.id];data.records[entry.id]=entry;}
      return route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
     });
     await page.route('https://film-grab.com/wp-content/uploads/photo-gallery/**',route=>route.fulfill({
      contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"></svg>'
     }));
     let delayedImage,selectedPaths;
     if(tv){
      await page.route('https://frames.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"></svg>'}));
     }
     const row=await open(page,mobile);
     if(tv){
      selectedPaths=await page.evaluate(()=>{
       const link=Lampa.Activity.active().activity.component,at=link.rows.findIndex(row=>row[1]?.minimal_gallery),line=link.items[at];
       return Array.from(document.querySelectorAll('[data-minimal-screenshot]')).map(node=>line.items.find(item=>item.render(true)===node).data.still_path);
      });
      delayedImage=page.waitForResponse(response=>new URL(response.url()).pathname==='/t/p/original'+selectedPaths[1],{timeout:10000});
      delayedImage.catch(()=>{});
      await page.route(url=>url.pathname==='/t/p/original'+selectedPaths[1],async route=>{
       await new Promise(resolve=>setTimeout(resolve,800));
       await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"></svg>'});
      });
     }
     const stills=row.locator('[data-minimal-screenshot]'),first=stills.first();
     await page.evaluate(()=>Lampa.Activity.active().activity.component.scroll.immediate(document.querySelector('.minimal-detail-screenshots')));
     async function activate(locator){
      if(!mobile)return locator.click();
      if(engine===chromium)return locator.tap();
      await locator.click({trial:true});
      const point=await locator.evaluate(node=>{
       const r=node.getBoundingClientRect();
       return {x:r.left+r.width/2,y:r.top+r.height/2,width:innerWidth};
      });
      // WebKit applies a page zoom to this Lampa fixture.
      const scale=viewport.width/point.width;
      await page.touchscreen.tap(point.x*scale,point.y*scale);
     }
     if(!tv){
      const start=await first.evaluate(node=>node.getBoundingClientRect().left);
      assert.equal(await row.getByRole('button',{name:'Следующая страница'}).count(),0);
      const scroll=row.locator('.scroll--horizontal');
      async function swipe(direction){
       if(!mobile){await scroll.hover();await page.mouse.wheel(direction*300,0);return;}
       assert.equal(await scroll.evaluate(node=>getComputedStyle(node).overflowX),'auto','Touch devices use native horizontal overflow');
       // Synthetic touch events do not invoke browser-native scrolling.
       await scroll.evaluate((node,direction)=>{node.scrollLeft+=direction*200;},direction);
      }
      await swipe(1);
      await page.waitForFunction(start=>document.querySelector('[data-minimal-screenshot]').getBoundingClientRect().left<start-10,start);
      await page.waitForFunction(()=>!document.body.classList.contains('pt-wheel-active'));
      await swipe(-1);
      await page.waitForFunction(start=>document.querySelector('[data-minimal-screenshot]').getBoundingClientRect().left>=start-3,start);
      await activate(first);
     }else{
      await page.evaluate(()=>{
       const link=Lampa.Activity.active().activity.component;
       link.active=link.rows.findIndex(row=>row[0]==='episodes');link.items[link.active].toggle();
      });
      await page.keyboard.press('Enter');
     }
     const viewer=page.locator('.minimal-frame-viewer');
     await viewer.waitFor();
     await page.waitForFunction(()=>{const viewer=document.querySelector('.minimal-frame-viewer'),image=viewer?.querySelector('img');return viewer?.getAttribute('aria-busy')==='false' && image?.complete && image.naturalWidth>0;});
     if(mobile)assert.match(await viewer.locator('img').getAttribute('src'),/real-frame-\d+\.jpg/);
     else assert.ok((await page.evaluate(()=>frameRequests)).some(path=>path.startsWith('/t/p/original/')));
     const position=()=>viewer.locator('[aria-live]').textContent();
     const total=15;
     assert.equal(await position(),'1 / '+total);
     for(const theme of ['minimal','glass']){
      await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
      // Measure the settled modal after Lampa finishes its opening animation.
      await viewer.evaluate(node=>Promise.allSettled(node.closest('.modal__content').getAnimations().map(animation=>animation.finished)));
      const bounds=await viewer.evaluate(node=>{const r=node.getBoundingClientRect(),close=node.querySelector('.minimal-frame-close').getBoundingClientRect(),next=node.querySelector('.minimal-frame-next').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,inside:r.left>=0 && r.right<=innerWidth+1 && r.top>=0 && r.bottom<=innerHeight+1,separated:close.bottom+8<next.top};});
      assert.ok(bounds.inside && (tv || mobile || bounds.separated),'Viewer and separate controls fit '+theme+' '+mode+': '+JSON.stringify(bounds));
      const close=await viewer.locator('.minimal-frame-close').boundingBox(),canvas=await viewer.boundingBox();
      if(tv || mobile)assert.equal(close,null,'TV and phone have no on-screen close button');else assert.ok(close.x<canvas.x+canvas.width/2,'Close stays on the left');
      const space=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
      const width=Math.min(space.width*(mobile?.95:.5),space.height*8/9);
      assert.ok(canvas.width<=width+3 && canvas.width>width*.82 && canvas.height<=space.height*.5+3,'The centered viewer stays within the compact size: '+JSON.stringify({canvas,space,viewport}));
      assert.ok(Math.abs(canvas.x+canvas.width/2-space.width/2)<3);
      assert.equal(await viewer.locator('.minimal-frame-control[title]').count(),0);
     }
     if(tv){
      assert.equal(await viewer.locator('.minimal-frame-next').isVisible(),false);
      assert.equal(await viewer.locator('.minimal-frame-prev').isVisible(),false);
      await page.keyboard.press('ArrowRight');
     }
     else if(mobile)await viewer.evaluate(node=>{
      const event=(name,x)=>{
       const touch={identifier:1,target:node,clientX:x,clientY:100};
       const event=new Event(name,{bubbles:true,cancelable:true});
       Object.defineProperties(event,{touches:{value:name==='touchstart'?[touch]:[]},changedTouches:{value:[touch]}});
       node.dispatchEvent(event);
      };
      event('touchstart',280);event('touchend',120);
     });
     else await viewer.getByRole('button',{name:'Следующий кадр'}).click();
     assert.equal(await position(),'2 / '+total);
     if(tv || mobile)await page.keyboard.press('ArrowLeft');else await activate(viewer.getByRole('button',{name:'Предыдущий кадр'}));
     assert.equal(await position(),'1 / '+total);
     if(tv){
      await page.keyboard.press('ArrowUp');assert.equal(await viewer.locator('.minimal-frame-close.focus').count(),0);
      await page.keyboard.press('ArrowDown');assert.equal(await viewer.locator('.minimal-frame-close.focus').count(),0);
      await page.keyboard.press('ArrowRight');assert.equal(await position(),'2 / '+total);
      await page.keyboard.press('ArrowRight');assert.equal(await position(),'3 / '+total);
      await page.waitForFunction(path=>document.querySelector('.minimal-frame-viewer img')?.getAttribute('src')?.endsWith(path),selectedPaths[2]);
      await delayedImage;
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.ok((await viewer.locator('img').getAttribute('src')).endsWith(selectedPaths[2]),'A slow previous image cannot replace the selected frame');
      const canvas=await viewer.boundingBox();
      await page.keyboard.press('ArrowLeft');assert.equal(await position(),'2 / '+total);
      await page.waitForFunction(path=>document.querySelector('.minimal-frame-viewer img')?.getAttribute('src')?.endsWith(path),selectedPaths[1]);
      assert.deepEqual(await viewer.boundingBox(),canvas,'Image aspect ratio cannot resize the viewer');
      await page.keyboard.press('ArrowLeft');assert.equal(await position(),'1 / '+total);
     }
     if(tv)await page.keyboard.press('Escape');else if(mobile){assert.equal(await viewer.locator('button:visible').count(),0);assert.equal(await page.locator('.navigation-bar').isVisible(),false);await page.locator('.modal').click({position:{x:5,y:5}});}else await activate(viewer.getByRole('button',{name:'Закрыть'}));
     await viewer.waitFor({state:'hidden'});
     assert.equal(await page.locator('body.pt-frame-open').count(),0,'Closing restores the normal mobile navigation state');
     assert.ok(await first.evaluate(node=>node.classList.contains('focus') || document.activeElement===node));
     if(tv){
      await stills.evaluateAll(nodes=>nodes.forEach((node,index)=>{node.hidden=index>0;}));
      await page.keyboard.press('Enter');await viewer.waitFor();
      assert.equal(await position(),'1 / 1');
      assert.equal(await viewer.locator('.minimal-frame-next').isVisible(),false);
      await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');
      assert.equal(await viewer.locator('.minimal-frame-close.focus').count(),0,'TV never focuses a hidden close button');
      assert.equal(await viewer.locator('.minimal-frame-control:visible').count(),0,'Single-frame TV viewer has no on-screen controls');
      await page.keyboard.press('Enter');await viewer.waitFor({state:'hidden'});
      await stills.evaluateAll(nodes=>nodes.forEach(node=>{node.hidden=false;}));
      await page.keyboard.press('Enter');await viewer.waitFor();
      await page.keyboard.press('ArrowRight');assert.equal(await position(),'2 / '+total,'The remote still advances after closing and reopening');
      await page.keyboard.press('Enter');await viewer.waitFor({state:'hidden'});
     }
     if(mobile){
      const related=page.getByRole('button',{name:'Связанные'});
      await page.evaluate(()=>Lampa.Activity.active().activity.component.scroll.immediate(document.querySelector('.minimal-anime-franchise')));
      await activate(related);
      const menu=page.locator('.minimal-franchise-menu');
      const current=menu.locator('[aria-current="true"]');
      await current.waitFor();
      const geometry=await current.evaluate(node=>{
       const info=node.querySelector('.minimal-related-info').getBoundingClientRect();
       const mark=node.querySelector('.minimal-related-mark');
       const bounds=mark.getBoundingClientRect(),row=node.getBoundingClientRect();
       return {right:info.right,left:bounds.left,center:bounds.top+bounds.height/2,rowCenter:row.top+row.height/2,
        native:getComputedStyle(node,'::after').content,own:getComputedStyle(mark,'::before').content};
      });
      assert.ok(geometry.right<geometry.left && Math.abs(geometry.center-geometry.rowCenter)<1);
      assert.equal(geometry.native,'none');
      assert.notEqual(geometry.own,'none');
      const headings=await menu.locator('.minimal-season-section,.selectbox-item__title').allTextContents();
      assert.ok(headings.indexOf('Фильм 2')<headings.indexOf('Продолжения и анонсы'));
      assert.ok(headings.indexOf('Продолжение')>headings.indexOf('Продолжения и анонсы'));
      assert.match(await menu.locator('.selectbox-item').filter({hasText:'Продолжение'}).textContent(),/2099.*Анонс/);
     }
     if(mode==='desktop'){
      await page.evaluate(()=>{
       Lampa.Api.sources.tmdb.get=(path,p,done)=>done({stills:[{file_path:'/episode-cover.jpg'}]});
       const card={...detailFixture.movie,id:93,name:'Сериал без кадров'};
       detailFixture={...detailFixture,movie:card};
       Lampa.Activity.push({component:'full',source:'tmdb',id:card.id,method:'tv',card});
      });
      const active=page.locator('.activity--active');
      await active.locator('.full-start-new__title').filter({hasText:'Сериал без кадров'}).waitFor();
      assert.equal(await active.locator('.minimal-detail-screenshots,.full-episode').count(),0);
      assert.equal(await active.getByText('Суперсезон',{exact:true}).count(),0);
      assert.equal(await active.locator('time.minimal-detail-next-episode').getAttribute('datetime'),'2099-11-13');

      const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'X-API-KEY'};
      await page.route('https://api.poiskkino.dev/v1.5/**',route=>{
       if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
       const url=new URL(route.request().url());
       if(url.pathname.endsWith('/movie')){
        assert.equal(url.searchParams.get('externalId.imdb'),'tt0000910');
        return route.fulfill({headers:cors,json:{docs:[{id:201,isSeries:false,externalId:{imdb:'tt0000910'}}]}});
       }
       assert.ok(url.searchParams.getAll('type').includes('still'));
       const base='https://frames.example.invalid/';
       return route.fulfill({headers:cors,json:{docs:[
        {movieId:201,type:'backdrops',url:base+'promo.jpg',width:3840},
        {movieId:201,type:'still',url:base+'original.jpg',previewUrl:base+'thumb.jpg',width:1920}
       ]}});
      });
      await page.route('https://frames.example.invalid/**',route=>route.request().url().endsWith('/thumb.jpg')?
       route.fulfill({status:403}):route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"></svg>'}));
      await page.evaluate(()=>{
       Lampa.Storage.set('minimal_poiskkino_frames_key','test-fixture');
       const movie={id:94,source:'tmdb',title:'Другой фильм',original_title:'Gallery Alternate',release_date:'2025-01-01',imdb_id:'tt0000910',
        production_countries:[],production_companies:[],spoken_languages:[],genres:[]};
       detailFixture={movie,persons:{cast:[],crew:[]},videos:{results:[]}};
       Lampa.Activity.push({component:'full',source:'tmdb',id:movie.id,method:'movie',card:movie});
      });
      const recovered=active.locator('.minimal-detail-screenshots');
      await recovered.waitFor();
      assert.equal(await recovered.locator('[data-minimal-screenshot]').count(),1);
      await page.evaluate(()=>Lampa.Activity.active().activity.component.scroll.immediate(document.querySelector('.activity--active .minimal-detail-screenshots')));
      await page.waitForFunction(()=>{
       const image=document.querySelector('.activity--active [data-minimal-screenshot] img');
       return image?.naturalWidth===1920 && image.currentSrc.endsWith('/original.jpg');
      });

      await page.route('https://www.bluscreens.net/uploads/**',route=>route.fulfill({
       contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"></svg>'
      }));
      await page.evaluate(()=>{
       Lampa.Storage.set('minimal_poiskkino_frames_key','');
       window.openArchiveFilm=year=>{
        const movie={id:year,source:'tmdb',title:'Архивный фильм '+year,original_title:'QA Archive Film',release_date:year+'-02-14',
         production_countries:[],production_companies:[],spoken_languages:[],genres:[]};
        detailFixture={movie,persons:{cast:[],crew:[]},videos:{results:[]}};
        Lampa.Activity.push({component:'full',source:'tmdb',id:movie.id,method:'movie',card:movie});
       };
       openArchiveFilm(2025);
      });
      await recovered.waitFor();
      assert.equal(await recovered.locator('[data-minimal-screenshot]').count(),14);
      await page.evaluate(()=>Lampa.Activity.active().activity.component.scroll.immediate(document.querySelector('.activity--active .minimal-detail-screenshots')));
      await page.waitForFunction(()=>{
       const image=document.querySelector('.activity--active [data-minimal-screenshot] img');
       return image?.naturalWidth===800 && image.currentSrc.includes('bluscreens.net');
      });
      await page.evaluate(()=>openArchiveFilm(2024));
      await active.locator('.full-start-new__title').filter({hasText:'Архивный фильм 2024'}).waitFor();
      assert.equal(await recovered.count(),0);
     }
     assert.deepEqual(errors,[]);
     console.log(engine.name(),mode,'frames and navigation passed');
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
