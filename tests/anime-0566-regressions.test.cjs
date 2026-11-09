const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
function mod(name){const m={exports:{}};new Function('module','exports',esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text)(m,m.exports);return m.exports;}
const catalogue=mod('anime-catalogue'),franchise=mod('anime-franchise'),index=mod('anime-index');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('joined TV finales recover exact season-zero metadata without reusing an ordinary episode or guessing an ambiguous special',()=>{
 const parts=[{season:4,offset:0,count:2,kind:'tv'},{season:4,offset:2,count:2,kind:'tv_special',aired:'2023-03-04',released:'2023-11-05'}];
 const row=(season,episode,date,name)=>({season_number:season,episode_number:episode,air_date:date,name,still_path:'/'+name,overview:name});
 const books={4:{episodes:[row(4,1,'2020-12-07','first'),row(4,2,'2020-12-14','second')]},0:{episodes:[row(0,10,'2023-03-04','final-one'),row(0,11,'2023-11-05','final-two')]}};
 const before=JSON.stringify(books),book=catalogue.joinedPartsBook(parts,books);
 assert.equal(book[3].name,'final-one');assert.equal(book[4].name,'final-two');assert.equal(book[3].episode_number,10);assert.equal(book[3].season_number,0);assert.equal(book[3].lampa_grouped,true);assert.equal(JSON.stringify(books),before);
 books[0].episodes.push(row(0,12,'2023-08-01','unrelated'));const ambiguous=catalogue.joinedPartsBook(parts,books);assert.equal(ambiguous[3],undefined);assert.equal(ambiguous[1].name,'first');
});

test('generic translated episode names use a matching original only; another season or episode identity cannot replace them',()=>{
 const source={season_number:3,episodes:[{id:1,episode_number:1,name:'Серия 1',overview:'',still_path:'/real'},{id:2,episode_number:2,name:'Настоящее название'}]},fallback={season_number:3,episodes:[{id:1,episode_number:1,name:'Original title',overview:'Original synopsis',still_path:'/fallback'},{id:2,episode_number:2,name:'Other title'}]},before=JSON.stringify(source);
 const result=catalogue.completeEpisodeData(source,fallback);assert.equal(result.episodes[0].name,'Original title');assert.equal(result.episodes[0].overview,'Original synopsis');assert.equal(result.episodes[0].still_path,'/real');assert.equal(result.episodes[1].name,'Настоящее название');assert.equal(JSON.stringify(source),before);
 assert.equal(catalogue.completeEpisodeData(source,{...fallback,season_number:1}),source);assert.equal(catalogue.completeEpisodeData(source,{...fallback,episodes:[{...fallback.episodes[0],id:999}]}).episodes[0].name,'Серия 1');
});

