const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),esbuild=require('esbuild');
function mod(name){const m={exports:{}},code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;new Function('module','exports',code)(m,m.exports);return m.exports;}
const index=mod('anime-index'),{franchiseModel}=mod('anime-franchise'),{releaseGroups,default:install}=mod('anime-catalogue');
const graph=require('./fixtures/anime-franchise-demon.json');
test('provider seasons use the complete primary TV release chain and checked episode dates for a merged canonical season',async()=>{
 const movie={id:95479,name:'Anime',source:'tmdb',media_type:'tv',minimal_anime:true,seasons:[{season_number:1,episode_count:4}]},metadata=[{id:40748,name:'First',kind:'tv',episodes:2,aired_on:'2020-01-01',released_on:'2020-01-08'},{id:51009,name:'Second',kind:'tv',episodes:2,aired_on:'2023-01-01',released_on:'2023-01-08'}],episodes=['2020-01-01','2020-01-08','2023-01-01','2023-01-08'].map((air_date,i)=>({season_number:1,episode_number:i+1,air_date,name:'Episode '+(i+1),still_path:'/frame.jpg',overview:'Description'})),g={current_id:40748,nodes:metadata.map(v=>({id:v.id,name:v.name,kind:'TV Сериал'})),links:[{source_id:40748,target_id:51009,relation:'sequel'}]},L={Api:{sources:{tmdb:{get(path,p,ok){ok({episodes});}},minimal_shiki:{franchise(seed,ok){ok({graph:g,metadata});}}}}},api=install(L);
 const read=(number,numbers,files)=>new Promise(done=>api.providerBook(movie,number,numbers,files,done));const book=await read(2,[1,2],[1,2]);assert.equal(book[1].name,'Episode 3');assert.equal(book[1].episode_number,3);assert.equal(book[1].still_path,'/frame.jpg');assert.equal(await read(2,[1,2],[1]),null);assert.equal(await read(2,[1,3],[1,2]),null);assert.equal(await read(3,[1,2,3],[1,2]),null);
});
test('global anime index resolves MAL/AniList/AniDB independently from TMDB movie/TV namespaces and refuses contradictory identities',()=>{
 assert.ok(index.animeIndexInfo.records>34000);assert.ok(index.animeIndexInfo.mapped>8000);for(const source of Object.values(index.animeIndexInfo.sources))assert.match(source.revision,/^[a-f0-9]{40}$/);
 for(const [mal,tv] of [[1735,31910],[38000,85937],[51009,95479],[60543,240411],[44511,114410]]){const found=index.animeTarget({source:'minimal_shiki',id:mal,media_type:'tv'});assert.equal(found.id,tv);assert.equal(found.release.mal,mal);}
 assert.equal(index.animeTarget({source:'minimal_shiki',id:40456,media_type:'movie'}).id,635302);assert.equal(index.animeTarget({source:'minimal_shiki',id:2472,media_type:'movie'}),null,'A movie recorded as TV special cannot open the whole show as a movie');
 assert.deepEqual(index.animeRecords({mal_id:38000,tmdb_id:31910,media_type:'tv'}),[]);assert.equal(index.animeSeed({source:'tmdb',id:85937,media_type:'tv'}).mal,38000);
 assert.equal(index.animeTarget({source:'minimal_shiki',id:99999999,media_type:'tv'}),null);
});
test('explicit episode maps cover Naruto 500/20 and keep zero-season specials, invalid ranges and merged episodes separate',()=>{
 const record=index.animeTarget({source:'minimal_shiki',id:1735,media_type:'tv'}).release,counts=[32,21,18,17,24,31,8,24,21,25,21,33,20,25,28,13,11,21,20,87],card={id:31910,seasons:counts.map((episode_count,i)=>({season_number:i+1,episode_count}))},map=index.animeEpisodeMap(record,500,card);
 assert.equal(map.length,500);assert.deepEqual(map[32],{number:33,season:2,episode:1});assert.deepEqual(map[499],{number:500,season:20,episode:87});assert.equal(index.animeEpisodeMap(record,501,card),null);
 const base={tv:4,season:1,kind:'tv'},one={id:4,seasons:[{season_number:0,episode_count:2},{season_number:1,episode_count:2}]};
 assert.equal(index.animeEpisodeMap({...base,season:0},2,one),null);assert.ok(index.animeEpisodeMap({...base,season:0,kind:'special'},2,one));
 assert.equal(index.animeEpisodeMap({...base,rules:[{source:1,season:1,pairs:[[1,[1,2]]]}]},2,one),null);assert.equal(index.animeEpisodeMap({...base,rules:[{source:1,season:1,pairs:[[2,[1]]]}]},2,one),null);
});
test('real franchise graph includes the Mugen Train film, keeps its alternative TV adaptation distinct and orders continuation links',()=>{
 const model=franchiseModel(graph,38000),story=model.rows.find(r=>r.key==='story').results,other=model.rows.find(r=>r.key==='alternatives').results;
 assert.equal(model.complete,true);assert.ok(story.some(c=>c.id===40456 && c.media_type==='movie'));assert.ok(other.some(c=>c.id===49926));assert.equal(story.some(c=>c.id===49926),false);assert.ok(story.findIndex(c=>c.id===47778)>story.findIndex(c=>c.id===40456));assert.ok(model.rows.find(r=>r.key==='related').results.some(c=>c.id===48861));
 const ids=model.rows.flatMap(r=>r.results.map(c=>c.id));assert.equal(ids.length,new Set(ids).size);assert.equal(ids.length,graph.nodes.length-1);assert.ok(!ids.includes(63692),'An indirect crossover does not import a second franchise');assert.equal(story.find(c=>c.id===40456).source,'minimal_shiki');
 assert.equal(franchiseModel({...graph,current_id:1},38000),null);assert.equal(franchiseModel({...graph,nodes:graph.nodes.concat(graph.nodes[0])},38000),null);
 const naruto=franchiseModel(require('./fixtures/anime-franchise-naruto.json'),1735),idsNaruto=naruto.rows.flatMap(r=>r.results.map(c=>c.id));assert.ok(idsNaruto.includes(2472));assert.ok(!idsNaruto.includes(912) && !idsNaruto.includes(2851),'Ninku and its film are not imported through a crossover');
});
test('franchise cycles never claim a confirmed viewing order and unrelated works are not inserted into main story',()=>{
 const nodes=[1,2,3,4].map(id=>({id,name:'Anime '+id,year:2020+id,kind:'TV Сериал'})),links=[{source_id:1,target_id:2,relation:'sequel'},{source_id:2,target_id:1,relation:'sequel'},{source_id:2,target_id:3,relation:'side_story'},{source_id:3,target_id:4,relation:'other'}],model=franchiseModel({current_id:1,nodes,links},1);
 assert.equal(model.complete,false);assert.deepEqual(model.rows.find(r=>r.key==='story').results.map(c=>c.id),[1,2]);assert.deepEqual(model.rows.find(r=>r.key==='related').results.map(c=>c.id),[3]);
});
const merged=()=>{const card={id:95479,source:'tmdb',minimal_anime:true,media_type:'tv',seasons:[{season_number:1,episode_count:4}]},episodes=[['2020-01-01','A'],['2020-01-08','B'],['2023-01-01','C'],['2023-01-08','D']].map(([air_date,name],i)=>({season_number:1,episode_number:i+1,air_date,name,overview:name,still_path:'/still-'+i+'.jpg'})),nodes=[{id:40748,name:'First',kind:'tv',episodes:2,aired:'2020-01-01',released:'2020-01-08',record:{tv:95479,season:1}},{id:51009,name:'Second',kind:'tv',episodes:2,aired:'2023-01-01',released:'2023-01-08',record:{tv:95479,season:2}}];return {card,episodes,model:{nodes},books:{1:{episodes}}};};
test('merged TMDB seasons split only with complete disjoint release evidence; stale season 2 mapping uses full date boundaries and keeps canonical episode coordinates',()=>{
 const {card,episodes,model,books}=merged(),before=JSON.stringify(episodes),groups=releaseGroups(card,[1,2,3,4],model,books);assert.equal(groups.length,2);assert.deepEqual(groups[1].episodes,[3,4]);assert.equal(groups[1].book[3].episode_number,3);assert.equal(groups[1].book[3].season_number,1);assert.equal(groups[1].book[3].overview,'C');assert.equal(JSON.stringify(episodes),before);
 for(const files of [[1,2,3],[1,2,2,4],[2,3,4,5]])assert.equal(releaseGroups(card,files,model,books),null);
 assert.equal(releaseGroups(card,[1,2,3,4],{nodes:model.nodes.slice(1)},books),null);assert.equal(releaseGroups(card,[1,2,3,4],{nodes:model.nodes.map(n=>({...n,aired:'2020-01-01',released:'2023-01-08'}))},books),null);
});
test('anime transport joins identical franchise reads, resolves exact IMDb movie IDs and discards stale pending metadata after clearing',async()=>{
 const callbacks=[],routes=[],L={Api:{sources:{tmdb:{get(path,p,ok){routes.push(path);callbacks.push(ok);}},minimal_shiki:{franchise(id,ok){ok({graph,metadata:[]});}}}}},api=install(L),card={id:85937,source:'tmdb',media_type:'tv',minimal_anime:true};
 const [a,b]=await Promise.all([new Promise(r=>api.collection(card,r)),new Promise(r=>api.collection(card,r))]);assert.equal(a,b);
 const movie={id:2472,source:'minimal_shiki',media_type:'movie'},answer=new Promise(r=>api.resolveTarget(movie,r));assert.match(routes[0],/^find\/tt0988982\?/);callbacks.shift()({movie_results:[{id:20982}],tv_results:[]});assert.equal((await answer).id,20982);
 let old=0;api.canonical({id:31910,media_type:'tv'},()=>old++);api.clear();assert.equal(old,1,'Clear resolves pending owners so the page can retry');const next=new Promise(r=>api.canonical({id:31910,media_type:'tv'},r));callbacks.shift()({id:31910,seasons:[{season_number:1,episode_count:9}]});callbacks.shift()({id:31910,seasons:[{season_number:1,episode_count:500}]});assert.equal((await next).seasons[0].episode_count,500);
});
test('native full page gains franchise rows without changing its active header or native playback movie; release films open their exact TMDB identity',async()=>{
 const n=await require('./fixtures/native-lampa.cjs')({built:true}),{w,L}=n;try{
  L.Api.sources.minimal_shiki.franchise=(id,ok)=>w.setTimeout(()=>ok({graph,metadata:[]}),5);const movie={id:85937,name:'Истребитель демонов',original_name:'Demon Slayer',source:'tmdb',media_type:'tv',minimal_anime:true,production_countries:[],production_companies:[],spoken_languages:[],genres:[]};
  L.Api.full=(p,ok)=>ok({movie,persons:{crew:[],cast:[]},images:{logos:[]},videos:{results:[]},simular:{results:[{id:2,title:'Other'}]},recomend:{results:[]}});L.Activity.push({component:'full',source:'tmdb',id:85937,method:'tv',card:movie});await new Promise(r=>setTimeout(r,250));const component=L.Activity.active().activity.component;
  assert.ok(component.rows.some(r=>Array.isArray(r) && r[1].minimal_anime_collection));assert.equal(component.active,0);assert.equal(component.props.get('movie').id,85937);const rows=component.rows.filter(r=>Array.isArray(r) && r[1].minimal_anime_collection);assert.ok(rows.some(r=>r[1].results.some(c=>c.id===40456)));assert.deepEqual(n.errors,[]);
  let target;L.Api.sources.tmdb.full=(p,ok)=>{target=p;ok({movie:{id:p.id}});};const result=await new Promise((ok,fail)=>L.Api.sources.minimal_shiki.full({card:{id:40456,source:'minimal_shiki',media_type:'movie',title:'Бесконечный поезд'}},ok,fail));assert.equal(target.id,635302);assert.equal(target.method,'movie');assert.equal(result.movie.shikimori_id,40456);
 }finally{n.close();}
});
test('native Shikimori franchise reads share the queue/cache, collect only requested metadata and recover from a failed graph',async()=>{
 const n=await require('./fixtures/native-lampa.cjs')({built:true}),{w,L}=n;try{
  const paths=[];let broken=true;w.testNetwork=(url,ok)=>{paths.push(url);w.setTimeout(()=>ok(url.includes('/franchise')?(broken===true?{}:graph):broken==='metadata'?{}:[{id:38000,name:'Original',russian:'Название',kind:'tv',episodes:26},{id:99999999,name:'Unrequested'}]),0);};
  const source=L.Api.sources.minimal_shiki,read=()=>new Promise(resolve=>source.franchise(38000,resolve,()=>resolve(null)));assert.equal(await read(),null);broken=false;source.retry();const before=paths.length,values=await Promise.all([read(),read()]);assert.ok(values[0]);assert.equal(values[0],values[1]);assert.equal(paths.length-before,2);assert.equal(values[0].metadata.length,1);assert.equal(values[0].metadata[0].id,38000);await read();assert.equal(paths.length-before,2);source.clear();source.retry();broken='metadata';assert.equal(await read(),null,'A failed metadata batch does not become a cached incomplete franchise');source.retry();broken=false;assert.ok(await read());assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('shared anime release identity scopes quality to the selected MAL release while preserving the canonical card ID',()=>{
 const quality=mod('anime-release'),card={id:95479,name:'Магическая битва',source:'tmdb',media_type:'tv',minimal_anime:true,minimal_anime_release:{mal:51009,title:'Магическая битва 2',original:'Jujutsu Kaisen 2nd Season',date:'2023-07-06'}},before=JSON.stringify(card);
 assert.notEqual(quality.qualityCacheKey(card,true),quality.qualityCacheKey({...card,minimal_anime_release:null},true));assert.equal(quality.animeReleaseMatches(card,'Jujutsu Kaisen 2nd Season (2023) WEB-DL 1080p',['Jujutsu Kaisen'],true),true);assert.equal(quality.animeReleaseMatches(card,'Jujutsu Kaisen (2020) WEB-DL 2160p',['Jujutsu Kaisen'],true),false);assert.equal(JSON.stringify(card),before);
});
test('native online selects the requested release from a confirmed merged list and retains absolute provider playback hashes',async()=>{
 const n=await require('./fixtures/native-lampa.cjs')({built:true}),{w,L}=n,$=w.jQuery;try{
  const {card,model,books}=merged(),groups=releaseGroups(card,[1,2,3,4],model,books),movie={...card,name:'Anime',minimal_anime_release:{mal:51009}};L.Api.sources.tmdb.get=(route,p,ok)=>ok(movie);w.LampaView.animeBase.groups=(value,files,done)=>done(groups);
  const root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body),filter=new L.Filter({search:false,sort:true,filter:true});root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Kodik',source:'kodik',selected:true}]);filter.set('filter',[{stype:'season',title:'Сезон',items:[{title:'Сезон 1',selected:true}]}]);let played=0;
  for(let i=1;i<=4;i++)$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+i+'</div><div class="online-prestige__episode-number">'+i+'</div><div class="time-line" data-hash="original-'+i+'"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played=i).appendTo(root.find('.scroll__body'));
  L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:{}}});L.Listener.send('activity',{type:'start'});await new Promise(r=>setTimeout(r,500));assert.equal(root.find('.nova-hero__season-label').text(),'Сезон 2');assert.equal(root.find('.nova-hero__season-name').text(),'Second');assert.equal(root.find('.nova-card').length,2);assert.match(root.find('.nova-card__overview').first().text(),/C/);root.find('.nova-card').last().trigger('hover:enter');assert.equal(played,4);assert.ok(root.find('[data-hash="original-4"]').length);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('Kodik joins verified TV continuations without importing recaps or sharing episode coordinates',()=>{
 const {continuationPlan,matchContinuations,continuationFiles}=mod('anime-continuations');
 const tv=30984,base='https://lampac.example/lite/kodik?s=1';
 const card={id:tv,seasons:[{season_number:1,episode_count:366},{season_number:2,episode_count:50}]};
 const metadata=[
  [269,'Bleach',2004,366],
  [41467,'Bleach: Sennen Kessen-hen',2022,13],
  [53998,'Bleach: Sennen Kessen-hen - Ketsubetsu-tan',2023,13],
  [56784,'Bleach: Sennen Kessen-hen - Soukoku-tan',2024,14],
  [60636,'Bleach: Sennen Kessen-hen - Kashin-tan',2026,10]
 ].map(([id,name,year,episodes])=>({id,name,kind:'tv',episodes,aired_on:year+'-01-01'}));
 const nodes=metadata.map(node=>({id:node.id,name:node.name,kind:'TV Сериал'}));
 const links=nodes.slice(1).map((node,i)=>({source_id:nodes[i].id,target_id:node.id,relation:'sequel'}));
 const model=franchiseModel({current_id:269,nodes,links},269,metadata);
 const playable={method:'play',season:1,episode:366};
 const plan=continuationPlan(card,model,[playable]);
 assert.deepEqual(plan.map(p=>[p.season,p.offset,p.count]),[[2,0,13],[2,13,13],[2,26,14],[2,40,10]]);
 assert.deepEqual(continuationPlan(card,model,[{...playable,episode:367}]),[]);
 const linksFor=plan.map((part,i)=>({method:'link',similar:true,title:'Блич [ТВ-2] / '+part.original.replaceAll('-',' '),year:part.year,url:'https://lampac.example/lite/kodik?pick='+i}));
 const recap={...linksFor[1],title:linksFor[1].title+' Recap',url:'https://lampac.example/lite/kodik?pick=recap'};
 const otherHost={...linksFor[0],url:'https://other.example/lite/kodik?pick=0'};
 const releases=matchContinuations(plan,[recap,otherHost,...linksFor],base);
 assert.deepEqual(releases.map(row=>new URL(row.url).searchParams.get('pick')),['0','1','2','3']);
 const file={method:'call',season:4,episode:1,url:'https://lampac.example/video?id=original'};
 assert.deepEqual(continuationFiles(releases[3],[file]),[{...file,season:2,episode:41}]);
 assert.deepEqual(continuationFiles(releases[3],[{...file,episode:51}]),[]);
 assert.equal(continuationFiles(releases[3],[{...file,episode:41}])[0].episode,41);
});


test('ongoing provider seasons map a released prefix through the explicit release offset',async()=>{
 const card={id:220542,name:'Монолог фармацевта',source:'tmdb',minimal_anime:true,number_of_seasons:1,seasons:[{season_number:1,episode_count:60}]};
 const meta=[
  {id:54492,name:'Kusuriya no Hitorigoto',kind:'tv',status:'released',episodes:24,aired_on:'2023-10-22',released_on:'2024-03-24'},
  {id:58514,name:'Kusuriya no Hitorigoto 2nd Season',kind:'tv',status:'released',episodes:24,aired_on:'2025-01-10',released_on:'2025-07-04'},
  {id:61987,name:'Kusuriya no Hitorigoto 3rd Season',kind:'tv',status:'ongoing',episodes:12,aired_on:'2026-10-02',released_on:null}
 ];
 const graph={current_id:54492,nodes:meta.map(row=>({id:row.id,name:row.name,kind:'TV Сериал'})),links:[{source_id:54492,target_id:58514,relation:'sequel'},{source_id:58514,target_id:61987,relation:'sequel'}]};
 const episodes=Array.from({length:60},(_,i)=>({season_number:1,episode_number:i+1,air_date:i<24?'2023-10-22':i<48?'2025-01-10':'2026-10-02',name:'Эпизод '+(i+1),overview:'Описание '+(i+1),still_path:'/frame-'+(i+1)+'.jpg'}));
 const L={Api:{sources:{tmdb:{get(path,p,ok){ok({episodes});}},minimal_shiki:{franchise(seed,ok){ok({graph,metadata:meta});}}}}};
 const api=install(L),book=await new Promise(done=>api.providerBook(card,3,[1,2,3],[1,2,3,4,5],done));
 assert.equal(book[1].name,'Эпизод 49');
 assert.equal(book[5].overview,'Описание 53');
 assert.equal(book[1].still_path,'/frame-49.jpg');
 assert.equal(Object.keys(book).length,5);
 assert.equal(await new Promise(done=>api.providerBook(card,2,[1,2,3],[1,2,3,4,5],done)),null,'A short completed release stays unverified');
});


test('anime full responses wait for the catalogue before exposing a resolved season count',()=>{
 const {installFullGuard}=mod('tmdb');
 const previous=global.window;let canonical,collection,answer;
 const data={movie:{id:220542,name:'Anime',minimal_anime:true,number_of_seasons:1}};
 const L={Api:{full(params,ok){ok(data);return 'native-request';}}};
 global.window={LampaView:{animeBase:{canonical(card,done){canonical=done;},collection(card,done){collection=done;}}}};
 try{
  installFullGuard(L);
  assert.equal(L.Api.full({},value=>{answer=value;}),'native-request');
  assert.equal(answer,undefined);
  canonical(data.movie);
  assert.equal(answer,undefined);
  collection({complete:true,rows:[{key:'story',results:[{id:1},{id:2},{id:3}]}],nodes:[1,2,3].map(id=>({id,record:{tv:220542},kind:'tv',status:'released',aired:'2020-01-01'}))});
  assert.equal(answer.movie.minimal_detail_seasons,3);
  assert.equal(answer.movie.minimal_detail_ready,true);
 }finally{global.window=previous;}
});
