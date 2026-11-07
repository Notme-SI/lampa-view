const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');

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
   ...(movie?{title:'Проверка фильма',original_title:'Gallery Film',release_date:'2025-01-01'}:
    {name:'Проверка сериала',first_air_date:'2024-01-01',seasons:[{season_number:1,air_date:'2024-01-01'},{season_number:2,air_date:'2025-01-01'}]})};
  window.detailFixture={movie:card,persons:{cast:[],crew:[]},images:{backdrops:artwork},videos:{results:[]},
   ...(movie?{collection:{results:[card,{id:92,title:'Фильм 2',release_date:'2026-01-01'}]}}:
    {episodes:{name:'Суперсезон',episodes:[
     ...Array.from({length:5},(_,i)=>({season_number:2,episode_number:i+1,air_date:'2025-01-01',still_path:i===0?'/episode-cover.jpg':null})),
     {season_number:2,episode_number:6,air_date:'2099-11-13'}]}})};
  L.Activity.push({component:'full',source:'tmdb',id:card.id,method:movie?'movie':'tv',card});
 },movie);
 const row=page.locator('.activity--active .minimal-detail-screenshots');
 await row.waitFor();
 assert.equal(await row.locator('[data-minimal-screenshot]').count(),14);
 assert.equal(await row.locator('.items-line__title').textContent(),movie?'Кадры из фильма':'Кадры из сериала');
 assert.ok(await row.locator('.full-episode:not([hidden])').count()<=14);
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
    const {page,context,errors}=await setup(browser,{mode,viewport,hasTouch:mobile},{beforePlugin:page=>page.evaluate(()=>{
     Lampa.Api.full=(p,done)=>done(window.detailFixture);
    })});
    try{
     await page.route('https://film-grab.com/wp-json/wp/v2/**',route=>{
      const search=route.request().url().includes('/search?');
      const data=search?[{id:91,title:'Gallery Film'}]:{content:{rendered:'<p>Year: <span>2025</span></p>'+
       Array.from({length:25},(_,i)=>'<a href="https://film-grab.com/wp-content/uploads/photo-gallery/real-frame-'+i+'.jpg"></a>').join('')}};
      return route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
     });
     await page.route('https://film-grab.com/wp-content/uploads/photo-gallery/**',route=>route.fulfill({
      contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"></svg>'
     }));
     const row=await open(page,mobile);
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
      await activate(row.getByRole('button',{name:'Следующая страница'}));
      await page.waitForFunction(start=>document.querySelector('[data-minimal-screenshot]').getBoundingClientRect().left<start-10,start);
      await activate(row.getByRole('button',{name:'Предыдущая страница'}));
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
     if(mobile)assert.match(await viewer.locator('img').getAttribute('src'),/real-frame-0\.jpg/);
     else assert.ok((await page.evaluate(()=>frameRequests)).includes('/t/p/original/episode-still1.jpg'));
     const position=()=>viewer.locator('[aria-live]').textContent();
     const total=14;
     assert.equal(await position(),'1 / '+total);
     if(tv)await page.keyboard.press('ArrowRight');
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
     if(tv)await page.keyboard.press('ArrowLeft');else await activate(viewer.getByRole('button',{name:'Предыдущий кадр'}));
     assert.equal(await position(),'1 / '+total);
     if(tv)await page.keyboard.press('Escape');else await activate(viewer.getByRole('button',{name:'Закрыть'}));
     await viewer.waitFor({state:'hidden'});
     assert.ok(await first.evaluate(node=>node.classList.contains('focus') || document.activeElement===node));
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
     }
     assert.deepEqual(errors,[]);
     console.log(engine.name(),mode,'frames and navigation passed');
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