test('provider season labels are independent from canonical seasons, including an only folder numbered two and a TV alternative omitted by native numbering',async()=>{
 const dom=new JSDOM(),oldDoc=global.document,oldLocation=global.location;global.document=dom.window.document;global.location={href:'http://lampac.example/'};
 const online=mod('online-state'),install=mod('anime-provider-parts').default,base='http://lampac.example/lite/kodik?title=Anime';
 const folder=(season,url)=>'<div class="videos__item videos__season" data-json=\''+JSON.stringify({method:'link',title:season+' сезон',url})+'\'></div>';
 const files=(season,count)=>'<div class="videos__line">'+Array.from({length:count},(_,i)=>'<div class="videos__item" s="'+season+'" e="'+(i+1)+'" data-json=\''+JSON.stringify({method:'call',url:base+'&video='+i})+'\'></div>').join('')+'</div>';
 const ids=[38000,47778,51019,55701,49926],counts=[26,11,11,8,7],years=[2019,2021,2023,2024,2021],names=['Kimetsu no Yaiba','Kimetsu no Yaiba: Yuukaku-hen','Kimetsu no Yaiba: Katanakaji no Sato-hen','Kimetsu no Yaiba: Hashira Geiko-hen','Kimetsu no Yaiba: Mugen Ressha-hen'];
 const c={id:85937,minimal_anime:true,seasons:[26,7,11,11,8].map((episode_count,i)=>({season_number:i+1,episode_count}))};
 const m={complete:true,rows:[{key:'story',results:ids.slice(0,4).map(id=>({id}))}],nodes:ids.map((id,i)=>({id,episodes:counts[i],aired:years[i]+'-01-01',released:years[i]+'-12-30',year:String(years[i]),original:names[i],name:names[i],status:'released',kind:'tv',record:index.animeRecords({source:'minimal_shiki',id})[0]})),edges:[{from:40456,to:49926,relation:'alternative_version'}]};
 function Request(){this.timeout=()=>{};this.native=(url,ok)=>{const u=new URL(url),pick=u.searchParams.get('pick'),s=Number(u.searchParams.get('s'));setTimeout(()=>{if(pick && !s)return ok(folder(1,base+'&pick='+pick+'&s=1'));if(s)return ok(files(s,pick==='train'?7:pick==='sword'?11:s===1?26:8));ok([2,4].map(i=>'<div class="videos__item similar" data-json=\''+JSON.stringify({method:'link',similar:true,title:names[i],year:String(years[i]),url:base+'&pick='+(i===2?'sword':'train')})+'\'></div>').join(''));},0);};}
 try{
  const api=install({Reguest:Request,Storage:{get:(k,d)=>d}},{canonical:(v,done)=>done(c),collection:(v,done)=>done(m)},online),root=[1,2,4].map(s=>folder(s,base+'&s='+s)).join('');
  const result=await new Promise(resolve=>api.folders(c,base,root,(body,layout)=>resolve({body,layout}))),rows=online.folderRows(result.body);
  assert.equal(rows.length,5);assert.deepEqual(Object.fromEntries(Object.entries(result.layout).map(([k,v])=>[k,v.number])),{1:1,2:3,3:4,4:5,5:2});
  for(const s of [1,2,4])assert.ok(rows.some(r=>r.url===base+'&s='+s),'Existing playback/history coordinates stay native');
  const train=rows.find(r=>r.season===5),sword=rows.find(r=>r.season===3);assert.equal(online.catalogueRows(api.rewrite(train.url,files(1,7)))[0].season,5);assert.equal(online.catalogueRows(api.rewrite(sword.url,files(1,11)))[0].season,3);
  const single={id:31911,minimal_anime:true,seasons:[{season_number:1,episode_count:64}]},one={complete:true,rows:[{key:'story',results:[{id:5114}]}],nodes:[{id:5114,kind:'tv',episodes:64,aired:'2009-04-05',original:'Fullmetal Alchemist: Brotherhood',status:'released',record:index.animeRecords({mal_id:5114})[0]}],edges:[]};
  function Single(){this.timeout=()=>{};this.native=(url,ok)=>ok(files(2,64));}
  const singleApi=install({Reguest:Single,Storage:{get:(k,d)=>d}},{canonical:(v,done)=>done(single),collection:(v,done)=>done(one)},online),singleRoot=folder(2,base+'&s=2');
  const answer=await new Promise(resolve=>singleApi.folders(single,base,singleRoot,(body,layout)=>resolve({body,layout})));assert.equal(answer.body,singleRoot);assert.deepEqual(answer.layout,{2:{number:1,mal:5114,offset:0,count:64}});
 }finally{global.document=oldDoc;global.location=oldLocation;dom.window.close();}
});

