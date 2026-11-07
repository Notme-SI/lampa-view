const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');

async function open(page,movie){
 await page.evaluate(movie=>{
  const L=Lampa;
  L.Layer.init();L.DeviceInput.init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();
  Navigator.follow('focus',event=>L.Controller.focus(event.elem));
  window.frameRequests=[];
  L.Api.sources.tmdb.get=(path,params,done)=>{
   frameRequests.push(path);
   done({stills:[{file_path:'/episode-still2.jpg'},{file_path:'/episode-still3.jpg'}]});
  };
  const artwork=Array.from({length:movie?25:6},(_,i)=>({file_path:'/art'+i+'.jpg',width:1280,aspect_ratio:16/9}));
  const card={id:91,source:'tmdb',production_countries:[],production_companies:[],spoken_languages:[],genres:[],
   ...(movie?{title:'Проверка фильма',release_date:'2025-01-01'}:{name:'Проверка сериала',first_air_date:'2025-01-01'})};
  L.Api.full=(p,done)=>done({movie:card,persons:{cast:[],crew:[]},images:{backdrops:artwork},videos:{results:[]},
   ...(movie?{}:{episodes:{episodes:[{season_number:1,episode_number:1,air_date:'2025-01-01',still_path:'/episode-still1.jpg'}]}})});
  L.Activity.push({component:'full',source:'tmdb',id:card.id,method:movie?'movie':'tv',card});
 },movie);
 const row=page.locator('.activity--active .minimal-detail-screenshots');
 await row.waitFor();
 assert.equal(await row.locator('[data-minimal-screenshot]').count(),movie?20:9);
 assert.equal(await row.locator('.items-line__title').textContent(),movie?'Кадры из фильма':'Кадры из сериала');
 assert.ok(await row.locator('.full-episode:not([hidden])').count()<=20);
 if(!movie)assert.ok((await page.evaluate(()=>frameRequests)).includes('tv/91/season/1/episode/1/images'));
 return row;
}

(async()=>{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   for(const mode of ['desktop','tv','mobile']){
    const mobile=mode==='mobile',tv=mode==='tv';
    const viewport=mobile?{width:390,height:844}:tv?{width:960,height:540}:{width:1280,height:800};
    const {page,context,errors}=await setup(browser,{mode,viewport,hasTouch:mobile});
    try{
     const row=await open(page,mobile);
     const stills=row.locator('[data-minimal-screenshot]'),first=stills.first();
     await page.evaluate(()=>Lampa.Activity.active().activity.component.scroll.immediate(document.querySelector('.minimal-detail-screenshots')));
     async function activate(locator){
      if(!mobile)return locator.click();
      if(engine===chromium)return locator.tap();
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
     const position=()=>viewer.locator('[aria-live]').textContent();
     const total=mobile?20:9;
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
     assert.deepEqual(errors,[]);
     console.log(engine.name(),mode,'frames and navigation passed');
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
