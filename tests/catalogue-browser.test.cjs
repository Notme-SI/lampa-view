const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
function mod(name){const m={exports:{}};new Function('module','exports',esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text)(m,m.exports);return m.exports;}
const browse=mod('catalogue-browser'),model=mod('discovery-model'),{discoverySpec}=mod('discovery-source');
test('single category list includes all non-genre collections, accepts archives and combines its filters',()=>{
 for(const kind of browse.BROWSE_KINDS){
  const options=browse.browseOptions(kind);assert.ok(options.collections.length>=4);assert.ok(options.collections.every(r=>!r.key.startsWith('genre-')));
  for(const row of options.collections)assert.ok(discoverySpec(browse.browseSpec(kind,{collection:row.key})),kind+':'+row.key);
  const spec=browse.browseSpec(kind,{period:'1990–2005',genre:options.genres[0].id,sort:'rated'}),path=model.discoverySpecs(spec)[0].path,q=new URLSearchParams(path.split('?')[1]),field=path.startsWith('discover/movie')?'primary_release_date':'first_air_date';
  assert.equal(q.get(field+'.gte'),'1990-01-01');assert.equal(q.get(field+'.lte'),'2005-12-31');assert.equal(q.get('sort_by'),'vote_average.desc');
 }
 assert.equal(browse.yearRange('2005–1990'),'');assert.equal(browse.yearRange('1800-2020'),'');assert.equal(browse.yearRange('2020 OR 1=1'),'');assert.equal(browse.yearRange('2001'),'2001-2001');
 const spec=browse.browseSpec('tv',{});assert.ok(model.discoveryAccepts({id:1,name:'Архив',first_air_date:'1980-01-01',genre_ids:[18]},spec));
 const changed=browse.browseSpec('movie',{collection:'now-watching',genre:'28'});assert.ok(model.discoverySpecs(changed)[0].path.startsWith('discover/'));
 const recent=browse.browseSpec('movie',{collection:'new',period:'1990-2005'});assert.equal(new URLSearchParams(model.discoverySpecs(recent)[0].path.split('?')[1]).get('primary_release_date.gte'),'1990-01-01');
 const series=browse.browseSpec('cartoon',{collection:'series',genre:'28'});assert.equal(series.type,'tv');assert.equal(series.genre,'');assert.equal(model.discoverySpecs(series).length,1);
 assert.deepEqual(model.discoverySpecs(browse.browseSpec('movie',{collection:'upcoming',period:'1990-2005'})),[]);
});

test('TV-show filters compose country, genre, archived years and rating',()=>{
 const options=browse.browseOptions('tvshow');assert.deepEqual(options.collections.map(r=>r.key),['now-watching','new','rated','russian-reality','russian-talk']);assert.deepEqual(options.genres.map(g=>g.id),['10764','10767']);
 const spec=browse.browseSpec('tvshow',{country:'FR',genre:'10767',period:'1990-2005',sort:'rated'}),q=new URLSearchParams(model.discoverySpecs(spec)[0].path.split('?')[1]);assert.equal(spec.type,'tv');assert.ok(discoverySpec(spec));assert.equal(q.get('with_origin_country'),'FR');assert.equal(q.get('with_genres'),'10767');assert.equal(q.get('first_air_date.gte'),'1990-01-01');assert.equal(q.get('sort_by'),'vote_average.desc');
 const base=browse.browseSpec('tvshow');assert.ok(model.discoveryAccepts({id:1,name:'Архивное ток-шоу',first_air_date:'1995-01-01',genre_ids:[10767],origin_country:['RU']},base));assert.equal(model.discoveryAccepts({id:2,name:'Драма',genre_ids:[18],origin_country:['RU']},base),false);
});
test('Russia combines modern and historical countries in a single ordered result',async()=>{
 for(const kind of browse.BROWSE_KINDS){
  assert.deepEqual(browse.browseOptions(kind).countries.filter(([code])=>['RU','SU'].includes(code)).map(([code])=>code),['RU']);
  assert.equal(browse.browseState(kind,{country:'SU'}).country,'RU');
  assert.equal(browse.browseState(kind,{collection:'country-RU'}).country,'RU');
  assert.equal(browse.browseState(kind,{collection:'country-RU'}).collection,'');
 }
 assert.equal(browse.browseState('tv',{collection:'country-KR'}).country,'KR');
 const calls=[],spec=browse.browseSpec('tv',{country:'SU',sort:'rated'});
 const card=(id,country,rating)=>({id,name:'Сериал '+id,origin_country:[country],genre_ids:[18],poster_path:'/p.jpg',vote_average:rating});
 const L={Api:{sources:{tmdb:{get(path,{page},ok){
  const country=new URLSearchParams(path.split('?')[1]).get('with_origin_country');
  calls.push(country+':'+page);
  const offset=(page-1)*15;
  const results=Array.from({length:15},(_,i)=>card(1+offset+i+(country==='SU'?100:0),country,10-(offset+i)*.2-(country==='SU'?.1:0)));
  if(country==='SU' && page===1)results.unshift(card(1,country,10));
  ok({results,page,total_pages:2});
 }}}}};
 const api=mod('discovery-source').default(L),cards=[];
 for(let page=1;page<=3;page++){
  const data=await new Promise((ok,fail)=>api.list({url:JSON.stringify(spec),page},ok,fail));
  cards.push(...data.results);
 }
 assert.deepEqual(calls.sort(),['RU:1','RU:2','SU:1','SU:2']);
 assert.equal(cards.length,60);
 assert.equal(new Set(cards.map(c=>c.id)).size,60);
 assert.ok(cards.every((c,i)=>!i || c.vote_average<=cards[i-1].vote_average));
 assert.equal(discoverySpec({...spec,country:'SU'}).country,'RU');
});
test('actor projects merge cast and crew once per media identity without clipping the full filmography',()=>{
 const {personProjects}=mod('project-browser'),cast=Array.from({length:67},(_,i)=>({id:i+1,title:'Проект '+i,popularity:67-i,poster_path:'/p.jpg'}));
 const result=personProjects({cast,crew:[cast[0],{id:88,title:'Режиссёрская работа',popularity:100}]},'movie');assert.equal(result.length,68);assert.equal(result[0].id,88);assert.equal(new Set(result.map(c=>c.id)).size,68);assert.ok(result.every(c=>c.media_type==='movie' && c.source==='tmdb'));
});
test('mixed cartoon sorting merges both paginated formats without losing or repeating lower-ranked projects',async()=>{
 const install=mod('discovery-source').default,L={Api:{sources:{tmdb:{get(path,p,ok){const tv=path.startsWith('discover/tv'),page=p.page;ok({page,total_pages:2,results:Array.from({length:20},(_,i)=>({id:(page-1)*20+i+1,title:'Проект',name:'Проект',genre_ids:[16],original_language:'en',poster_path:'/p.jpg',popularity:100-(page-1)*20-i+(tv?.5:0)}))});}}}}},source=install(L),all=[];
 for(let page=1;page<=4;page++){const result=await new Promise((ok,fail)=>source.list({url:JSON.stringify(browse.browseSpec('cartoon')),page},ok,fail));all.push(...result.results);assert.equal(result.total_pages,page===4?4:page+1);}
 assert.equal(all.length,80);assert.equal(new Set(all.map(c=>c.media_type+':'+c.id)).size,80);assert.ok(all.every((card,i)=>!i || card.popularity<=all[i-1].popularity));
});

