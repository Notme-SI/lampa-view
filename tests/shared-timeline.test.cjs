const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/shared-timeline.js')],bundle:true,write:false,format:'iife',globalName:'Shared'}).outputFiles[0].text;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function backend(){
 const areas=new Map(),requests=[];let version=100;
 const scope=url=>url.searchParams.get('account_email')+'|'+url.searchParams.get('profile_id');
 return {areas,requests,delay:0,inject(email,id,hash,data){const key=email+'|'+id;if(!areas.has(key))areas.set(key,new Map());areas.get(key).set(hash,{hash,card:'native',...data,updated_at:++version});},ajax(params){
  const url=new URL(params.url),key=scope(url);requests.push({method:url.pathname,scope:key,body:params.data && JSON.parse(params.data),since:Number(url.searchParams.get('since'))});
  if(!areas.has(key))areas.set(key,new Map());const area=areas.get(key);let result;
  if(params.type==='POST'){
   let skipped=0;for(const row of JSON.parse(params.data).rows){const old=area.get(row.hash);if(old && old.watched_at>row.watched_at){skipped++;continue;}area.set(row.hash,{...row,updated_at:++version});}
   result={success:true,skipped,version};
  }else{
   let rows=Array.from(area.values()).filter(row=>!url.pathname.endsWith('changelog') || row.updated_at>Number(url.searchParams.get('since'))).sort((a,b)=>a.updated_at-b.updated_at);
   const limit=Number(url.searchParams.get('limit')) || Infinity,truncated=rows.length>limit;rows=rows.slice(0,limit);result={rows:structuredClone(rows),version:rows.length?rows.at(-1).updated_at:Number(url.searchParams.get('since')),truncated};
  }
  const timer=setTimeout(()=>params.success(result),this.delay);return{abort(){clearTimeout(timer);}};
 }};
}
function client(server,profile=7,options={}){
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://lampa.test/'}),w=dom.window,store={account:{email:'viewer@example.test'}},hooks={};
 const listener={follow(name,fn){(hooks[name] ||= []).push(fn);},send(name,data){for(const fn of hooks[name] || [])fn(data);}};
 const L={Account:{Permit:{sync:true,account:{profile:{id:profile,main:options.main}}}},Plugins:{get:()=>options.noPlugin?[]:[{url:'http://lampac.test/timecode.js'}]},Storage:{get:(k,d)=>store[k]===undefined?d:store[k],set:(k,v)=>store[k]=v},Timeline:{listener,filename:()=> 'file_view_'+L.Account.Permit.account.profile.id,read(){listener.send('read',{});},update(value){const file=this.filename(),records=store[file] ||= {},old=records[value.hash] || {};records[value.hash]={...old,...value,updated:value.received?value.updated:Date.now()};listener.send('update',{data:{hash:value.hash,road:records[value.hash]}});}}};
 w.jQuery={ajax:p=>server.ajax(p)};w.eval(bundle);const sync=w.Shared.default(L,()=>true);
 return {w,L,store,sync,records:()=>store[L.Timeline.filename()] || {},close(){sync.stop();w.close();}};
}
test('two devices share actual episode time and manual marks, propagate clears, and converge without echo writes',async()=>{
 const server=backend(),a=client(server,7,{main:true}),b=client(server);try{
  a.sync.refresh();b.sync.refresh();await wait(30);
  a.L.Timeline.update({hash:'series-12',percent:40,time:1304,duration:3200});a.L.Timeline.update({hash:'movie',percent:100,time:0,duration:0});await wait(400);
  b.sync.refresh();await wait(40);assert.equal(b.records()['series-12'].time,1304);assert.equal(b.records().movie.percent,100);assert.equal(b.records().movie.time,0);
  assert.equal(b.records()['series-12'].profile,7);const writes=server.requests.filter(r=>r.method.endsWith('/set')).length;await wait(1100);assert.equal(server.requests.filter(r=>r.method.endsWith('/set')).length,writes,'Imports must not echo back');
  b.L.Timeline.update({hash:'series-12',percent:0,time:0,duration:3200});await wait(400);a.sync.refresh();await wait(30);assert.equal(a.records()['series-12'].percent,0);assert.equal(a.records()['series-12'].duration,3200);
  const deleted=server.areas.get('viewer@example.test|7').get('series-12');assert.equal(deleted.deleted,true);
  // Native old dumps bypass update. The newer tombstone still wins.
  a.store.file_view_7['series-12']={percent:100,time:3200,duration:3200,updated:1};a.L.Timeline.read();assert.equal(a.records()['series-12'].percent,0);
 }finally{a.close();b.close();}
});
test('new unsent local progress survives stale native imports; older received events preserve its author stamp',async()=>{
 const server=backend(),a=client(server);try{
  a.sync.refresh();await wait(20);a.L.Timeline.update({hash:'episode',percent:30,time:500,duration:2000});const updated=a.records().episode.updated;
  a.store.file_view_7.episode={percent:90,time:1800,updated:1};a.L.Timeline.read();assert.equal(a.records().episode.time,500);
  a.L.Timeline.update({hash:'episode',percent:100,time:2000,updated:2,received:true});assert.equal(a.records().episode.time,500);assert.equal(a.records().episode.updated,updated);
  await wait(400);assert.equal(server.areas.get('viewer@example.test|7').get('episode').position,500);
 }finally{a.close();}
});
test('offline bootstrap keeps real timestamps; profile switch discards late responses and never uploads another profile',async()=>{
 const server=backend();server.inject('viewer@example.test',7,'episode',{percent:20,position:200,duration:1000,watched_at:20});server.inject('viewer@example.test',8,'other',{percent:50,position:500,duration:1000,watched_at:30});server.delay=40;
 const a=client(server);try{
  a.store.file_view_7={episode:{percent:80,time:800,duration:1000,updated:10}};a.sync.refresh();a.L.Account.Permit.account.profile.id=8;a.sync.refresh();await wait(90);
  assert.equal(a.records().episode,undefined);assert.equal(a.records().other.time,500);assert.equal(a.store.file_view_7.episode.time,800);
  a.L.Account.Permit.account.profile.id=7;a.sync.refresh();await wait(90);assert.equal(a.records().episode.time,200);assert.equal(a.records().episode.updated,20);assert.equal(a.records().other,undefined);
  assert.equal(server.requests.filter(r=>r.method.endsWith('/set')).length,0);
 }finally{a.close();}
});
test('paged deltas and concurrent POST versions do not skip unseen device writes',async()=>{
 const server=backend(),a=client(server);try{
  a.sync.refresh();await wait(20);
  for(let i=0;i<1004;i++)server.inject('viewer@example.test',7,'hash'+i,{percent:10,position:i,duration:2000,watched_at:i+1});
  a.L.Timeline.update({hash:'local',percent:20,time:40,duration:200});await wait(350);a.sync.refresh();await wait(100);assert.equal(Object.keys(a.records()).length,1005);assert.equal(a.records().hash1003.time,1003);
  const deltas=server.requests.filter(r=>r.method.endsWith('/changelog'));assert.ok(deltas.length>=2);assert.ok(deltas[0].since<server.areas.get('viewer@example.test|7').get('hash0').updated_at);
 }finally{a.close();}
});
test('no server discovery, disabled CUB sync, hidden screen and playback do not issue requests',async()=>{
 const server=backend(),a=client(server,7,{noPlugin:true}),b=client(server);try{
  a.sync.refresh();b.L.Account.Permit.sync=false;b.sync.refresh();assert.equal(server.requests.length,0);
  b.L.Account.Permit.sync=true;Object.defineProperty(b.w.document,'hidden',{value:true,configurable:true});b.sync.refresh();assert.equal(server.requests.length,0);
  Object.defineProperty(b.w.document,'hidden',{value:false,configurable:true});b.L.Controller={enabled:()=>({name:'player'})};b.sync.refresh();assert.equal(server.requests.length,0);
 }finally{a.close();b.close();}
});

