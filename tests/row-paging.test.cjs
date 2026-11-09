const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
test('native actor grid retains all 27 works across pages without duplicate cast and crew credits',async()=>{
 const native=require('./fixtures/native-lampa.cjs'),n=await native({built:true}),{L,w}=n;try{
 L.Api.sources.tmdb.get=(url,p,ok)=>w.setTimeout(()=>ok(url.includes('_credits')?{cast:Array.from({length:27},(_,i)=>({id:700+i,title:'Film '+i,popularity:100-i,poster_path:'/p.jpg'})),crew:[{id:700,title:'Duplicate'}]}:{name:'Actor'}),0);
 L.Activity.push({component:'actor',id:690,source:'tmdb'});await new Promise(r=>setTimeout(r,180));const grid=L.Activity.active().activity.component;assert.equal(grid.items.length,20);grid.object.page=2;const next=await new Promise((ok,fail)=>grid.emit('next',ok,fail));assert.equal(next.results.length,7);assert.equal(next.results.at(-1).id,726);assert.equal(next.total_pages,2);assert.equal(grid.render(true).querySelectorAll('.minimal-project-tabs button').length,2);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
