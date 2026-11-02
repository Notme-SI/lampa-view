const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const source=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/filters.js')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,mod={exports:{}};new Function('module','exports',source)(mod,mod.exports);
test('quality sorting uses explicit release data or fresh cache, preserves ties and leaves unknown last',()=>{
 const L={Storage:{get:()=>[['movie:cached:2026',{q:'1080p',time:Date.now()}],['movie:expired:2026',{q:'4K',time:Date.now()-21600001}]]}},cards=[{id:1,title:'Unknown'},{id:2,title:'HD',quality:'720p'},{id:3,title:'Cached',release_date:'2026-01-01'},{id:4,title:'UHD',release_quality:'2160p'},{id:5,title:'Expired',release_date:'2026-01-01'},{id:6,title:'Other UHD',quality:'4K'}];
 assert.deepEqual(mod.exports.sortQuality(L,cards).map(c=>c.id),[4,6,3,2,1,5]);assert.equal(cards[0].id,1,'input/native card order is not mutated');
});
