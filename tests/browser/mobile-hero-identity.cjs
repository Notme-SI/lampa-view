const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
const fixture=path.join(__dirname,'../fixtures/lampa-runtime/current-menu');
const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1';
(async()=>{for(const engine of [chromium,webkit].filter(e=>!process.env.QA_ENGINE||e.name()===process.env.QA_ENGINE)){
 const browser=await engine.launch({headless:true});try{for(const phone of ['iphone','android'].filter(p=>(engine!==webkit||p==='iphone')&&(!process.env.QA_PHONE||p===process.env.QA_PHONE))){
  const r=await setup(browser,{mode:'auto',viewport:{width:393,height:852},hasTouch:true,isMobile:true,deviceScaleFactor:3,userAgent:phone==='iphone'?ios:'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'},{app:path.join(fixture,'app.js.gz'),css:path.join(fixture,'app.css.gz'),plugin:process.env.LAMPA_QA_PLUGIN,beforePlugin:p=>p.evaluate(()=>{
   const L=Lampa;L.Platform.init();L.Params.init();L.Layer.init();L.Menu.ready();L.Storage.set('animation',false);
   L.TMDB.image=p=>'https://hero-identity.example.invalid/'+p.replace(/^\//,'');
   window.qaCards=[91,92,93].map((id,i)=>({id,title:['Первый фильм','Длинное название без логотипа','Третий фильм'][i],original_title:'Film '+id,overview:'Описание фильма для проверки логотипа на мягком краю баннера.',poster_path:'/poster-'+id+'.jpg',backdrop_path:'/cover-'+id+'.jpg',release_date:'2025-01-01',vote_average:8,source:'tmdb'}));
   const movie=id=>({...qaCards.find(c=>c.id===Number(id)),production_countries:[],production_companies:[],spoken_languages:[],genres:[],runtime:120});
   const images=id=>({logos:Number(id)===92?[]:[{file_path:'/logo-'+id+'.png',iso_639_1:Number(id)===93?'en':'ru'}]});
   L.Api.main=(p,ok)=>ok([{title:'Сейчас смотрят',url:'qa/0',results:qaCards}]);
   const get=L.Api.sources.tmdb.get;L.Api.sources.tmdb.get=(url,params,ok,fail,options)=>{const m=url.match(/^(?:movie|tv)\/(9[123])(?:\?|$)/);return m?ok({...movie(m[1]),images:images(m[1])}):get.call(L.Api.sources.tmdb,url,params,ok,fail,options);};
   L.Api.full=(p,ok)=>ok({movie:movie(p.id),persons:{cast:[],crew:[]},discuss:{result:[]},images:images(p.id),videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
  })}),p=r.page;p.setDefaultTimeout(6000);
  try{
   await p.route('https://hero-identity.example.invalid/**',route=>{const logo=route.request().url().includes('/logo-');return route.fulfill({contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'},body:logo?'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><text x="300" y="145" fill="white" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="80">НАЗВАНИЕ</text></svg>':'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g"><stop stop-color="#145a6e"/><stop offset="1" stop-color="#a07159"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><path d="m0 600 260-350 230 240 210-300 300 410h280v120H0Z" fill="#25444d"/></svg>'});});
   await p.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));await p.waitForSelector('.activity--active .pt-hero__dot');
   const choose=async index=>{await p.locator('.activity--active .pt-hero__dot').nth(index).evaluate(n=>Lampa.Utils.trigger(n,'hover:enter'));await p.waitForFunction(index=>document.querySelector('.activity--active .pt-hero__dot[aria-pressed=true]')===document.querySelectorAll('.activity--active .pt-hero__dot')[index],index);};
   const inspect=()=>p.locator('.activity--active .pt-hero').evaluate(n=>{const rect=n=>n.getBoundingClientRect().toJSON(),art=n.querySelector('.pt-hero__artwork'),body=n.querySelector('.pt-hero__body'),brand=n.querySelector('.pt-hero__branding');return {hero:rect(n),art:rect(art),brand:rect(brand),body:rect(body),font:parseFloat(getComputedStyle(body).fontSize),rootFont:parseFloat(getComputedStyle(document.body).fontSize),logo:getComputedStyle(n.querySelector('.pt-hero__logo')).display,title:getComputedStyle(n.querySelector('.pt-hero__title')).display,mask:getComputedStyle(art).maskImage||getComputedStyle(art).webkitMaskImage};});
   const fonts=[];
   for(const [theme,size,width] of [['minimal','small',320],['glass','normal',393],['minimal','bigger',430],['glass','normal',852]]){
    await p.setViewportSize({width,height:width===852?393:852});await p.evaluate(({theme,size})=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.Storage.set('interface_size',size);},{theme,size});await p.waitForTimeout(180);
    for(const i of [0,1,2]){
     await choose(i);
     if(i!==1)await p.waitForFunction(()=>{const n=document.querySelector('.activity--active .pt-hero__logo');return n&&!n.classList.contains('pt-hidden')&&n.complete&&n.naturalWidth>0;});
     const b=await inspect();
     assert.ok(b.art.height>0&&Math.abs(b.art.width/b.art.height-16/9)<.02,'Carousel retains its banner ratio '+JSON.stringify(b));
     assert.ok(b.brand.top<b.art.bottom-4&&b.brand.bottom>b.art.bottom,'Mobile identity crosses the soft banner edge '+JSON.stringify({theme,size,width,i,b}));
     assert.ok(b.body.bottom<=b.hero.bottom+1&&b.brand.left>=b.hero.left&&b.brand.right<=b.hero.right+1,'Normal-flow content remains inside the carousel');
     assert.ok(Math.abs(b.font-b.rootFont)<.1,'Mobile carousel respects native interface type instead of shrinking it '+JSON.stringify(b));
     assert.ok(i===1?b.title!=='none':b.logo!=='none','A missing logo retains a readable title');
     if(i===0&&width!==852)fonts.push(b.font);
     if(process.env.LAMPA_QA_OUTPUT&&width===393&&i===0){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await p.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-'+phone+'-carousel.png')});}
    }
   }
   assert.ok(fonts[0]<fonts[1]&&fonts[1]<fonts[2],JSON.stringify(fonts));
   await p.setViewportSize({width:393,height:852});await p.evaluate(()=>{Lampa.Storage.set('interface_size','normal');Lampa.Storage.set('lampa_view_theme','glass');});await choose(0);
   const setting=await p.evaluate(()=>{const d=Lampa.SettingsApi.getParam('minimal_settings_appearance').find(d=>d.param.name==='card_interfice_cover');return {default:d.param.default,name:d.field.name};});assert.equal(setting.default,true);assert.equal(setting.name,'Баннер в карточке');
   await p.locator('.activity--active .pt-hero__branding').dispatchEvent('click');await p.waitForSelector('.activity--active .minimal-detail-logo.loaded');
   const detail=()=>p.locator('.activity--active .minimal-detail-header').evaluate(n=>{const bg=n.querySelector('.full-start__background'),logo=n.querySelector('.minimal-detail-logo');return {banner:getComputedStyle(bg).display!=='none'&&bg.getBoundingClientRect().height>0,logo:getComputedStyle(logo).display!=='none'&&logo.getBoundingClientRect().height>0,body:n.querySelector('.full-start-new__body').getBoundingClientRect().top,top:n.getBoundingClientRect().top,controls:n.querySelectorAll('.full-start__button').length};});
   assert.equal((await detail()).banner,true,'Title page starts with its banner enabled');
   for(const enabled of [false,true,false]){
    await p.evaluate(enabled=>{const d=Lampa.SettingsApi.getParam('minimal_settings_appearance').find(d=>d.param.name==='card_interfice_cover');Lampa.Storage.set('card_interfice_cover',enabled);d.onChange();},enabled);
    const d=await detail();assert.equal(d.banner,enabled);assert.ok(d.logo&&d.controls>0,'Title logo and native controls survive hiding the banner');if(!enabled)assert.ok(d.body>=d.top-1,'Hidden artwork leaves no negative overlap');
   }
   await p.evaluate(()=>Lampa.Activity.backward());await p.waitForSelector('.activity--active .pt-hero');assert.ok((await inspect()).art.height>0,'Disabling detail artwork leaves carousel artwork visible');
   await choose(0);await p.locator('.activity--active .pt-hero__branding').dispatchEvent('click');await p.waitForSelector('.activity--active .minimal-detail-logo.loaded');assert.equal((await detail()).banner,false,'The cover preference survives reopening the title page');
   if(process.env.LAMPA_QA_OUTPUT)await p.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-'+phone+'-detail-logo-only.png')});
   assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+phone+': carousel overlap, logo/title fallback, native sizing and detail-only cover preference PASS');
  }finally{await r.context.close();}
 }}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
