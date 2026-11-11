const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');

(async()=>{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch();
  try{
   for(const theme of ['minimal','glass']){
    const {page,context,errors}=await setup(browser,{mode:theme==='minimal'?'desktop':'tv',viewport:{width:1440,height:900}});
    try{
     await page.evaluate(theme=>{
      const L=Lampa;
      L.Storage.set('lampa_view_theme',theme);
      for(const name of ['Params','Layer','DeviceInput'])L[name].init();
      L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
      const cards=Array.from({length:20},(_,i)=>({id:9000+i,name:'Аниме '+i,poster_path:'/qa.jpg',genre_ids:[16],original_language:'ja',first_air_date:'2026-10-01'}));
      L.Api.sources.tmdb.get=(url,p,ok)=>ok({page:p.page,total_pages:1,results:url.includes('air_date.gte=')&&!url.includes('first_air_date.gte=')?cards.slice(0,4):cards});
      L.Activity.push({component:'category',url:'anime',source:'tmdb',title:'Аниме'});
     },theme);
     const rows=page.locator('.activity--active .items-line');
     const short=rows.filter({hasText:'Сейчас смотрят'}).first();
     const season=rows.filter({hasText:'Новинки сезона'}).first();
     await short.locator('.minimal-row-more[hidden]').waitFor({state:'attached'});
     await season.locator('.minimal-row-more:not([hidden])').waitFor({state:'attached'});
     if(theme==='minimal'){
      await page.setViewportSize({width:440,height:900});
      await short.locator('.minimal-row-more:not([hidden])').waitFor({state:'attached'});
      await page.setViewportSize({width:1440,height:900});
      await short.locator('.minimal-row-more[hidden]').waitFor({state:'attached'});
     }
     const preview=await season.locator('.card__title').allTextContents();
     assert.ok(preview.length>=4);
     await season.locator('.minimal-row-more').evaluate(n=>n.dispatchEvent(new Event('hover:enter')));
     await page.waitForFunction(()=>Lampa.Activity.active().component==='category_full');
     const full=page.locator('.activity--active .card__title');
     await full.first().waitFor();
     assert.deepEqual((await full.allTextContents()).slice(0,preview.length),preview);
     assert.equal(await full.count(),20);

     await page.evaluate(()=>{
      const L=Lampa;
      const long='Полный текст комментария. '.repeat(100);
      L.Api.full=(p,ok)=>ok({movie:{id:91,title:'Фильм',original_title:'Film',overview:'Описание',poster_path:'/p.jpg',backdrop_path:'/b.jpg',release_date:'2025-01-01',production_countries:[],production_companies:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{crew:[],cast:[{id:42,name:'Actor',profile_path:'/actor.jpg'}]},images:{logos:[]},videos:{results:[]},discuss:{total_pages:1,result:[{id:123,email:'Автор',comment:long,liked:0,icon:'1'}]},simular:{results:[]},recomend:{results:[]}});
      L.Activity.push({component:'full',id:91,method:'movie',source:'tmdb',card:{id:91,title:'Фильм'}});
     });
     const review=page.locator('.activity--active .minimal-comments-native .full-review').first();
     await review.waitFor({state:'attached',timeout:10000}).catch(error=>{throw new Error(error.message+' '+JSON.stringify(errors));});
     await review.evaluate(n=>{
      const component=Lampa.Activity.active().activity.component,row=component.items.find(item=>item.render(true).contains(n));
      component.active=component.items.indexOf(row);component.scroll.immediate(row.render(true),false);
      row.toggle();Lampa.Controller.collectionFocus(n,row.render(true));
     });
     if(theme==='minimal')await review.click();else await page.keyboard.press('Enter');
     const modal=page.locator('.minimal-comment-reader');
     await modal.waitFor();
     assert.equal(await modal.locator('.minimal-comment-text').textContent(),('Полный текст комментария. '.repeat(100)).trim());
     assert.ok((await modal.locator('.modal__content').boundingBox()).width>=600);
     assert.ok(await modal.locator('.scroll__content').evaluate(n=>n.scrollHeight>n.clientHeight));
     await page.keyboard.press('Escape');
     await modal.waitFor({state:'detached'});
     assert.equal(await review.evaluate(n=>n.classList.contains('focus')),true);
     const ring=await review.evaluate(n=>{const s=getComputedStyle(n);return [s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor,s.boxShadow];});
     assert.ok(ring.slice(0,4).every(color=>color===ring[0]));
     assert.match(ring[4],/inset/);
     await page.evaluate(()=>{
      const account=Lampa.Account;
      window.lampa_settings.account_use=true;
      Lampa.Storage.set('account',{token:'fixture-token'},true);
      const load=account.Api.load;
      account.Api.load=function(path,query,body){if(path!=='discuss/voite')return load.apply(this,arguments);window.qaCommentVote=body;return Promise.resolve();};
     });
     await review.evaluate(n=>n.dispatchEvent(new Event('hover:enter')));
     await page.waitForTimeout(250); // Lampa ignores clicks within 200 ms of the previous activation.
     await modal.locator('.modal__button').first().click();
     await modal.waitFor({state:'detached',timeout:5000});
     assert.deepEqual(await page.evaluate(()=>qaCommentVote),{id:123,like:1});
     assert.equal(await review.locator('.full-review__like-counter').textContent(),'1');
     assert.equal(await review.evaluate(n=>n.classList.contains('focus')),true);
     assert.deepEqual(errors,[]);
     console.log(engine.name(),theme,'short and long rows, matching seasonal order, comment reader and focus PASS');
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
