const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const mode of ['desktop','tv','mobile']){
  const r=await setup(browser,{viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},mode});const {page}=r;
  await page.evaluate(()=>{Lampa.Layer.init();Lampa.Storage.set('menu_always',true);});await page.waitForTimeout(120);
  const dock=await page.evaluate(()=>{const p=document.querySelector('.wrap__left'),c=document.querySelector('.wrap__content'),rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};};return {panel:rect(p),content:rect(c),visibility:getComputedStyle(p).visibility,button:getComputedStyle(document.querySelector('.head__menu-icon')).display,count:document.querySelectorAll('.menu').length};});
  assert.equal(dock.button,'none');assert.equal(dock.visibility,'visible');assert.equal(dock.count,1);assert.ok(dock.content.left>=dock.panel.right-1);assert.ok(dock.content.right<= (mode==='mobile'?393:1280)+1);console.log(mode,'dock',dock);
  await page.evaluate(()=>Lampa.Storage.set('menu_always',false));await page.waitForTimeout(1600);await stage(page,true,2);
  const toolbar=await page.locator('.nova-plus__bar').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,buttons:[...n.querySelectorAll('.nova-chip')].map(b=>({key:b.dataset.novaFocus,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),outside:[...n.querySelectorAll('.nova-chip')].some(b=>b.getBoundingClientRect().right>innerWidth+1)}));assert.equal(toolbar.outside,false);if(mode==='mobile'){assert.ok(toolbar.height<51);assert.equal(toolbar.buttons.filter(b=>['view','direction'].includes(b.key)).length,2);}console.log(mode,'toolbar',toolbar);assert.deepEqual(r.errors,[]);await r.context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
