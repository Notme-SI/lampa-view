const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const source=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/filters.js')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,mod={exports:{}};new Function('module','exports',source)(mod,mod.exports);
test('quality sorting uses explicit release data or fresh cache, preserves ties and leaves unknown last',()=>{
 const L={Storage:{get:()=>[['movie:cached:2026',{q:'1080p',time:Date.now()}],['movie:expired:2026',{q:'4K',time:Date.now()-21600001}]]}},cards=[{id:1,title:'Unknown'},{id:2,title:'HD',quality:'720p'},{id:3,title:'Cached',release_date:'2026-01-01'},{id:4,title:'UHD',release_quality:'2160p'},{id:5,title:'Expired',release_date:'2026-01-01'},{id:6,title:'Other UHD',quality:'4K'}];
 assert.deepEqual(mod.exports.sortQuality(L,cards).map(c=>c.id),[4,6,3,2,1,5]);assert.equal(cards[0].id,1,'input/native card order is not mutated');
});


test('all discover filters map to supported movie and TV parameters, including independent TMDB anime',()=>{
 const {discoverUrl,minimumVotes}=mod.exports;
 for(const kind of ['movie','tv','anime_movie','anime_tv'])for(const sort of ['popularity.desc','vote_average.desc','primary_release_date.desc']){
  const path=discoverUrl({kind,sort,year_from:'2019',year_to:'2025',genre:18,score:8,votes:1000,language:'ko'},'uk'),tv=kind==='tv' || kind==='anime_tv',anime=kind.startsWith('anime_'),url=new URL(path,'https://tmdb.test/');
  assert.equal(url.pathname,tv?'/discover/tv':'/discover/movie');assert.equal(url.searchParams.get('language'),'uk');assert.equal(url.searchParams.get('include_adult'),'false');assert.equal(url.searchParams.get(tv?'first_air_date.gte':'primary_release_date.gte'),'2019-01-01');assert.equal(url.searchParams.get(tv?'first_air_date.lte':'primary_release_date.lte'),'2025-12-31');assert.equal(url.searchParams.get('vote_average.gte'),'8');assert.equal(url.searchParams.get('vote_count.gte'),'1000');assert.equal(url.searchParams.get('with_genres'),anime?'16,18':'18');assert.equal(url.searchParams.get('with_original_language'),anime?'ja':'ko');assert.equal(url.searchParams.get('sort_by'),tv && sort==='primary_release_date.desc'?'first_air_date.desc':sort);
 }
 assert.equal(minimumVotes({kind:'anime_tv',sort:'vote_average.desc'}),200);assert.equal(minimumVotes({kind:'anime_movie',sort:'vote_average.desc'}),500);assert.equal(minimumVotes({kind:'movie',sort:'vote_average.desc',votes:'0'}),0);
});

test('a movie with a legacy name uses the movie quality cache and one normalizer for HD/FHD/UHD',()=>{
 const L={Storage:{get:()=>[['movie:film:2025',{q:'FHD',time:Date.now()}]]}},card={id:1,title:'Film',name:'Film',media_type:'movie',release_date:'2025-01-01'};
 assert.equal(mod.exports.cachedQuality(L,card),'1080p');assert.deepEqual(mod.exports.sortQuality(L,[card,{id:2,title:'HD',quality:'HD'},{id:3,title:'UHD',quality:'UHD'}]).map(c=>c.id),[3,1,2]);
});
