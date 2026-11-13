const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}

test('Trakt rows respect saved native collection order and visibility by their semantic aliases',()=>{
 const {arrange}=mod('collections'),rows=[{url:'mixed/trending',title:'Сейчас смотрят',minimal_row_aliases:['?sort=now_playing']},{url:'minimal:continue',title:'Продолжить просмотр'},{url:'mixed/popular',title:'Популярное',minimal_row_aliases:['movie/popular']}];
 const prefs={order:['movie/popular','?sort=now_playing','minimal:continue']};assert.deepEqual(arrange(rows,prefs).map(row=>row.url),['mixed/popular','mixed/trending','minimal:continue']);assert.deepEqual(arrange(rows,{...prefs,hidden:['?sort=now_playing']}).map(row=>row.url),['mixed/popular','minimal:continue']);
});
test('home and anime split the same native history before local pagination, while the menu stays complete',()=>{
 const movie={id:1,title:'Фильм',original_title:'Film',source:'cub'},series={id:2,name:'Сериал',first_air_date:'2025',source:'tmdb'},anime={id:3,name:'Аниме',genre_ids:[16],original_language:'ja',first_air_date:'2025',source:'cub'},history=[movie,series,anime,{...movie,source:'tmdb'},{id:4,title:'Готово'},{id:5,title:'Брошен'},{id:6,title:'Досмотрен',original_title:'Finished'}];
 const store={},L={Storage:{get:(k,d)=>store[k] || d},Favorite:{get:({type})=>type==='history'?history:type==='viewed'?[{id:4}]:[{id:5}]},Timeline:{view:hash=>({percent:hash==='Finished'?95:25})},Utils:{hash:s=>s},Api:{sources:{}}};
 const build=mod('continue-watching').default(L),rows=build([{title:'Сейчас смотрят',results:[movie]},{title:'Продолжить просмотр',results:[series]},{title:'Новинки',results:[movie]}]);
 assert.deepEqual(rows.map(r=>r.title),['Сейчас смотрят','История просмотра','Новинки']);assert.deepEqual(rows[1].results.map(r=>r.id),[1,2,4,5,6]);assert.deepEqual(L.Favorite.get({type:'history'}).map(r=>r.id),[1,2,3,4,5,6]);assert.equal(history.length,7);
 history.push(...Array.from({length:24},(_,i)=>({id:i+100,title:'Фильм '+i,source:'cub'})));let page;
 L.Api.sources.minimal_continue.list({url:'minimal:continue',page:2},r=>page=r);assert.equal(page.results.length,9);assert.equal(page.total_pages,2);assert.equal(page.results[0].id,115);
 L.Api.sources.minimal_continue.list({url:'minimal:anime-history',page:1},r=>page=r);assert.deepEqual(page.results.map(card=>card.id),[3]);assert.equal(page.total_pages,1);
});
test('main adds the personal row below watching with existing preferences, lets settings hide it, and keeps an empty row configurable',()=>{
 const store={minimal_home_compact:false,minimal_collections:{'main:':{order:['watch','new']}}},params=[];let selected;
 const L={Storage:{get:(k,d)=>store[k]===undefined?d:store[k],set:(k,v)=>store[k]=v},Favorite:{get:({type})=>type==='history'?[{id:1,title:'Фильм',source:'cub'}]:[]},SettingsApi:{addParam:p=>params.push(p)},Select:{show:o=>selected=o},Controller:{toggle(){}},Api:{sources:{},main:(p,ok)=>{ok([{url:'watch',title:'Сейчас смотрят',results:[{id:11,title:'Фильм'}]},{url:'new',title:'Новинки',results:[{id:12,title:'Фильм'}]}]);return ()=>assert.fail('no next page');}},Maker:{get(){}},Utils:{createInstance(){}}};
 const api=mod('collections').default(L,{});let rows;assert.equal(L.Api.main({component:'main'},r=>rows=r),undefined);assert.deepEqual(rows.map(r=>r.url),['watch','minimal:continue','new']);assert.ok(!params.some(p=>p.param.name==='minimal_home_compact'));
 api.menu();selected.onSelect({id:'main:'});selected.onSelect(selected.items.find(r=>r.id==='minimal:continue'));selected.onSelect({id:'toggle'});L.Api.main({component:'main'},r=>rows=r);assert.deepEqual(rows.map(r=>r.url),['watch','new']);
 L.Favorite.get=()=>[];L.Api.main({component:'main'},r=>rows=r);api.menu();selected.onSelect({id:'main:'});assert.equal(selected.items.find(r=>r.id==='minimal:continue').subtitle,'Появится после добавления в историю');assert.equal(rows.length,2);
});
test('built plugin renders local continue cards through native Lampa and preserves their source when opened',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  const movie={id:701,title:'Мой фильм',original_title:'My Film',release_date:'2025-01-01',poster_path:'/poster.jpg',source:'tmdb'},series={id:702,name:'Мой сериал',original_name:'My Series',first_air_date:'2025-01-01',poster_path:'/series.jpg',source:'cub'};
  L.Favorite.add('history',movie);L.Favorite.add('history',series);
  L.Api.sources.cub.main=(p,ok)=>w.setTimeout(()=>ok([{title:'Сейчас смотрят',url:'?sort=now_playing',source:'cub',results:[movie]}]),0);
  L.Activity.push({component:'main',source:'cub',url:'',page:1});await new Promise(r=>setTimeout(r,150));
  const component=L.Activity.active().activity.component;assert.equal(component.items[1].data.url,'minimal:continue');assert.deepEqual(Array.from(component.items[1].data.results,r=>r.id),[702,701]);
  let route;L.Activity.push=p=>route=p;const row=component.items[1];row.render(true).querySelector('.card').dispatchEvent(new w.CustomEvent('hover:enter',{bubbles:true}));assert.equal(route.source,'cub');assert.equal(route.id,702);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('history localizes copies consistently without changing native records or movie/series identities',()=>{
 const movie={id:2000000007,media_type:'movie',title:'Movie',original_title:'Movie',source:'cub'},series={id:movie.id,media_type:'tv',title:'Cyberpunk: Edgerunners',name:'Киберпанк: Бегущие по краю',original_title:'Cyberpunk: Edgerunners',source:'tmdb',minimal_anime:true};
 const records=[movie,series,{...movie,source:'tmdb'}],L={Storage:{get:(k,d)=>d},Favorite:{get:()=>records},Api:{sources:{}}};
 const build=mod('continue-watching').default(L),home=build([])[0].results,menu=L.Favorite.get({type:'history'});let anime;
 build.preview('minimal:anime-history',row=>anime=row.results);
 assert.deepEqual(menu,[...home,...anime]);assert.equal(home.length,1);assert.equal(anime[0].title,series.name);assert.equal(anime[0].original_title,'Cyberpunk: Edgerunners');assert.equal(records[1].title,'Cyberpunk: Edgerunners');assert.equal(records.length,3);
});

test('CUB history fills filtered pages in server order, keeps progress and switches profile during a request',()=>{
 const {default:install,CONTINUE,ANIME_HISTORY}=mod('continue-watching'),calls=[];
 const profile={id:1},L={Storage:{get:(k,d)=>d},Favorite:{get:()=>[]},Api:{sources:{}},Account:{Permit:{sync:true,account:{profile}},Api:{watchHistory:(params,ok)=>calls.push({params,ok,profile:profile.id})}}};
 const build=install(L),source=L.Api.sources.minimal_continue,movie={id:2000000080,title:'Film',source:'cub'};
 const anime=id=>({id,name:'Anime '+id,source:'tmdb',minimal_anime:true,watch_history:{watched_at:300-id}});
 function respond(page,results,total_pages=3){
  const call=calls.shift();assert.equal(call.params.page,page);call.ok({page,results,total_pages});return call.profile;
 }
 let result;
 build.preview(ANIME_HISTORY,row=>result=row);
 respond(1,[movie]);respond(2,Array.from({length:20},(_,i)=>anime(i+1)));assert.equal(result,undefined);
 respond(3,[anime(20),anime(21),{...movie,id:movie.id+1}]);
 assert.deepEqual(result.results.map(card=>card.id),Array.from({length:20},(_,i)=>i+1));assert.equal(result.total_pages,2);
 assert.equal(result.results[0].source,'tmdb');assert.equal(result.results[0].watch_history.watched_at,299);
 source.list({url:ANIME_HISTORY,page:2},value=>result=value);
 respond(2,Array.from({length:20},(_,i)=>anime(i+1)));respond(3,[anime(20),anime(21)]);
 assert.deepEqual(result.results.map(card=>card.id),[21]);assert.equal(result.total_pages,2);
 source.list({url:CONTINUE,page:1},value=>result=value);
 respond(2,[anime(1)]);respond(3,[anime(2),{...movie,id:movie.id+1}]);
 assert.deepEqual(result.results.map(card=>card.id),[movie.id,movie.id+1]);
 result=null;build.preview(ANIME_HISTORY,row=>result=row);
 profile.id=2;assert.equal(respond(2,[anime(90)]),1);assert.equal(result,null);
 assert.equal(respond(1,[anime(95)],1),2);assert.deepEqual(result.results.map(card=>card.id),[95]);
});

test('anime history is inserted once near the start of Standard, Shikimori and Trakt catalogues',()=>{
 const {default:install}=mod('collections'),url='minimal:anime-history';
 const anime={id:2000000003,name:'Anime history',source:'tmdb',minimal_anime:true,watch_history:{watched_at:10}};
 for(const [mode,source] of [['standard','cub'],['shikimori','tmdb'],['standard','trakt']]){
  const store={minimal_anime_catalogue:mode,source};let history=[anime],id=2000001000;
  const result=ok=>ok({page:1,total_pages:1,results:[{id:id++,title:'Editorial',source:'tmdb'}]});
  const L={Storage:{get:(key,fallback)=>store[key]??fallback,set:(key,value)=>store[key]=value},Favorite:{get:()=>history},
   SettingsApi:{addParam(){}},Utils:{createInstance(){}},Maker:{get(){}},
   Api:{main(){},category(p,ok){ok([{url:'trakt-row',title:'Editorial',results:[{id:id++}]}]);},sources:{
    cub:{list:(p,ok)=>result(ok)},tmdb:{get:(route,p,ok)=>result(ok)}
   }}};
  install(L,{list:(p,ok)=>result(ok)});
  const object={component:'category',url:'anime',source};let rows;
  const next=L.Api.category({...object},value=>rows=value);
  assert.equal(rows[1].url,url);assert.deepEqual(rows[1].results.map(card=>[card.id,card.source,card.watch_history.watched_at]),[[anime.id,'tmdb',10]]);
  assert.equal(rows.filter(row=>row.url===url).length,1);
  if(next)next(value=>assert.ok(!value.some(row=>row.url===url)));
  history=[];L.Api.category({...object},value=>rows=value);assert.ok(!rows.some(row=>row.url===url));
 }
});

test('native Anime history More opens the filtered grid and retains the original card source',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  for(let i=0;i<21;i++)L.Favorite.add('history',{id:2000100000+i,name:'History anime '+i,original_name:'History anime '+i,first_air_date:'2025-01-01',genre_ids:[16],original_language:'ja',minimal_anime:true,poster_path:'/poster.jpg',source:'tmdb'});
  L.Api.sources.cub.list=(params,ok)=>w.setTimeout(()=>ok({page:1,total_pages:1,results:[{id:2000200000,title:'Editorial',source:'cub'}]}),0);
  L.Activity.push({component:'category',url:'anime',source:'cub',page:1});
  await new Promise(resolve=>setTimeout(resolve,200));
  const row=L.Activity.active().activity.component.items.find(item=>item.data?.url==='minimal:anime-history');
  assert.ok(row);assert.equal(row.data.results.length,20);assert.equal(row.data.total_pages,2);
  row.visible();const more=row.render(true).querySelector('.items-line__more');assert.ok(more);
  more.dispatchEvent(new w.CustomEvent('hover:enter',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,150));
  const active=L.Activity.active();assert.equal(active.component,'category_full');assert.equal(active.source,'minimal_continue');assert.equal(active.url,'minimal:anime-history');
  const data=active.activity.component.items[0].data;assert.equal(data.id,2000100020);assert.equal(data.source,'tmdb');
  let route;L.Activity.push=params=>route=params;
  active.activity.render(true).querySelector('.card').dispatchEvent(new w.CustomEvent('hover:enter',{bubbles:true}));
  assert.equal(route.source,'tmdb');assert.equal(route.id,data.id);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('native history grid keeps loading when the filtered CUB page count grows beyond two pages',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  const records=Array.from({length:45},(_,i)=>({id:2000300000+i,name:'Cloud anime '+i,original_name:'Cloud anime '+i,source:'tmdb',minimal_anime:true,first_air_date:'2025-01-01',poster_path:'/poster.jpg'}));
  L.Account.Timeline.update=()=>{};
  L.Storage.set('account',{token:'fixture',profile:{id:1}},true);L.Storage.set('account_use','true',true);
  w.lampa_settings.account_use=true;w.lampa_settings.account_sync=true;
  L.Account.Api.watchHistory=(params,ok)=>w.setTimeout(()=>ok({page:params.page,total_pages:3,results:records.slice((params.page-1)*20,params.page*20)}),0);
  L.Activity.push({component:'category_full',url:'minimal:anime-history',source:'minimal_continue',page:1,title:'Anime history'});
  await new Promise(resolve=>setTimeout(resolve,150));
  const grid=L.Activity.active().activity.component;
  assert.equal(grid.total_pages,2);
  for(const page of [2,3]){
   grid.builded_time=0;grid.emit('loadNext');
   await new Promise(resolve=>setTimeout(resolve,100));
   while(grid.loaded.length)grid.emit('pushLoaded');
   assert.equal(grid.object.page,page);assert.equal(grid.total_pages,3);
  }
  assert.equal(grid.items.length,45);assert.equal(grid.items.at(-1).data.id,records.at(-1).id);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
