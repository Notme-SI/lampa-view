const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),vm=require('node:vm');
const source=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/episode-metadata.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text;
function fixture(){const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,setTimeout});return module.exports;}
const card={id:96677,number_of_seasons:3,number_of_episodes:25,networks:[{id:213}],seasons:[{season_number:1,name:'Сезон 1'},{season_number:2,name:'Часть 3'},{season_number:3,name:'Часть 4'}]};
test('absolute tail and gaps use original episode coordinates without inventing the earlier unavailable files',()=>{
 const api=fixture(),card={minimal_anime:true,seasons:[{season_number:1,episode_count:3},{season_number:2,episode_count:4},{season_number:3,episode_count:3}]},result=api.absoluteRangeSeasons(card,[6,8,9]);assert.deepEqual(Array.from(result,g=>g.number),[2,3]);assert.deepEqual(Array.from(result[0].episodes),[6]);assert.deepEqual(Array.from(result[1].episodes),[8,9]);const original={1:{episode_number:1,name:'Eight'},2:{episode_number:2,name:'Nine'},3:{episode_number:3,name:'Ten'}},book=api.groupBook(original,result[1]);assert.equal(book[8].name,'Eight');assert.equal(book[9].episode_number,2);assert.equal(book[10],undefined);assert.equal(original[1].lampa_grouped,undefined);const absolute={8:{episode_number:8,name:'Eight'},9:{episode_number:9,name:'Nine'},10:{episode_number:10,name:'Ten'}};assert.equal(api.groupBook(absolute,result[1])[8].episode_number,8);assert.equal(api.groupBook({...absolute,1:original[1]},result[1]),null);for(const files of [[1,2],[8,8],[8,11],[6,6.5]])assert.equal(api.absoluteRangeSeasons(card,files),null);
});
const groups=[5,5,7,8].map((count,i)=>({order:i+1,episodes:Array.from({length:count},(_,j)=>({order:j,season_number:i<2?1:i,episode_number:i===1?j+6:j+1}))}));
test('Netflix parts map through explicit episode groups without changing source season or timeline coordinates',async()=>{
 const api=fixture(),requests=[];let active=0,max=0;
 const L={Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){requests.push(url);active++;max=Math.max(max,active);setTimeout(()=>{active--;if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25,network:{id:213}},{id:'other',group_count:4,episode_count:25}]});if(url.includes('episode_group/'))return ok({groups});const season=Number(url.match(/season\/(\d+)/)[1]);ok({episodes:Array.from({length:[0,10,7,8][season]},(_,i)=>({episode_number:i+1,season_number:season,name:'Canonical '+season+':'+(i+1),overview:'Description',still_path:'/s'+season+'e'+(i+1)+'.jpg'}))});},0);}}}}};
 const service=api.default(L),read=(season,count)=>new Promise(resolve=>assert.equal(service.book(card,season,[1,2,3,4],count,(book,grouped)=>resolve({book,grouped})),true));
 const results=await Promise.all([read(1,5),read(2,5),read(3,7),read(4,8)]);
 assert.deepEqual(results.map(r=>Object.keys(r.book).length),[5,5,7,8]);assert.equal(results[1].book[1].name,'Canonical 1:6');assert.equal(results[2].book[1].name,'Canonical 2:1');assert.equal(results[3].book[1].name,'Canonical 3:1');assert.ok(results.every(r=>r.grouped));assert.ok(max<=2);assert.equal(requests.length,5);assert.equal(card.number_of_seasons,3);
 const saved=requests.length;await read(4,8);assert.equal(requests.length,saved);assert.equal((await read(3,8)).book,null,'A conflicting provider count cannot receive another episode group');
 assert.equal(service.book(card,3,[1,2,3],8,()=>assert.fail()),false,'Native three-season providers keep their own coordinates');assert.equal(api.namedSeason(card,3),'Часть 4');assert.equal(api.namedPartCount(card),4);
});
test('ambiguous or incomplete episode groups leave provider metadata intact',async()=>{
 const api=fixture();let count=0;const service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){count++;ok({results:[{id:'a',group_count:4,episode_count:25},{id:'b',group_count:4,episode_count:25}]});}}}}});let answer;
 service.book(card,4,[1,2,3,4],8,book=>answer=book);assert.equal(answer,null);assert.equal(count,1);assert.equal(api.alternativeNumbering(card,[1,3,4]),false);assert.equal(api.namedSeason(card,1),'');
});


