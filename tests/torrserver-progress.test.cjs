const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
test('server checkpoints survive restart, map next episode and reject stale/profile responses',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;
 try{const state={},events={},records={},requests=[];let scope='p1';
 const L={Storage:{get:(k,v)=>state[k]??v,set:(k,v)=>state[k]=v,field:()=>true},Torserver:{url:()=> 'http://server:8090'},Timeline:{filename:()=>scope,view:h=>records[h]||{},update:r=>records[r.hash]=r},Player:{listener:{follow:(n,f)=>events[n]=f}},Reguest:function(){this.timeout=()=>{};this.clear=()=>{};this.silent=(url,ok,fail,body)=>requests.push({url,ok,body});}};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/torrserver-progress.js')],bundle:true,write:false,format:'iife',globalName:'Mod'}).outputFiles[0].text);
 let api=w.Mod.default(L,()=>true);const make=n=>({torrent_hash:'abc',url:'http://server:8090/stream?link=abc&index='+n,card:{id:1,name:'Series',source:'tmdb'},season:1,episode:n,timeline:{hash:'ep'+n,duration:3000}});
 const movie={...make(9),card:{id:2,title:'Movie',media_type:'movie'},timeline:{hash:'movie'}};
 events.create({data:{...make(7),playlist:[make(7),make(8),movie]}});api.stop();api=w.Mod.default(L,()=>true);api.refresh();assert.equal(requests.length,1);assert.equal(JSON.parse(requests[0].body).hash,'abc');requests[0].ok([{file_index:8,timecode:1500},{file_index:7,timecode:2900},{file_index:9,timecode:321}]);assert.equal(records.ep8.episode,8);assert.equal(records.ep8.time,1500);assert.equal(records.ep8.percent,50);assert.equal(records.movie.card,'movie_2');assert.equal(records.movie.time,321);assert.equal(records.movie.percent,0);api.stop();
 api=w.Mod.default(L,()=>true);api.refresh();requests.at(-1).ok([{file_index:8,timecode:100}]);assert.equal(records.ep8.time,1500);api.stop();
 api=w.Mod.default(L,()=>true);api.refresh();scope='p2';requests.at(-1).ok([{file_index:8,timecode:1800}]);assert.equal(records.ep8.time,1500);api.stop();
 }finally{w.close();}
});

