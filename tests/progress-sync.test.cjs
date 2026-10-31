const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
function load(w,file,name){w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+file+'.js')],bundle:true,write:false,format:'iife',globalName:name}).outputFiles[0].text);return w[name];}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('CUB refresh uses the native account transport on foreground and coalesces duplicate lifecycle events',async()=>{
 const d=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;
 try{let calls=0;const hooks={},L={Account:{Permit:{sync:true},Timeline:{update(){calls++;}}},Listener:{follow:(name,fn)=>hooks[name]=fn}};
  load(w,'progress-sync','Sync').default(L,()=>true);w.dispatchEvent(new w.Event('focus'));hooks.activity({type:'start'});await wait(400);assert.equal(calls,1);
  w.dispatchEvent(new w.Event('focus'));await wait(400);assert.equal(calls,1,'Foreground events are bounded, not a polling loop');
  L.Account.Permit.sync=false;w.dispatchEvent(new w.Event('focus'));await wait(400);assert.equal(calls,1);
 }finally{w.close();}
});
test('manual native timeline writes preserve profile and duration; remote read invalidates cached episode history',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
  const hooks={},records={},saved={file_view_7:records,online_watched_last:{}};
  const L={Account:{Permit:{sync:true,account:{profile:{id:7}}}},Utils:{hash:x=>x},Storage:{get:(k,f)=>saved[k] || f,set:(k,v)=>saved[k]=v},Timeline:{filename:()=> 'file_view_7',listener:{follow:(event,fn)=>hooks[event]=fn},view:hash=>({...records[hash],hash}),update:value=>records[value.hash]={...value,updated:1},read(){hooks.read();}}};
  const api=load(w,'online-state','State').default(L),card={name:'Сериал',original_name:'Original',number_of_seasons:2,seasons:[{season_number:1,episode_count:10},{season_number:2,episode_count:10}],episode_run_time:[47]};
  api.setWatched(card,1,3,true);assert.equal(records['13Original'].profile,7);assert.equal(records['13Original'].time,2820);assert.equal(api.lastWatched(card).episode,3);
  records['24Original']={percent:35,time:915,duration:2800,profile:7,updated:2};hooks.read();assert.equal(api.lastWatched(card).season,2);assert.equal(api.lastWatched(card).episode,4);assert.equal(api.lastWatched(card).time,915);
  api.clearProgress(card,2,4);assert.equal(records['24Original'].profile,7);assert.equal(records['24Original'].percent,0);
 }finally{w.close();}
});
test('watched caption describes the factual episode and only collapses a finished season',()=>{
 const d=new JSDOM('<body><div class="card focus"><div class="card__view"></div></div></body>',{runScripts:'outside-only'}),w=d.window;try{
  let last={season:1,episode:3,hash:'13Original',percent:100,time:2832,duration:2832};w.LampaView={online:{lastWatched:()=>last}};
  const L={Utils:{hash:x=>x},Timeline:{view:()=>({...last}),render:()=>{const n=w.document.createElement('div');n.className='time-line';n.dataset.hash=last.hash;n.innerHTML='<div></div>';return n;}},TimeTable:{get:()=>[]}};
  const api=load(w,'series-status','Status').default(L,()=>{}),node=w.document.querySelector('.card'),card={id:3,name:'Сериал',source:'minimal_shiki',seasons:[{season_number:1,episode_count:10}],next_episode_to_air:{season_number:1,episode_number:9}};
  api.track(node,card);api.paint(node);assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Просмотрено: Серия 3 • Сезон 1');assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__time').textContent,'47:12');assert.equal(node.querySelector('.time-line>div').style.width,'100%');
  last={...last,episode:8,hash:'18Original'};api.paint(node);assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Просмотрено: Серия 8 • Сезон 1');
  last={...last,episode:10,hash:'110Original'};delete card.next_episode_to_air;api.track(node,card);api.paint(node);assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Сезон 1 просмотрен');assert.equal(node.querySelector('.pt-card-watch').classList.contains('pt-card-watch--complete'),true);
 }finally{w.close();}
});
test('history activation opens the full card for pointer and remote while other sections retain native actions',()=>{
 const d=new JSDOM('<div class="activity--active"><div class="card"><div class="card__view"><img></div></div></div>',{runScripts:'outside-only'}),w=d.window;try{
  let active={component:'favorite',type:'history'},routes=[];const L={Activity:{active:()=>active,push:r=>routes.push(r)},Storage:{get:()=> 'cub'}},node=w.document.querySelector('.card');node.card_data={id:12,name:'История',source:'tmdb'};
  load(w,'history-cards','History').default(L,()=>true);node.querySelector('img').dispatchEvent(new w.Event('click',{bubbles:true}));node.dispatchEvent(new w.Event('hover:enter',{bubbles:true}));assert.equal(routes.length,2);assert.equal(routes[0].component,'full');assert.equal(routes[0].method,'tv');assert.equal(routes[0].source,'tmdb');
  active={component:'favorite',type:'book'};node.dispatchEvent(new w.Event('hover:enter',{bubbles:true}));assert.equal(routes.length,2);
 }finally{w.close();}
});
test('bulk completion marks aired episodes only and preserves the current CUB profile',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
  const records={},saved={file_view_7:records,online_watched_last:{}};let count;
  const L={Utils:{hash:x=>x},Storage:{get:(k,f)=>saved[k] || f,set:(k,v)=>saved[k]=v},Timeline:{filename:()=> 'file_view_7',view:()=>({profile:7}),update:v=>records[v.hash]=v,read(){}},TimeTable:{get:()=>[]}};
  const card={name:'Сериал',original_name:'Original',source:'minimal_shiki',episode_run_time:[30],seasons:[{season_number:1,episode_count:2},{season_number:2,episode_count:10}],last_episode_to_air:{season_number:2,episode_number:3,air_date:'2020-01-01'}};
  load(w,'online-state','State').default(L).setAllWatched(card,n=>count=n);assert.equal(count,5);assert.equal(records['23Original'].percent,100);assert.equal(records['23Original'].profile,7);assert.equal(records['24Original'],undefined);
 }finally{w.close();}
});
