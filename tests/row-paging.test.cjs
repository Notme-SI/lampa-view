const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
test('native actor filmography retains all 27 works and remote navigation reaches the last card',async()=>{
 const native=require('./fixtures/native-lampa.cjs'),n=await native({built:true}),{L}=n;try{
  L.Api.person=(p,ok)=>ok({person:{id:p.id,name:'Actor',profile_path:'/actor.jpg'},credits:{knownFor:[{name:'Films',credits:Array.from({length:27},(_,i)=>({id:700+i,title:'Film '+i,original_title:'Film '+i,release_date:'2025-01-01',poster_path:'/p'+i+'.jpg',source:'tmdb'}))}]}});
  L.Activity.push({component:'actor',id:690,source:'tmdb'});await new Promise(r=>setTimeout(r,180));
  const link=L.Activity.active().activity.component,line=link.items.find(item=>item.data.results.length===27);assert.ok(line);const root=line.render(true);
  assert.equal(root.querySelectorAll('.minimal-row-arrow').length,0);assert.equal(line.data.results.length,27);
  line.toggle();for(let i=0;i<26;i++)L.Controller.enabled().controller.right();assert.equal(line.active,26);assert.equal(line.items.length,27);assert.equal(line.items[26].data.title,'Film 26');assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
