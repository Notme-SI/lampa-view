const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;const module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}
test('Russian alternative titles exclude season aliases; English-language anime uses metadata',()=>{
 const {localizedTitle,isAnime}=mod('metadata'),card={name:'Cyberpunk: Edgerunners',original_name:'Cyberpunk: Edgerunners',original_language:'en',origin_country:['JP','PL','US'],genres:[{id:16}],alternative_titles:{results:[{iso_3166_1:'RU',title:'Киберпанк: Бегущие по краю 2',type:'season 2'},{iso_3166_1:'RU',title:'Киберпанк: Бегущие по краю',type:''}]}};
 assert.equal(localizedTitle(card),'Киберпанк: Бегущие по краю');assert.equal(localizedTitle(card,'en'),card.name);assert.equal(isAnime(card),true);assert.equal(isAnime({...card,genres:[{id:18}]}),false);assert.equal(isAnime({...card,origin_country:[],keywords:{results:[{id:210024,name:'anime'}]}}),true);assert.equal(card.original_name,'Cyberpunk: Edgerunners');
});

test('cartoon rows and native More pages exclude anime while other catalogues and server pagination stay intact',()=>{
 const {cataloguePlan}=mod('catalogue'),{installTmdb}=mod('tmdb');
 const json={page:2,total_pages:5,total_results:90,results:[
  {id:1,title:'Cartoon',genre_ids:[16],original_language:'en',origin_country:['US']},
  {id:2,title:'Anime movie',genre_ids:[16],original_language:'ja'},
  {id:3,name:'English dub anime',genre_ids:[16],original_language:'en',origin_country:['JP']},
  {id:4,name:'Donghua',genre_ids:[16],original_language:'zh'},
  {id:5,title:'Known anime',minimal_anime:true},
  {id:6,title:'French cartoon',genre_ids:[16],original_language:'fr'},
 ]};
 const source={get(path,params,ok){ok(json);},list(params,ok){ok(json);}},cub={list(params,ok){ok(json);}},L={Api:{sources:{tmdb:source,cub}}};installTmdb(L);
 for(const row of cataloguePlan('cartoon')){
  const check=result=>{assert.deepEqual(result.results.map(c=>c.id),[1,6]);assert.equal(result.page,2);assert.equal(result.total_pages,5);assert.equal(result.total_results,90);};
  if(row.cub)cub.list({url:row.cub,page:2},check);
  else {source.get(row.tmdb,{page:2},check);source.list({url:row.tmdb,page:2},check);}
 }
 source.list({url:'discover/tv?with_genres=16&with_original_language=ja',page:2},result=>assert.equal(result,json));
 assert.equal(json.results.length,6,'Do not mutate shared TMDB cache entries');
});

test('movies and series exclude animation on every CUB and TMDB row and subsequent More pages, without filtering anime or other lists',()=>{
 const {cataloguePlan,default:catalogue}=mod('catalogue'),{installTmdb}=mod('tmdb');
 const json={page:3,total_pages:7,total_results:140,results:[{id:1,name:'Series',genre_ids:[18]},{id:2,name:'Cartoon',genre_ids:[16,35]},{id:3,name:'Anime',minimal_anime:true},{id:4,name:'Cartoon genre objects',genres:[{id:16}]},{id:5,name:'Unknown genres'}]};
 const tmdb={get(path,p,ok){ok(json);},list(p,ok){ok(json);}},cub={list(p,ok){ok(json);}},L={Storage:{get:(k,d)=>d},Api:{sources:{tmdb,cub}}};installTmdb(L);installTmdb(L);
 const check=result=>{assert.deepEqual(result.results.map(c=>c.id),[1,5]);assert.equal(result.page,3);assert.equal(result.total_pages,7);assert.equal(result.total_results,140);};
 for(const row of [...cataloguePlan('tv'),...cataloguePlan('movie')]){
  assert.equal(new URLSearchParams(row.cub.slice(1)).get('without_genres'),'16');assert.equal(new URLSearchParams(row.tmdb.split('?')[1]).get('without_genres'),'16');
  cub.list({url:row.cub,page:3},check);tmdb.get(row.tmdb,{page:3},check);tmdb.list({url:row.tmdb,page:3},check);
 }
 for(const kind of ['tv','movie'])for(const source of ['cub','tmdb']){let answer;catalogue(L,{}, {url:kind,source},[],rows=>answer=rows);assert.equal(answer.length,source==='cub'?10:1);assert.ok(answer.every(row=>row.results.map(c=>c.id).join(',')==='1,5'));}
 for(const row of cataloguePlan('anime'))cub.list({url:row.cub,page:3},result=>assert.equal(result,json));
 cub.list({url:'?cat=tv&sort=top',page:3},result=>assert.equal(result,json));assert.equal(json.results.length,5);
});

