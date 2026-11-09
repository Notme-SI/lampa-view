const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile']){
 const r=await setup(browser,{viewport:mode==='tv'?{width:960,height:540}:mode==='mobile'?{width:390,height:844}:{width:1440,height:900},mode}),{page}=r;
 try{
  await page.evaluate(()=>{Lampa.Params.init();Lampa.Layer.init();Lampa.DeviceInput.init();Lampa.Controller.observe();Lampa.Keypad.init();Lampa.Keypad.enable();Navigator.follow('focus',e=>Lampa.Controller.focus(e.elem));Lampa.Api.full=(p,ok)=>ok({movie:{id:91,name:'Series',original_name:'Series',overview:'A readable series description.',backdrop_path:'/background.jpg',first_air_date:'2025-01-01',production_countries:[],production_companies:[{id:7,name:'Test studio',logo_path:'/studio.png'}],spoken_languages:[],runtime:60,number_of_seasons:3,number_of_episodes:25,seasons:[{season_number:1,name:"Сезон 1",episode_count:10},{season_number:2,name:"Часть 3",episode_count:7},{season_number:3,name:"Часть 4",episode_count:8}],vote_average:8,genres:[],source:'tmdb'},persons:{crew:[{id:90,name:'Native director',profile_path:'/director.jpg',job:'Director'}],cast:Array.from({length:18},(_,i)=>({id:100+i,name:'Native actor '+i,profile_path:'/person.jpg',character:'Role'}))},discuss:{result:[]},images:{logos:[]},videos:{results:[{site:'YouTube',key:'qa',name:'Trailer'}]},simular:{results:[]},recomend:{results:[]}});Lampa.Activity.push({component:'full',id:91,method:'tv',source:'tmdb',card:{id:91,name:'Series'}});});
  await page.waitForSelector('.minimal-detail-columns');
  if(mode==='desktop'){
   const alignment=await page.evaluate(()=>{
    Lampa.Storage.set('menu_always',true);
    const header=document.querySelector('.minimal-detail-header'),columns=header.querySelector('.minimal-detail-columns');
    const gallery=document.createElement('div');gallery.className='items-line minimal-detail-screenshots';header.after(gallery);
    const cast=columns.querySelector('.minimal-cast-native').getBoundingClientRect();
    const facts=columns.querySelector('.minimal-detail-facts').getBoundingClientRect();
    const rail=gallery.getBoundingClientRect(),gap=parseFloat(getComputedStyle(columns).columnGap);
    const bg=header.closest('.activity').querySelector('.full-start__background').getBoundingClientRect();
    gallery.remove();
    Lampa.Storage.set('menu_always',false);
    return {left:cast.left-rail.left,right:facts.right-rail.right,gap:facts.left-cast.right-gap,backdropLeft:bg.left,backdropRight:bg.right-innerWidth};
   });
   assert.ok(Object.values(alignment).every(delta=>Math.abs(delta)<1),'Pinned menu preserves the detail grid: '+JSON.stringify(alignment));
  }
  if(mode!=='mobile'){const counters=await page.locator('.activity--active .full-start-new__details').textContent();assert.ok(counters.includes('Сезоны: 4') && counters.includes('25'),counters);assert.ok((await page.locator('.activity--active .minimal-detail-facts').textContent()).includes('01:00'),'Season counter does not replace native runtime');}

  for(const theme of ['minimal','glass']){
   await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);await page.waitForTimeout(450);
   const value=await page.locator('.activity--active').evaluate(root=>{const background=root.querySelector('.full-start__background');if(!background)return {nativeBackground:false};const b=background.getBoundingClientRect(),cast=root.querySelector('.minimal-detail-columns').getBoundingClientRect(),header=root.querySelector('.minimal-detail-header').getBoundingClientRect();return {backgroundTop:b.top,backgroundBottom:b.bottom,backgroundWidth:b.width,backgroundHeight:b.height,castTop:cast.top,castBottom:cast.bottom,headerBottom:header.bottom,headerTop:header.top,first:root.querySelector('.full-person__name').textContent,mask:getComputedStyle(root.querySelector('.full-start__background')).maskImage};});
   if(value.nativeBackground===false){assert.equal(mode,'mobile','Only the native mobile template may omit its backdrop');continue;}
   if(mode==='mobile'){
    assert.ok(Math.abs(value.backgroundWidth*9/16-value.backgroundHeight)<2,'Mobile cover keeps its 16:9 ratio: '+JSON.stringify(value));
    assert.ok(value.backgroundBottom<value.castTop,'Mobile cover is above credits, with no background behind them');
    assert.equal(value.first,'Native director');assert.ok(value.mask.includes('gradient'));
    assert.equal(await page.locator('.activity--active .minimal-detail-shade').evaluate(n=>getComputedStyle(n).display),'none');
    continue;
   }
   assert.ok(value.backgroundTop<=1,'Detail artwork reaches the top of the viewport');assert.ok(value.backgroundBottom>=value.castBottom-1,'Backdrop reaches beneath the complete cast/facts block: '+JSON.stringify({mode,theme,value}));assert.ok(value.backgroundBottom<=value.headerBottom+2,'Backdrop fades before comments/recommendations');assert.equal(value.first,'Native director');assert.equal(await page.locator('.activity--active .full-start-new__description,.activity--active .minimal-detail-overview').first().evaluate(n=>getComputedStyle(n).color),'rgb(255, 255, 255)','Detail overview remains readable white');assert.ok(value.mask.includes('gradient'));const shade=await page.locator('.activity--active .minimal-detail-shade').evaluate(n=>({display:getComputedStyle(n).display,pointer:getComputedStyle(n).pointerEvents,bg:getComputedStyle(n).backgroundImage,height:n.getBoundingClientRect().height,imageHeight:n.previousElementSibling.getBoundingClientRect().height}));if(theme==='glass'){assert.ok(shade.bg.includes('gradient'));assert.equal(shade.pointer,'none');assert.ok(Math.abs(shade.height-shade.imageHeight)<2,'Contrast shade tracks the complete backdrop');}else assert.equal(shade.display,'none');
  }
  if(mode!=='mobile'){
   await page.waitForSelector('.activity--active .minimal-detail-studio:not([hidden])');
   await page.evaluate(()=>{Lampa.Controller.toggle('full_start');Lampa.Controller.collectionFocus(document.querySelector('.activity--active .button--play'),document.querySelector('.activity--active .minimal-detail-header'));});
   assert.equal(await page.locator('.activity--active .button--play.focus').count(),1,'Native Watch action is the navigation starting point');await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);assert.equal(await page.locator('.activity--active .minimal-detail-studio.focus').count(),1,'Right from Watch reaches the studio: '+JSON.stringify(await page.evaluate(()=>({controller:Lampa.Controller.enabled().name,focus:[...document.querySelectorAll('.activity--active .focus')].map(n=>n.className),header:Lampa.Controller.enabled().controller?.link?.render(true)?.className}))));
   const focus=await page.locator('.activity--active .minimal-detail-studio').evaluate(n=>({filter:getComputedStyle(n).filter,shadow:getComputedStyle(n).boxShadow}));assert.ok(focus.filter.includes('drop-shadow'));assert.equal(focus.shadow,'none');
   await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('.activity--active .button--play.focus').count(),1);await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>Lampa.Activity.active().component),'company');assert.equal(String(await page.evaluate(()=>Lampa.Activity.active().id)),'7');await page.evaluate(()=>Lampa.Activity.backward());await page.waitForSelector('.activity--active .minimal-detail-studio.focus');
  }
  await page.evaluate(()=>{Lampa.Api.person=(p,ok)=>ok({person:{id:p.id,name:'Native director',birthday:'1968-09-10',place_of_birth:'England',profile_path:'/director.jpg',biography:'Biography'},credits:{knownFor:[{name:'Directing',credits:Array.from({length:27},(_,i)=>({id:91+i,title:'Film '+i,release_date:'2025-01-01',poster_path:'/p'+i+'.jpg'}))}]}});Lampa.Activity.push({component:'actor',id:90,source:'tmdb'});});
  await page.waitForSelector('.activity--active .person-start');
  await page.waitForSelector('.activity--active .items-line .card');
  const actorLine=page.locator('.activity--active .items-line').filter({has:page.locator('.card')}).first();
  if(mode!=='tv'){
   await actorLine.locator('.scroll--horizontal').hover();await page.mouse.wheel(360,0);
   await actorLine.locator('.scroll--horizontal').evaluate(node=>new Promise((resolve,reject)=>{const end=Date.now()+2000;function check(){if(node.Scroll.position()<0)resolve();else if(Date.now()>end)reject(new Error('Filmography did not scroll'));else requestAnimationFrame(check);}check();}));
  }
  await page.evaluate(()=>{const line=Lampa.Activity.active().activity.component.items.find(line=>line.data.results.length===27);line.toggle();});
  for(let i=0;i<30;i++)await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>{const line=Lampa.Activity.active().activity.component.items.find(line=>line.data.results.length===27),r=line.items[26]?.render(true).getBoundingClientRect();return !document.body.classList.contains('pt-tv-busy') && r && r.left>=0 && r.right<=innerWidth+2;},{},{timeout:3000});
  const reached=await page.evaluate(()=>{const line=Lampa.Activity.active().activity.component.items.find(line=>line.data.results.length===27),last=line.items[26]?.render(true);return {index:line.active,count:line.items.length,text:last?.textContent,visible:last?.getBoundingClientRect().right<=innerWidth+2,rect:last?.getBoundingClientRect().toJSON(),screen:innerWidth};});assert.equal(reached.index,26);assert.equal(reached.count,27);assert.ok(reached.text.includes('Film 26'));assert.ok(reached.visible,JSON.stringify(reached));
  if(mode==='tv'){await page.evaluate(()=>{const line=Lampa.Activity.active().activity.component.items.find(line=>line.data.results.length===27);line.scroll.reset();document.dispatchEvent(new Event('minimal:tv-idle'));});await page.waitForFunction(()=>{const line=Lampa.Activity.active().activity.component.items.find(line=>line.data.results.length===27),r=line.items[26].render(true).getBoundingClientRect();return !document.body.classList.contains('pt-tv-busy') && r.left>=0 && r.right<=innerWidth+2;},{},{timeout:3000});const restored=await page.evaluate(()=>{const line=Lampa.Activity.active().activity.component.items.find(line=>line.data.results.length===27),r=line.items[26].render(true).getBoundingClientRect();return {active:line.active,left:r.left,right:r.right,width:innerWidth,lastClass:line.items[26].render(true).className,remembered:line.last?.className||line.last?.[0]?.className,busy:document.body.classList.contains('pt-tv-busy'),fit:line.scroll.minimalPosterFit,position:line.scroll.position(),view:line.scroll.render(true).getBoundingClientRect().toJSON()};});assert.equal(restored.active,26);assert.ok(restored.left>=0 && restored.right<=restored.width+2,JSON.stringify(restored));}


  for(const theme of ['minimal','glass']){
   await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);await page.waitForTimeout(120);
   const person=await page.locator('.activity--active .person-start').evaluate(n=>({bg:getComputedStyle(n).backgroundColor,image:getComputedStyle(n).backgroundImage,width:n.getBoundingClientRect().width,scroll:n.scrollWidth,name:n.textContent}));assert.ok(person.name.includes('Native director'));if(theme==='glass'){assert.ok(person.scroll<=person.width+2,JSON.stringify({mode,theme,person}));assert.ok(person.image.includes('gradient'));const alpha=Number(person.bg.match(/[\d.]+/g)[3]);assert.ok(alpha<.5);}else assert.equal(person.bg,'rgb(0, 0, 0)');
  }
  await page.evaluate(()=>{const root=document.querySelector('.activity--active'),sample=document.createElement('div');sample.className='minimal-detail-header';sample.innerHTML='<div class="full-start-new__reactions"><div class="reaction">Reaction</div></div><div class="mapping--line"><div class="full-review">Comment</div><div class="full-review-add">Add</div></div><div class="minimal-torrent-banner__meta">8.6 2025</div>';root.appendChild(sample);});
  for(const selector of ['.full-review','.full-review-add','.reaction','.minimal-torrent-banner__meta']){const material=await page.locator('.activity--active '+selector).evaluate(n=>({bg:getComputedStyle(n).backgroundColor,image:getComputedStyle(n).backgroundImage,blur:getComputedStyle(n).backdropFilter}));assert.ok(material.image.includes('gradient'),selector+JSON.stringify(material));const alpha=Number(material.bg.match(/[\d.]+/g)[3]);assert.ok(alpha<.5,selector+JSON.stringify(material));assert.equal(material.blur,'none');}
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+': native credits and '+(mode==='mobile'?'separate 16:9 cover':'full-height fading backdrop')+' in both themes');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
