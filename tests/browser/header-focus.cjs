const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const theme of ['minimal','glass'])for(const mode of ['desktop','tv','mobile']){
  const r=await setup(browser,{viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},mode},{beforePlugin:page=>page.evaluate(()=>{Lampa.Params.init();Lampa.Search.init();Lampa.Listener.send('app',{type:'ready'});})}),{page}=r;
  await page.evaluate(theme=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.DeviceInput.init();Lampa.Controller.observe();Navigator.follow('focus',e=>Lampa.Controller.focus(e.elem));},theme);
  const geometry=await page.evaluate(()=>{
   const head=document.querySelector('.head'),body=document.body,menu=head.querySelector('.head__menu-icon'),back=head.querySelector('.head__backward'),search=head.querySelector('.open--search');
   body.classList.add('pt-home');back.classList.add('pt-back-visible','selector');const before=menu.getBoundingClientRect().left,homeSizes=[menu.getBoundingClientRect().height,search.getBoundingClientRect().height],homeSearchWidth=search.getBoundingClientRect().width,homeSearchLeft=search.getBoundingClientRect().left;body.classList.remove('pt-home');const after=menu.getBoundingClientRect().left;
   const rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
   const controls=[back,menu,search].map(node=>{Lampa.Controller.collectionSet(head);Lampa.Controller.collectionFocus(node,head);return {focused:node.classList.contains('focus'),box:rect(node),border:getComputedStyle(node).borderColor,outline:getComputedStyle(node).outlineWidth};});
   return {before,after,homeSizes,homeSearchWidth,homeSearchLeft,controls,menu:rect(menu),search:rect(search),hidden:[...head.querySelectorAll('.open--settings,.open--profile,.head__logo')].every(n=>!n.getBoundingClientRect().width),vw:innerWidth};
  });
  assert.equal(geometry.after,geometry.before,'Back never moves Menu');assert.equal(geometry.search.left,geometry.homeSearchLeft,'Back never moves Search');assert.equal(geometry.search.width,geometry.homeSearchWidth,'Back never resizes Search');assert.equal(geometry.hidden,true);assert.ok(Math.abs(geometry.homeSizes[0]-geometry.homeSizes[1])<1,'Header actions match search height');if(mode==='desktop')assert.ok(geometry.homeSearchWidth>geometry.vw*.85);assert.ok(geometry.search.width>geometry.vw*.55);assert.ok(geometry.search.left>=geometry.menu.right+3 && geometry.search.left<=geometry.menu.right+13,'Compact spacing between header actions');assert.ok(geometry.search.right<=geometry.vw);
  for(const control of geometry.controls){assert.equal(control.focused,true);assert.equal(control.outline,'0px');assert.equal(control.border,theme==='glass'?'rgb(244, 244, 246)':'rgb(216, 195, 154)');}
  await page.locator('.head__menu-icon').click();await page.locator('.wrap__left [data-action=settings]').click();await page.waitForSelector('body.settings--open');
  const settings=await page.locator('.settings__content').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,vh:innerHeight,rows:[...n.querySelectorAll('.settings-folder')].filter(n=>n.getBoundingClientRect().height).map(n=>({h:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)}))}));
  assert.ok(settings.width<=Math.min(600,geometry.vw*.94+1));assert.ok(settings.height<settings.vh*.9);assert.ok(settings.rows.length>0);assert.ok(settings.rows.every(row=>row.h>=44 && row.font>=12));
  const buttons=await page.evaluate(()=>{
   const size=selector=>{const n=document.querySelector(selector),r=n.getBoundingClientRect(),s=getComputedStyle(n);return {width:r.width,height:r.height,background:s.backgroundImage,tint:s.backgroundColor,border:s.borderColor,shadow:s.boxShadow};};
   return {back:size('.head__backward'),menu:size('.head__menu-icon'),search:size('.head .open--search')};
  });
  for(const button of [buttons.back,buttons.menu]){assert.ok(Math.abs(button.height-buttons.search.height)<1,'Header circles match Search');assert.ok(Math.abs(button.width-button.height)<1);assert.equal(button.background,buttons.search.background);assert.equal(button.tint,buttons.search.tint);assert.equal(button.shadow,buttons.search.shadow);}
  if(theme==='glass'){
   const glass=await page.evaluate(()=>{
    const material=node=>{const s=getComputedStyle(node);return [s.backgroundImage,s.backgroundColor,s.borderColor,s.backdropFilter];},row=document.querySelector('.wrap__left [data-action=movie]');
    row.classList.add('focus');const style=getComputedStyle(row),result={menu:material(document.querySelector('.wrap__left')),settings:material(document.querySelector('.settings__content')),shade:getComputedStyle(document.querySelector('.settings__layer')).backgroundColor,focus:{tint:style.backgroundColor,shadow:style.boxShadow,radius:parseFloat(style.borderRadius),marker:getComputedStyle(row,':before').display}};row.classList.remove('focus');return result;
   });
   assert.deepEqual(glass.menu,glass.settings,'Menu and Settings share one glass material');assert.equal(glass.shade,'rgba(0, 0, 0, 0)','Settings do not add a second dark layer');assert.equal(glass.focus.tint,'rgba(0, 0, 0, 0.24)');assert.equal(glass.focus.shadow,'none');assert.equal(glass.focus.marker,'none');assert.ok(glass.focus.radius>5,'Menu focus is a filled rounded row');
  }
  const icons=await page.locator('.settings-folder__icon').evaluateAll(slots=>slots.map(slot=>{
   const icon=slot.firstElementChild,a=slot.getBoundingClientRect(),b=icon?.getBoundingClientRect();
   return b && a.width>0 ? Math.abs(a.width-b.width)<1 && Math.abs(a.height-b.height)<1 : true;
  }));
  assert.ok(icons.length>0 && icons.every(Boolean),'Icons fit their slots');
  await page.locator('.settings-folder[data-component="interface"]').evaluate(node=>jQuery(node).trigger('hover:enter'));
  const fonts=await page.locator('.settings__content').evaluate(n=>{
   const px=selector=>parseFloat(getComputedStyle(n.querySelector(selector)).fontSize);
   return {name:px('.settings-param__name'),value:px('.settings-param__value'),group:px('.settings-param-title>span')};
  });
  assert.ok(fonts.value<fonts.name && fonts.group<fonts.name,'Values and group labels are smaller than the setting name');
  await page.evaluate(()=>{Lampa.Controller.back();Lampa.Controller.back();Lampa.Select.show({title:'Действие',items:[{title:'Избранное',separator:true},{title:'Нравится',subtitle:'Выбрано',checkbox:true}]});});
  const action=await page.locator('.selectbox__content').evaluate(n=>{
   const title=n.querySelector('.selectbox-item__title'),subtitle=n.querySelector('.selectbox-item__subtitle'),group=n.querySelector('.settings-param-title>span'),checkbox=n.querySelector('.selectbox-item__checkbox');
   const size=el=>parseFloat(getComputedStyle(el).fontSize),center=el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;};
   return {title:size(title),value:size(subtitle),group:size(group),gap:Math.abs(center(checkbox)-center(checkbox.parentElement))};
  });
  assert.ok(action.value<action.title && action.group<action.title && action.gap<1);
  if(theme==='glass'){
   const panels=await page.evaluate(()=>{const material=selector=>{const s=getComputedStyle(document.querySelector(selector));return [s.backgroundImage,s.backgroundColor,s.borderColor,s.backdropFilter];};return {menu:material('.wrap__left'),actions:material('.selectbox__content')};});assert.deepEqual(panels.actions,panels.menu,'Actions share the menu glass material');
  }
  await page.evaluate(()=>Lampa.Select.hide());
  assert.deepEqual(r.errors,[]);console.log(theme,mode,'search, back, menu, native compact settings OK');await r.context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
