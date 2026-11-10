const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs'),until=require('./fixtures/until.cjs');
test('desktop resolves lazy episodes on both sides while Android retains its eight-ahead policy',async()=>{
 const n=await native({built:true}),{w}=n;
 try{
  let requests=[],active=0,maximum=0;w.XMLHttpRequest=class{open(method,url){this.url=url;}setRequestHeader(){}getResponseHeader(){return null;}send(){requests.push(this.url);maximum=Math.max(maximum,++active);this.status=200;this.responseText=JSON.stringify({url:'https://stream.test/episode-'+new URL(this.url).searchParams.get('e')+'.mp4'});w.setTimeout(()=>{active--;this.onload();},0);}};
  const episodes=Array.from({length:24},(_,i)=>({e:i+1,title:'Эпизод '+(i+1)}));
  const items=episodes.map(ep=>({method:'call',url:'http://lampa.example.invalid/lite/qa?e='+ep.e,episode:ep.e}));
  const candidate={src:'qa',items},pb={season:1,episodes,voice:{cands:[candidate]},findItem:(items,e)=>items.find(it=>it.episode===e),session:{serial:true,movie:{id:91,name:'Series',original_name:'Series',first_air_date:'2025-01-01'},itemsOf:c=>c.items}};
  const selected={episode:12,season:1,url:'https://stream.test/episode-12.mp4',alc_pb:pb,alc_src:'qa'};selected.playlist=[selected];
  let done=false;const full=w.alc_auto_debug.extPlaylist(selected,()=>done=true,{previous:true});await until(()=>done,'bidirectional external resolver');
  assert.deepEqual(Array.from(full.list(),x=>x.episode),episodes.map(e=>e.e));assert.equal(requests.length,23);assert.ok(maximum<=4);
  // Nearby entries get queued first; ready lists retain their canonical order.
  assert.equal(new URL(requests[0]).searchParams.get('e'),'11');assert.equal(new URL(requests[1]).searchParams.get('e'),'13');
  requests=[];done=false;const android=w.alc_auto_debug.extPlaylist(selected,()=>done=true);await until(()=>done,'native Android resolver');
  assert.deepEqual(Array.from(android.list(),x=>x.episode),[12,13,14,15,16,17,18,19,20]);
  assert.equal(requests.length,8);assert.deepEqual(n.errors,[]);
  requests=[];const cancelled=w.alc_auto_debug.extPlaylist(selected,()=>assert.fail('Cancelled resolver completed'),{previous:true});cancelled.cancel();await new Promise(r=>setTimeout(r,30));assert.equal(requests.length,4,'Only already-running requests survive cancellation');
 }finally{n.close();}
});
