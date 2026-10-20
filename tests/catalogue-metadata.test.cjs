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
 const source={get(path,params,ok){ok(json);},list(params,ok){ok(json);}},L={Api:{sources:{tmdb:source}}};installTmdb(L);
 for(const row of cataloguePlan('cartoon')){
  const check=result=>{assert.deepEqual(result.results.map(c=>c.id),[1,6]);assert.equal(result.page,2);assert.equal(result.total_pages,5);assert.equal(result.total_results,90);};
  source.get(row.tmdb,{page:2},check);source.list({url:row.tmdb,page:2},check);
 }
 source.list({url:'discover/tv?with_genres=16&with_original_language=ja',page:2},result=>assert.equal(result,json));
 assert.equal(json.results.length,6,'Do not mutate shared TMDB cache entries');
});
test('collection menu keeps all five sections before their first visit, without fetching or inventing rows',()=>{
 const names={'main:':[{id:'A',title:'A'}],'search:':[{id:'B'}],'category_full:':[{id:'C'}],'category:tv':[{id:'D',title:'D'}],'category:anime':[{id:'E',title:'E'}]};let definition,select,writes=0;
 const data={minimal_collection_rows_v2:names,minimal_collection_names:{'main:':[{id:'obsolete',title:'TV Series I Have Seen'}]}},L={Storage:{get:(k,d)=>data[k]===undefined?d:data[k],set(){writes++;}},SettingsApi:{addParam(p){if(p.param.name==='minimal_rows')definition=p;}},Select:{show:v=>select=v},Api:{main(){}},Utils:{createInstance(){}},Maker:{get(){}}};
 mod('collections').default(L,{});definition.onChange();assert.deepEqual(select.items.map(i=>i.title),['Главная','Фильмы','Сериалы','Мультфильмы','Аниме']);assert.ok(!/[—–]/.test(select.title));select.onSelect({id:'category:movie'});assert.equal(select.items.length,1);assert.equal(select.items[0].noenter,true);delete names['category:tv'];definition.onChange();assert.ok(select.items.some(row=>row.title==='Сериалы'));select.onSelect({id:'category:tv'});assert.equal(select.items[0].noenter,true);assert.equal(writes,0);
});
