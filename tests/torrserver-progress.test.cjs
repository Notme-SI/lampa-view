const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
test('server checkpoints survive restart, map next episode and reject stale/profile responses',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;
 try{const state={},events={},records={},requests=[];let scope='p1';
 const L={Storage:{get:(k,v)=>state[k]??v,set:(k,v)=>state[k]=v,field:()=>true},Torserver:{url:()=> 'http://server:8090'},Timeline:{filename:()=>scope,view:h=>records[h]||{},update:r=>records[r.hash]=r},Player:{listener:{follow:(n,f)=>events[n]=f}},Reguest:function(){this.timeout=()=>{};this.clear=()=>{};this.silent=(url,ok,fail,body)=>requests.push({url,ok,body});}};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/torrserver-progress.js')],bundle:true,write:false,format:'iife',globalName:'Mod'}).outputFiles[0].text);
 let api=w.Mod.default(L,()=>true);const make=n=>({torrent_hash:'abc',url:'http://server:8090/stream?link=abc&index='+n,card:{id:1,name:'Series',source:'tmdb'},season:1,episode:n,timeline:{hash:'ep'+n,duration:3000}});
 events.create({data:{...make(7),playlist:[make(7),make(8)]}});api.stop();api=w.Mod.default(L,()=>true);api.refresh();assert.equal(requests.length,1);assert.equal(JSON.parse(requests[0].body).hash,'abc');requests[0].ok([{file_index:8,timecode:1500},{file_index:7,timecode:2900}]);assert.equal(records.ep8.episode,8);assert.equal(records.ep8.time,1500);assert.equal(records.ep8.percent,50);api.stop();
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
  const first=file(7,1),second=file(11,2);
  L.Android.openPlayer(first.url,{...first,playlist:[first,second]});
  assert.equal(sent.length,1);assert.equal(viewed.length,0,'Opening a torrent never creates playback progress');
  L.Android.timeCall({hash:'unrelated',time:120,duration:3000,percent:4});
  assert.equal(viewed.length,0);
  L.Android.timeCall({hash:'ep2',time:1250,duration:2500,percent:50});
  assert.equal(L.Timeline.view('ep2').time,1250);
  assert.deepEqual(viewed,[[hash,11,1250]]);
  assert.equal(L.Timeline.view('ep1').time,0);
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
