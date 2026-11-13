const assert = require('node:assert/strict');
const {chromium,webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup} = require('../fixtures/native-browser.cjs');

(async () => {
 for (const engine of [chromium,webkit]) {
  const browser = await engine.launch({headless:true});
  try {
   const {page, errors} = await setup(browser,{mode:'desktop',viewport:{width:1440,height:900}},{
    beforePlugin: page => page.evaluate(() => {
     const L=Lampa;
     L.Search.init();
     document.body.appendChild(L.Search.render(true));
     L.Menu.ready();
     L.Params.init();
     L.Layer.init();
     document.querySelector('.wrap').classList.add('layer--height','layer--width');
     document.querySelector('.wrap__content').classList.add('layer--height','layer--width');
     L.Api.main=(options,success)=>success(Array.from({length:8},(_,index)=>({
      title:'Row '+index,url:'qa/'+index,results:Array.from({length:10},(_,item)=>({
       id:index*10+item+1,title:'Фильм '+item,overview:'Description',poster_path:'/p.jpg',backdrop_path:'/b.jpg',source:'tmdb'
      }))
     })));
    })
   });
   page.setDefaultTimeout(4500);
   await page.evaluate(() => {
    const L=Lampa;
    L.Storage.set('navigation_type','mouse');
    L.DeviceInput.init();
    L.Controller.observe();
    L.Keypad.init();
    L.Keypad.enable();
    Navigator.follow('focus',event=>L.Controller.focus(event.elem));
    L.Activity.push({component:'main',source:'tmdb'});
    L.Account.Profile.select=()=>{window.profileOpened=(window.profileOpened||0)+1;};
   });
   await page.waitForSelector('.activity--active .pt-hero');
   assert.equal(await page.locator('.head .open--home').isVisible(),false);
   const pageBottom=await page.locator('.activity--active .scroll:not(.scroll--horizontal)').first().evaluate(n=>({bottom:n.getBoundingClientRect().bottom,height:innerHeight}));
   assert.ok(pageBottom.height-pageBottom.bottom>=0 && pageBottom.height-pageBottom.bottom<=9,JSON.stringify(pageBottom));
   const cases = [
    ['.head .open--search','search--open'],
    ['.head .open--settings','settings--open'],
    ['.head .head__menu-icon','menu--open']
   ];
   async function panelTop(selector) {
    return page.locator(selector).evaluate(node=>node.getBoundingClientRect().top);
   }
   for (const [theme,index] of [['minimal',1],['glass',2]]) {
    await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
    await page.waitForTimeout(350);
    const menuTop=await panelTop('.wrap__left');
    for (const shift of [0,400]) {
     for (const [selector, className] of cases) {
      await page.evaluate(shift=>{
       const scroll=Lampa.Activity.active().activity.component.scroll;
       if(shift===0)scroll.reset();else scroll.shift(scroll.position()+shift);
      },shift);
      await page.waitForFunction(shift=>{
       const position=Lampa.Activity.active().activity.component.scroll.position();
       const n=Lampa.Activity.active().activity.component.scroll.render(true),range=Math.max(0,n.scrollHeight-n.clientHeight);return shift===0 ? Math.abs(position)<1 : Math.abs(position+Math.min(shift,range))<2;
      },shift,{timeout:2200});
      const expected=await page.evaluate(()=>Lampa.Activity.active().activity.component.scroll.position());
      const opener=page.locator(selector);
      if(className==='menu--open')await opener.click();
      else await opener.evaluate(node=>jQuery(node).trigger('hover:enter'));
      await page.waitForSelector('body.'+className,{timeout:3000});
      if(className==='settings--open')assert.ok(Math.abs(await panelTop('.settings__content')-menuTop)<1,'Settings start at the menu top');
      if(className==='menu--open' && shift===0){
       await page.locator('[data-action=minimal_profile]').click({timeout:2500});
       assert.equal(await page.evaluate(()=>window.profileOpened),index);
      }
      await page.evaluate(()=>Lampa.Controller.back());
      await page.waitForFunction(name=>!document.body.classList.contains(name),className);
      await page.waitForFunction(selector=>document.querySelector(selector).classList.contains('focus'),selector,{timeout:4000});
      await page.waitForFunction(expected=>Math.abs(Lampa.Activity.active().activity.component.scroll.position()-expected)<2,expected,{timeout:2200}).catch(async error=>{
       throw new Error(error.message+' '+JSON.stringify({theme,shift,selector,expected,...await page.evaluate(()=>({
        actual:Lampa.Activity.active().activity.component.scroll.position(),
        controller:Lampa.Controller.enabled().name,
        viewport:Lampa.Activity.active().activity.component.scroll.vieport()
       }))}));
      });
     }
    }
   }
   await page.evaluate(()=>Lampa.Storage.set('menu_always',true));
   await page.evaluate(()=>Lampa.Controller.toggle('menu'));
   const profile=page.locator('[data-action=minimal_profile]');
   await profile.click();
   assert.equal(await page.evaluate(()=>window.profileOpened),3);
   await profile.evaluate(node=>{
    const L=Lampa;
    L.Controller.collectionFocus(node,node.closest('.wrap__left'));
    L.Controller.enter();
   });
   assert.equal(await page.evaluate(()=>window.profileOpened),4);
   const settings=page.locator('.wrap__left [data-action=settings]');
   await settings.click();
   await page.waitForSelector('body.settings--open');
   await page.evaluate(()=>Lampa.Controller.back());
   await page.waitForSelector('body.menu--open .wrap__left [data-action=settings].focus');
   await page.evaluate(()=>Lampa.Controller.back());
   await page.waitForFunction(()=>!document.body.classList.contains('menu--open'));
   for(const theme of ['minimal','glass']){
    await page.evaluate(theme=>{
     Lampa.Storage.set('lampa_view_theme',theme);
     Lampa.Select.show({title:'Action',items:[{title:'Check'}]});
    },theme);
    await page.waitForSelector('body.selectbox--open');
    assert.ok(Math.abs(await panelTop('.selectbox__content')-await panelTop('.wrap__left'))<1,'Actions start at the menu top');
    await page.evaluate(()=>Lampa.Controller.back());
    await page.waitForFunction(()=>!document.body.classList.contains('selectbox--open'));
   }
   assert.deepEqual(errors,[]);
   console.log(engine.name()+': header overlays preserve home scroll and focus; Profile receives its click');
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
