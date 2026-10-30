const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('home always hides Back with a deep activity stack and menu/back have identical normal and focus shells',async()=>{
 const r=await native({built:true}),{w,L}=r;
 try{
  let component='main';L.Activity.active=()=>({component});L.Activity.all=()=>[{},{},{}];
  const back=w.document.querySelector('.head__backward'),menu=w.document.querySelector('.head__menu-icon');
  L.Listener.send('activity',{type:'start'});assert.equal(w.getComputedStyle(back).display,'none');assert.equal(back.getAttribute('aria-hidden'),'true');assert.ok(!back.classList.contains('selector'));
  component='category';L.Listener.send('activity',{type:'start'});assert.equal(w.getComputedStyle(back).display,'flex');
  for(const focused of [false,true]){
   back.classList.toggle('focus',focused);menu.classList.toggle('focus',focused);
   const a=w.getComputedStyle(back),b=w.getComputedStyle(menu);for(const prop of ['width','height','border','borderRadius','color','backgroundColor','outline','outlineOffset'])assert.equal(a[prop],b[prop],prop);
   const nav=w.document.createElement('div');nav.innerHTML='<button class="minimal-row-arrow"></button><button class="minimal-row-more selector"></button><button class="minimal-comments-arrow"></button>';w.document.body.appendChild(nav);
   for(const button of nav.children){button.classList.toggle('focus',focused);const actual=w.getComputedStyle(button);for(const prop of ['border','borderRadius','color','backgroundColor','outline','outlineOffset'])assert.equal(actual[prop],b[prop],button.className+' '+prop);}
   if(focused){assert.equal(b.outline,'none');assert.match(b.boxShadow,/inset/);};nav.remove();
  }
  component='main';L.Listener.send('activity',{type:'start'});assert.equal(w.getComputedStyle(back).display,'none');assert.equal(back.tabIndex,-1);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('cartoons menu sits below series and opens bounded film/TV animation rows through mouse and remote',async()=>{
 const r=await native({built:true}),{w,L}=r,requests=[];
 try{
  const item=w.document.querySelector('[data-action="cartoon"]'),series=w.document.querySelector('[data-action="tv"]');assert.equal(series.nextElementSibling,item);assert.notEqual(w.getComputedStyle(item).display,'none');
  L.Api.sources.tmdb.get=(url,params,ok)=>{requests.push(url);w.setTimeout(()=>ok({results:[{id:100+requests.length,title:'Animation',genre_ids:[16],original_language:'en'}],page:1,total_pages:2}),0);};
  w.jQuery(item).trigger('hover:enter');await wait(180);
  assert.equal(L.Activity.active().url,'cartoon');assert.equal(requests.length,6);
  for(const path of requests){const query=new URLSearchParams(path.split('?')[1]);assert.equal(query.get('with_genres'),'16');assert.equal(query.get('without_keywords'),'210024');assert.match(path,/^discover\/(?:movie|tv)\?/);}
  const root=L.Activity.active().activity.render(true),rows=L.Activity.active().activity.component;
  assert.ok(root.textContent.includes('мультфильмы'));assert.ok(root.textContent.includes('мультсериалы'));assert.ok(rows.items.length+rows.loaded.length<=6);
  assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('TV rows replace arrows with More that can be focused from the last card and activated by OK or click',async()=>{
 const r=await native({built:true,initialStorage:{lampa_view_layout:'tv'}}),{w,L}=r;
 try{
  Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected?w.document.body:null;},configurable:true});
  w.Navigator.follow('focus',event=>L.Controller.focus(event.elem));
  L.Api.sources.tmdb.get=(url,params,ok)=>w.setTimeout(()=>ok({results:[{id:601,title:'Animation',genre_ids:[16],original_language:'en'}],page:1,total_pages:2}),0);
  w.jQuery(w.document.querySelector('[data-action="cartoon"]')).trigger('hover:enter');await wait(160);
  const row=L.Activity.active().activity.component.items[0],root=row.render(true),button=root.querySelector('.minimal-row-more');assert.ok(button);assert.equal(w.getComputedStyle(button).display,'flex');for(const arrow of root.querySelectorAll('.minimal-row-arrow'))assert.equal(w.getComputedStyle(arrow).display,'none');
  row.toggle();L.Controller.enabled().controller.right();assert.equal(row.last,button);assert.ok(button.classList.contains('focus'),'Remote cannot highlight More');
  button.dispatchEvent(new w.Event('hover:enter'));await wait(100);assert.equal(L.Activity.active().component,'category_full');assert.match(L.Activity.active().url,/with_genres=16/);
  L.Activity.backward();await wait(100);button.click();await wait(100);assert.equal(L.Activity.active().component,'category_full');assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('cast has only paging arrows on desktop and no header controls on TV',async()=>{
 const r=await native({built:true}),{w,L}=r;
 try{
  L.Api.full=(p,ok)=>ok({movie:{id:710,title:'Film',source:'tmdb',production_countries:[],production_companies:[],spoken_languages:[],genres:[]},persons:{cast:Array.from({length:30},(_,id)=>({id:id+900,name:'Actor '+id,profile_path:'/person.jpg',character:'Role '+id})),crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
  L.Activity.push({component:'full',id:710,method:'movie',source:'tmdb',card:{id:710,title:'Film',source:'tmdb'}});await wait(120);
  const root=L.Activity.active().activity.render(true).querySelector('.minimal-cast-native');assert.equal(root.querySelector('.minimal-row-more'),null);assert.equal(root.querySelectorAll('.minimal-row-arrow').length,2);assert.ok([...root.querySelectorAll('.minimal-row-arrow')].every(b=>!b.disabled));
  w.document.body.classList.add('pt-tv');assert.equal(w.getComputedStyle(root.querySelector('.minimal-row-nav')).display,'none');w.document.body.classList.remove('pt-tv');root.querySelector('.full-person').dispatchEvent(new w.Event('hover:enter'));await wait(50);assert.equal(L.Activity.active().component,'actor');assert.equal(L.Activity.active().id,900);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});

test('held TV navigation scrolls once per card, builds the next lazy batch and hides the native tail More',async()=>{
 const r=await native({built:true,initialStorage:{lampa_view_layout:'tv'}}),{w,L}=r;
 try{
  Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected && !this.classList.contains('card-more')?w.document.body:null;},configurable:true});
  w.Navigator.follow('focus',event=>L.Controller.focus(event.elem));
  L.Api.sources.tmdb.get=(url,p,ok)=>w.setTimeout(()=>ok({results:Array.from({length:20},(_,i)=>({id:600+i,title:'Film '+i,source:'tmdb'})),page:1,total_pages:3}),0);
  L.Activity.push({component:'category',url:'movie',source:'tmdb',title:'Фильмы'});await wait(180);
  const row=L.Activity.active().activity.component.items[0],root=row.render(true);row.toggle();
  const update=row.scroll.update;let updates=0;row.scroll.update=function(){updates++;return update.apply(this,arguments);};
  for(let i=1;i<20;i++){updates=0;L.Controller.enabled().controller.right();assert.equal(row.active,i);assert.equal(updates,1,'Only native focus should position the rail');}
  const tail=root.querySelector('.card-more');assert.ok(tail);assert.equal(w.getComputedStyle(tail).display,'none');
  const more=root.querySelector('.minimal-row-more');L.Controller.enabled().controller.right();assert.equal(row.last,more);assert.ok(more.classList.contains('focus'));
  L.Controller.enabled().controller.left();assert.equal(row.active,19);
  for(let i=18;i>=0;i--){updates=0;L.Controller.enabled().controller.left();assert.equal(row.active,i);assert.equal(updates,1,'Returning to the first card must also scroll exactly once');}
  assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});


test('dorama opens the same native category rows and More pages using live-action Asian TV filters',async()=>{
 const r=await native({built:true}),{w,L}=r,requests=[];try{
  const item=w.document.querySelector('.menu__item[data-action="dorama"]');assert.equal(item.querySelector('.menu__text').textContent,'Дорамы');assert.equal(w.document.querySelectorAll('.menu__item[data-action="dorama"]').length,1);
  L.Api.sources.tmdb.get=(url,params,ok)=>{requests.push(url);w.setTimeout(()=>ok({results:[{id:requests.length+1900,name:'Дорама',genre_ids:[18],original_language:'ko'}],page:1,total_pages:2}),0);};
  w.jQuery(item).trigger('hover:enter');await wait(230);assert.equal(L.Activity.active().url,'dorama');assert.equal(requests.length,10);
  for(const path of requests){assert.match(path,/^discover\/tv\?/);const q=new URLSearchParams(path.split('?')[1]);assert.ok(q.get('with_origin_country'));assert.match(q.get('without_genres'),/16/);}
  const rows=L.Activity.active().activity.component;assert.ok(rows.items.length+rows.loaded.length<=10);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});

test('native menu_always switches a single native menu between dock and popover and restores the button',async()=>{
 const r=await native({built:true}),{w,L}=r;try{
  const button=w.document.querySelector('.head__menu-icon'),panel=w.document.querySelector('.wrap__left');
  L.Storage.set('menu_always',true);assert.ok(w.document.body.classList.contains('pt-menu-pinned'));assert.equal(w.getComputedStyle(button).display,'none');assert.equal(w.getComputedStyle(panel).visibility,'visible');
  L.Controller.toggle('menu');L.Controller.toggle('content');await wait(330);assert.equal(w.getComputedStyle(panel).visibility,'visible');assert.equal(w.document.querySelectorAll('.menu').length,1);
  L.Storage.set('menu_always',false);assert.ok(!w.document.body.classList.contains('pt-menu-pinned'));assert.equal(w.getComputedStyle(button).display,'flex');assert.equal(w.getComputedStyle(panel).visibility,'hidden');
  L.Storage.set('menu_always',true);L.Storage.set('lampa_view_enabled',false);assert.ok(!w.document.body.classList.contains('pt-menu-pinned'));assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
