const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),esbuild=require('esbuild');
function load(file){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+file+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}
const api=load('anime-release'),resolve=load('shiki-season').default;
test('anime release quality rejects a live-action film, another season/year, extended title and declared upscale without capping genuine 4K',()=>{
 const card={id:1535,source:'minimal_shiki',original_name:'Death Note',first_air_date:'2006-10-04'},names=['Тетрадь смерти','Death Note'];
 for(const title of ['Death Note (2017) 2160p','Death Note Movie (2006) 2160p','Death Note (2006) AI Upscale 2160p','Death Note Relight (2006) 2160p','Another Death Notebook (2006) 4K','Тетрадь смерти / Death Note Relight (2006) 2160p'])assert.equal(api.animeReleaseMatches(card,title,names,true),false,title);
 for(const title of ['Тетрадь смерти / Death Note [01-37 из 37] (2006) BDRip 1080p','Death Note S01 (2006) UHD BluRay 2160p'])assert.equal(api.animeReleaseMatches(card,title,names,true),true,title);
 const second={...card,original_name:'Anime 2nd Season',first_air_date:'2024-01-01'};
 assert.equal(api.animeReleaseMatches(second,'Anime Season 1 (2024) 4K',['Anime'],true),false);
 assert.equal(api.animeReleaseMatches(second,'Anime Season 2 (2024) WEB-DL 1080p',['Anime'],true),true);
});
test('new anime cache separates Shikimori entries and ignores legacy broad matches, while ordinary quality keys remain compatible',()=>{
 const card={id:1,title:'Anime',first_air_date:'2024',source:'minimal_shiki'};
 assert.notEqual(api.qualityCacheKey(card,true),'tv:anime:2024');assert.notEqual(api.qualityCacheKey(card,true),api.qualityCacheKey({...card,id:2},true));
 assert.equal(api.qualityCacheKey({title:'Movie',release_date:'2020'},false),'movie:movie:2020');
});
test('Shikimori resolves only unambiguous TV prequels and caches verified numbers; API failures and cycles never become season 1',()=>{
 const calls=[],rows={1:[{relation:'Sequel',anime:{id:2,kind:'tv',name:'Next'}}],2:[{relation:'Prequel',anime:{id:1,kind:'tv',name:'First'}},{relation:'Summary',anime:{id:9,kind:'movie',name:'Film'}}],3:[{relation:'Prequel',anime:{id:2,kind:'tv',name:'Next'}}],4:[{relation:'Prequel',anime:{id:4,kind:'tv',name:'Cycle'}}],5:[{relation:'Prequel',anime:{id:9,kind:'movie',name:'Film'}}]},get=resolve((id,ok,fail)=>{calls.push(id);if(rows[id])ok(rows[id]);else fail();});
 let result;get({id:3,kind:'tv',name:'Final Season'},v=>result=v);assert.equal(result,3);assert.equal(calls.length,3);get({id:3,kind:'tv',name:'Final Season'},v=>result=v);assert.equal(calls.length,3);
 get({id:33,kind:'tv',name:'Anime 2nd Season Part 2'},v=>result=v);assert.equal(result,2);assert.equal(calls.length,3);
 for(const id of [4,5,6]){get({id,kind:'tv',name:'Unknown'},v=>result=v);assert.equal(result,0);}
 get({id:9,kind:'movie',name:'Film'},v=>result=v);assert.equal(result,0);
});
test('Shikimori joins duplicate focus requests and keeps a split Part 2 within its preceding season',()=>{
 const requests=[],get=resolve((id,ok,fail)=>requests.push({id,ok,fail})),card={id:1,kind:'tv',name:'Anime Part 2'},answers=[];
 get(card,v=>answers.push(v));get(card,v=>answers.push(v));assert.equal(requests.length,1);
 requests[0].ok([{relation:'Prequel',anime:{id:2,kind:'tv',name:'Anime'}}]);requests[1].ok([]);assert.deepEqual(answers,[1,1]);
});
test('standard anime badges reuse actual native grouping, exclude future seasons and preserve canonical Timeline coordinates',async()=>{
 const n=await require('./fixtures/native-lampa.cjs')({deferPlugin:true}),{L}=n;
 try{
  const card={id:1,media_type:'tv',genre_ids:[16],original_language:'ja',number_of_seasons:1},episodes=[];
  for(const [year,count] of [[2020,24],[2023,23],[2026,12],[2027,12]])for(let i=0;i<count;i++)episodes.push({season_number:1,episode_number:episodes.length+1,air_date:year+'-'+String(1+Math.floor(i/4)).padStart(2,'0')+'-'+String(1+(i%4)*7).padStart(2,'0')});
  const original=JSON.stringify(episodes),result=api.groupedAnimeRelease(L,card,{episodes_original:episodes,episodes:episodes.slice(0,24)},'2026-11-04');
  assert.deepEqual(result,{season:3,count:12,total:12});assert.equal(JSON.stringify(episodes),original);
  assert.deepEqual(api.groupedAnimeRelease(L,card,{episodes},'2023-01-15'),{season:2,count:3,total:23});
  assert.equal(api.groupedAnimeRelease(L,{...card,genre_ids:[18]}, {episodes}),null,'Live-action chronology must remain untouched');
  assert.equal(api.groupedAnimeRelease(L,{...card,number_of_seasons:3},{episodes}),null);
  const data={id:1,name:'Anime',source:'tmdb',media_type:'tv',...card},callbacks=[],node=n.w.document.createElement('div');
  // Use a module in the document realm for the DOM integration.
  const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/series-status.js')],bundle:true,write:false,format:'iife',globalName:'Series'}).outputFiles[0].text;n.w.eval(code);node.className='card focus';node.innerHTML='<div class="card__view"></div>';n.w.document.body.appendChild(node);
  L.Api.sources.tmdb.get=(url,p,ok)=>callbacks.push({url,ok});const status=n.w.Series.default(L,node=>status.paint(node));status.track(node,data);status.paint(node);
  callbacks[0].ok({...data,last_episode_to_air:episodes[58],seasons:[{season_number:1,episode_count:71}]});assert.equal(callbacks[1].url,'tv/1/season/1');callbacks[1].ok({episodes_original:episodes,episodes:episodes.slice(0,24)});
  assert.equal(node.querySelector('.pt-series-status').textContent,'Сезон 3 • Серий 12');assert.equal(data.number_of_seasons,1);assert.equal(node.querySelector('.time-line'),null);
 }finally{n.close();}
});