test('Android return saves measured position to the exact torrent file for cross-device history',async()=>{
 const native=require('./fixtures/native-lampa.cjs'),sent=[],viewed=[];
 const f=await native({prepare(w,L){
  const is=L.Platform.is;
  L.Platform.is=name=>name==='android' || is.call(L.Platform,name);
  w.AndroidJS={appVersion:()=> '1.13.3-999',openPlayer:(url,data)=>sent.push({url,data:JSON.parse(data)})};
  L.Torserver.url=()=> 'http://server:8090';
  L.Torserver.viewedSet=(...args)=>viewed.push(args);
  L.Storage.set('torrserver_tracktimecode',true);
 }});
 try{
  const {L}=f,hash='a'.repeat(40),card={id:41,name:'Series',source:'tmdb'};
  const file=(index,episode)=>({url:'/ts/stream/file.mkv?link='+hash+'&index='+index+'&play',torrent_hash:hash,
   timeline:L.Timeline.view('ep'+episode),season:1,episode,card});
  const first=file(7,1),second=file(11,2),third=file(13,3),fourth=file(19,4);
  third.timeline.duration=2103;
  L.Android.openPlayer(first.url,{...first,playlist:[first,second,third,fourth]});
  assert.equal(sent.length,1);assert.equal(viewed.length,0,'Opening a torrent never creates playback progress');
  L.Android.timeCall({hash:'unrelated',time:120,duration:3000,percent:4});
  assert.equal(viewed.length,0);
  L.Android.timeCall({hash:'ep2',time:1250,duration:2500,percent:50});
  assert.equal(L.Timeline.view('ep2').time,1250);
  assert.deepEqual(viewed,[[hash,11,1250]]);
  L.Storage.set('torrserver_tracktimecode',false);
  L.Android.timeCall({hash:'ep2',time:1800,duration:2500,percent:72});
  assert.equal(L.Timeline.view('ep2').time,1800,'The later Android checkpoint still reaches Lampa after the native callback is consumed');
  assert.equal(f.L.Storage.get(L.Timeline.filename(),{}).ep2.episode,2);
  assert.equal(viewed.length,1,'Saving Timeline does not depend on TorrServer TrackTimecode');
  L.Storage.set('torrserver_tracktimecode',true);
  L.Torserver.parse=({path})=>({hash:path});
  const params={movie:card,viewed:[{file_index:11,timecode:1250},{file_index:7,timecode:600}]};
  L.Listener.send('torrent_file',{type:'list_open',params,items:[{id:11,path:'ep2'},{id:7,path:'ep1'}]});
  assert.deepEqual(params.viewed.map(row=>row.file_index),[7],'An older TorrServer copy must not rewind the current device position');
  assert.equal(L.Timeline.view('ep1').time,0);
  L.Android.timeCall({hash:'ep2',time:0,duration:0,percent:100});
  assert.equal(L.Timeline.view('ep2').percent,100);
  assert.deepEqual(viewed.at(-1),[hash,11,2500],'Legacy Android completion with zero time uses the measured duration');
  L.Timeline.update({hash:'ep3',time:0,duration:0,percent:100});
  assert.equal(L.Timeline.view('ep3').percent,100);
  assert.deepEqual(viewed.at(-1),[hash,13,2103],'Just+ and newer Android hosts write completion directly to Timeline.update');
  assert.equal(L.Storage.get(L.Timeline.filename(),{}).ep3.episode,3);
  const writes=viewed.length;
  L.Timeline.update({hash:'ep4',time:0,duration:0,percent:100});
  assert.equal(L.Timeline.view('ep4').percent,100);
  assert.equal(L.Timeline.view('ep4').time,0);
  assert.equal(viewed.length,writes,'Without any duration, keep the completion mark and avoid fabricating a TorrServer time');
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});

test('a saved fifth episode from TorrServer appears in title history when the PC opens the file list',async()=>{
 const native=require('./fixtures/native-lampa.cjs');
 const f=await native({prepare(w,L){
  L.Storage.set('torrserver_tracktimecode',true);
  L.Torserver.url=()=> 'http://server:8090';
  L.Torserver.parse=({path})=>({hash:path});
 }});
 try{
  const {L,w}=f,hash='b'.repeat(40),card={id:54,name:'Series',original_name:'Series',source:'tmdb',media_type:'tv'};
  L.Timeline.update({hash:L.Utils.hash('12Series'),percent:59,time:1425,duration:2400,updated:10,received:true});
  assert.equal(w.LampaView.online.lastWatched(card).episode,2);
  const params={movie:card,viewed:[{file_index:7,timecode:2400},{file_index:8,timecode:0}]};
  const items=[{id:7,path:'opaque-fifth'},{id:8,path:'opaque-sixth'}];
  L.Listener.send('torrent_file',{type:'list_open',params,items});
  // The native file list loads the position before emitting the render event.
  L.Timeline.update({hash:'opaque-fifth',percent:100,time:2400,duration:2400,updated:20,received:true});
  items.forEach(({id,path},index)=>L.Listener.send('torrent_file',{type:'render',params,items,element:{
   card,season:1,episode:index+5,torrent_hash:hash,timeline:L.Timeline.view(path),
   url:'http://server:8090/stream?link='+hash+'&index='+id+'&play'
  }}));
  const latest=w.LampaView.online.lastWatched(card);
  assert.equal(latest.episode,5);assert.equal(latest.percent,100);assert.equal(latest.updated,20);
  const records=L.Storage.get(L.Timeline.filename(),{});
  assert.equal(records['opaque-fifth'].torrentHash,hash);
  assert.equal(records['opaque-sixth'],undefined,'A zero-position server mark does not count as a playback');
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(L.Storage.get('minimal_torrserver_progress_v1',[]).length,2,'Files can be refreshed without starting playback on the PC');
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
