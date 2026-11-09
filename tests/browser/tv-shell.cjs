const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{args:['--blink-settings=minimumFontSize=8,minimumLogicalFontSize=8']}:{})});try{for(const width of [960,1920,3840]){
  const r=await setup(browser,{mode:'tv',viewport:{width,height:width*9/16}},{beforePlugin:page=>page.evaluate(()=>{
   const L=Lampa;L.Params.init();L.Layer.init();L.Search.init();
   L.Api.main=(o,ok)=>ok(['Сейчас смотрят','Популярное'].map((title,row)=>({title,url:'qa/'+row,results:Array.from({length:20},(_,i)=>({id:row*100+i+1,title:'Название фильма',vote_average:8.6,overview:'Длинное описание фильма для проверки большого интерфейса. '.repeat(6),poster_path:'/p.jpg',backdrop_path:'/b.jpg',release_date:'2025-01-01',source:'tmdb'}))})));
  })});try{
   if(engine===chromium){const minimum=await r.page.evaluate(()=>{const n=document.createElement('span');n.style.fontSize='2px';n.textContent='TMDB';document.body.appendChild(n);const range=document.createRange();range.selectNodeContents(n);const h=range.getBoundingClientRect().height;n.remove();return h;});assert.ok(minimum>=7,'Android minimum-font emulation must actually affect glyphs');}
   for(const theme of ['minimal','glass']){
    await r.page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);
    await r.page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));await r.page.waitForSelector('.minimal-home-first-row');
    for(const size of ['small','normal','bigger']){
     await r.page.evaluate(size=>Lampa.Storage.set('interface_size',size),size);await r.page.waitForTimeout(500);
     const value=await r.page.evaluate(()=>{
      const rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
      const hero=document.querySelector('.activity--active .pt-hero'),body=hero.querySelector('.pt-hero__body'),dots=hero.querySelector('.pt-hero__dots');
      const poster=hero.nextElementSibling.querySelector('.card__view');
      const quality=document.createElement('span');quality.className='pt-quality';quality.textContent='WEB-DL';poster.appendChild(quality);
      const type=document.createElement('span');type.className='pt-kind';type.textContent='Мультфильм';poster.appendChild(type);
      const result={ratingGlyph:parseFloat(getComputedStyle(poster.querySelector(".card__vote"),":after").fontSize),width:innerWidth,menu:rect(document.querySelector('.head .head__menu-icon')),settings:rect(document.querySelector('.head .open--settings')),search:rect(document.querySelector('.head .open--search')),hero:rect(hero),panel:rect(body),dots:rect(dots),poster:rect(poster),tags:[rect(type),rect(quality)],blur:[...document.querySelectorAll('.head *, .pt-hero *, .wrap__left')].some(n=>getComputedStyle(n).backdropFilter!=='none' && getComputedStyle(n).backdropFilter!==undefined)};
      quality.remove();type.remove();return result;
     });
     assert.ok(value.ratingGlyph>=8,'Rating source glyphs remain above the Android minimum');assert.ok(value.menu.height/value.width>.024 && value.menu.height/value.width<.03,'Moderate TV header: '+JSON.stringify({width,size,value}));
     assert.ok(Math.abs(value.menu.height-value.settings.height)<1,'Settings mirrors Menu');
     assert.ok(value.settings.left>=value.search.right-1 && value.settings.right<=width,'Search leaves room for Settings');
     assert.ok(value.hero.width>value.width*.9,'Main area uses the TV width: '+JSON.stringify({engine:engine.name(),width,theme,size,value}));
     if(theme==='glass'){assert.ok(value.dots.top>=value.panel.bottom+2,'TV dots do not overlap large description: '+JSON.stringify({width,size,value}));assert.equal(value.blur,false,'TV does not use live backdrop filtering');}
     for(const tag of value.tags)assert.ok(tag.left>=value.poster.left && tag.right<=value.poster.right+1,'Tags fit narrow TV posters');
     assert.ok(value.tags[0].right<=value.tags[1].left+1,'Type and quality do not overlap: '+JSON.stringify({width,size,theme,value}));
     if(process.env.LAMPA_QA_OUTPUT && width===960 && theme==='glass' && size==='normal'){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await r.page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-tv-minimum-font.png')});}
    }
   }
   assert.deepEqual(r.errors,[]);console.log(engine.name()+' TV '+width+': compact shell, Settings, badges and carousel in both themes and all sizes passed');
  }finally{await r.context.close();}
 }}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
