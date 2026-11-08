const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const theme of ['minimal','glass'])for(const mode of ['desktop','tv','mobile']){
  const r=await setup(browser,{viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},mode},{beforePlugin:page=>page.evaluate(()=>{Lampa.Search.init();Lampa.Listener.send('app',{type:'ready'});})}),{page}=r;
  await page.evaluate(theme=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.DeviceInput.init();Lampa.Controller.observe();Navigator.follow('focus',e=>Lampa.Controller.focus(e.elem));},theme);
  const geometry=await page.evaluate(()=>{
   const head=document.querySelector('.head'),body=document.body,menu=head.querySelector('.head__menu-icon'),back=head.querySelector('.head__backward'),search=head.querySelector('.open--search');
   body.classList.add('pt-home');back.classList.add('pt-back-visible','selector');const before=menu.getBoundingClientRect().left;body.classList.remove('pt-home');const after=menu.getBoundingClientRect().left;
   const rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
   const controls=[back,menu,search].map(node=>{Lampa.Controller.collectionSet(head);Lampa.Controller.collectionFocus(node,head);return {focused:node.classList.contains('focus'),box:rect(node),border:getComputedStyle(node).borderColor,outline:getComputedStyle(node).outlineWidth};});
   return {before,after,controls,menu:rect(menu),search:rect(search),hidden:[...head.querySelectorAll('.open--settings,.open--profile,.head__logo')].every(n=>!n.getBoundingClientRect().width),vw:innerWidth};
  });
  assert.ok(geometry.after>geometry.before,'Back occupies its own slot before Menu');assert.equal(geometry.hidden,true);assert.ok(geometry.search.width>geometry.vw*.55);assert.ok(geometry.search.left>=geometry.menu.right+3);assert.ok(geometry.search.right<=geometry.vw);
  for(const control of geometry.controls){assert.equal(control.focused,true);assert.equal(control.outline,'0px');assert.equal(control.border,theme==='glass'?'rgb(244, 244, 246)':'rgb(216, 195, 154)');assert.ok(control.box.height>=44);}
  await page.locator('.head__menu-icon').click();await page.locator('.wrap__left [data-action=settings]').click();await page.waitForSelector('body.settings--open');
  const settings=await page.locator('.settings__content').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,vh:innerHeight,rows:[...n.querySelectorAll('.settings-folder')].filter(n=>n.getBoundingClientRect().height).map(n=>({h:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)}))}));
  assert.ok(settings.width<=Math.min(600,geometry.vw*.94+1));assert.ok(settings.height<settings.vh*.9);assert.ok(settings.rows.length>0);assert.ok(settings.rows.every(row=>row.h>=44 && row.font>=12));
  await page.evaluate(()=>Lampa.Controller.back());
  assert.deepEqual(r.errors,[]);console.log(theme,mode,'search, back, menu, native compact settings OK');await r.context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
