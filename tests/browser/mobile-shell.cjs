const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{for(const theme of ['minimal','glass']){
 const r=await setup(browser,{viewport:{width:393,height:852},mode:'mobile'},{beforePlugin:page=>page.evaluate(()=>{Lampa.Params.init();Lampa.Menu.ready();Lampa.Search.init();})}),{page}=r;
 await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
 assert.deepEqual(await page.locator('.navigation-bar__item').evaluateAll(nodes=>nodes.map(n=>n.dataset.action)),['back','menu','main','settings']);
 assert.equal(await page.locator('.head__menu-icon').isVisible(),false);assert.equal(await page.locator('.head__backward').isVisible(),false);
 const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
 const search=await page.locator('.head .open--search').evaluate(n=>n.getBoundingClientRect().toJSON());assert.ok(search.x<14 && search.right>viewport.width-15);
 await page.locator('.navigation-bar [data-action=menu]').click();await page.waitForSelector('body.menu--open');
 const gap=await page.locator('.wrap__left').evaluate(n=>document.querySelector('.navigation-bar').getBoundingClientRect().top-n.getBoundingClientRect().bottom);assert.ok(gap>=0,'Sidebar ends above bottom navigation');
 await page.locator('.navigation-bar [data-action=menu]').press('Enter');await page.waitForFunction(()=>!document.body.classList.contains('menu--open'));
 await page.locator('.navigation-bar [data-action=settings]').click();await page.waitForSelector('body.settings--open');
 const panel=await page.locator('.settings__content').evaluate(n=>{const r=n.getBoundingClientRect(),head=n.querySelector('.settings__head').getBoundingClientRect(),body=n.querySelector('.settings__body').getBoundingClientRect();return {x:r.x,width:r.width,height:r.height,headBottom:head.bottom,bodyTop:body.top,bodyBottom:body.bottom};});
 assert.ok(panel.x<1 && panel.width>viewport.width-2 && panel.height>viewport.height-2,'Settings use the full phone viewport');assert.ok(panel.bodyTop-panel.headBottom<2 && panel.bodyBottom>viewport.height-7,'Settings list uses all space below its heading');
 await page.evaluate(()=>{Lampa.Controller.back();Lampa.Select.show({title:'Действие',items:Array.from({length:3},(_,i)=>({title:'Действие '+i}))});});
 const action=await page.locator('.selectbox__content').evaluate(n=>n.getBoundingClientRect().toJSON());assert.ok(action.x<1 && action.width>viewport.width-2 && action.height>viewport.height-2,'Actions use the full phone viewport');
 assert.deepEqual(r.errors,[]);console.log(engine.name(),theme,'full phone panels and bottom-menu navigation passed');await r.context.close();
 }}finally{await browser.close();}}})().catch(error=>{console.error(error);process.exitCode=1;});
