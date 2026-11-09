const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
function mod(name){const m={exports:{}};new Function('module','exports',esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text)(m,m.exports);return m.exports;}
const browse=mod('catalogue-browser'),model=mod('discovery-model'),{discoverySpec}=mod('discovery-source');
test('single category list includes all non-genre collections, accepts archives and combines its filters',()=>{
 for(const kind of browse.BROWSE_KINDS){
  const options=browse.browseOptions(kind);assert.ok(options.collections.length>5);assert.ok(options.collections.every(r=>!r.key.startsWith('genre-')));
  for(const row of options.collections)assert.ok(discoverySpec(browse.browseSpec(kind,{collection:row.key})),kind+':'+row.key);
  const spec=browse.browseSpec(kind,{period:'1990–2005',genre:options.genres[0].id,sort:'rated'}),path=model.discoverySpecs(spec)[0].path,q=new URLSearchParams(path.split('?')[1]),field=path.startsWith('discover/movie')?'primary_release_date':'first_air_date';
  assert.equal(q.get(field+'.gte'),'1990-01-01');assert.equal(q.get(field+'.lte'),'2005-12-31');assert.equal(q.get('sort_by'),'vote_average.desc');
 }
 assert.equal(browse.yearRange('2005–1990'),'');assert.equal(browse.yearRange('1800-2020'),'');assert.equal(browse.yearRange('2020 OR 1=1'),'');assert.equal(browse.yearRange('2001'),'2001-2001');
 const spec=browse.browseSpec('tv',{});assert.ok(model.discoveryAccepts({id:1,name:'Архив',first_air_date:'1980-01-01',genre_ids:[18]},spec));
 const changed=browse.browseSpec('movie',{collection:'now-watching',genre:'28'});assert.ok(model.discoverySpecs(changed)[0].path.startsWith('discover/'));
 const recent=browse.browseSpec('movie',{collection:'new',period:'1990-2005'});assert.equal(new URLSearchParams(model.discoverySpecs(recent)[0].path.split('?')[1]).get('primary_release_date.gte'),'1990-01-01');
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