test('provider metadata selects the verified release rather than its arbitrary source folder label',async()=>{
 const card={id:31911,minimal_anime:true,seasons:[{season_number:1,episode_count:2}]},meta=[{id:5114,kind:'tv',name:'Fullmetal Alchemist: Brotherhood',episodes:2,aired_on:'2009-04-05',released_on:null,status:'released'}],graph={current_id:5114,nodes:[{id:5114,name:meta[0].name,kind:'TV Сериал'},{id:6421,name:'Extra',kind:'Спецвыпуск'}],links:[{source_id:5114,target_id:6421,relation:'side_story'}]},episodes=[1,2].map((episode_number,i)=>({season_number:1,episode_number,name:'Real '+i,air_date:i?'2009-04-12':'2009-04-05',still_path:'/still'+i})),L={Api:{sources:{tmdb:{get:(route,p,ok)=>ok({season_number:1,episodes})},minimal_shiki:{franchise:(id,ok)=>ok({graph,metadata:meta})}}}};
 const api=catalogue.default(L),book=await new Promise(done=>api.providerBook(card,2,[2],[1,2],done,{2:{number:1,mal:5114}}));assert.equal(book[1].name,'Real 0');assert.equal(book[1].season_number,1);const independent=await new Promise(done=>api.providerBook(card,2,[2],[1,2],done));assert.equal(independent[1].name,'Real 0','A sole verified release also maps for providers without the Kodik folder adapter');
});

test('franchise destinations are unique, full release evidence is retained, and movies remain interleaved in the viewing guide',()=>{
 const graph=require('./fixtures/anime-franchise-demon.json'),model=franchise.franchiseModel(graph,38000),before=JSON.stringify(model),rows=franchise.franchiseCatalogueRows(model),cards=rows.flatMap(r=>r.results),targets=cards.flatMap(c=>{const v=c.minimal_anime_targets.filter(t=>t.type===c.media_type);return v.length===1?[c.media_type+':'+v[0].id]:[];});
 assert.equal(targets.length,new Set(targets).size);assert.equal(cards.filter(c=>c.media_type==='tv' && c.minimal_anime_targets.some(t=>t.type==='tv' && t.id===85937)).length,1);assert.ok(cards.some(c=>c.id===40456));assert.equal(JSON.stringify(model),before);
 const ordered=franchise.franchiseViewingOrder(model);assert.ok(ordered.findIndex(s=>s.id===40456)<ordered.findIndex(s=>s.id===47778));assert.deepEqual(ordered.map(s=>s.number),Array.from({length:ordered.length},(_,i)=>i+1));assert.deepEqual(franchise.franchiseViewingOrder({...model,complete:false}),[]);
});

test('future seasons do not inflate the released header and anime classification follows verified global identities',()=>{
 const {publishedSeasonCount}=mod('episode-metadata'),{isAnime}=mod('metadata');assert.equal(publishedSeasonCount({number_of_seasons:2,seasons:[{season_number:1,air_date:'2017-01-06'},{season_number:2,air_date:'2099-01-01'}]},'2026-11-07'),1);
 assert.equal(publishedSeasonCount({number_of_seasons:4,last_episode_to_air:{season_number:3,air_date:'2026-01-01'},seasons:[1,2,3,4].map(season_number=>({season_number}))},'2026-11-07'),3);
 const record=index.animeRecords({mal_id:56038})[0];assert.ok(record.tv);assert.equal(isAnime({id:record.tv,source:'tmdb',media_type:'tv',name:'Lazarus'}),true);assert.equal(isAnime({id:record.tv,source:'tmdb',media_type:'movie',title:'Different namespace'}),false);
});

