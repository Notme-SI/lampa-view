const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 try{for(const mode of ['desktop','tv']){
  const r=await setup(browser,{mode,viewport:{width:1280,height:720},reducedMotion:'no-preference'},{beforePlugin:page=>page.evaluate(()=>{
   const L=Lampa;L.Params.init();L.Layer.init();L.Search.init();L.Menu.ready();L.DeviceInput.init();L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
   document.querySelector('.wrap').classList.add('layer--height','layer--width');document.querySelector('.wrap__content').classList.add('layer--height');L.Layer.update();
   L.Storage.set('lampa_view_theme','glass');L.Storage.set('animation',true);
   L.TMDB.image=p=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="'+(p.includes('banner1')?'#744351':'#284e69')+'"/><text x="80" y="180" fill="white" font-size="70">'+p.replace(/[<>&]/g,'')+'</text></svg>');
   L.Api.main=(q,ok)=>setTimeout(()=>ok(Array.from({length:5},(_,row)=>({title:'Подборка '+row,url:'qa/'+row,results:Array.from({length:24},(_,i)=>({id:row*100+i+1,title:'Фильм '+i,overview:'Описание фильма для проверки плавности интерфейса.',poster_path:'/poster'+i+'.jpg',backdrop_path:'/banner'+i+'.jpg',release_date:'2025-01-01',genre_ids:[18],source:'tmdb'}))}))),0);
   L.Api.full=(p,ok)=>setTimeout(()=>ok({movie:{id:p.id,title:'Фильм',overview:'Описание',backdrop_path:'/banner0.jpg',release_date:'2025-01-01',production_companies:[],production_countries:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{cast:[],crew:[]},images:{logos:[]},discuss:{result:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}}),0);
  })});
  try{
   const {page}=r;await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));
   await page.waitForSelector('.activity--active .pt-hero__image[src]');await page.waitForTimeout(450);
   const hero=page.locator('.activity--active .pt-hero');assert.equal(await hero.count(),1);
   const firstSrc=await hero.locator('.pt-hero__image').getAttribute('src');
   await hero.locator('.pt-hero__dot').nth(1).evaluate(n=>jQuery(n).trigger('hover:enter'));
   await page.waitForFunction(src=>{const image=document.querySelector('.activity--active .pt-hero__image');return image.src!==src && image.complete && image.naturalWidth>0;},firstSrc);
   await page.waitForTimeout(350);assert.equal(await page.locator('.pt-hero__previous').count(),0);
   const card=page.locator('.activity--active .card').first();await card.evaluate(n=>n.classList.add('focus'));await page.waitForTimeout(250);
   const transform=await card.locator('.card__view').evaluate(n=>getComputedStyle(n).transform);
   await page.evaluate(()=>document.body.classList.add('pt-wheel-active'));
   assert.equal(await card.locator('.card__view').evaluate(n=>getComputedStyle(n).transform),transform,'Starting scroll preserves the selected poster lift');
   await page.evaluate(()=>{document.body.classList.remove('pt-wheel-active');document.dispatchEvent(new Event('minimal:wheel-idle'));});
   const grid=page.locator('.activity--active .pt-browser-catalogue');const top=await grid.evaluate(n=>n.scrollTop);
   await page.evaluate(()=>{document.body.appendChild(Lampa.Search.render(true));Lampa.Search.open({sources:[{title:'TMDB',params:{},search(p,ok){ok([]);}}]});});await page.waitForSelector('.main-search .simple-keyboard-input');
   await page.evaluate(()=>Lampa.Search.close());await page.waitForTimeout(200);assert.equal(await grid.evaluate(n=>n.scrollTop),top,'Search close preserves the page position');
   if(process.env.LAMPA_QA_OUTPUT)await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,'preview-'+mode+'.png')});
   assert.deepEqual(r.errors,[]);console.log(mode+': native home hero, slide change, poster continuity and search return PASS');
  }finally{await r.context.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
