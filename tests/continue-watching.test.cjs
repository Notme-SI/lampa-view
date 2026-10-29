const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}

test('Trakt rows respect saved native collection order and visibility by their semantic aliases',()=>{
 const {arrange}=mod('collections'),rows=[{url:'mixed/trending',title:'Сейчас смотрят',minimal_row_aliases:['?sort=now_playing']},{url:'minimal:continue',title:'Продолжить просмотр'},{url:'mixed/popular',title:'Популярное',minimal_row_aliases:['movie/popular']}];
 const prefs={order:['movie/popular','?sort=now_playing','minimal:continue']};assert.deepEqual(arrange(rows,prefs).map(row=>row.url),['mixed/popular','mixed/trending','minimal:continue']);assert.deepEqual(arrange(rows,{...prefs,hidden:['?sort=now_playing']}).map(row=>row.url),['mixed/popular','minimal:continue']);
});
test('personal row uses local mixed history, excludes finished and discarded titles, deduplicates, and paginates locally',()=>{
 const movie={id:1,title:'Фильм',original_title:'Film',source:'cub'},series={id:2,name:'Сериал',first_air_date:'2025',source:'tmdb'},anime={id:3,name:'Аниме',original_language:'ja',first_air_date:'2025',source:'cub'},history=[movie,series,anime,{...movie,source:'tmdb'},{id:4,title:'Готово'},{id:5,title:'Брошен'},{id:6,title:'Досмотрен',original_title:'Finished'}];
 const store={},L={Storage:{get:(k,d)=>store[k] || d},Favorite:{get:({type})=>type==='history'?history:type==='viewed'?[{id:4}]:[{id:5}]},Timeline:{view:hash=>({percent:hash==='Finished'?95:25})},Utils:{hash:s=>s},Api:{sources:{}}};
 const build=mod('continue-watching').default(L),rows=build([{title:'Сейчас смотрят',results:[movie]},{title:'Продолжить просмотр',results:[series]},{title:'Новинки',results:[movie]}]);
 assert.deepEqual(rows.map(r=>r.title),['Сейчас смотрят','Продолжить просмотр','Новинки']);assert.deepEqual(rows[1].results.map(r=>r.id),[1,2,3]);assert.equal(history.length,7);
 history.push(...Array.from({length:24},(_,i)=>({id:i+100,title:'Фильм '+i,source:'cub'})));let page;L.Api.sources.minimal_continue.list({page:2},r=>page=r);assert.equal(page.results.length,7);assert.equal(page.total_pages,2);assert.equal(page.results[0].id,117);
});
test('main adds the personal row below watching with existing preferences, lets settings hide it, and keeps an empty row configurable',()=>{
 const store={minimal_home_compact:false,minimal_collections:{'main:':{order:['watch','new']}}},params=[];let selected;
 const L={Storage:{get:(k,d)=>store[k]===undefined?d:store[k],set:(k,v)=>store[k]=v},Favorite:{get:({type})=>type==='history'?[{id:1,title:'Фильм',source:'cub'}]:[]},SettingsApi:{addParam:p=>params.push(p)},Select:{show:o=>selected=o},Controller:{toggle(){}},Api:{sources:{},main:(p,ok)=>{ok([{url:'watch',title:'Сейчас смотрят',results:[1]},{url:'new',title:'Новинки',results:[2]}]);return ()=>assert.fail('no next page');}},Maker:{get(){}},Utils:{createInstance(){}}};
 const api=mod('collections').default(L,{});let rows;assert.equal(L.Api.main({component:'main'},r=>rows=r),undefined);assert.deepEqual(rows.map(r=>r.url),['watch','minimal:continue','new']);assert.ok(!params.some(p=>p.param.name==='minimal_home_compact'));
 api.menu();selected.onSelect({id:'main:'});selected.onSelect(selected.items.find(r=>r.id==='minimal:continue'));selected.onSelect({id:'toggle'});L.Api.main({component:'main'},r=>rows=r);assert.deepEqual(rows.map(r=>r.url),['watch','new']);
 L.Favorite.get=()=>[];L.Api.main({component:'main'},r=>rows=r);api.menu();selected.onSelect({id:'main:'});assert.equal(selected.items.find(r=>r.id==='minimal:continue').subtitle,'Появится после начала просмотра');assert.equal(rows.length,2);
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
