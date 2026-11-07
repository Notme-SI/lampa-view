const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
function mod(name){const m={exports:{}};new Function('module','exports',esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text)(m,m.exports);return m.exports;}
const f=mod('anime-franchise'),p=mod('anime-provider-parts'),fixtures=require('./fixtures/anime-franchises-2026-11-07.json');
test('live franchise evidence separates seasons, parts and recaps without discarding release destinations',()=>{
 for(const fixture of fixtures){const model=f.franchiseModel(fixture.graph,fixture.graph.current_id,fixture.metadata),order=f.franchiseViewingOrder(model),menu=f.franchiseMenuGroups(model);assert.ok(order.length);assert.equal(new Set(menu.flatMap(g=>g.entries.map(e=>e.card.id))).size,menu.flatMap(g=>g.entries).length);assert.ok(menu.flatMap(g=>g.entries).every(e=>!/[\u2013\u2014]/.test(e.title)));if(model.seed===11757){assert.deepEqual(order.filter(n=>n.season===4).map(n=>n.part),[1,2]);assert.ok(!order.some(n=>[40489,41341].includes(n.id)));}if(model.seed===40748)assert.deepEqual(order.filter(n=>n.season).map(n=>[n.season,n.part]),[[1,0],[2,0],[3,0]]);if(model.seed===54492)assert.deepEqual(order.filter(n=>n.season).map(n=>n.season),[1,2,3]);if(model.seed===14719)assert.deepEqual(order.filter(n=>n.season===5).map(n=>n.part),[1,2,3]);}
});
test('zero is retained as an extra and cannot shift the first real episode or the next part',()=>{
 const rows=[0,1,2].map(episode=>({method:'call',episode,season:2,url:'https://example.invalid/video/'+episode}));const mapped=p.mappedPartFiles({season:2,offset:0,count:12,part:1},rows);assert.deepEqual(mapped.map(r=>r.episode),[0,1,2]);assert.deepEqual(mapped.map(r=>r.url),rows.map(r=>r.url));assert.deepEqual(p.mappedPartFiles({season:2,offset:12,count:12,part:2},rows),[]);
 const {joinedPartsBook}=mod('anime-catalogue'),book=joinedPartsBook([{season:2,offset:0,count:12,available:0,episodes:[]},{season:2,offset:12,count:12,available:1,episodes:[13]}],{2:{episodes:[{episode_number:13,name:'Верная серия'}]}});assert.deepEqual(Object.keys(book),['13']);
});
test('explicit request language and default UI language reach native transport exactly once',()=>{const {normalizeTmdb}=mod('tmdb');assert.deepEqual(normalizeTmdb('tv/1/season/1?language=en'),{path:'tv/1/season/1',params:{langs:'en'}});assert.equal(normalizeTmdb('tv/1/season/1').params.langs,'ru');});

test('MAL episode identity rejects mixed releases and keeps missing Russian translations empty',()=>{
 const {malEpisodeBook}=mod('kinoapi'),rows=[{mal_id:39535,mal_episode_number:1,name_ru:'Начало',name_en:'Beginning',overview_ru:'Описание'},{mal_id:39535,mal_episode_number:2,name_en:'Other',overview_en:'English only'}];
 const book=malEpisodeBook({data:rows},39535,'ru');assert.equal(book[1].name,'Начало');assert.equal(book[2].name,'');assert.equal(book[2].overview,'');assert.equal(malEpisodeBook({data:rows},39535,'en')[2].name,'Other');assert.equal(malEpisodeBook({data:rows},51179),null);assert.equal(malEpisodeBook({data:[...rows,rows[0]]},39535),null);
 const localized=mod('episode-metadata').localizedEpisodeBook(book,'ru');assert.equal(localized[2].name,'Серия 2');assert.equal(mod('episode-metadata').localizedEpisodeBook({7:{name:'Эпизод 7'}},'ru')[7].name,'Серия 7');
});
test('a missing or incomplete TMDB season cannot truncate explicitly mapped anime parts',()=>{
 const fixture=fixtures.find(f=>f.graph.current_id===39535),model=f.franchiseModel(fixture.graph,39535,fixture.metadata),files=Array.from({length:12},(_,i)=>({method:'call',season:2,episode:i+1}));
 for(const seasons of [[],[{season_number:2,episode_count:12}]]){const plan=p.providerPartPlan({id:94664,seasons},model,files,2,[1,2,3]);assert.deepEqual(plan.map(p=>[p.mal,p.offset,p.count]),[[51179,0,12],[55888,12,12]]);}
});

test('all providers distinguish native season navigation from numbered dub names',()=>{
 const {seasonNavigation}=mod('online-state');
 for(const source of ['kodik','ailiberty','animevost','anidub','hdvb']){
 const rows=[1,2,3].map(season=>({method:'link',text:'Сезон '+season,url:'https://example.invalid/lite/'+source+'?s='+season}));
 assert.deepEqual(Object.keys(seasonNavigation(rows)),['1','2','3']);
 assert.equal(seasonNavigation([{method:'link',text:'Studio 1',url:rows[0].url+'&t=1'},{method:'link',text:'Studio 2',url:rows[0].url+'&t=2'}]),null);
 assert.equal(seasonNavigation([rows[0],{...rows[1],text:'Studio 2',season:1,url:rows[0].url+'&t=2'}]),null);
 assert.equal(seasonNavigation([rows[0],{...rows[0]}]),null);
 }
});