test('category filters expose revenue, votes, verified networks and studios without changing home rows',()=>{
 for(const kind of ['movie','tv','cartoon']){
  const options=browse.browseOptions(kind),keys=options.collections.map(row=>row.key);
  assert.equal(new Set(keys).size,keys.length);
  assert.ok(keys.includes(kind==='cartoon'?'mixed-votes':'votes'));
  assert.equal(new Set(options.collections.map(row=>JSON.stringify(row.discovery))).size,keys.length);
  assert.ok(browse.browseSorts(kind).some(([key])=>key==='votes'));
  assert.equal(keys.includes('revenue'),kind!=='tv');
  for(const row of options.collections){const spec=browse.browseSpec(kind,{collection:row.key});assert.ok(discoverySpec(spec));assert.ok(model.discoverySpecs(spec).length,kind+':'+row.key);}
 }
 for(const kind of ['movie','cartoon'])for(const selection of [{collection:'revenue'},{sort:'revenue'}]){
  const spec=browse.browseSpec(kind,selection),streams=model.discoverySpecs(spec);
  assert.equal(spec.type,'movie');assert.equal(streams.length,1);assert.equal(new URLSearchParams(streams[0].path.split('?')[1]).get('sort_by'),'revenue.desc');
 }
 assert.equal(browse.browseState('tv',{sort:'revenue'}).sort,'');
 assert.ok(browse.browseOptions('tv').collections.some(row=>row.key==='network-213'));
 assert.ok(browse.browseOptions('cartoon').collections.some(row=>row.key.startsWith('studio-')));
});

test('vote sorting merges independent streams by vote count and revenue keeps provider order',async()=>{
 const L={Api:{sources:{tmdb:{get(path,p,ok){const tv=path.startsWith('discover/tv');ok({page:1,total_pages:1,results:[{id:tv?1:2,title:'Проект',name:'Проект',genre_ids:[16],original_language:'en',poster_path:'/p.jpg',vote_count:tv?100:1000,popularity:tv?999:1}]});}}}}};
 const api=mod('discovery-source').default(L),spec=browse.browseSpec('cartoon',{sort:'votes'}),result=await new Promise((ok,fail)=>api.list({url:JSON.stringify(spec),page:1},ok,fail));
 assert.deepEqual(result.results.map(row=>row.vote_count),[1000,100]);
 for(const kind of ['movie','cartoon']){
  const streams=model.discoverySpecs(browse.browseSpec(kind,{sort:'revenue',country:'RU'}));
  assert.equal(streams.length,1);assert.equal(new URLSearchParams(streams[0].path.split('?')[1]).get('with_origin_country'),'RU|SU');
 }
 assert.equal(browse.browseState('cartoon',{collection:'series',sort:'revenue'}).sort,'');
});