test('metadata transport failures retry once, share pending readers and never poison the cache',async()=>{
 const api=fixture(),calls={};let active=0,max=0;
 const service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok,fail){
  calls[url]=(calls[url]||0)+1;active++;max=Math.max(max,active);setTimeout(()=>{active--;
   if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25,network:{id:213}}]});
   if(url.includes('episode_group/'))return ok({groups});
   if(calls[url]===1)return fail();
   ok({episodes:Array.from({length:10},(_,i)=>({episode_number:i+1,season_number:1,overview:'Описание '+(i+1)}))});
  },5);
 }}}}});
 const read=()=>new Promise(resolve=>service.book(card,2,[1,2,3,4],5,resolve));
 const result=await Promise.all([read(),read(),read()]);
 assert.ok(result.every(book=>book[1].overview==='Описание 6'));
 assert.equal(Object.values(calls).reduce((a,b)=>a+b,0),4,'three readers share the original request and one retry');assert.ok(max<=2);
 await read();assert.equal(Object.values(calls).reduce((a,b)=>a+b,0),4,'successful retry is cached');
});

test('malformed responses stop after one retry and can recover on a later visit',async()=>{
 const api=fixture();let calls=0,broken=true;
 const service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){calls++;
  if(broken)return ok({error:'temporary'});
  if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25}]});
  if(url.includes('episode_group/'))return ok({groups});
  ok({episodes:Array.from({length:10},(_,i)=>({episode_number:i+1,season_number:1,overview:'Описание'}))});
 }}}}});
 const read=()=>new Promise(resolve=>service.book(card,2,[1,2,3,4],5,resolve));
 assert.equal(await read(),null);assert.equal(calls,2,'no endless polling');
 broken=false;assert.equal((await read())[1].overview,'Описание');assert.equal(calls,5,'a later visit does not reuse the failed result');
});

