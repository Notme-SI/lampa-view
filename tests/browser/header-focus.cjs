const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const theme of ['minimal','glass'])for(const mode of ['desktop','tv']){
  const r=await setup(browser,{viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},mode},{beforePlugin:page=>page.evaluate(()=>{Lampa.Params.init();Lampa.Search.init();Lampa.Listener.send('app',{type:'ready'});})}),{page}=r;
  await page.evaluate(theme=>{Lampa.Storage.set('lampa_view_theme',theme);Lampa.DeviceInput.init();Lampa.Controller.observe();Navigator.follow('focus',e=>Lampa.Controller.focus(e.elem));},theme);
  const material=await page.evaluate(()=>{const controls=[...document.querySelectorAll('.head__menu-icon,.head__backward,.head__action.open--search,.head__action.open--settings')];controls.forEach(n=>n.classList.remove('focus','hover'));return controls.map(n=>({bg:getComputedStyle(n).backgroundColor,image:getComputedStyle(n).backgroundImage}));});assert.equal(new Set(material.map(v=>JSON.stringify(v))).size,1,'Separate header controls use the Search background style');assert.equal(await page.locator('.head .open--search').getAttribute('data-pt-placeholder'),'Поиск');
  const headerIcons=await page.locator('.head__menu-icon svg,.head .open--search svg,.head .open--settings svg').evaluateAll(nodes=>nodes.map(n=>({color:getComputedStyle(n).color,width:n.getBoundingClientRect().width,control:n.parentElement.getBoundingClientRect().height})));assert.equal(new Set(headerIcons.map(n=>n.color)).size,1,'Search, Menu and Settings share the same icon color');for(const icon of headerIcons)assert.ok(icon.width/icon.control>.48 && icon.width/icon.control<.59,'Icons grow inside unchanged controls');
  await page.evaluate(()=>document.querySelector('.head__backward').classList.remove('pt-back-visible'));await page.waitForTimeout(300);
  const home=await page.evaluate(()=>{const menu=document.querySelector('.head__menu-icon').getBoundingClientRect(),s=document.querySelector('.open--search').getBoundingClientRect();return {menu:menu.left,left:s.left,width:s.width,right:s.right};});
  await page.evaluate(()=>document.querySelector('.head__backward').classList.add('pt-back-visible','selector'));await page.waitForTimeout(300);
  const geometry=await page.evaluate(()=>{
   const head=document.querySelector('.head'),menu=head.querySelector('.head__menu-icon'),search=head.querySelector('.open--search'),back=head.querySelector('.head__backward');
   const rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
   const settings=head.querySelector(".open--settings");const controls=[back,menu,search,...(settings.getBoundingClientRect().width?[settings]:[])].map(node=>{Lampa.Controller.collectionSet(head);Lampa.Controller.collectionFocus(node,head);return {focused:node.classList.contains('focus'),box:rect(node),fill:getComputedStyle(node).backgroundColor,shadow:getComputedStyle(node).boxShadow,border:getComputedStyle(node).borderColor,outline:getComputedStyle(node).outlineWidth};});
   return {controls,menu:rect(menu),search:rect(search),vw:innerWidth};
  });
  assert.ok(geometry.controls[0].box.right<geometry.menu.left,'Back appears before Menu');
  assert.ok(geometry.menu.left>home.menu+geometry.controls[0].box.width*.8 && geometry.search.left>home.left+geometry.controls[0].box.width*.8,'Back moves Menu and shrinks Search');
  assert.ok(Math.abs(geometry.search.right-home.right)<1,'Search keeps its right edge');assert.ok(geometry.search.width<home.width);
  const head=await page.locator('.head__body').evaluate(node=>node.getBoundingClientRect().toJSON());
  if(mode==='desktop'){assert.equal(head.height,46);assert.ok(headerIcons.every(icon=>Math.abs(icon.width-24)<.1));}
  assert.ok(Math.abs(head.left+head.right-geometry.vw)<1,'The compact header is centered');
  assert.ok(head.width<geometry.vw*.65 && geometry.search.width>100,'Search stays usable inside the compact header');
  for(const control of geometry.controls){assert.equal(control.focused,true);assert.equal(control.outline,'0px');if(theme==='glass'){assert.match(control.fill,/^rgba\(/,'Glass focus keeps a translucent fill');assert.match(control.border,/^rgba\(/);}else{assert.match(control.fill,/^rgb\(/,'Dark focus stays opaque');assert.equal(control.border,'rgb(216, 195, 154)');}}
  assert.equal(new Set(geometry.controls.map(n=>n.fill)).size,1,'Header controls share focus fill');assert.equal(new Set(geometry.controls.map(n=>n.shadow)).size,1,'Header controls share focus edge');await page.locator('.head__menu-icon').click();
  const menuPanel=await page.locator('.wrap__left').evaluate(n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width};});
  assert.ok(menuPanel.left>=8 && menuPanel.left+menuPanel.width<=head.left,'Menu stays to the left of the controls');
  assert.ok(Math.abs(menuPanel.top-head.top)<1,'Menu starts at the same height as the controls');
  assert.equal(new Set(geometry.controls.map(n=>n.fill)).size,1,'Header controls share focus fill');assert.equal(new Set(geometry.controls.map(n=>n.shadow)).size,1,'Header controls share focus edge');await page.locator('.head__menu-icon').click();assert.equal(await page.evaluate(()=>document.body.classList.contains('menu--open')),false,'Second click closes Menu');
  assert.equal(new Set(geometry.controls.map(n=>n.fill)).size,1,'Header controls share focus fill');assert.equal(new Set(geometry.controls.map(n=>n.shadow)).size,1,'Header controls share focus edge');await page.locator('.head__menu-icon').click();await page.locator('.wrap__left [data-action=settings]').click();await page.waitForSelector('body.settings--open');
  const mirrored=await page.locator('.settings__content').evaluate(n=>{const r=n.getBoundingClientRect();return {inset:innerWidth-r.right,top:r.top,width:r.width};});
  assert.ok(Math.abs(mirrored.top-menuPanel.top)<1 && mirrored.width>menuPanel.width+35 && Math.abs(mirrored.inset-menuPanel.left)<1,'Wider Settings align with the menu and mirror its inset');
  const settings=await page.locator('.settings__content').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,vh:innerHeight,rows:[...n.querySelectorAll('.settings-folder')].filter(n=>n.getBoundingClientRect().height).map(n=>({h:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)}))}));
  assert.ok(settings.width>=330 && settings.width<=Math.min(600,geometry.vw*.94+1));assert.ok(settings.height<settings.vh*.9);assert.ok(settings.rows.length>0);assert.ok(settings.rows.every(row=>row.h>=44 && row.font>=12));
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
   assert.deepEqual(glass.menu.slice(0,3),glass.settings.slice(0,3),'Menu and Settings share the same tint and edge');assert.equal(glass.menu[3],'none','Closed menus do not blur the page');assert.match(glass.settings[3],/blur\(/);assert.equal(glass.shade,'rgba(0, 0, 0, 0)','Settings do not add a second dark layer');assert.match(glass.focus.tint,/^rgba?\(255, 255, 255/);assert.equal(glass.focus.marker,'none');assert.ok(glass.focus.radius>5,'Menu focus is a filled rounded row');
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
  const qr=await page.locator('.settings__content').evaluate(panel=>{
   const block=document.createElement('div');block.className='ad-server';
   block.innerHTML='<div class="ad-server__text"><div>https://cub.black/really-long-address-without-spaces</div>Синхронизация закладок и истории</div><div class="ad-server__qr"><svg width="180" height="180" viewBox="0 0 180 180"></svg></div>';
   panel.querySelector('.settings__body').prepend(block);
   const outer=panel.getBoundingClientRect(),picture=block.querySelector('svg').getBoundingClientRect(),text=block.firstElementChild;
   const fits=picture.left>=outer.left && picture.right<=outer.right && Math.abs(picture.width-picture.height)<1 && text.scrollWidth<=text.clientWidth+1;
      const usesFullWidth=block.querySelector('.ad-server__qr').getBoundingClientRect().top>=text.getBoundingClientRect().bottom;
   const row=document.createElement('div');row.className='settings-param';row.dataset.name='torrserver_url';
   row.innerHTML='<div class="settings-param__name">Основная ссылка</div><span class="settings-param__status active"></span>';
   block.after(row);
   const status=row.querySelector('.settings-param__status').getBoundingClientRect();
   const label=row.querySelector('.settings-param__name').getBoundingClientRect();
   const separated=status.left>=label.right && status.right<=outer.right;
   row.remove();block.remove();return fits && usesFullWidth && separated;
  });
  assert.ok(qr,'QR and long addresses fit inside the compact settings pane');
  if(theme==='glass' && mode==='desktop'){
   await page.evaluate(()=>{
    Lampa.Storage.set('minimal_poiskkino_frames_key','test-frame-key');
    Lampa.Settings.create('minimal_settings_services');
   });
   const row=page.locator('.settings-param[data-name="minimal_poiskkino_frames"]');
   assert.equal(await row.locator('.settings-param__value').textContent(),'test-frame-key');
   assert.match(await row.locator('.settings-param__descr').textContent(),/https:\/\/t\.me\/poiskkinodev_bot/);
   await row.evaluate(node=>{
    const edit=Lampa.Input.edit;Lampa.Input.edit=(options,save)=>save(' updated-frame-key ');
    try{jQuery(node).data('onChange')();}finally{Lampa.Input.edit=edit;}
   });
   assert.equal(await row.locator('.settings-param__value').textContent(),'updated-frame-key');
   await page.evaluate(()=>Lampa.Settings.create('interface'));
  }
  await page.evaluate(()=>{Lampa.Controller.back();Lampa.Controller.back();Lampa.Select.show({title:'Действие',items:[{title:'Избранное',separator:true},{title:'Нравится',subtitle:'Выбрано',checkbox:true}]});});
  const actionPanel=await page.locator('.selectbox__content').evaluate(node=>node.getBoundingClientRect().toJSON());
  assert.ok(Math.abs(actionPanel.top-menuPanel.top)<1 && Math.abs(actionPanel.width-mirrored.width)<1,'Actions align with the menu and match Settings width: '+JSON.stringify({actionPanel,menuPanel,mirrored}));
  const action=await page.locator('.selectbox__content').evaluate(n=>{
   const title=n.querySelector('.selectbox-item__title'),subtitle=n.querySelector('.selectbox-item__subtitle'),group=n.querySelector('.settings-param-title>span'),checkbox=n.querySelector('.selectbox-item__checkbox');
   const size=el=>parseFloat(getComputedStyle(el).fontSize),center=el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;};
   return {title:size(title),value:size(subtitle),group:size(group),gap:Math.abs(center(checkbox)-center(checkbox.parentElement)),footer:n.getBoundingClientRect().bottom-checkbox.parentElement.getBoundingClientRect().bottom};
  });
  assert.ok(action.value<action.title && action.group<action.title && action.gap<1);assert.ok(action.footer<20,'Short actions end at the last row');
  const inset=await page.locator('.selectbox__content').evaluate(n=>{const panel=n.getBoundingClientRect(),row=n.querySelector('.selectbox-item').getBoundingClientRect();return row.left-panel.left>5 && panel.right-row.right>5 && panel.bottom-row.bottom>5;});assert.ok(inset,'Selection rows leave room for the outer panel corners');
  if(theme==='glass'){
   const panels=await page.evaluate(()=>{const material=selector=>{const s=getComputedStyle(document.querySelector(selector));return [s.backgroundImage,s.backgroundColor,s.borderColor,s.backdropFilter];};return {menu:material('.wrap__left'),actions:material('.selectbox__content')};});assert.deepEqual(panels.actions.slice(0,3),panels.menu.slice(0,3),'Actions share the menu tint and edge');assert.match(panels.actions[3],/blur\(/);
  }
  await page.evaluate(()=>Lampa.Select.hide());
  await page.evaluate(()=>{
   Lampa.Api.main=(p,ok)=>ok([{url:'qa',title:'QA',results:[{id:2000000100,title:'QA',source:'tmdb'}]}]);
   Lampa.Api.category=(p,ok)=>ok([]);
   Lampa.Activity.push({component:'main',source:'cub'});
   window.openTestCategory=()=>Lampa.Activity.push({component:'category',url:'qa',source:'cub'});
   openTestCategory();
  });
  const homeButton=page.getByRole('button',{name:'Главная',exact:true});
  assert.equal(await homeButton.count(),1);
  assert.ok(await homeButton.evaluate(node=>{
   const menu=document.querySelector('.head .head__menu-icon');
   return menu.getBoundingClientRect().right<=node.getBoundingClientRect().left && node.nextElementSibling.classList.contains('open--search');
  }));
  await homeButton.click();
  await page.waitForFunction(()=>Lampa.Activity.active().component==='main' && Lampa.Activity.active().source==='tmdb');
  const count=await page.evaluate(()=>Lampa.Activity.all().length);
  assert.equal(await homeButton.isVisible(),false);assert.equal(await page.evaluate(()=>Lampa.Activity.all().length),count);
  await page.evaluate(()=>{Lampa.Storage.set('menu_always',true);openTestCategory();});
  await page.waitForTimeout(320);
  assert.equal(await page.locator('.head .head__menu-icon').isVisible(),false);
  assert.ok(await homeButton.evaluate(node=>document.querySelector('.head .head__backward').getBoundingClientRect().right<=node.getBoundingClientRect().left));
  if(mode==='tv'){
   await page.evaluate(()=>{
    document.activeElement.blur();Lampa.Keypad.init();Lampa.Keypad.enable();Lampa.Controller.toggle('head');
    Lampa.Controller.collectionFocus(document.querySelector('.head .open--search'),document.querySelector('.head'));
   });
   await page.keyboard.press('ArrowLeft');
   assert.ok(await homeButton.evaluate(node=>node.classList.contains('focus')));
   await page.keyboard.press('Enter');
  }else{
   await page.locator('.head .head__backward').focus();await page.keyboard.press('Tab');
   assert.ok(await homeButton.evaluate(node=>document.activeElement===node));
   await page.keyboard.press('Space');
   await page.waitForFunction(()=>Lampa.Activity.active().component==='main');
   await page.evaluate(()=>openTestCategory());
   await homeButton.press('Enter');
  }
  await page.waitForFunction(()=>Lampa.Activity.active().component==='main' && Lampa.Activity.active().source==='tmdb');
  assert.deepEqual(r.errors,[]);console.log(theme,mode,'header order, Home activation, search and compact settings passed');await r.context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
