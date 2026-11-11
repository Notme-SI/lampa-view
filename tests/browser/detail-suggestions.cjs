const assert=require('node:assert/strict'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{
for(const mode of ['desktop','tv','mobile'])for(const theme of ['minimal','glass']){
const r=await setup(browser,{mode,viewport:mode==='tv'?{width:960,height:540}:mode==='mobile'?{width:390,height:844}:{width:1440,height:900}},{beforePlugin:p=>p.evaluate(()=>{
window.imageRequests=[];const image=Lampa.TMDB.image;Lampa.TMDB.image=(path,options)=>{imageRequests.push(path);return image(path,options);};
window.rects=0;const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){rects++;return rect.call(this);};
Lampa.Api.full=(p,done)=>{const movie={id:p.id,source:p.source||'tmdb',title:'Проверка отступов и списков',original_title:'Detail sample',release_date:'2025-01-01',backdrop_path:'/backdrop.jpg',production_countries:[],production_companies:[],spoken_languages:[],genres:[],overview:'Описание фильма'};
const cards=offset=>Array.from({length:20},(_,i)=>({id:offset+i,title:'Фильм '+i,source:'tmdb',poster_path:'/suggestion-'+(offset+i)+'.jpg',release_date:'2024-01-01'}));
done({movie,persons:{crew:[{id:50,name:'Режиссёр с длинным именем',job:'Director',profile_path:'/person.jpg'}],cast:Array.from({length:12},(_,i)=>({id:100+i,name:'Актёр с длинным именем '+i,character:'Персонаж с длинным описанием',profile_path:'/person.jpg'}))},discuss:{result:[{id:1,text:'Хороший фильм',user:{login:'Viewer'}}]},images:{logos:[]},videos:{results:[]},minimal_gallery_frames:[{still_path:'/scene.jpg',width:1920}],recomend:{results:cards(200)},simular:{results:cards(400)}});};
})});try{const {page}=r;
await page.evaluate(theme=>{Lampa.Params.init();Lampa.Layer.init();Lampa.DeviceInput.init();Lampa.Controller.observe();Lampa.Keypad.init();Lampa.Keypad.enable();Navigator.follow('focus',e=>Lampa.Controller.focus(e.elem));Lampa.Storage.set('lampa_view_theme',theme);Lampa.Activity.push({component:'full',source:'tmdb',method:'movie',id:91,card:{id:91,title:'Проверка'}});},theme);
await page.waitForSelector('.minimal-detail-columns');await page.waitForTimeout(500);
const initial=await page.evaluate(()=>({cards:document.querySelectorAll('.activity--active .card').length,suggestionImages:imageRequests.filter(p=>p.includes('/suggestion-')).length,rects,rows:Lampa.Activity.active().activity.component.rows.length,buttons:[...document.querySelectorAll('.activity--active .minimal-suggestions-button')].map(b=>b.textContent)}));
{
assert.equal(initial.cards,0,JSON.stringify(initial));assert.equal(initial.suggestionImages,0);
if(mode==='tv')await page.evaluate(()=>{const link=Lampa.Activity.active().activity.component;link.view=link.rows.length;link.emit('scroll',0);});
assert.deepEqual(await page.locator('.activity--active .minimal-suggestions-button').allTextContents(),['Рекомендации','Похожие']);
if(mode==='desktop'){const gap=await page.evaluate(()=>{const a=document.querySelector('.minimal-comments-native').getBoundingClientRect(),b=document.querySelector('.minimal-suggestions-choice').getBoundingClientRect();return {distance:b.top-a.bottom,font:parseFloat(getComputedStyle(document.body).fontSize)};});assert.ok(gap.distance>=gap.font*2,JSON.stringify(gap));}
for(const title of ['Рекомендации','Похожие']){const button=page.getByRole('button',{name:title,exact:true});await page.evaluate(title=>{const link=Lampa.Activity.active().activity.component;link.items.find(item=>item.minimalSuggestions && item.data.title===title).toggle();},title);await page.waitForTimeout(300);await button.click();await page.waitForSelector('.selectbox-item');assert.equal(await page.locator('.minimal-suggestions-menu .selectbox-item').count(),20);assert.equal(await button.getAttribute('aria-expanded'),'true');await page.evaluate(()=>Lampa.Controller.back());await page.waitForTimeout(50);assert.equal(await button.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.activity--active .card').count(),0);}
await page.getByRole('button',{name:'Рекомендации',exact:true}).click();await page.locator('.minimal-suggestions-menu .selectbox-item').first().click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Lampa.Activity.active().id),200);await page.evaluate(()=>Lampa.Activity.backward());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Lampa.Activity.active().id),91);
assert.equal(await page.evaluate(()=>{const link=Lampa.Activity.active().activity.component;return link.items[link.active].data.title;}),'Рекомендации','Return retains the invoking native row');
assert.equal(await page.locator('.activity--active .minimal-suggestions-button.focus').textContent(),'Рекомендации');
if(process.env.LAMPA_QA_OUTPUT)await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-'+mode+'-'+theme+'-suggestions.png')});assert.deepEqual(r.errors,[]);
}
console.log(JSON.stringify({engine:engine.name(),mode,theme,initial,errors:r.errors}));
}finally{await r.context.close();}}
}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
