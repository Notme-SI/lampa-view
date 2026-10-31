const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const mode of ['desktop','tv']){
  const r=await setup(browser,{viewport:{width:1280,height:720},mode},{beforePlugin:page=>page.evaluate(()=>Lampa.Search.init())});
  await r.page.evaluate(()=>{for(const name of ['halloween','black-friday','new-year','womens_day'])Lampa.Head.addIcon('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',()=>{}).addClass(name+'__button');});
  await r.page.waitForSelector('.pt-holiday-icons>.womens_day__button');
  const result=await r.page.evaluate(()=>{
   const L=Lampa;L.DeviceInput.init();L.Controller.observe();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
   const head=document.querySelector('.head'),menu=head.querySelector('.head__menu-icon'),back=head.querySelector('.head__backward'),body=document.body;
   body.classList.add('pt-home');back.classList.add('pt-back-visible');
   const before=menu.getBoundingClientRect().left;body.classList.remove('pt-home');const after=menu.getBoundingClientRect().left;
   // This isolated runtime has no signed-in account; add the native avatar shell.
   if(!head.querySelector('.open--profile')){const profile=document.createElement('div');profile.className='head__action selector open--profile';profile.innerHTML='<img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2740%27 height=%2740%27/%3E">';head.querySelector('.head__actions').appendChild(profile);}
   const controls=[];
   for(const selector of ['.head__menu-icon','.open--search','.open--profile','.halloween__button','.black-friday__button','.new-year__button','.womens_day__button']){
    const node=head.querySelector(selector);L.Controller.collectionSet(head);L.Controller.collectionFocus(node,head);
    const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
    controls.push({selector,focused:node.classList.contains('focus'),color:style.outlineColor,width:parseFloat(style.outlineWidth),borderWidth:parseFloat(style.borderWidth),shadow:style.boxShadow,border:style.borderColor,inside:rect.right+5<=innerWidth && rect.top>=5 && rect.bottom+5<=head.getBoundingClientRect().bottom});
   }
   const mr=menu.getBoundingClientRect(),sr=menu.querySelector('svg').getBoundingClientRect();
   const menuCenter=Math.abs((mr.left+mr.right-sr.left-sr.right)/2)+Math.abs((mr.top+mr.bottom-sr.top-sr.bottom)/2);
   const sample=document.createElement('button');sample.className='pt-hero__action selector';sample.textContent='Подробнее';head.after(sample);
   const primary=[];for(const focused of [false,true,false]){sample.classList.toggle('focus',focused);const r=sample.getBoundingClientRect(),s=getComputedStyle(sample);primary.push({width:r.width,height:r.height,bg:s.backgroundColor,border:s.borderColor,shadow:s.boxShadow});}sample.remove();
   const text=document.querySelector('.menu__text');text.textContent='Длинное название раздела для проверки переноса';const style=getComputedStyle(text);
   return {before,after,menuCenter,controls,primary,wrap:style.whiteSpace,mode:body.classList.contains('pt-tv')?'tv':'desktop'};
  });
  if(mode==='tv'){
   assert.ok(result.after>result.before,'Back appears before Menu, as on desktop');
   for(const p of result.primary){assert.equal(p.bg,'rgb(173, 217, 229)');assert.equal(p.shadow,'none');assert.equal(p.width,result.primary[0].width);assert.equal(p.height,result.primary[0].height);}
   assert.equal(result.primary[1].border,'rgb(255, 255, 255)');assert.equal(result.primary[2].border,'rgba(0, 0, 0, 0)');
  }
  assert.equal(result.wrap,'normal');assert.ok(result.menuCenter<.1,'Menu glyph stays centered');for(const control of result.controls){assert.equal(control.focused,true);assert.equal(control.width,0,'No external ring');assert.equal(control.borderWidth,2,'One clear border');assert.equal(control.shadow,'none');assert.equal(control.border,'rgb(173, 217, 229)');assert.equal(control.inside,true);}
  assert.deepEqual(r.errors,[]);console.log(mode,result);await r.context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
