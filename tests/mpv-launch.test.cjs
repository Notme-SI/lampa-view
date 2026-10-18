const test=require('node:test'),assert=require('node:assert/strict');
const launch=require('../src/mpv-launch.cjs');
const card={id:1396,name:'Во все тяжкие',original_name:'Breaking Bad',source:'tmdb',first_air_date:'2008-01-20'};
function fixture(options={}){
 const calls=[],timers=[],listeners={},fallback=[],external=[];
 const root={setTimeout:fn=>timers.push(fn),encodeURIComponent,unescape,require:name=>{
   if(options.denied)throw Error('not available');
   return name==='fs'?{existsSync:()=>!options.missing}:{spawn:(...args)=>{if(options.spawnError)throw Error('not started');calls.push(args);return {on:(name,fn)=>{calls.at(-1).error=fn;}};}};
 }};
 const values={player:'other',player_torrent:'other',player_nw_path:'C:\\Players\\mpv.exe',...options.values};
 const L={Platform:{desktop:()=>!options.tv,is:name=>name==='android'&&!!options.tv},Storage:{field:name=>values[name]},
   Torserver:{toPlayUrl:url=>url.replace('&preload','&play')},Player:{getUrlQuality:()=>options.quality,
   playlist(){},play:video=>fallback.push(video),listener:{follow:(name,fn)=>listeners[name]=fn,send:(name,v)=>{if(name==='create')listeners[name]?.(v);else external.push(v);}}}};
 launch.install(L,root,options.cardProvider || (()=>card),()=>!options.disabled);
 function play(video){let aborted=false;L.Player.listener.send('create',{data:video,abort(){aborted=true;}});return aborted;}
 function tick(){while(timers.length)timers.shift()();}
 return {L,root,play,tick,calls,fallback,external};
}
function context(args){const opt=args[0];assert.match(opt,/^--script-opts-append=mpv_plus_lampa_context=[a-f0-9]+$/);return JSON.parse(Buffer.from(opt.split('=')[2],'hex').toString('utf8'));}
test('unmodified Desktop launch passes Unicode card data without an environment or changed stream URL',()=>{
 const f=fixture(),video={url:'http://server/stream?link=abc&index=2&preload',season:3,episode:2};
 assert.equal(f.play(video),true);assert.equal(f.calls.length,0);
 f.L.Player.playlist([video,{...video,url:'http://server/stream?link=abc&index=3&preload',episode:3}]);f.tick();
 assert.equal(f.calls.length,1);const [exe,args,opts]=f.calls[0];assert.equal(exe,'C:\\Players\\mpv.exe');assert.equal(opts,undefined);
 assert.equal(args[1],'http://server/stream?link=abc&index=2&play');
 const data=context(args);assert.equal(data.entries[0].identity.title,'Во все тяжкие');assert.equal(data.entries[0].identity.season,3);
 assert.equal(data.entries[1].identity.episode,3);assert.equal(f.external.length,1);
 assert.equal(video.url,'http://server/stream?link=abc&index=2&preload');
});
test('the chosen quality, rather than the old video URL, is scoped to its card',()=>{
 const f=fixture({quality:'https://host/high.mkv'});f.play({url:'https://host/low.mkv',quality:{low:'low',high:'high'},season:2,episode:4});f.tick();
 assert.equal(context(f.calls[0][1]).entries[0].url,'https://host/high.mkv');assert.equal(f.calls[0][1][1],'https://host/high.mkv');
});
test('TV, other players, inner mode, disabled transport and missing executables keep the native route',()=>{
 for(const options of [{tv:true},{disabled:true},{denied:true},{missing:true},{values:{player:'inner'}},{values:{player_nw_path:'C:\\vlc.exe'}}]){
   const f=fixture(options);assert.equal(f.play({url:'https://host/video.mkv'}),false);f.tick();assert.equal(f.calls.length,0);
 }
 const f=fixture();assert.equal(f.play({url:'https://host/video.mkv',launch_player:'inner'}),false);
});
test('spawn failure returns to native playback once; a superseded pending launch never starts',()=>{
 const failed=fixture({spawnError:true});failed.play({url:'https://host/a.mkv'});failed.tick();assert.equal(failed.fallback.length,1);
 const f=fixture();f.play({url:'https://host/old.mkv'});f.play({url:'https://host/new.mkv'});f.tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0][1][1],'https://host/new.mkv');
 f.calls[0].error();f.calls[0].error();assert.equal(f.fallback.length,1);
});
test('oversized optional metadata is dropped without blocking playback',()=>{
 assert.equal(launch.option({value:'x'.repeat(11001)},v=>v),'');
 const f=fixture();f.play({url:'https://host/'+'x'.repeat(15000)});f.tick();assert.equal(f.fallback.length,1);
});
test('another extension can cancel playback before the additional transport runs',()=>{
 const f=fixture();f.L.Player.listener.follow('create',event=>event.abort());
 assert.equal(f.play({url:'https://host/blocked.mkv'}),true);f.tick();assert.equal(f.calls.length,0);
});
test('navigating to another card before spawn cannot attach that card to the previous video',()=>{
 let active=card;const f=fixture({cardProvider:()=>active});f.play({url:'https://host/episode.mkv',season:3,episode:2});
 active={...card,id:99,name:'Another show'};f.tick();assert.equal(context(f.calls[0][1]).entries[0].identity.tmdb_id,1396);
});