test('real Lampac empty dump omits version zero and still bootstraps local uploads',async()=>{
 const server=backend(),ajax=server.ajax;server.ajax=function(params){const success=params.success;return ajax.call(this,{...params,success:value=>{if(value && value.rows && !value.rows.length && value.version===0){value={rows:[]};}success(value);}});};
 const a=client(server),b=client(server);try{
  a.store.file_view_7={episode:{percent:40,time:1304,duration:3200,updated:123}};a.sync.refresh();await wait(400);
  assert.equal(a.sync.status().state,'ready');assert.equal(server.areas.get('viewer@example.test|7').get('episode').position,1304);
  b.sync.refresh();await wait(30);assert.equal(b.records().episode.time,1304);
 }finally{a.close();b.close();}
});


test('a nonempty dump without a version remains an error and never uploads over it',async()=>{
 const server=backend(),ajax=server.ajax;server.inject('viewer@example.test',7,'episode',{percent:40,position:100,duration:250,watched_at:10});
 server.ajax=function(params){const success=params.success;return ajax.call(this,{...params,success:value=>{if(value && value.rows && value.rows.length){value={rows:value.rows};}success(value);}});};
 const a=client(server);try{a.sync.refresh();await wait(30);assert.equal(a.sync.status().state,'offline');assert.equal(a.records().episode,undefined);assert.equal(server.requests.filter(r=>r.method.endsWith('/set')).length,0);}finally{a.close();}
});

