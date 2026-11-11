const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('home always hides Back with a deep activity stack and menu/back have identical normal and focus shells',async()=>{
 const r=await native({built:true}),{w,L}=r;
 try{
  let component='main';L.Activity.active=()=>({component});L.Activity.all=()=>[{},{},{}];
  const back=w.document.querySelector('.head__backward'),menu=w.document.querySelector('.head__menu-icon');
  L.Listener.send('activity',{type:'start'});assert.equal(w.getComputedStyle(back).visibility,'hidden');assert.equal(back.getAttribute('aria-hidden'),'true');assert.ok(!back.classList.contains('selector'));
  component='category';L.Listener.send('activity',{type:'start'});assert.equal(w.getComputedStyle(back).display,'flex');
  for(const focused of [false,true]){
   back.classList.toggle('focus',focused);menu.classList.toggle('focus',focused);
   const a=w.getComputedStyle(back),b=w.getComputedStyle(menu);for(const prop of ['width','height','border','borderRadius','color','backgroundColor','outline','outlineOffset','boxShadow'])assert.equal(a[prop],b[prop],prop);
   const nav=w.document.createElement('div');nav.innerHTML='<button class="minimal-row-more selector"></button>';w.document.body.appendChild(nav);
   for(const button of nav.children){button.classList.toggle('focus',focused);const actual=w.getComputedStyle(button);assert.equal(actual.outline,'none');if(focused)assert.match(actual.boxShadow,/inset/);}
   assert.equal(parseFloat(b.outlineWidth)||0,0);if(focused)assert.match(b.boxShadow,/inset 0 0 0 1px/);else assert.equal(b.boxShadow,'none');nav.remove();
  }
  component='main';L.Listener.send('activity',{type:'start'});assert.equal(w.getComputedStyle(back).visibility,'hidden');assert.equal(back.tabIndex,-1);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('cartoons menu sits below series and opens bounded film/TV animation rows through mouse and remote',async()=>{
 const r=await native({built:true}),{w,L}=r,requests=[];
 try{
  const item=w.document.querySelector('[data-action="cartoon"]'),series=w.document.querySelector('[data-action="tv"]');assert.equal(series.nextElementSibling.dataset.action,'tvshow');assert.equal(series.nextElementSibling.nextElementSibling,item);assert.notEqual(w.getComputedStyle(item).display,'none');
  const response=require('./fixtures/discovery-response.cjs');L.Api.sources.tmdb.get=(url,params,ok)=>{requests.push(url);w.setTimeout(()=>ok(response(url,params.page)),0);};
  w.jQuery(item).trigger('hover:enter');
  const activity=L.Activity.active().activity,root=activity.render(true),rows=activity.component;
  for(let attempt=0;attempt<50 && !root.querySelector('.card');attempt++)await wait(20);
  assert.equal(L.Activity.active().url,'cartoon');assert.ok(requests.length===2,'One mixed grid uses one movie and one TV request');
  assert.ok(requests.some(path=>path.startsWith('discover/movie?')));assert.ok(requests.some(path=>path.startsWith('discover/tv?')));
  for(const path of requests){if(/^trending\/(?:movie|tv)\//.test(path))continue;const query=new URLSearchParams(path.split('?')[1]);assert.match(path,/^discover\/(?:movie|tv)\?/);assert.ok(query.get('with_genres').split(',').includes('16'));if(!query.has('with_companies') && !query.has('with_networks'))assert.equal(query.get('without_keywords'),'210024');}
  assert.equal(root.querySelectorAll('.minimal-catalogue-control').length,5);assert.equal(rows.items.length,20);assert.equal(new Set(rows.items.map(item=>item.data.media_type+':'+item.data.id)).size,20);
  assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('TV rows replace arrows with More that can be focused from the last card and activated by OK or click',async()=>{
 const r=await native({built:true,initialStorage:{lampa_view_layout:'tv'}}),{w,L}=r;
 try{
  Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected?w.document.body:null;},configurable:true});
  w.Navigator.follow('focus',event=>L.Controller.focus(event.elem));
  L.Api.sources.tmdb.get=(url,params,ok)=>w.setTimeout(()=>ok({results:[{id:601,title:'Передача',name:'Передача',genre_ids:[18],origin_country:['KR'],poster_path:'/p.jpg'}],page:1,total_pages:2}),0);
  L.Api.category=(p,ok)=>ok([{title:'Подборка',url:JSON.stringify({kind:'dorama',type:'tv',sort:'popular',country:'KR'}),source:'minimal_discovery',results:[{id:601,name:'Передача',poster_path:'/p.jpg'}],page:1,total_pages:2}]);
  L.Activity.push({component:'category',url:'dorama',source:'tmdb'});for(let tries=0;tries<100 && !L.Activity.active().activity.component.items.length;tries++)await wait(20);
  const row=L.Activity.active().activity.component.items[0],root=row.render(true),button=root.querySelector('.minimal-row-more');assert.ok(button);assert.equal(w.getComputedStyle(button).display,'inline-flex');assert.equal(root.querySelectorAll('.minimal-row-arrow').length,0);
  row.toggle();for(let i=0;i<row.data.results.length;i++)L.Controller.enabled().controller.right();assert.equal(row.last,button);assert.ok(button.classList.contains('focus'),'Remote cannot highlight More');
  button.dispatchEvent(new w.Event('hover:enter'));await wait(100);assert.equal(L.Activity.active().component,'category_full');assert.equal(JSON.parse(L.Activity.active().url).kind,'dorama');assert.equal(L.Activity.active().source,'minimal_discovery');
  L.Activity.backward();await wait(100);button.click();await wait(100);assert.equal(L.Activity.active().component,'category_full');assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('cast has no paging controls and actor selection still works',async()=>{
 const r=await native({built:true}),{w,L}=r;
 try{
  L.Api.full=(p,ok)=>ok({movie:{id:710,title:'Film',source:'tmdb',production_countries:[],production_companies:[],spoken_languages:[],genres:[]},persons:{cast:Array.from({length:30},(_,id)=>({id:id+900,name:'Actor '+id,profile_path:'/person.jpg',character:'Role '+id})),crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
  L.Activity.push({component:'full',id:710,method:'movie',source:'tmdb',card:{id:710,title:'Film',source:'tmdb'}});await wait(120);
  const root=L.Activity.active().activity.render(true).querySelector('.minimal-cast-native');assert.equal(root.querySelector('.minimal-row-more'),null);assert.equal(root.querySelectorAll('.minimal-row-arrow').length,0);
  root.querySelector('.full-person').dispatchEvent(new w.Event('hover:enter'));await wait(50);assert.equal(L.Activity.active().component,'actor');assert.equal(L.Activity.active().id,900);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});

test('held TV navigation scrolls once per card, builds the next lazy batch and hides the native tail More',async()=>{
 const r=await native({built:true,initialStorage:{lampa_view_layout:'tv'}}),{w,L}=r;
 try{
  Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected && !this.classList.contains('card-more')?w.document.body:null;},configurable:true});
  w.Navigator.follow('focus',event=>L.Controller.focus(event.elem));
  L.Api.sources.tmdb.get=(url,p,ok)=>w.setTimeout(()=>ok({results:Array.from({length:20},(_,i)=>({id:600+i,name:'Передача '+i,genre_ids:[18],origin_country:['KR'],poster_path:'/poster.jpg',source:'tmdb'})),page:1,total_pages:3}),0);
  L.Activity.push({component:'category',url:'dorama',source:'tmdb',title:'Дорамы'});for(let tries=0;tries<100 && !L.Activity.active().activity.component.items.length;tries++)await wait(20);
  const row=L.Activity.active().activity.component.items[0],root=row.render(true);row.toggle();
  const collectionSet=L.Controller.collectionSet,collectionAppend=L.Controller.collectionAppend;
  let resets=0;const appended=[];
  L.Controller.collectionSet=function(){resets++;return collectionSet.apply(this,arguments);};
  L.Controller.collectionAppend=function(target){appended.push(target);return collectionAppend.apply(this,arguments);};
  const initialCount=row.items.length;
  const update=row.scroll.update;let updates=0;row.scroll.update=function(){updates++;return update.apply(this,arguments);};
  for(let i=1;i<20;i++){updates=0;L.Controller.enabled().controller.right();assert.equal(row.active,i);assert.equal(updates,1,'Only native focus should position the rail');}
  assert.equal(resets,0,'Moving inside the owned row preserves the native collection and current focus');
  assert.ok(initialCount<20 && row.items.length>=20,'Navigation builds the next native lazy batch');
  assert.ok(appended.includes(row.items[19].render(true)),'A lazily appended target joins the owned native collection');
  const tail=root.querySelector('.card-more');assert.ok(tail);assert.equal(w.getComputedStyle(tail).display,'none');
  const more=root.querySelector('.minimal-row-more');L.Controller.enabled().controller.right();assert.equal(row.last,more);assert.ok(more.classList.contains('focus'));
  L.Controller.enabled().controller.left();assert.equal(row.active,19);
  for(let i=18;i>=0;i--){updates=0;L.Controller.enabled().controller.left();assert.equal(row.active,i);assert.equal(updates,1,'Returning to the first card must also scroll exactly once');}
  assert.equal(resets,0,'Returning from More and moving left never resets the owned row');
  row.toggle();assert.equal(resets,1,'Native entry still initializes the row collection');
  assert.equal(root.querySelectorAll('.card.focus').length,1,'Reentry restores one native focused card');
  L.Controller.collectionSet=collectionSet;L.Controller.collectionAppend=collectionAppend;
  assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});


test('Korean series remain available through the country filter',async()=>{
 const r=await native({built:true}),{w,L}=r;
 try{
  assert.equal(w.document.querySelector('.menu__item[data-action=dorama]'),null);
  L.Menu.ready();L.Storage.set('source','tmdb');
  const item=w.document.querySelector('.menu__item[data-action=tv]'),requests=[],response=require('./fixtures/discovery-response.cjs');
  L.Api.sources.tmdb.get=(url,p,ok)=>{requests.push(url);w.setTimeout(()=>ok(response(url,p.page)),0);};
  item.click();await wait(250);
  assert.equal(L.Activity.active().url,'tv');
  const buttons=L.Activity.active().activity.render(true).querySelectorAll('.minimal-catalogue-control');
  buttons[0].click();await wait(50);
  const choices=()=>[...w.document.querySelectorAll('.selectbox-item')];
  assert.ok(choices().every(n=>!n.textContent.includes('Корейские дорамы')));
  L.Select.hide();buttons[4].click();await wait(50);
  const korea=choices().find(n=>n.textContent.includes('Корея'));
  assert.ok(korea);korea.dispatchEvent(new w.Event('hover:enter'));await wait(100);
  assert.equal(L.Activity.active().minimal_browse.country,'KR');
  assert.ok(requests.at(-1).includes('with_origin_country=KR'));
  assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});

test('native menu_always switches a single native menu between dock and popover and restores the button',async()=>{
 const r=await native({built:true}),{w,L}=r;try{
  const button=w.document.querySelector('.head__menu-icon'),panel=w.document.querySelector('.wrap__left');
  L.Storage.set('menu_always',true);assert.ok(w.document.body.classList.contains('pt-menu-pinned'));await wait(100);assert.equal(button.parentElement.className,'head__body');assert.equal(w.getComputedStyle(panel).visibility,'visible');
  L.Controller.toggle('menu');L.Controller.toggle('content');await wait(330);assert.equal(w.getComputedStyle(panel).visibility,'visible');assert.equal(w.document.querySelectorAll('.menu').length,1);
  L.Storage.set('menu_always',false);assert.ok(!w.document.body.classList.contains('pt-menu-pinned'));await wait(100);assert.ok(button.closest('.head'));assert.equal(w.getComputedStyle(button).display,'flex');assert.equal(w.getComputedStyle(panel).visibility,'hidden');
  L.Storage.set('menu_always',true);L.Storage.set('lampa_view_enabled',false);assert.ok(!w.document.body.classList.contains('pt-menu-pinned'));assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});


test('TV shows open a single filtered native grid and preserve scope on later pages',async()=>{
 const r=await native({built:true}),{w,L}=r,requests=[];try{
  L.Storage.set('source','tmdb');const shows=w.document.querySelector('.menu__item[data-action=tv]').nextElementSibling;assert.equal(shows.dataset.action,'tvshow');
  const response=require('./fixtures/discovery-response.cjs');L.Api.sources.tmdb.get=(url,p,ok)=>{requests.push(url);w.setTimeout(()=>ok(response(url,p.page)),0);};shows.click();await wait(220);
  let c=L.Activity.active().activity.component;assert.equal(c.items.length,20);assert.equal(c.render(true).querySelectorAll('.minimal-catalogue-control').length,5);assert.equal(c.render(true).querySelectorAll('.items-line').length,0);assert.equal(requests.length,1);
  c.render(true).querySelectorAll('.minimal-catalogue-control')[1].click();await wait(30);const talk=[...w.document.querySelectorAll('.selectbox-item')].find(n=>n.textContent.includes('Ток'));assert.ok(talk);talk.dispatchEvent(new w.Event('hover:enter'));await wait(100);c=L.Activity.active().activity.component;c.object.page=2;const json=await new Promise((ok,fail)=>c.emit('next',ok,fail));assert.equal(json.results.length,20);
  const q=new URLSearchParams(requests.at(-1).split('?')[1]);assert.equal(q.get('with_origin_country'),null);assert.equal(q.get('with_genres'),'10767');assert.equal(q.get('without_genres'),'16,99,18,80,10766');assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
