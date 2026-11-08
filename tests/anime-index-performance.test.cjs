const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
test('ordinary catalogue lookup does not retain indexes for every external anime namespace',()=>{
 const maps=[];class TrackedMap extends Map{constructor(...args){super(...args);maps.push(this);}}
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/anime-index.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
 const module={exports:{}};new Function('module','exports','Map',code)(module,module.exports,TrackedMap);
 const api=module.exports,total=()=>maps.reduce((sum,map)=>sum+map.size,0);
 assert.deepEqual(api.animeRecords({}),[]);assert.equal(total(),0);
 const first=api.animeRecords({source:'tmdb',id:31910,media_type:'tv'});assert.ok(first.some(row=>row.mal===1735));
 assert.ok(total()<12000,'An ordinary TV lookup must not build MAL, AniList and AniDB indexes');
 assert.strictEqual(api.animeRecords({source:'tmdb',id:31910,media_type:'tv'})[0],first[0],'Repeated lookups reuse hydrated records');
 assert.deepEqual(api.animeRecords({mal_id:38000,tmdb_id:31910,media_type:'tv'}),[],'Contradictory coordinates remain unresolved');
});
