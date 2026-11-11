const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const devices=[
 {name:'iPhone',mode:'auto',width:393,height:852,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1'},
 {name:'Android',mode:'auto',width:412,height:915,userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'},
 {name:'iPad desktop UA',mode:'auto',width:834,height:1194,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15'},
 {name:'Tablet setting',mode:'tablet',width:800,height:1100,userAgent:'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'}
];
async function run(browser,device,theme){
 const r=await setup(browser,{...device,viewport:{width:device.width,height:device.height},isMobile:true,hasTouch:true},{
  beforePlugin:page=>page.evaluate(standalone=>{
   if(standalone)Object.defineProperty(navigator,'standalone',{value:true});
   Lampa.Params.init();Lampa.Menu.ready();Lampa.Search.init();Lampa.DeviceInput.init();Lampa.Layer.init();
   document.querySelector('.wrap').classList.add('layer--height','layer--width');
   document.querySelector('.wrap__content').classList.add('layer--height','layer--width');
   const movies=Array.from({length:20},(_,i)=>({id:i+1,title:'Фильм '+i,overview:'Описание',poster_path:'/p.jpg',backdrop_path:'/b.jpg',source:'tmdb'}));
   Lampa.Api.main=(p,ok)=>ok(Array.from({length:3},(_,i)=>({title:'Ряд '+i,url:'qa/'+i,results:movies})));
  },device.name==='iPhone' || device.name==='iPad desktop UA')
 });
 try{
  const {page}=r;
  await page.evaluate(theme=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.Activity.push({component:'main',source:'tmdb'});},theme);
  await page.waitForSelector('.activity--active .pt-hero');
  for(const viewport of [{width:device.width,height:device.height},{width:device.height,height:device.width},{width:device.width,height:device.height}]){
   await page.setViewportSize(viewport);
   await page.waitForTimeout(600);
   assert.equal(await page.evaluate(()=>LampaView.layout),'mobile',device.name);
   assert.deepEqual(await page.locator('.navigation-bar__item').evaluateAll(nodes=>nodes.map(n=>n.dataset.action)),['back','menu','main','settings']);
   for(const selector of ['.head__menu-icon','.head__backward','.head .open--home','.head .open--settings'])assert.equal(await page.locator(selector).isVisible(),false);
   const geometry=await page.evaluate(()=>{
    const box=s=>document.querySelector(s).getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,wrap:box('.wrap').width,
     art:box('.activity--active .pt-hero__artwork').width,
     scroll:box('.activity--active > .activity__body .scroll:not(.scroll--horizontal)').bottom,
     opacity:getComputedStyle(document.querySelector('.activity--active .activity__body')).opacity,
     direction:getComputedStyle(document.querySelector('.navigation-bar__body')).flexDirection,
     search:box('.head .open--search').toJSON(),nav:box('.navigation-bar').toJSON()};
   });
   assert.ok(Math.abs(geometry.width-geometry.wrap)<2 && geometry.art>geometry.width*.9,JSON.stringify({device,geometry}));
   assert.equal(geometry.opacity,'1');assert.equal(geometry.direction,'row');
   assert.ok(Math.abs(geometry.scroll-geometry.height)<2,JSON.stringify(geometry));
   assert.ok(geometry.search.left<14 && geometry.search.right>geometry.width-15);
   await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForSelector('body.menu--open');
   const menu=await page.locator('.wrap__left').evaluate(n=>n.getBoundingClientRect().toJSON());
   await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForFunction(()=>!document.body.classList.contains('menu--open'));
   await page.locator('.navigation-bar [data-action=settings]').click();await page.waitForSelector('body.settings--open');
   const settings=await page.locator('.settings__content').evaluate(n=>n.getBoundingClientRect().toJSON());
   assert.ok(Math.abs(settings.top-menu.top)<2 && settings.bottom<=geometry.nav.top+1);
   if(device.name==='iPhone' || device.name==='Android')assert.ok(Math.abs(settings.width-menu.width)<2);
   await page.evaluate(()=>Lampa.Controller.back());
  }
  assert.deepEqual(r.errors,[]);
 }finally{await r.context.close();}
}
(async()=>{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch();
  try{for(const theme of ['minimal','glass'])for(const device of devices){
   await run(browser,device,theme);
   console.log(engine.name(),theme,device.name,'retains the page and touch controls through both rotations');
  }}finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
