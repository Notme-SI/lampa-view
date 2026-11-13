const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
function load(w,file,name){w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+file+'.js')],bundle:true,write:false,format:'iife',globalName:name}).outputFiles[0].text);return w[name];}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('CUB refresh uses the native account transport on foreground and coalesces duplicate lifecycle events',async()=>{
 const d=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;
 try{let calls=0,bookmarkReads=0;const hooks={},L={Storage:{get:(k,f)=>f},Account:{Bookmarks:{update(){bookmarkReads++;}},Permit:{sync:true},Timeline:{update(){calls++;}}},Listener:{follow:(name,fn)=>hooks[name]=fn}};
  const sync=load(w,'progress-sync','Sync').default(L,()=>true);w.dispatchEvent(new w.Event('focus'));hooks.activity({type:'start'});await wait(400);assert.equal(calls,1);
  w.dispatchEvent(new w.Event('focus'));await wait(400);assert.equal(calls,1,'Foreground events are bounded, not a polling loop');assert.equal(bookmarkReads,0,'The plugin must not launch competing native bookmark refreshes');
  L.Account.Permit.sync=false;w.dispatchEvent(new w.Event('focus'));await wait(400);assert.equal(calls,1);sync.stop();
 }finally{w.close();}
});
test('manual native timeline writes preserve profile and duration; remote read invalidates cached episode history',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
  const hooks={},records={},saved={file_view_7:records,online_watched_last:{}};
  const L={Account:{Permit:{sync:true,account:{profile:{id:7}}}},Utils:{hash:x=>x},Storage:{get:(k,f)=>saved[k] || f,set:(k,v)=>saved[k]=v},Timeline:{filename:()=> 'file_view_7',listener:{follow:(event,fn)=>hooks[event]=fn},view:hash=>({...records[hash],hash}),update:value=>records[value.hash]={...value,updated:1},read(){hooks.read();}}};
  const api=load(w,'online-state','State').default(L),card={name:'Сериал',original_name:'Original',number_of_seasons:2,seasons:[{season_number:1,episode_count:10},{season_number:2,episode_count:10}],episode_run_time:[47]};
  api.setWatched(card,1,3,true);assert.equal(records['13Original'].profile,7);assert.equal(records['13Original'].time,0);assert.equal(api.lastWatched(card).episode,3);
  records['24Original']={percent:35,time:915,duration:2800,profile:7,updated:2};hooks.read();assert.equal(api.lastWatched(card).season,2);assert.equal(api.lastWatched(card).episode,4);assert.equal(api.lastWatched(card).time,915);
  api.clearProgress(card,2,4);assert.equal(records['24Original'].profile,7);assert.equal(records['24Original'].percent,0);
 }finally{w.close();}
});
test('watched caption describes the factual episode and only collapses a finished season',()=>{
 const d=new JSDOM('<body><div class="card focus"><div class="card__view"></div></div></body>',{runScripts:'outside-only'}),w=d.window;try{
  let last={season:1,episode:3,hash:'13Original',percent:100,time:2832,duration:2832};let allWatched=false;w.LampaView={online:{lastWatched:()=>last,seasonWatched:()=>allWatched}};
  const L={Utils:{hash:x=>x},Timeline:{view:()=>({...last}),render:()=>{const n=w.document.createElement('div');n.className='time-line';n.dataset.hash=last.hash;n.innerHTML='<div></div>';return n;}},TimeTable:{get:()=>[]}};
  const api=load(w,'series-status','Status').default(L,()=>{}),node=w.document.querySelector('.card'),card={id:3,name:'Сериал',source:'minimal_shiki',seasons:[{season_number:1,episode_count:10}],next_episode_to_air:{season_number:1,episode_number:9}};
  api.track(node,card);api.paint(node);assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Просмотрено: Серия 3 · Сезон 1');assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__time').textContent,'');assert.equal(node.querySelector('.time-line>div').style.width,'100%');
  last={...last,episode:8,hash:'18Original'};api.paint(node);assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Просмотрено: Серия 8 · Сезон 1');
  last={...last,episode:10,hash:'110Original'};delete card.next_episode_to_air;card.last_episode_to_air={season_number:1,episode_number:10,air_date:'2020-01-01'};api.track(node,card);api.paint(node);assert.equal(node.querySelector('.pt-card-watch').classList.contains('pt-card-watch--complete'),true,'A completed episode hides its rail');assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Просмотрено: Серия 10 · Сезон 1','A completed last episode alone does not complete a season');
  allWatched=true;api.paint(node);assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Сезон 1 просмотрен');assert.equal(node.querySelector('.pt-card-watch').classList.contains('pt-card-watch--complete'),true);
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

test('all ten native 95-percent Cyberpunk marks complete the season, but a missing or partial episode never does',()=>{
 const d=new JSDOM('<body><div class="card focus"><div class="card__view"></div></div></body>',{runScripts:'outside-only'}),w=d.window;try{
  const records={},hooks={},saved={file_view:records};
  for(let episode=1;episode<=10;episode++)records['2'+episode+'Cyberpunk: Edgerunners']={percent:95,time:0,duration:0,updated:episode};
  const L={Utils:{hash:x=>x},Storage:{get:(key,fallback)=>saved[key] || fallback},TimeTable:{get:()=>[]},Timeline:{filename:()=> 'file_view',listener:{follow:(event,fn)=>hooks[event]=fn},view:hash=>({...records[hash],hash}),render:value=>{const n=w.document.createElement('div');n.className='time-line';n.dataset.hash=value.hash;n.innerHTML='<div></div>';return n;}}};
  const online=load(w,'online-state','State').default(L);w.LampaView={online};
  const api=load(w,'series-status','Status').default(L,()=>{}),node=w.document.querySelector('.card'),card={id:3,name:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',source:'minimal_shiki',seasons:[{season_number:2,episode_count:10}],last_episode_to_air:{season_number:2,episode_number:10,air_date:'2020-01-01'}};
  api.track(node,card);api.paint(node);assert.equal(node.querySelector('.pt-card-watch__label').textContent,'Сезон 2 просмотрен');assert.ok(node.querySelector('.pt-card-watch--complete'));assert.equal(node.querySelector('.pt-card-watch__time').textContent,'','A manual mark does not invent elapsed time');
  records['210Cyberpunk: Edgerunners']={percent:40,time:915,updated:11};hooks.update();api.paint(node);assert.equal(node.querySelector('.pt-card-watch--complete'),null);assert.equal(node.querySelector('.pt-card-watch__label').textContent,'Просмотрено: Серия 10 · Сезон 2');assert.equal(node.querySelector('.pt-card-watch__time').textContent,'15:15');
  records['210Cyberpunk: Edgerunners']={percent:95,time:0,updated:12};delete records['25Cyberpunk: Edgerunners'];hooks.update();api.paint(node);assert.equal(node.querySelector('.pt-card-watch__label').textContent,'Просмотрено: Серия 10 · Сезон 2','A completed final episode cannot replace a missing earlier mark');assert.equal(online.seasonWatched(card,2,10),false);
  records['25Cyberpunk: Edgerunners']={percent:89,time:915};hooks.update();api.paint(node);assert.equal(node.querySelector('.pt-card-watch__label').textContent,'Просмотрено: Серия 10 · Сезон 2','An episode below the completion threshold remains incomplete');assert.equal(online.seasonWatched(card,2,10),false);
 }finally{w.close();}
});


test('shared episodes remain discoverable beyond stale card season metadata and local resume hints',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
  const records={'214Stars':{percent:100,time:0,updated:10},'34Stars':{percent:45,time:915,duration:2800,updated:20}},saved={file_view:records,online_watched_last:{Stars:{season:2,episode:14}}};
  const L={Utils:{hash:x=>x},Storage:{get:(k,v)=>saved[k] || v},Timeline:{filename:()=> 'file_view'}};
  const online=load(w,'online-state','State').default(L),card={id:10,name:'Звёзды в джунглях',original_name:'Stars',number_of_seasons:2,seasons:[{season_number:2,episode_count:14}]};
  const last=online.lastWatched(card);assert.equal(last.season,3);assert.equal(last.episode,4);assert.equal(last.time,915);
  saved.online_watched_last.Stars={season:3,episode:2};assert.equal(online.lastWatched(card).hash,last.hash);
 }finally{w.close();}
});


