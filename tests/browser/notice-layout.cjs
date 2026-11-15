const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
const fixture=path.join(__dirname,'../fixtures/lampa-runtime/current-menu');
const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1';
const profiles=[{name:'iphone-standalone',ua:ios,standalone:true},{name:'iphone-browser',ua:ios},{name:'android',ua:'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'},{name:'desktop',desktop:true,ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'}];
(async()=>{for(const engine of [chromium,webkit].filter(e=>!process.env.QA_ENGINE||e.name()===process.env.QA_ENGINE)){
 const browser=await engine.launch({headless:true});try{for(const profile of profiles.filter(p=>(engine!==webkit||p.name!=='android')&&(!process.env.QA_PROFILE||p.name===process.env.QA_PROFILE))){
  const r=await setup(browser,{mode:profile.desktop?'desktop':'auto',viewport:profile.desktop?{width:1440,height:900}:{width:393,height:852},hasTouch:!profile.desktop,isMobile:!profile.desktop,deviceScaleFactor:profile.desktop?1:3,userAgent:profile.ua},{app:path.join(fixture,'app.js.gz'),css:path.join(fixture,'app.css.gz'),plugin:process.env.LAMPA_QA_PLUGIN,beforePlugin:p=>p.evaluate(async standalone=>{
   Object.defineProperty(navigator,'standalone',{value:!!standalone});const L=Lampa;await L.Cache.openDatabase();L.Platform.init();L.Params.init();L.Storage.set('animation',false);L.Menu.ready();L.Notice.init();L.Search.init();L.Layer.init();
  },profile.standalone)}),p=r.page;p.setDefaultTimeout(5000);
  try{
   await p.route('https://notice.example.invalid/poster.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90"><rect width="60" height="90" fill="#345"/></svg>'}));
   const variants=profile.desktop?[{width:1440,height:900,size:'normal'}]:[{width:320,height:852,size:'small'},{width:393,height:852,size:'normal'},{width:430,height:852,size:'bigger'},{width:852,height:393,size:'normal'}];
   for(const v of variants.filter(v=>!process.env.QA_WIDTH||v.width===Number(process.env.QA_WIDTH)))for(const theme of ['minimal','glass']){
    await p.setViewportSize({width:v.width,height:v.height});await p.evaluate(({size,theme,safe})=>{Lampa.Storage.set('interface_size',size);Lampa.Storage.set('lampa_view_theme',theme);document.body.style.setProperty('--pt-safe-top',safe?'60px':'0px');},{...v,theme,safe:profile.standalone});await p.waitForTimeout(170);
    await p.evaluate(()=>{Lampa.Notice.display='cub';Lampa.Notice.get('cub').notices=Array.from({length:20},(_,i)=>({id:'qa-'+i,title:'Уведомление '+(i+1),text:'Вышла новая серия. Длинное описание уведомления для проверки переноса текста и доступности последнего пункта списка.',time:Date.now()-i*60000,poster:'https://notice.example.invalid/poster.svg',labels:['Сезон 1','Серия '+(i+1)],author:{ru:{name:'Автор',text:'Информация о премьере'}}}));Lampa.Notice.open();});
    await p.waitForSelector('.pt-notices .notice--card');
    const metrics=await p.locator('.pt-notices .modal__content').evaluate(n=>{const b=n.getBoundingClientRect(),font=s=>parseFloat(getComputedStyle(n.querySelector(s)).fontSize),sc=n.querySelector('.modal__body>.scroll'),nav=document.querySelector('.navigation-bar');return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,font:parseFloat(getComputedStyle(n).fontSize),title:font('.notice__title'),text:font('.notice__descr'),time:font('.notice__time'),tab:font('.navigation-tabs__button'),tabHeight:n.querySelector('.navigation-tabs__button').getBoundingClientRect().height,nav:nav?.getBoundingClientRect().top,scroll:sc.clientHeight,body:sc.scrollHeight,viewport:innerWidth,scale:parseFloat(getComputedStyle(document.body).getPropertyValue('--pt-interface-scale'))};});
    if(process.env.QA_MEASURE_ONLY){console.log(JSON.stringify({engine:engine.name(),profile:profile.name,...v,theme,...metrics}));}
    else if(profile.desktop){assert.ok(metrics.title>=17 && metrics.text>=14,'Desktop notices are slightly larger '+JSON.stringify(metrics));}
    else{
     assert.ok(metrics.title>=14 && metrics.text>=14 && metrics.time>=12 && metrics.tab>=14,JSON.stringify({profile:profile.name,v,theme,metrics}));
     assert.ok(Math.abs(metrics.font-16*metrics.scale)<.2,'Notification type follows the standard interface size');
     assert.ok(metrics.bottom<=metrics.nav+1 && metrics.top>=0 && metrics.left>=0 && metrics.right<=metrics.viewport+1,'Phone notification panel stays above dock '+JSON.stringify({profile:profile.name,v,theme,metrics}));
     assert.ok(metrics.tabHeight>=43.9 && metrics.body>metrics.scroll && metrics.scroll>30,JSON.stringify(metrics));
     await p.locator('.pt-notices .modal__body>.scroll').evaluate(n=>{n.Scroll.shift(1000000);});
     const last=await p.locator('.pt-notices .notice--card').last().evaluate(n=>{const b=n.getBoundingClientRect(),sc=n.closest('.scroll').getBoundingClientRect(),nav=document.querySelector('.navigation-bar').getBoundingClientRect();return {top:b.top,bottom:b.bottom,viewportTop:sc.top,viewportBottom:sc.bottom,nav:nav.top};});
     assert.ok(last.bottom<=last.viewportBottom+2 && last.bottom<=last.nav+1 && last.top<last.viewportBottom,'Last notification remains reachable '+JSON.stringify(last));
    }
    if(process.env.LAMPA_QA_OUTPUT && v.width===393 && theme==='glass'){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await p.waitForTimeout(350);await p.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-'+profile.name+'.png')});}
    await p.evaluate(()=>Lampa.Notice.close());await p.waitForFunction(()=>!document.querySelector('.pt-notices'));
   }
   assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+profile.name+': notice type, dock clearance and native scroll PASS');
  }finally{await r.context.close();}
 }}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
