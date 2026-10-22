const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const native=require('./fixtures/native-lampa.cjs'),source=fs.readFileSync(require.resolve('../plugins/mpvplus-ios.js'),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(const touches of [0,5])test('desktop-style iPad user agent '+(touches?'enables':'does not enable')+' the iOS bridge with '+touches+' touch points',()=>{
 let registrations=0;
 const Lampa={Player:{play(){},playlist(){}},Params:{values:{player:{inner:'Inner'},player_torrent:{inner:'Inner'}},defaults:{},select(k,v){this.values[k]=v;registrations++;}},Storage:{get:(k,d)=>k==='mpvplus_ios_torrent_revision'?1:d,field:()=> 'inner'},Select:{show(){}},Listener:{follow(){}}};
 const context={Lampa,navigator:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',maxTouchPoints:touches},URL,Blob,appready:true};context.window=context;vm.runInNewContext(source,context);
 assert.equal(registrations,touches?2:0);
});
for(const device of ['Windows','Android TV'])test('iOS bridge leaves '+device+' player methods and selection intact',()=>{
 const storage={player:device==='Windows'?'other':'android',player_torrent:device==='Windows'?'other':'android'};
 const originalPlay=()=>{},originalStream=()=>'/stream?link=x&index=1&preload';let registrations=0,listeners=0;
 const Lampa={Player:{play:originalPlay,playlist(){}},Torserver:{stream:originalStream},Params:{values:{player:{inner:'Inner'},player_torrent:{inner:'Inner'}},defaults:{},select(){registrations++;}},Storage:{get:(k,d)=>storage[k]??d,field:k=>storage[k],set:assert.fail},Select:{show:assert.fail},Listener:{follow(){listeners++;}}};
 const context={Lampa,navigator:{userAgent:device==='Windows'?'Mozilla/5.0 (Windows NT 10.0; Win64; x64)':'Mozilla/5.0 (Linux; Android 12; Android TV)'},URL,Blob,appready:true};context.window=context;
 vm.runInNewContext(source,context);
 assert.equal(Lampa.Player.play,originalPlay);assert.equal(Lampa.Torserver.stream,originalStream);assert.equal(registrations,0);assert.equal(listeners,0);assert.equal(context.MPVPlusLampa,undefined);
});
for(const device of ['Windows','Android TV'])test('native '+device+' torrent file reaches the external transport with the iOS plugin installed',async()=>{
 const calls=[];
 const n=await native({built:true,prepare(w,L){
  const is=L.Platform.is;
  L.Platform.is=name=>name==='android'?device==='Android TV':name==='apple'?false:is(name);
  L.Platform.desktop=()=>device==='Windows';
  if(device==='Windows')w.require=name=>name==='fs'?{existsSync:()=>true}:name==='child_process'?{spawn:(path,args)=>{calls.push({path,args});return {on(){}};}}:{};
 }}),{L,w}=n;
 try{
  const movie={id:99,name:'MobLand',original_name:'MobLand',original_title:'MobLand',first_air_date:'2025-01-01',number_of_seasons:1,seasons:[{season_number:1,episode_count:2}],genres:[]};
  L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[]}),0);L.Activity.push({component:'torrents',movie,search:'MobLand',url:'',page:1});await wait(200);
  L.Storage.set('player_torrent',device==='Windows'?'other':'android');L.Storage.set('player_nw_path','C:\\Player\\mpv.exe');L.Storage.set('internal_torrclient',true);
  L.Android.openPlayer=(url,data)=>calls.push({url,index:data.episode});
  const context={Lampa:L,navigator:{userAgent:device==='Windows'?'Mozilla/5.0 (Windows NT 10.0; Win64; x64)':'Mozilla/5.0 (Linux; Android 12; Android TV)'},URL,Blob,appready:true};context.window=context;vm.runInNewContext(source,context);
  L.Torserver.url=()=>true;L.Torserver.connected=ok=>ok();L.Torserver.hash=(p,ok)=>ok({hash:'a'.repeat(40)});L.Torserver.files=(hash,ok)=>ok({file_stats:[1,7].map((id,i)=>({id,path:'MobLand/MobLand.S01E0'+(i+1)+'.mkv',length:1e9}))});L.Torserver.viewed=(hash,ok)=>ok([]);
  L.Torserver.stream=(path,hash,id)=>'http://server.test/stream?link='+hash+'&index='+id+'&play';
  L.Api.seasons=(card,seasons,ok)=>ok({1:{episodes:[1,2].map(episode_number=>({season_number:1,episode_number,name:'Episode '+episode_number}))}});
  L.Torrent.start({Title:'MobLand S01',MagnetUri:'magnet:?xt=urn:btih:'+'a'.repeat(40)},movie);await wait(2200);
  const files=w.document.querySelectorAll('.torrent-serial');assert.equal(files.length,2);w.jQuery(files[1]).trigger('hover:enter');await wait(100);
  assert.equal(calls.length,1,'native Player.play reaches the OS transport');
  if(device==='Windows'){assert.equal(calls[0].path,'C:\\Player\\mpv.exe');assert.match(calls[0].args.at(-1),/index=7&play/);}
  else {assert.equal(calls[0].index,2);assert.match(calls[0].url,/index=7&play/);}
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