test('native Shikimori grid advances beyond its initial two-page boundary and stops at the first short page',async()=>{
 const n=await require('./fixtures/native-lampa.cjs')({built:true,requestPipeline:true}),{w,L}=n;try{
  const requests=[],network=w.testNetwork;w.testNetwork=(url,ok,fail)=>{if(!/shikimori\.(io|one)\/api\/animes\?/.test(url))return network(url,ok,fail);const page=Number(new URL(url).searchParams.get('page'));requests.push(page);setTimeout(()=>ok(Array.from({length:page<4?24:2},(_,i)=>({id:page*100+i,name:'Anime',kind:'tv',image:{original:'/p.jpg'}}))),0);};
  L.Activity.push({component:'category_full',source:'minimal_shiki',url:'order=popularity',page:1,title:'All'});await wait(60);const grid=L.Activity.active().activity.component;assert.equal(grid.total_pages,2);
  for(let page=2;page<=4;page++){grid.object.page=page;const result=await new Promise((ok,fail)=>grid.emit('next',ok,fail));assert.equal(result.page,page);assert.equal(grid.total_pages,page<4?page+1:4);}
  assert.deepEqual(requests,[1,2,3,4]);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('a poster queued before its row mounts can request its real artwork on the next visible event',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;try{
  w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/poster-cache.js')],bundle:true,write:false,format:'iife',globalName:'PosterCache'}).outputFiles[0].text);
  const images=[];w.Image=function(){images.push(this);this.naturalWidth=500;this.naturalHeight=750;this.decode=()=>Promise.resolve();};
  const Card={},hooks=[],img=w.document.createElement('img'),node=w.document.createElement('div');node.className='card';node.appendChild(img);node.getBoundingClientRect=()=>({width:150,height:225,top:0,bottom:225,left:0,right:150});
  const item={img,getPosterPath:()=> 'https://image.tmdb.org/t/p/w500/poster.jpg',use:hook=>hooks.push(hook)},L={Maker:{get:()=>Card},Utils:{createInstance:()=>item}};w.PosterCache.default(L,()=>true,()=>true);L.Utils.createInstance(Card,{});hooks[0].onCreate();item.getPosterPath();await wait(15);assert.equal(images.length,0);
  w.document.body.appendChild(node);hooks[0].onVisible();await wait(15);assert.equal(images.length,1);images[0].onload();await wait(0);assert.ok(img.src.endsWith('/poster.jpg'));hooks[0].onDestroy();
 }finally{w.close();}
});

test('the original-language fallback actually requests English through native language normalization and never caches a swapped season',async()=>{
 const requests=[],L={Api:{sources:{tmdb:{get:(route,p,ok)=>{requests.push([route,p.langs]);if(p.langs==='en')ok({season_number:3,episodes:[{id:1,season_number:3,episode_number:1,name:'Actual episode name',overview:'Original synopsis'}]});else ok({season_number:3,episodes:[{id:1,season_number:3,episode_number:1,name:'Серия 1'}]});}}}}};
 const api=catalogue.default(L),book=await new Promise(done=>api.seasonBook({id:4},3,done));assert.equal(requests[1][1],'en');assert.equal(book.episodes[0].name,'Actual episode name');assert.equal(book.episodes[0].overview,'Original synopsis');
});
test('an exact same-year release wins over broad franchise aliases instead of losing Mugen Train to another cour',()=>{
 const {matchProviderParts}=mod('anime-provider-parts'),base='http://lampac.example/lite/kodik',part={name:'Поезд',original:'Kimetsu no Yaiba: Mugen Ressha-hen',family:'Kimetsu no Yaiba',year:'2021'};
 const rows=[{method:'link',similar:true,title:'Истребитель демонов [ТВ-2] / Kimetsu no Yaiba: Mugen Ressha-hen',year:'2021',url:base+'?pick=train'},{method:'link',similar:true,title:'Истребитель демонов [ТВ-2] / Kimetsu no Yaiba: Yuukaku-hen',year:'2021',url:base+'?pick=redlight'}];
 assert.equal(matchProviderParts([part],rows,base)[0].url,base+'?pick=train');
});

test('an announced undated season is excluded using release status while its published predecessor retains all episodes',()=>{
 const {installFullGuard}=mod('tmdb'),previous=global.window;let answer;
 const card={id:1,minimal_anime:true,number_of_seasons:2,number_of_episodes:24,seasons:[1,2].map(season_number=>({season_number,episode_count:12}))};
 const model={complete:true,rows:[{key:'story',results:[{id:10},{id:11}]}],nodes:[{id:10,record:{tv:1,season:1},kind:'tv',status:'released',aired:'2017-01-01'},{id:11,record:{tv:1,season:2},kind:'tv',status:'anons',aired:''}]};
 global.window={LampaView:{animeBase:{canonical:(c,done)=>done(card),collection:(c,done)=>done(model)}}};
 try{const L={Api:{full:(p,done)=>done({movie:card})}};installFullGuard(L);L.Api.full({},v=>answer=v);assert.equal(answer.movie.minimal_detail_seasons,1);assert.equal(answer.movie.minimal_detail_episodes,12);assert.equal(card.number_of_seasons,2);assert.equal(card.number_of_episodes,24);}finally{global.window=previous;}
});

test('Kodik TV markers preserve the season selector and reject dubs as episodes',()=>{
 const {folderSeasons,folderTarget,episodeRows}=mod('online-state'),card={name:'Моб Психо 100',original_name:'Mob Psycho 100',first_air_date:'2016-07-12'},base='https://example.test/lite/kodik?pick=';
 const row=(title,year,id)=>({title,year,url:base+id,method:'link',similar:true});
 const rows=[row('Моб Психо 100 [ТВ-3] / Mob Psycho 100 III',2022,3),row('Моб Психо 100',2018,'live'),row('Моб Психо 100 [ТВ-1] / Mob Psycho 100',2016,1),row('Моб Психо 100 [ТВ-2] / Mob Psycho 100 II',2019,2),row('Моб Психо 100 [OVA]',2019,'ova')];
 assert.deepEqual(folderSeasons(rows,card).map(r=>[r.season,r.url]),[1,2,3].map(n=>[n,base+n]));
 assert.equal(folderTarget(rows,card,2),base+2);
 const episodes=[{method:'play',episode:0},{method:'call',episode:1},{method:'call',episode:2}];
 assert.deepEqual(episodeRows([...episodes,{method:'call',title:'Crunchyroll.Subtitles'},{method:'call',title:'AniDUB'}]),episodes);
 const extra={method:'play',title:'Бонус',url:'/bonus'};
 const late={method:'call',title:'6 серия',url:'/episode6',s:3};
 const control={method:'call',title:'AniDUB',url:'/voice'};
 assert.deepEqual(episodeRows([...episodes,extra,late,control],[{method:'link',title:'AniDUB',url:'/voice'}]).slice(-2),[{...extra,lampa_unassigned_episode:true},{...late,episode:6,season:3}]);
});

test('Russian episode cards preserve local text and images without substituting English',()=>{
 const {localizedEpisodeBook}=mod('episode-metadata'),book={1:{name:'English title',overview:'English synopsis',air_date:'2025-01-01',still_path:'/episode.jpg'},2:{name:'Название — часть',overview:'Описание'},3:{name:'A'}};
 assert.deepEqual(localizedEpisodeBook(book,'ru')[1],{...book[1],name:'Серия 1',overview:''});
 assert.equal(localizedEpisodeBook(book,'ru')[2].name,'Название - часть');
 assert.equal(localizedEpisodeBook(book,'ru')[3].name,'A');
 assert.equal(localizedEpisodeBook(book,'en')[1].name,'English title');
});

test('nonadjacent mapped releases stay separate, and verified consecutive parts share a season',()=>{
 const nodes=[
  {id:1,name:'Series',kind:'tv',aired:'2020-01-01',record:{tv:10,season:1,offset:0}},
  {id:2,name:'Prequel film',kind:'movie',aired:'2021-01-01'},
  {id:3,name:'Series 2',kind:'tv',aired:'2023-01-01',record:{tv:10,season:2,offset:0}},
  {id:4,name:'Series 3',kind:'tv',aired:'2024-01-01',record:{tv:10,season:1,offset:24}},
  {id:5,name:'Series 4',episodes:12,kind:'tv',aired:'2025-01-01',record:{tv:10,season:4,offset:0}},
  {id:6,name:'Series 4 Part 2',kind:'tv',aired:'2025-04-01',record:{tv:10,season:4,offset:12}}
 ];
 const model={complete:true,nodes,edges:[],rows:[{key:'story',results:nodes.map(({id})=>({id}))}]};
 assert.deepEqual(franchise.franchiseViewingOrder(model).map(({season,part})=>[season,part]),[[1,0],[0,0],[2,0],[3,0],[4,1],[4,2]]);
});
