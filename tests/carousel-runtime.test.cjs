const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
test('MyShows unwatched stays first through late startup, API compaction and deferred home rows',async()=>{
 const r=await native({deferPlugin:true}),{w,L}=r;
 try{
  L.Params.init();L.Layer.init();
  const card={id:1,title:'Сериал',name:'Сериал',poster_path:null,source:'tmdb',remaining:3,next_episode:'S01E02'};
  const personal={title:'Непросмотренные сериалы (MyShows)',results:[card],source:'tmdb',url:'myshows://unwatched',line_type:'myshows_unwatched',total_pages:1};
  const rows=()=>[personal,{title:'Сейчас смотрят',url:'movie/now_playing',results:[{...card,poster_path:'/p.jpg'}]},...Array.from({length:8},(_,i)=>({title:'Каталог '+i,url:'catalogue/'+i,results:[{...card,poster_path:'/p.jpg'}]}))];
  // MyShows 1.0.12 prepends this row in TMDB/CUB source.main callbacks.
  L.Api.main=(o,ok)=>ok(rows());
  L.Activity.push({component:'main',source:'tmdb'});await new Promise(resolve=>setTimeout(resolve,40));
  w.eval(require('node:fs').readFileSync(require('node:path').join(__dirname,'../dist/lampa.js'),'utf8'));await new Promise(resolve=>setTimeout(resolve,80));
  const check=()=>{const item=L.Activity.active().activity.component,first=item.items[0];assert.equal(first.data.url,personal.url);assert.equal(first.data.results[0].remaining,3);assert.equal(first.render(true).parentNode.firstElementChild,first.render(true));return item;};
  check();
  L.Activity.push({component:'main',source:'tmdb'});await new Promise(resolve=>setTimeout(resolve,80));
  const item=check();assert.equal(item.items[0].data.results.length,1,'Personal series without artwork must survive catalogue filtering');
  item.loaded.push([{title:'Новинки',minimal_row_id:'minimal:annual:new_movies',results:[{...card,poster_path:'/p.jpg'}]}]);item.emit('pushLoaded');check();
  const known=L.Storage.get('minimal_collection_rows_v2',{})['main:tmdb'];assert.ok(known.some(row=>row.id===personal.url));assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('native home rotates cards, pauses behind settings and cleans up with its activity',async()=>{
 const r=await native(),{w,L}=r,$=w.jQuery,timers=new Map();let now=0,id=0;
 const nativeTimer=w.setTimeout.bind(w),nativeClear=w.clearTimeout.bind(w);
 w.setTimeout=(fn,delay,...args)=>delay===10000?(timers.set(++id,{fn,at:now+delay}),-id):nativeTimer(fn,delay,...args);
 w.clearTimeout=key=>key<0?timers.delete(-key):nativeClear(key);
 const advance=()=>{now+=10000;const due=[...timers].filter(([,t])=>t.at<=now);due.forEach(([key,t])=>{timers.delete(key);t.fn();});};
 const tick=()=>new Promise(resolve=>setTimeout(resolve,20)),hooks=[];
 try{
  const root=$('<main><div class="items-line"><div class="items-line__body"></div></div></main>').appendTo(w.document.body),activity={render:()=>root,component:{use:hook=>hooks.push(hook)}};
  L.Activity.active=()=>({activity});
  const cards=[{id:1,title:'Первый',overview:'Описание',backdrop_path:'/a.jpg',source:'tmdb'},{id:2,title:'Второй',overview:'Описание',backdrop_path:'/b.jpg',source:'tmdb'}];
  L.Listener.send('line',{type:'append',params:{object:{component:'main',activity}},data:{results:cards}});await tick();
  const selected=()=>root.find('.pt-hero__dot.active').attr('title');assert.equal(selected(),'Первый');assert.equal(timers.size,1);
  advance();assert.equal(selected(),'Второй');assert.equal(timers.size,1);
  w.document.body.classList.add('settings--open');L.Settings.listener.send('open',{});await tick();assert.equal(timers.size,0);advance();assert.equal(selected(),'Второй');
  w.document.body.classList.remove('settings--open');L.Settings.listener.send('close',{});await tick();assert.equal(timers.size,1);advance();assert.equal(selected(),'Первый');
  L.Controller.toggle('menu');await tick();assert.equal(timers.size,0);L.Controller.toggle('content');await tick();assert.equal(timers.size,1);
  L.Controller.add('modal',{toggle(){}});L.Controller.toggle('modal');L.Modal.listener.send('fullshow',{});await tick();assert.equal(timers.size,0);
  L.Controller.toggle('content');L.Modal.listener.send('close',{});await tick();assert.equal(timers.size,1);advance();assert.equal(selected(),'Второй');
  hooks.forEach(hook=>hook.onDestroy?.());assert.equal(timers.size,0);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});


test('late plugin startup decorates the already built native home without another catalogue request',async()=>{
 const r=await native({deferPlugin:true}),{w,L}=r;let calls=0;
 try{
  L.Params.init();L.Layer.init();const card={id:1,title:'Film',overview:'Overview',poster_path:'/p.jpg',backdrop_path:'/b.jpg',source:'tmdb'};
  L.Api.main=(o,ok)=>{calls++;ok([{title:'Последнее добавление',url:'?sort=latest',results:[card]},{title:'Новинки кино',minimal_row_id:'minimal:annual:new_movies',results:[card]},{title:'Сейчас смотрят',url:'movie/now_playing',results:[card]}]);};
  L.Activity.push({component:'main',source:'tmdb'});await new Promise(resolve=>setTimeout(resolve,40));assert.equal(w.document.querySelectorAll('.activity--active .pt-hero').length,0);
  w.eval(require('node:fs').readFileSync(require('node:path').join(__dirname,'../dist/lampa.js'),'utf8'));await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(w.document.querySelectorAll('.activity--active .pt-hero').length,1);assert.equal(calls,1,'No catalogue reload or repeated spinner');assert.deepEqual(r.errors,[]);
  const initial=L.Activity.active().activity.component,keys=()=>Array.from(L.Activity.active().activity.component.items,row=>row.data.title);
  assert.deepEqual(keys(),['Сейчас смотрят','Новинки кино']);const first=keys();
  initial.loaded.push([{title:'Последнее добавление',url:'?sort=latest',results:[card]}]);initial.emit('pushLoaded');assert.deepEqual(keys(),first,'Deferred native rows cannot restore Latest');
  const known=L.Storage.get('minimal_collection_rows_v2',{})['main:tmdb'];assert.ok(!known.some(row=>row.title==='Последнее добавление'));
  L.Activity.push({component:'main',source:'tmdb',url:''});await new Promise(resolve=>setTimeout(resolve,60));assert.deepEqual(keys(),first,'Initial and menu home use the same order and exclusions');assert.equal(calls,2);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