test('a completed Kerry episode waits for season facts and returns directly to the cached completed-season caption',async()=>{
 const d=new JSDOM('<body><div class="card focus"><div class="card__view"></div></div></body>',{runScripts:'outside-only'}),w=d.window;try{
  let requests=0,finish;const saved={},last={season:1,episode:8,hash:'18Kerry',percent:100,time:0,duration:0};
  w.LampaView={online:{lastWatched:()=>last,seasonWatched:()=>true}};
  const L={Storage:{get:(k,v)=>saved[k] || v,set:(k,v)=>saved[k]=v},Utils:{hash:x=>x},Api:{sources:{tmdb:{get:(path,p,ok)=>{requests++;finish=ok;}}}},TimeTable:{get:()=>[]},Timeline:{view:()=>last,render:()=>{const line=w.document.createElement('div');line.className='time-line';line.dataset.hash=last.hash;line.innerHTML='<div></div>';return line;}}};
  let api=load(w,'series-status','Status').default(L,node=>api.paint(node)),node=w.document.querySelector('.card'),card={id:48,name:'Кэрри',original_name:'Kerry',source:'tmdb'};
  api.track(node,card);api.paint(node);assert.equal(requests,1);assert.equal(node.querySelector('.pt-card-watch--has-progress'),null,'Do not flash episode 8 while completion facts are pending');
  finish({id:48,seasons:[{season_number:1,episode_count:8}],last_episode_to_air:{season_number:1,episode_number:8,air_date:'2020-01-01'},next_episode_to_air:null});
  assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Сезон 1 просмотрен');await wait(170);
  api=load(w,'series-status','Status2').default(L,()=>{});api.track(node,card);api.paint(node);assert.equal(requests,1,'Bounded release metadata survives a new screen/session');assert.equal(node.querySelector('.pt-card-watch__current .pt-card-watch__label').textContent,'Сезон 1 просмотрен');
 }finally{w.close();}
});

