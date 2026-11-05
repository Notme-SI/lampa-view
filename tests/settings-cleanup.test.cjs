const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,m={exports:{}};new Function('module','exports',code)(m,m.exports);return m.exports;}

test('annual rows ignore the removed switch and expose stable IDs without losing movie/TV coordinates',()=>{
 const rows=[],settings=[],L={Storage:{get:(key,fallback)=>key==='mpv_plus_recent_rows'?false:fallback,value:()=>false},Listener:{follow(){}},ContentRows:{add:row=>rows.push(row)},SettingsApi:{addComponent(){},addParam:row=>settings.push(row)},TMDB:{api:path=>'http://example/'+path,key:()=> 'test'},Reguest:function(){this.timeout=()=>{};this.silent=(url,ok)=>ok({results:[{id:1,title:'Название'}]});}},context={Lampa:L,appready:true};context.window=context;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../vendor/pars.js'),'utf8'),context);
 assert.equal(rows.length,3);assert.ok(!settings.some(row=>row.param.name==='mpv_plus_recent_rows'));
 const output=[];for(const row of rows){const load=row.call();assert.equal(typeof load,'function');load(data=>output.push(data));}
 assert.equal(output[2].title,'Популярные сериалы за год');assert.equal(output[2].minimal_row_id,'minimal:annual:popular_series');assert.equal(output[2].results[0].media_type,'tv');
 const old='discover/tv?language=ru&sort_by=popularity.desc&first_air_date.gte=2025-01-01&first_air_date.lte=2026-01-01&vote_count.gte=20&include_adult=false';
 assert.equal(mod('collections').arrange(output,{hidden:[old]}).length,2,'Old dated preferences still match the stable annual row');
});

test('collection settings follow Trakt versus discovery and both anime tabs, replacing stale cached definitions',()=>{
 const storage={source:'trakt',minimal_collection_rows_v2:{'category:tv':[{id:'old',title:'Устаревшая подборка'}]}},data={};let definition,menu;
 const L={Storage:{get:(k,d)=>storage[k] ?? d,set:(k,v)=>storage[k]=v},SettingsApi:{addParam:p=>definition=p},Select:{show:p=>menu=p},Api:{main(p,ok){ok(data[p.source] || []);},sources:{cub:{list(){}},tmdb:{}}},Utils:{createInstance(){}},Maker:{get(){}}};mod('collections').default(L,{});
 const open=id=>{definition.onChange();menu.onSelect({id});return menu.items.filter(row=>row.id!=='reset');};
 for(const kind of ['movie','tv','cartoon']){const rows=open('category:'+kind);assert.ok(rows.every(row=>/^(movies|shows)\//.test(row.id)));assert.ok(rows.some(row=>row.id.includes('watched/weekly')));assert.ok(!rows.some(row=>row.id==='old'));}
 const shows=open('category:tvshow');assert.equal(shows.length,6);assert.ok(shows.every(row=>row.id.startsWith('minimal:discover:tvshow:')));
 const anime=open('category:anime');assert.ok(anime.every(row=>row.id.startsWith('?cat=anime')));
 storage.minimal_anime_catalogue='shikimori';const shiki=open('category:anime');assert.ok(shiki.every(row=>row.id.includes('order=') || row.id==='minimal:shikimori:all'));assert.ok(shiki.some(row=>row.id==='order=ranked'));
 storage.source='tmdb';assert.ok(open('category:tv').every(row=>row.id.startsWith('minimal:discover:tv:')));
 data.cub=[{title:'Ряд CUB',url:'cub-only',results:[{id:1}]}];data.tmdb=[{title:'Ряд TMDB',url:'tmdb-only',results:[{id:2}]}];
 L.Api.main({source:'cub'},()=>{});assert.ok(open('main:').some(row=>row.id==='cub-only'));L.Api.main({source:'tmdb'},()=>{});const current=open('main:');assert.ok(current.some(row=>row.id==='tmdb-only'));assert.ok(!current.some(row=>row.id==='cub-only'));
});

test('compact discovery keeps broad coverage without niche or duplicate rows and upcoming survives the host released-only filter',()=>{
 const {cataloguePlan}=mod('catalogue'),{default:install,discoverySpec}=mod('discovery-source');
 for(const kind of ['movie','tv']){
  const plan=cataloguePlan(kind);assert.ok(plan.length<=15);assert.equal(new Set(plan.map(row=>row.title)).size,plan.length);assert.equal(new Set(plan.map(row=>row.tmdb)).size,plan.length);
  assert.ok(!plan.some(row=>row.key==='country-GB' || [99,10402,10752,10751,10770].includes(Number(row.discovery.genre))));
  const announced=plan.find(row=>row.key==='upcoming');assert.equal(announced.title,'Ожидаемые');assert.ok(discoverySpec(announced.discovery));
  const field=kind==='movie'?'primary_release_date':'first_air_date',q=new URLSearchParams(announced.tmdb.split('?')[1]);assert.ok(q.get(field+'.gte')>new Date().toISOString().slice(0,10));assert.equal(q.has(field+'.lte'),false);
 }
 const requested=[],future=(new Date().getFullYear()+1)+'-06-01',L={Storage:{get:(key,fallback)=>key==='tmdb_only_released'?true:fallback,set:assert.fail},TMDB:{api:path=>'http://configured.example/tmdb/'+path,key:()=> 'test-key'},Api:{sources:{tmdb:{get:()=>assert.fail('Do not pass announced titles through the host released-only filter')}}},Reguest:function(){this.timeout=()=>{};this.silent=(url,ok)=>{const parsed=new URL(url),page=Number(parsed.searchParams.get('page'));requested.push(parsed);ok({page,total_pages:2,results:Array.from({length:20},(_,i)=>({id:page*100+i,title:'Будущий проект',name:'Будущий проект',release_date:future,first_air_date:future,genre_ids:[18],poster_path:'/p.jpg',backdrop_path:'/b.jpg'})).concat([{id:1,title:'Старый проект',name:'Старый проект',release_date:'2020-01-01',first_air_date:'2020-01-01',genre_ids:[18],poster_path:'/p.jpg',backdrop_path:'/b.jpg'}])});};}},api=install(L);
 for(const kind of ['movie','tv']){const row=cataloguePlan(kind).find(row=>row.key==='upcoming');for(const page of [1,2]){let output;api.list({url:JSON.stringify(row.discovery),page},result=>output=result,assert.fail);assert.equal(output.results.length,20);assert.equal(output.page,page);assert.ok(output.results.every(card=>card.id!==1));}}
 assert.equal(requested.length,4);assert.ok(requested.every(url=>url.origin==='http://configured.example' && url.searchParams.get('language')==='ru'));
});
