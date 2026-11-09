const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{for(const theme of ['minimal','glass']){
 const r=await setup(browser,{viewport:{width:393,height:852},mode:'mobile'},{beforePlugin:page=>page.evaluate(()=>{Lampa.Params.init();Lampa.Menu.ready();Lampa.Search.init();})}),{page}=r;
 await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
 assert.deepEqual(await page.locator('.navigation-bar__item').evaluateAll(nodes=>nodes.map(n=>n.dataset.action)),['back','menu','main','settings']);
 assert.equal(await page.locator('.head__menu-icon').isVisible(),false);assert.equal(await page.locator('.head__backward').isVisible(),false);
 const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
 const search=await page.locator('.head .open--search').evaluate(n=>n.getBoundingClientRect().toJSON());assert.ok(search.x<14 && search.right>viewport.width-15);
 await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForSelector('body.menu--open');
 const menu=await page.locator('.wrap__left').evaluate(n=>n.getBoundingClientRect().toJSON());
 const navTop=await page.locator('.navigation-bar').evaluate(n=>n.getBoundingClientRect().top);assert.ok(menu.bottom<=navTop,'Sidebar ends above bottom navigation');
 await page.locator('.navigation-bar [data-action=menu]').press('Enter');await page.waitForFunction(()=>!document.body.classList.contains('menu--open'));
 await page.locator('.navigation-bar [data-action=settings]').click();await page.waitForSelector('body.settings--open');
 const mirror=rect=>{assert.ok(Math.abs(viewport.width-rect.right-menu.left)<2,'Right inset mirrors the menu');assert.ok(Math.abs(rect.top-menu.top)<2);assert.ok(Math.abs(rect.width-menu.width)<2);assert.ok(rect.bottom<=navTop);};
 const panel=await page.locator('.settings__content').evaluate(n=>n.getBoundingClientRect().toJSON());mirror(panel);
 await page.evaluate(()=>{Lampa.Controller.back();Lampa.Select.show({title:'Действие',items:Array.from({length:3},(_,i)=>({title:'Действие '+i}))});});
 const action=await page.locator('.selectbox__content').evaluate(n=>n.getBoundingClientRect().toJSON());mirror(action);assert.ok(action.height<250,'Short actions have no unused panel below them');
 assert.deepEqual(r.errors,[]);console.log(engine.name(),theme,'mirrored phone panels and bottom-menu navigation passed');await r.context.close();
 }}finally{await browser.close();}}})().catch(error=>{console.error(error);process.exitCode=1;});
