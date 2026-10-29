const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
const output=process.env.LAMPA_QA_OUTPUT;
if(output)fs.mkdirSync(output,{recursive:true});
async function holiday(page,name){
 await page.evaluate(()=>{document.querySelectorAll('.head .halloween__button,.head .black-friday__button,.head .new-year__button,.head .womens_day__button,.head>.garland').forEach(n=>n.remove());jQuery('.head__logo-icon').replaceWith('<div class="head__logo-icon"><span class="pt-brand">LAMPA</span></div>');});
 if(process.env.LAMPA_HOLIDAY_SCRIPT_DIR){
  await page.addScriptTag({content:fs.readFileSync(path.join(process.env.LAMPA_HOLIDAY_SCRIPT_DIR,'lampa-'+name+'.js'),'utf8')});
 }else await page.evaluate(name=>{
  const head=jQuery('.head');
  if(name==='snow'){
   head.find('.head__logo-icon').append('<div class="head__logo-cap"><svg viewBox="0 0 24 24"><path fill="red" d="M0 22 12 0l12 22z"/></svg></div>');head.prepend('<div class="garland"><svg viewBox="0 0 100 50"><circle cx="30" cy="15" r="5" fill="yellow"/></svg></div>');
   jQuery('<style>.head__logo-cap{position:absolute;top:-.95em;left:-1.25em}.head__logo-cap svg{width:3.2em!important;height:3.2em!important}.garland{position:absolute;width:7em!important;height:4.7em!important;z-index:-1}</style>').appendTo('head');
  }else{
   if(name==='halloween')head.find('.head__logo-icon').replaceWith('<div class="head__logo-icon head__logo-halloween"><div class="head__logo-halloween-fire"></div><div class="head__logo-halloween-svg"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="orange"/></svg></div></div>');
   const cls=name.replace('womens-day','womens_day');head.find('.open--search').after('<div class="head__action head__settings selector '+cls+'__button"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z" fill="currentColor"/></svg></div>');
   jQuery('<style>.head__logo-halloween{width:2.7em;height:2.7em}.head__logo-halloween-svg{position:absolute;width:2.7em;height:2.7em}.head__logo-halloween-svg svg{width:2.7em!important;height:2.7em!important}</style>').appendTo('head');
  }
 },name);
 await page.waitForTimeout(50);
 const box=await page.evaluate(name=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const head=document.querySelector('.head'),logo=head.querySelector('.head__logo-icon'),cap=head.querySelector('.head__logo-cap'),menu=head.querySelector('.head__menu-icon'),button=head.querySelector('.'+name.replace('womens-day','womens_day')+'__button');
  const art=logo.querySelector('.pt-holiday-art'),brand=logo.querySelector('.pt-brand');
  return {head:rect(head),logo:rect(logo),art:art&&rect(art),brand:brand&&rect(brand),word:brand&&brand.textContent,cap:cap&&rect(cap.querySelector('svg')),menu:rect(menu),button:button&&rect(button),buttonDisplay:button&&getComputedStyle(button).display,garland:head.querySelector('.garland')&&getComputedStyle(head.querySelector('.garland')).pointerEvents,width:innerWidth};
 },name);
 if(box.cap){assert.ok(box.cap.top>=-1 && box.cap.bottom<=box.head.bottom+1);assert.ok(box.cap.left>box.menu.right,'hat does not cover the menu');assert.equal(box.garland,'none');}
 if(box.button){assert.equal(box.buttonDisplay,'flex');assert.ok(Math.abs(box.button.height-box.menu.height)<1);assert.ok(box.button.right<=box.width && box.button.top>=0 && box.button.bottom<=box.head.bottom+1);}
 assert.ok(box.logo.bottom<=box.head.bottom+1);
 if(name==='halloween'){assert.equal(box.word,'LAMPA');assert.ok(box.art.right<box.brand.left,'pumpkin is beside, not over the wordmark');assert.ok(box.brand.right<=box.width);}
}
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});try{
   for(const mode of ['desktop','tv','mobile']){
    const r=await setup(browser,mode==='mobile'?{viewport:{width:393,height:852},isMobile:true,hasTouch:true,mode}:{viewport:{width:1440,height:900},mode}),{page}=r;
    for(const event of ['snow','halloween','black-friday','new-year','womens-day']){
     await holiday(page,event);
     if(output)await page.screenshot({path:path.join(output,name+'-'+mode+'-'+event+'.png'),clip:{x:0,y:0,width:mode==='mobile'?393:1440,height:100}});
    }
    await page.evaluate(()=>{Lampa.Api.sources.tmdb.get=(url,p,ok)=>setTimeout(()=>ok(url.includes('/season/')?{episodes:[{episode_number:1,name:'Название серии',vote_average:8.4,air_date:'2025-01-01'}]}:{logos:[]}),5);});
    await stage(page,true,2);
    if(mode==='mobile'){
     const toolbar=await page.locator('.nova-plus__bar').evaluate(node=>{const r=node.getBoundingClientRect();return {height:r.height,inside:[...node.querySelectorAll('.nova-chip')].every(button=>{const b=button.getBoundingClientRect();return b.left>=r.left-1 && b.right<=r.right+1 && b.height>=43.5;}),buttons:[...node.querySelectorAll('.nova-chip')].map(button=>({key:button.dataset.novaFocus,x:button.getBoundingClientRect().x,width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})),labels:[...node.querySelectorAll('.nova-chip:not(.nova-chip--view-icon)')].every(button=>button.getAttribute('aria-label')),overflow:node.closest(".nova-plus-root").scrollWidth>node.closest(".nova-plus-root").clientWidth+1};});
     assert.ok(toolbar.height<=50,'mobile toolbar fits one row');assert.ok(toolbar.inside,JSON.stringify(toolbar));assert.ok(toolbar.labels);assert.equal(toolbar.overflow,false);
    }
    await page.evaluate(()=>{Lampa.DeviceInput.init();Lampa.Controller.observe();window.qaBacks=0;Lampa.Controller.add('content',{toggle(){Lampa.Controller.collectionSet(qaRoot[0]);},back(){qaBacks++;}});Lampa.Controller.toggle('content');});
    const center=await page.locator('.nova-chip--view-icon').evaluate(node=>{const a=node.getBoundingClientRect(),b=node.querySelector('svg').getBoundingClientRect();return [Math.abs(a.x+a.width/2-b.x-b.width/2),Math.abs(a.y+a.height/2-b.y-b.height/2)];});assert.ok(center.every(value=>value<=1),'layout icon centered: '+center);
    const meta=await page.locator('.nova-hero__meta').evaluate(node=>({bg:getComputedStyle(node).backgroundColor,color:getComputedStyle(node).color}));assert.match(meta.bg,/0\.78/);assert.equal(meta.color,'rgb(245, 247, 250)');
    const season=await page.locator('.nova-hero__season-label').evaluate(node=>{const a=node.getBoundingClientRect(),b=node.parentNode.getBoundingClientRect();return {top:a.top,bottom:b.bottom,parent:node.parentNode.className,bg:getComputedStyle(node).backgroundColor,height:b.height,font:parseFloat(getComputedStyle(node.parentNode).fontSize)};});
    assert.equal(season.parent,'nova-hero__meta');assert.match(season.bg,/0\.78/);assert.ok(season.top>season.bottom,'season has its own separate plate');assert.ok(season.height<season.font*2.4,'main facts stay one compact line');
    for(const key of ['source','voice']){
     await page.evaluate(key=>jQuery('[data-nova-focus='+key+']').last().trigger('hover:enter'),key);await page.waitForSelector('.selectbox--open');await page.waitForTimeout(320);
     if(key==='voice')assert.equal(await page.locator('.selectbox__title').textContent(),'Дубляж');
     if(key==='source'){
      assert.equal(await page.locator('.nova-source-option .selectbox-item__subtitle').count(),0);
      const badge=await page.locator('.nova-source-option__quality').evaluate(node=>{const a=node.getBoundingClientRect(),b=node.parentNode.getBoundingClientRect(),r=node.closest('.selectbox-item').getBoundingClientRect();return {text:node.textContent,top:a.top,bottom:a.bottom,rowTop:b.top,rowBottom:b.bottom,height:r.height,font:parseFloat(getComputedStyle(node.closest('.selectbox-item')).fontSize)};});
      assert.match(badge.text,/^(4K|FHD|HD|SD)$/);assert.ok(badge.top>=badge.rowTop-1 && badge.bottom<=badge.rowBottom+1);assert.ok(badge.height<badge.font*3.6,'source rows stay compact');
      if(output)await page.screenshot({path:path.join(output,name+'-'+mode+'-source-menu.png')});
     }
     await page.locator('.selectbox .minimal-back--overlay').click();assert.equal(await page.evaluate(()=>Lampa.Controller.enabled().name),'content');await page.evaluate(()=>Lampa.Controller.back());
    }
    assert.equal(await page.evaluate(()=>qaBacks),2);
    await page.evaluate(()=>jQuery('[data-nova-focus=view]').last().trigger('hover:enter'));await page.waitForTimeout(150);
    assert.equal(await page.locator('.nova-card__num').first().textContent(),'Серия 1');assert.equal(await page.locator('.nova-card__rate').first().textContent(),'★ 8.4');
    const thumbnail=await page.locator('.nova-card__thumb').first().evaluate(node=>{const image=node.querySelector('img'),number=node.querySelector('.nova-card__num'),r=node.getBoundingClientRect(),n=number.getBoundingClientRect();return {opacity:getComputedStyle(image).opacity,width:r.width,numberHeight:n.height,height:r.height};});
    assert.equal(thumbnail.opacity,'1','list thumbnails keep original brightness');assert.ok(thumbnail.numberHeight<thumbnail.height*.6,'number does not shade the whole thumbnail');
    if(mode==='mobile'){
     assert.ok(thumbnail.width<=120,'mobile preview leaves room for title');
     const body=await page.locator('.nova-card__body').first().evaluate(node=>{const r=node.getBoundingClientRect();return {width:r.width,meta:getComputedStyle(node.querySelector('.nova-card__meta')).display};});
     assert.ok(body.width>=180);assert.equal(body.meta,'flex');
    }
    if(output){await page.waitForTimeout(200);await page.screenshot({path:path.join(output,name+'-'+mode+'-online-list.png')});}
    assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+' '+mode+': five seasonal layouts, readable bright banner, centered icon, online Back and episode list passed');
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