test('complete absolute anime lists expose all confirmed named seasons without KinoAPI',async()=>{
 const api=fixture(),counts=[32,21,18,17,24,31,8,24,21,25,21,33,20,25,28,13,11,21,20,87],anime={id:31910,name:'Naruto',minimal_anime:true,seasons:counts.map((n,i)=>({season_number:i+1,episode_count:n,name:'Арка '+(i+1)}))},files=Array.from({length:500},(_,i)=>i+1);
 const groups=api.absoluteSeasons(anime,files);assert.equal(groups.length,20);assert.equal(groups[1].name,'Арка 2');assert.deepEqual([...groups[1].episodes],Array.from({length:21},(_,i)=>i+33));assert.equal(groups.at(-1).episodes.at(-1),500);
 assert.equal(api.absoluteSeasons(anime,files.slice(0,21)),null);assert.equal(api.absoluteSeasons({...anime,minimal_anime:false},files),null);assert.equal(api.absoluteSeasons({...anime,seasons:anime.seasons.concat(anime.seasons[0])},files),null);
 let requests=0;const service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){requests++;ok({seasons:anime.seasons});}}}}});
 const result=await new Promise(resolve=>service.groups({...anime,seasons:undefined},files,resolve));assert.equal(result.length,20);assert.equal(requests,1);await new Promise(resolve=>service.groups({...anime,seasons:undefined},files,resolve));assert.equal(requests,1,'The complete catalogue is shared and cached, not fetched per episode');
 const local=Object.fromEntries(Array.from({length:21},(_,i)=>[i+1,{episode_number:i+1,name:'Episode '+(i+1)}])),book=api.groupBook(local,result[1]);assert.equal(book[33].name,'Episode 1');assert.equal(book[53].name,'Episode 21');assert.equal(api.groupBook({...local,22:{episode_number:22}},result[1]),null);assert.equal(local[1].episode_number,1,'Playback/native metadata is never mutated');
 assert.equal(api.seasonName(anime,2),'Арка 2');for(const name of ['Часть 4','Part 4','Parte 4'])assert.equal(api.seasonName({seasons:[{season_number:4,name}]},4),'');assert.equal(api.seasonName({seasons:[{season_number:1,name:'Season 1'}]},1),'');
});
test('published full episode maps partition a contiguous provider prefix and never invent the missing tail',async()=>{
 const api=fixture(),card={id:88,minimal_anime:true,number_of_seasons:2,number_of_episodes:6,seasons:[{season_number:1,episode_count:4},{season_number:2,episode_count:2}]},groups=[{order:1,name:'One',episodes:[1,2].map((episode_number,order)=>({order,season_number:1,episode_number}))},{order:2,name:'Two',episodes:[3,4].map((episode_number,order)=>({order,season_number:1,episode_number}))},{order:3,name:'Three',episodes:[1,2].map((episode_number,order)=>({order,season_number:2,episode_number}))}],service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(path,p,ok){if(path.includes('/episode_groups'))return ok({results:[{type:1,episode_count:6,group_count:3,id:'split'}]});if(path.includes('/episode_group/'))return ok({groups});const match=path.match(/season\/(\d+)/);if(!match)return ok(card);const season=Number(match[1]);ok({episodes:Array.from({length:season===1?4:2},(_,i)=>({season_number:season,episode_number:i+1,name:'Episode '+(i+1),overview:'Description',still_path:'/frame.jpg'}))});}}}}});
 const result=await new Promise(done=>service.groups(card,[1,2,3],done));assert.deepEqual(Array.from(result,g=>g.count),[2,1]);assert.equal(result[1].book[3].episode_number,3);assert.equal(result[1].book[4],undefined);assert.equal(result[1].book[3].still_path,'/frame.jpg');const sparse=await new Promise(done=>service.groups(card,[1,3,4],done));assert.deepEqual(Array.from(sparse,g=>Array.from(g.episodes)),[[1],[3,4]]);assert.equal(sparse[1].book[3].episode_number,3);assert.equal(sparse[0].book[2],undefined);
});

test('partial lists from a native season cannot replace the other provider seasons',()=>{
 const api=fixture(),card={id:88,minimal_anime:true,seasons:[{season_number:1,episode_count:26},{season_number:2,episode_count:48},{season_number:3,episode_count:7}]};
 const service=api.default({Api:{sources:{tmdb:{get(){assert.fail('A native season should not need a franchise lookup');}}}}});
 for(const context of [{number:1,numbers:[1,2,3]},{number:3,numbers:[3]}]){
  let result;service.groups(card,[1,2,3,4,5,6,7],groups=>result=groups,context);
  assert.equal(result,null);
 }
});

