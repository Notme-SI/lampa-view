const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
const {progressChannel}=require('../src/mpv-progress.cjs');
function bundle(name){return esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'iife',globalName:'TestModule'}).outputFiles[0].text;}
function events(){const hooks={};return {follow(name,fn){(hooks[name] ||= []).push(fn);},send(name,event){for(const fn of hooks[name] || [])fn(event);}};}

test('TV playback saves measured episode progress before close and keeps profile/card coordinates',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
 try{
  let clock=100,profile=7,playing;w.Date.now=()=>clock;
  const records={},card={id:95403,name:'Периферийные устройства',original_name:'The Peripheral',source:'tmdb',media_type:'tv'};
  const L={Activity:{active:()=>({card})},Storage:{get:(file,def)=>records[file] || def},Player:{listener:events(),playdata:()=>playing,playlist(){}},PlayerVideo:{listener:events()},Timeline:{filename:()=> 'file_view_'+profile,update(value){const rows=records[this.filename()] ||= {};rows[value.hash]={...value,updated:clock};}},Utils:{hash:v=>v}};
  w.eval(bundle('playback-progress'));const api=w.TestModule.default(L,()=>true);
  const timeline={hash:'provider-file-6',profile:7,handler(percent,time,duration){const rows=records[L.Timeline.filename()] ||= {};rows[this.hash]={percent,time,duration,updated:clock};}};
  const video={url:'http://example/6',season:1,episode:6,timeline};
  L.Player.listener.send('create',{data:video});assert.deepEqual(records,{},'Opening a file must not mark it watched');
  playing=video;timeline.time=120;L.Player.listener.send('start',video);L.PlayerVideo.listener.send('timeupdate',{current:0.2,duration:2400});
  assert.deepEqual(records,{},'The first frame must not overwrite a pending resume seek');
  L.PlayerVideo.listener.send('timeupdate',{current:120,duration:2400});
  assert.equal(records.file_view_7['provider-file-6'].card,'tv_95403');assert.equal(records.file_view_7['provider-file-6'].episode,6);assert.equal(records.file_view_7['provider-file-6'].percent,5);
  clock+=100;L.PlayerVideo.listener.send('timeupdate',{current:121,duration:2400});assert.equal(records.file_view_7['provider-file-6'].time,120,'Checkpoints are throttled');
  clock+=10000;L.PlayerVideo.listener.send('timeupdate',{current:240,duration:2400});assert.equal(records.file_view_7['provider-file-6'].time,240);
  w.eval(bundle('online-state'));const online=w.TestModule.default(L);assert.equal(online.lastWatched(card).episode,6,'An opaque provider hash is read through its stable card link');
  profile=8;clock+=20000;L.PlayerVideo.listener.send('timeupdate',{current:270,duration:2400});api.stop();assert.equal(records.file_view_8,undefined,'A profile switch cannot receive the old playback');
 }finally{w.close();}
});

test('mpv reports persist exact files, handle split streams and flush on exit without cross-profile writes',()=>{
 let profile=7;const writes=[],handlers={stdout:{},stderr:{},process:{}};
 const timeline=hash=>({hash,handler:(percent,time,duration)=>writes.push({hash,percent,time,duration})});
 const first={url:'http://example/episode-6',timeline:timeline('six')},second={url:'http://example/episode-7',timeline:timeline('seven')};
 const L={Timeline:{filename:()=> 'file_view_'+profile}},channel=progressChannel(L,{TextDecoder},[first,second],()=>true);
 channel.attach({on:(event,fn)=>handlers.process[event]=fn,stdout:{on:(event,fn)=>handlers.stdout[event]=fn},stderr:{on:(event,fn)=>handlers.stderr[event]=fn}});
 const marker=channel.args.find(arg=>arg.startsWith('--term-status-msg=')).split('=')[1].split('${')[0];
 handlers.stdout.data(marker+'120|2400|http://example/unknown\n');assert.equal(writes.length,0);
 handlers.stdout.data(Buffer.from(marker+'12'));handlers.stdout.data(Buffer.from('0|2400|http://example/episode-6\r'));
 assert.deepEqual(writes[0],{hash:'six',percent:5,time:120,duration:2400});
 handlers.stderr.data(marker+'180|2400|http://example/episode-6\n');
 handlers.stdout.data(marker+'60|1200|http://example/episode-7\n');assert.ok(writes.some(row=>row.hash==='six' && row.time===180));
 handlers.stderr.data(marker+'900|1200|http://example/episode-7');handlers.process.exit();handlers.process.close();
 assert.deepEqual(writes.at(-1),{hash:'seven',percent:75,time:900,duration:1200});
 const other=progressChannel(L,{TextDecoder},[first],()=>true),callbacks={};other.attach({stdout:{on:(event,fn)=>callbacks[event]=fn}});
 profile=8;const otherMarker=other.args.find(arg=>arg.startsWith('--term-status-msg=')).split('=')[1].split('${')[0],before=writes.length;
 callbacks.data(otherMarker+'500|2400|http://example/episode-6\n');other.finish();assert.equal(writes.length,before);
});