test('device synchronization preserves stable episode links alongside opaque native hashes',async()=>{
 const server=backend(),a=client(server),b=client(server);
 try{
  a.sync.refresh();b.sync.refresh();await wait(30);
  a.L.Timeline.update({hash:'opaque-file',card:'tv_95403',season:1,episode:6,percent:20,time:240,duration:1200});await wait(400);
  b.sync.refresh();await wait(30);
  assert.equal(b.records()['opaque-file'].card,'tv_95403');assert.equal(b.records()['opaque-file'].episode,6);assert.equal(b.records()['opaque-file'].time,240);
  server.inject('viewer@example.test',7,'opaque-file',{percent:40,position:480,duration:1200,watched_at:Date.now()+1,card:'lampa_view_timeline_v1'});
  b.sync.refresh();await wait(30);assert.equal(b.records()['opaque-file'].card,'tv_95403','Legacy imports must retain a known local card link');
 }finally{a.close();b.close();}
});

test('TimeCode 4 imports a fresh edit of an old watch without uploading stale local progress',async()=>{
 const server=backend(),a=client(server);
 try{
  a.store.file_view_7={episode:{percent:20,time:200,duration:1000,updated:200}};
  server.inject('viewer@example.test',7,'episode',{percent:90,position:900,duration:1000,watched_at:100,changed_at:300});
  a.sync.refresh();await wait(400);
  assert.equal(a.records().episode.time,900);assert.equal(a.records().episode.updated,300);
  assert.equal(server.requests.filter(r=>r.method.endsWith('/set')).length,0,'The newer server edit must not be overwritten');
  server.inject('viewer@example.test',7,'episode',{percent:40,position:400,duration:1000,watched_at:400,changed_at:0});
  a.sync.refresh();await wait(30);assert.equal(a.records().episode.time,400);assert.equal(a.records().episode.updated,400,'Zero changed_at retains legacy watched_at semantics');
 }finally{a.close();}
});

test('measured playback writes can reach another device while general refresh stays deferred',async()=>{
 const server=backend(),a=client(server),b=client(server);
 try{
  a.sync.refresh();b.sync.refresh();await wait(30);
  a.L.Controller={enabled:()=>({name:'player'})};
  const before=server.requests.length;a.sync.refresh();assert.equal(server.requests.length,before);
  a.L.Timeline.update({hash:'episode-6',card:'tv_95403',season:1,episode:6,percent:20,time:240,duration:1200});await wait(400);
  b.sync.refresh();await wait(30);assert.equal(b.records()['episode-6'].time,240);assert.equal(b.records()['episode-6'].episode,6);
 }finally{a.close();b.close();}
});