test('cartoon watching row uses live CUB rankings for both formats, supports hidden rows and survives missing CUB',()=>{
 const {cataloguePlan,default:catalogue}=mod('catalogue'),watch=cataloguePlan('cartoon')[0];assert.equal(watch.title,'Сейчас смотрят');
 const calls=[],film={id:1,title:'Movie',media_type:'movie',genre_ids:[16],original_language:'en'},series={id:2,name:'Series',media_type:'tv',genre_ids:[16],original_language:'fr'},anime={id:3,name:'Anime',genre_ids:[16],original_language:'ja'};
 const L={Storage:{get:(k,d)=>d},Api:{sources:{cub:{list(p,ok){calls.push(p);ok({page:1,total_pages:4,results:[film,series,anime]});}},tmdb:{get(path,p,ok){ok({results:[film]});}}}}};
 for(const source of ['cub','tmdb']){let answer;catalogue(L,{}, {url:'cartoon',source},[],rows=>answer=rows);assert.equal(answer.length,2);assert.equal(answer[0].url,watch.cub);assert.equal(answer[0].source,'cub');assert.equal(answer[0].total_pages,4);assert.deepEqual(answer[0].results,[film,series]);}
 assert.equal(calls.length,2);assert.equal(new URLSearchParams(calls[0].url.slice(1)).get('sort'),'now_playing');assert.equal(new URLSearchParams(calls[0].url.slice(1)).get('genre'),'16');assert.equal(new URLSearchParams(calls[0].url.slice(1)).has('cat'),false);
 let hidden;catalogue(L,{}, {url:'cartoon'},[watch.cub],rows=>hidden=rows);assert.equal(calls.length,2);assert.equal(hidden[0].minimal_hidden,true);
 delete L.Api.sources.cub;let fallback;catalogue(L,{}, {url:'cartoon'},[],rows=>fallback=rows);assert.equal(fallback.length,2);assert.ok(fallback.every(row=>row.title!=='Сейчас смотрят'));
});
test('collection menu keeps all seven sections before their first visit, without fetching or inventing rows',()=>{
 const names={'main:':[{id:'A',title:'A'}],'search:':[{id:'B'}],'category_full:':[{id:'C'}],'category:tv':[{id:'D',title:'D'}],'category:anime':[{id:'E',title:'E'}]};let definition,select,writes=0;
 const data={minimal_collection_rows_v2:names,minimal_collection_names:{'main:':[{id:'obsolete',title:'TV Series I Have Seen'}]}},L={Storage:{get:(k,d)=>data[k]===undefined?d:data[k],set(){writes++;}},SettingsApi:{addParam(p){if(p.param.name==='minimal_rows')definition=p;}},Select:{show:v=>select=v},Api:{main(){}},Utils:{createInstance(){}},Maker:{get(){}}};
 mod('collections').default(L,{});definition.onChange();assert.deepEqual(select.items.map(i=>i.title),['Главная','Фильмы','Сериалы','Дорамы','ТВ-шоу','Мультфильмы','Аниме']);assert.ok(!/[—–]/.test(select.title));select.onSelect({id:'category:movie'});assert.equal(select.items.length,1);assert.equal(select.items[0].noenter,true);delete names['category:tv'];definition.onChange();assert.ok(select.items.some(row=>row.title==='Сериалы'));select.onSelect({id:'category:tv'});assert.equal(select.items[0].noenter,true);assert.equal(writes,0);
});