test('range marks batch native reads, retain actual time/profile and ignore known future entries and other seasons',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
  const records={'13Original':{percent:40,time:915,duration:2800,profile:7},'23Original':{percent:50,time:100}},saved={file_view_7:records};let reads=0,count;
  const L={Utils:{hash:x=>x},Storage:{get:(k,v)=>saved[k] || v,set:(k,v)=>saved[k]=v},Timeline:{filename:()=> 'file_view_7',view:hash=>records[hash] || {profile:7},update:value=>records[value.hash]=value,read:()=>reads++}},api=load(w,'online-state','RangeState').default(L);
  api.setPreviousWatched({name:'Сериал',original_name:'Original'},1,3,n=>count=n,[{episode:2,soon:true},{episode:3,hash:'provider-3'}]);
  assert.equal(count,2);assert.equal(reads,1);assert.equal(records['13Original'].time,915);assert.equal(records['13Original'].profile,7);assert.equal(records['11Original'].time,0);assert.equal(records['12Original'],undefined);assert.equal(records['14Original'],undefined);assert.equal(records['23Original'].time,100);assert.equal(records['provider-3'].percent,100);
 }finally{w.close();}
});


test('a late bulk-mark metadata response cannot mark another account profile',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
  let profile='file_view_7',finish,writes=0;const L={Utils:{hash:x=>x},Storage:{get:(k,v)=>v,set(){}},Api:{sources:{tmdb:{get:(path,p,ok)=>finish=ok}}},Timeline:{filename:()=>profile,view:()=>({}),update:()=>writes++,read(){}}};
  const api=load(w,'online-state','BulkRace').default(L);api.setAllWatched({id:8,name:'Сериал',original_name:'Original',source:'tmdb'});profile='file_view_8';finish({id:8,seasons:[{season_number:1,episode_count:2}],last_episode_to_air:{season_number:1,episode_number:2,air_date:'2020-01-01'}});assert.equal(writes,0);
 }finally{w.close();}
});