test('fewer provider seasons never infer a mapping from selected episode counts or a catalogue-only alternative',async()=>{
 const live=require('./fixtures/anime-season-layout.json'),api=fixture(),requests=[];
 const service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){requests.push(url);if(url.includes('episode_groups'))return ok(live.index);if(url.includes('episode_group/'))return ok(live.group);ok(live.seasons[Number(url.match(/season\/(\d+)/)[1])]);}}}}});
 const read=season=>new Promise(resolve=>{const files=live.provider[season-1].episodes;assert.equal(service.book(live.card,season,[1,2,3,4],files.length,(book,grouped)=>resolve({book,grouped}),files),true);});
 const second=await read(2);assert.equal(second.book,null,'11 source files cannot receive an 18-episode group or native season 2');assert.equal(second.grouped,true,'Suppress unsafe canonical fallback');assert.equal(requests.length,0);
 const third=await read(3),fourth=await read(4);
 assert.equal(third.book,null,'11 files could be native S3 or remapped S4');assert.equal(fourth.book,null,'A catalogue-only layout cannot prove the provider uses it');assert.equal(third.grouped,true);assert.equal(fourth.grouped,true);
 let kinoCalls=0;const keyed=api.default({}, {enabled:()=>true,book(card,number,numbers,files,done){kinoCalls++;done({1:{name:'Verified absolute episode'}});}});let keyedAnswer;assert.equal(keyed.book(live.card,3,[1,2,3,4],11,(book,grouped)=>keyedAnswer={book,grouped},live.provider[2].episodes),true);assert.equal(keyedAnswer.book,null);assert.equal(keyedAnswer.grouped,true);assert.equal(kinoCalls,0,'A key does not prove which numbering the selected provider uses');
 keyed.book(live.card,3,[1,2,3,4],11,(book,grouped)=>keyedAnswer={book,grouped},live.provider[2].episodes,true);assert.equal(kinoCalls,1);assert.equal(keyedAnswer.book[1].name,'Verified absolute episode','The separately verified full absolute-list path remains available');
 assert.equal(live.card.number_of_seasons,5);assert.deepEqual(live.provider[3].episodes,[1,2,3,4,5,6,7,8]);
 const gap=await new Promise(resolve=>service.book(live.card,4,[1,2,3,4],8,resolve,[1,2,3,4,5,6,7,9]));assert.equal(gap,null);
 assert.equal(api.alternativeNumbering(live.card,[0,1,2,3,4]),true,'Specials are not counted as an ordinary provider season');
 assert.equal(api.alternativeNumbering({...live.card,minimal_anime:false},[1]),false,'An ordinary series with one exposed source season keeps native metadata');
});

test('the entire episode-group model rejects specials, cross-group duplicates, incomplete maps and fractional coordinates',()=>{
 const api=fixture(),live=require('./fixtures/anime-season-layout.json'),model=data=>api.episodeGroupModel(live.card,data,4,63);
 assert.equal(model(live.group).groups.length,4);
 for(const mutate of [g=>g.groups[0].episodes[0].season_number=0,g=>g.groups[1].episodes[0]={...g.groups[0].episodes[0]},g=>g.groups[0].episodes.pop(),g=>g.groups[3].episodes[0].episode_number=1.5,g=>g.groups[3].episodes[0].episode_number=99,g=>g.groups[1].order=4]){
  const bad=JSON.parse(JSON.stringify(live.group));mutate(bad);assert.equal(model(bad),null,'Invalid rows outside the selected season must also invalidate the map');
 }
 const ambiguous=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){ok({results:[live.index.results.at(-1),{...live.index.results.at(-1),id:'another'}]});}}}}});
 let answer;ambiguous.book(live.card,4,[1,2,3,4],8,(book,grouped)=>answer={book,grouped});assert.equal(answer.book,null);assert.equal(answer.grouped,true);
});

test('season badge hides a repeated show title and keeps a named arc',()=>{
 const {seasonName}=fixture();
 const card={name:'Магическая битва',original_name:'JUJUTSU KAISEN',seasons:[
  {season_number:1,name:'Магическая битва'},
  {season_number:2,name:'JUJUTSU KAISEN: Season 2'},
  {season_number:3,name:'Смертельная миграция'}
 ]};
 assert.equal(seasonName(card,1),'');
 assert.equal(seasonName(card,2),'');
 assert.equal(seasonName(card,3),'Смертельная миграция');
 assert.equal(seasonName({seasons:[{season_number:1,name:'JUJUTSU KAISEN'}]},1,card),'');
});
