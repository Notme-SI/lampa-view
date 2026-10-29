const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
const {stage}=require('../fixtures/online-browser.cjs');
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   const r=await setup(browser,{viewport:{width:1440,height:1000},mode:'desktop'},{beforePlugin:page=>page.evaluate(()=>{
    const L=Lampa;window.qaMetadata=[];
    const local=(id,type)=>({id,media_type:type,...(type==='tv'?{name:'Сериал '+id,original_name:'Original '+id,first_air_date:'2025-01-01'}:{title:'Фильм '+id,original_title:'Original '+id,release_date:'2025-01-01'}),overview:'Русское описание',poster_path:'/ru'+id+'.jpg',backdrop_path:'/bg'+id+'.jpg',genre_ids:[18],original_language:'en'});
    L.Api.sources.tmdb.get=(url,p,ok)=>{qaMetadata.push(url);const kind=url.startsWith('tv/')?'tv':'movie',match=url.match(/^(movie|tv)\/(\d+)/);setTimeout(()=>ok(match?{...local(Number(match[2]),kind),images:{logos:[]}}:{results:url.startsWith('trending/')?Array.from({length:10},(_,i)=>[local(100+i,'movie'),local(200+i,'tv')]).flat():[]}),5);};
    window.XMLHttpRequest=class{open(method,url){this.url=url;}setRequestHeader(){}getResponseHeader(){return '3';}abort(){if(this.onabort)this.onabort();}send(){setTimeout(()=>{const tv=this.url.includes('/shows/'),limit=Number(new URL(this.url).searchParams.get('limit'))||20;this.status=200;this.responseText=JSON.stringify(Array.from({length:limit},(_,i)=>({[tv?'show':'movie']:{title:'English '+i,year:2025,ids:{tmdb:(tv?200:100)+i,trakt:900+i},images:{poster:['media.trakt.tv/english.jpg']}}})));this.onload();},5);}};
    L.Storage.set('minimal_trakt_enabled',true);L.Storage.set('minimal_trakt_client_id','public-test-id');L.Storage.set('source','trakt');
    L.Storage.set('minimal_collections',{'main:':{order:['?sort=now_playing','minimal:continue','movie/popular']}});
    L.Favorite.add('history',{id:900,title:'Продолженный фильм',original_title:'History',release_date:'2025-01-01',poster_path:'/history.jpg',source:'tmdb'});
   })});
   const {page}=r;
   await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'trakt',url:'',page:1}));
   await page.waitForSelector('.activity--active .pt-hero');
   const actual=await page.evaluate(()=>{
    const active=Lampa.Activity.active(),component=active.activity.component,root=active.activity.render(true),rows=[...component.items,...component.loaded].map(row=>row.data || row);
    return {titles:rows.map(row=>row.title),urls:rows.map(row=>row.url),hero:root.querySelector('.pt-hero__title').textContent,poster:rows[0].results[0].poster_path,localized:rows.filter(row=>row.source==='trakt').every(row=>row.results.every(card=>/[А-Яа-я]/.test(card.title || card.name))),requests:qaMetadata.filter(url=>!url.includes('append_to_response')).length};
   });
   assert.deepEqual(actual.titles.slice(0,3),['Сейчас смотрят','Продолжить просмотр','Популярное']);assert.ok(actual.localized);assert.match(actual.hero,/Фильм|Сериал/);assert.match(actual.poster,/^\/ru/);assert.equal(actual.requests,3,'Common titles are localized by three shared list requests, without one request per poster');
   // This isolated fixture does not initialize native layer visibility for its seed activity.
   await page.evaluate(()=>document.querySelectorAll('.activity:not(.activity--active)').forEach(node=>{node.style.display='none';}));
   await page.waitForFunction(()=>getComputedStyle(Lampa.Activity.active().activity.render(true)).opacity==='1');
   if(process.env.LAMPA_QA_OUTPUT){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,name+'-trakt-home.png')});}
   await stage(page,true);
   await page.evaluate(()=>{Lampa.DeviceInput.init();Lampa.Controller.observe();Lampa.Keypad.init();Lampa.Keypad.enable();Navigator.follow('focus',event=>Lampa.Controller.focus(event.elem));});
   const bar=await page.locator('.nova-plus-root .nova-plus__bar').last().evaluate(el=>[...el.querySelectorAll('.nova-chip')].map(n=>({key:n.dataset.novaFocus,text:n.innerText,icon:!!n.querySelector('svg')})));
   assert.deepEqual(bar.map(item=>item.key),['view','source','voice']);assert.equal(bar[0].text,'');assert.ok(bar[0].icon);
   await page.evaluate(()=>jQuery('.nova-plus-root [data-nova-focus=source]').last().trigger('hover:enter'));await page.waitForSelector('.selectbox--open');assert.equal(await page.locator('.selectbox-item').count(),1);await page.keyboard.press('Escape');
   await page.evaluate(()=>jQuery('.nova-plus-root [data-nova-focus=view]').last().trigger('hover:enter'));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Lampa.Storage.get('nova_plus_view')),'list');
   assert.equal(await page.locator('.nova-plus-root [data-nova-focus=order],.nova-plus-root [data-nova-focus=look]').count(),0);
   assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+': localized Trakt posters, restored carousel and saved row order; icon-first compact controls and native source popup passed');
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
