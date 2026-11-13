const test=require('node:test'),assert=require('node:assert/strict');
const launch=require('../src/mpv-launch.cjs');
const card={id:1396,name:'Во все тяжкие',original_name:'Breaking Bad',source:'tmdb',first_air_date:'2008-01-20'};
function fixture(options={}){
 const calls=[],timers=[],listeners={},fallback=[],external=[],notices=[];
 const root={setTimeout:fn=>timers.push(fn),encodeURIComponent,unescape,require:name=>{
   if(options.denied)throw Error('not available');
   if(name==='fs' && options.noSyncFs)throw Error('synchronous filesystem IPC must not delay launch');
   return name==='fs'?{existsSync:()=>!options.missing}:{spawn:(...args)=>{
     if(options.spawnError)throw Error('not started');
     calls.push(args);
     return {on:(name,fn)=>{
       const previous=args[name];
       args[name]=(...values)=>{previous?.(...values);fn(...values);};
     }};
   }};
 }};
 if(options.microtasks)root.queueMicrotask=queueMicrotask;
 const values={player:'other',player_torrent:'other',player_nw_path:'C:\\Players\\mpv.exe',...options.values};
 const L={Noty:{show:message=>notices.push(message)},Platform:{desktop:()=>!options.tv,is:name=>name==='android'&&!!options.tv},Storage:{field:name=>values[name]},
   Torserver:{toPlayUrl:url=>url.replace('&preload','&play')},Player:{getUrlQuality:()=>options.quality,
   playlist(){},play:video=>fallback.push(video),listener:{follow:(name,fn)=>listeners[name]=fn,send:(name,v)=>{if(name==='create')listeners[name]?.(v);else external.push(v);}}}};
 launch.install(L,root,options.cardProvider || (()=>card),()=>!options.disabled);
 function play(video){let aborted=false;L.Player.listener.send('create',{data:video,abort(){aborted=true;}});return aborted;}
 function tick(){while(timers.length)timers.shift()();}
 return {L,root,play,tick,calls,fallback,external,notices};
}
function context(args){const opt=args[0];assert.match(opt,/^--script-opts-append=mpv_plus_lampa_context=[a-f0-9]+$/);return JSON.parse(Buffer.from(opt.split('=')[2],'hex').toString('utf8'));}
test('unmodified Desktop launch passes Unicode card data without an environment or changed stream URL',()=>{
 const f=fixture(),video={url:'http://server/stream?link=abc&index=2&preload',torrent_hash:'abc',season:3,episode:2};
 assert.equal(f.play(video),true);assert.equal(f.calls.length,0);
 f.L.Player.playlist([video,{...video,url:'http://server/stream?link=abc&index=3&preload',episode:3}]);f.tick();
 assert.equal(f.calls.length,1);const [exe,args,opts]=f.calls[0];assert.equal(exe,'C:\\Players\\mpv.exe');assert.equal(opts,undefined);
 assert.equal(args.at(-1),'http://server/stream?link=abc&index=2&play');
 const data=context(args);assert.equal(data.entries[0].identity.title,'Во все тяжкие');assert.equal(data.entries[0].identity.season,3);
 assert.equal(data.entries[1].identity.episode,3);assert.equal(f.external.length,1);
 assert.equal(video.url,'http://server/stream?link=abc&index=2&preload');
});
test('the chosen quality, rather than the old video URL, is scoped to its card',()=>{
 const f=fixture({quality:'https://host/high.mkv'});f.play({url:'https://host/low.mkv',quality:{low:'low',high:'high'},season:2,episode:4});f.tick();
 assert.equal(context(f.calls[0][1]).entries[0].url,'https://host/high.mkv');assert.equal(f.calls[0][1].at(-1),'https://host/high.mkv');
});
test('TV, other players, inner mode, disabled transport and unavailable spawn keep the native route',()=>{
 for(const options of [{tv:true},{disabled:true},{denied:true},{values:{player:'inner'}},{values:{player_nw_path:'C:\\vlc.exe'}}]){
   const f=fixture(options);assert.equal(f.play({url:'https://host/video.mkv'}),false);f.tick();assert.equal(f.calls.length,0);
 }
 const f=fixture();assert.equal(f.play({url:'https://host/video.mkv',launch_player:'inner'}),false);
});

test('launch does not wait for filesystem IPC or timer tasks and retains the synchronously supplied playlist',async()=>{
 const f=fixture({noSyncFs:true,microtasks:true});
 const video={url:'https://host/episode-2.mkv',season:3,episode:2};
 assert.equal(f.play(video),true);assert.equal(f.calls.length,0);
 f.L.Player.playlist([video,{url:'https://host/episode-3.mkv',season:3,episode:3}]);
 await Promise.resolve();
 assert.equal(f.calls.length,1,'spawn must be reached before advancing any timer tasks');
 const data=context(f.calls[0][1]);assert.equal(data.entries.length,2);assert.equal(data.entries[1].identity.episode,3);
 assert.deepEqual(f.calls[0][1].slice(-2),[video.url,'https://host/episode-3.mkv']);
 f.tick();assert.equal(f.calls.length,1,'the old timer route must not duplicate the launch');
});
test('online resolver retains both directions, starts at the selection and ignores stale completion',()=>{
 const f=fixture();
 let resolved,done,cancelled=0;
 const episode=n=>({url:'https://host/episode-'+n+'.mkv',season:1,episode:n});
 const selected={...episode(2),playlist:[episode(1),episode(2),{...episode(3),url(){}}],
  minimalExternalPlaylist(callback){done=callback;return {list:()=>resolved,cancel(){cancelled++;}};}};
 f.play(selected);
 f.tick(); // The bounded timeout falls back to the available selected episode.
 assert.deepEqual(f.calls[0][1].filter(v=>v.startsWith('https://')),[episode(1).url,episode(2).url]);
 assert.ok(f.calls[0][1].includes('--playlist-start=1'));
 assert.equal(cancelled,1,'The deadline stops unused queued link requests');
 resolved=[episode(1),episode(2),episode(3),episode(4)];done();
 assert.equal(f.calls.length,1);
 f.calls[0].exit(0);
 f.play({...selected,minimalExternalPlaylist(callback){callback();return {list:()=>resolved};}});f.tick();
 const args=f.calls[1][1];
 assert.deepEqual(args.slice(-4),[episode(1).url,episode(2).url,episode(3).url,episode(4).url]);
 assert.ok(args.includes('--playlist-start=1'));
 assert.deepEqual(context(args).entries.map(item=>item.identity.episode),[2,1,3,4]);
});

test('a late selected episode keeps its nearest previous/next entries inside the Windows argument budget',()=>{
 for(const padding of [0,900]){
  const f=fixture(),items=Array.from({length:200},(_,i)=>({url:'https://host/episode-'+(i+1)+'.mkv'+(padding?'?token='+'x'.repeat(padding):''),season:1,episode:i+1}));
  f.play({...items[149],playlist:items});f.tick();const args=f.calls[0][1],urls=args.filter(s=>s.startsWith('https://'));
  const start=Number(args.find(s=>s.startsWith('--playlist-start=')).split('=')[1]);
  assert.equal(urls[start],items[149].url);assert.ok(urls.includes(items[148].url));assert.ok(urls.includes(items[150].url));
  assert.ok(urls.length<=40);assert.ok(urls.join(' ').length<12000);if(!padding)assert.equal(context(args).entries[0].identity.episode,150);
 }
});

test('a missing selected entry is inserted between known episodes without mutating native cells',()=>{
 const f=fixture(),items=[1,3].map(n=>({url:'https://host/'+n+'.mkv',season:'1',episode:String(n)})),before=JSON.stringify(items);
 f.play({url:'https://host/2.mkv',season:1,episode:2,playlist:[items[0],items[0],{url(){},season:1,episode:4},items[1]]});f.tick();
 const args=f.calls[0][1];assert.deepEqual(args.filter(s=>s.startsWith('https://')),['https://host/1.mkv','https://host/2.mkv','https://host/3.mkv']);assert.ok(args.includes('--playlist-start=1'));assert.equal(JSON.stringify(items),before);
});
test('long signed episode URLs retain the selected identity and every launched playlist identity',()=>{
 const f=fixture(),items=Array.from({length:9},(_,i)=>({url:'https://host/proxy/'+('x'.repeat(4700))+'episode-'+(i+1)+'.m3u8',season:3,episode:i+1,title:'Серия '+(i+1)}));
 f.play({...items[3],playlist:items});f.tick();
 const args=f.calls[0][1],urls=args.filter(v=>v.startsWith('https://'));
 const payload=context(args),start=Number(args.find(s=>s.startsWith('--playlist-start='))?.split('=')[1] || 0);
 assert.equal(urls[start],items[3].url);
 assert.equal(payload.entries[0].identity.episode,4);
 assert.ok(args.join(' ').length+f.calls[0][0].length<28000);
 assert.equal(payload.entries.length,urls.length);
 for(const url of urls)assert.equal(payload.entries.find(row=>row.url===url).identity.episode,items.find(row=>row.url===url).episode);
 assert.ok(urls.length<items.length,'Bound the playlist to preserve per-file coordinates');
});
test('spawn failure returns to native playback once; a superseded pending launch never starts',()=>{
 const failed=fixture({spawnError:true});failed.play({url:'https://host/a.mkv'});failed.tick();assert.equal(failed.fallback.length,1);
 const f=fixture();f.play({url:'https://host/old.mkv'});f.play({url:'https://host/new.mkv'});f.tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].at(-1),'https://host/new.mkv');
 f.calls[0].error();f.calls[0].error();assert.equal(f.fallback.length,1);
});
test('repeat clicks show feedback without opening a second process and allow retry after exit',()=>{
 const f=fixture(),video={url:'https://host/movie.m3u8'};
 assert.equal(f.play(video),true);
 assert.deepEqual(f.notices,['Открываем в mpv+…']);
 assert.equal(f.play(video),true);f.tick();
 assert.equal(f.calls.length,1);
 assert.ok(f.calls[0][1].includes('--force-window=immediate'));
 assert.equal(f.play(video),true);f.tick();
 assert.equal(f.calls.length,1);
 assert.equal(f.notices.at(-1),'Видео уже открывается или играет в mpv+');
 f.calls[0].exit(2);
 assert.equal(f.notices.at(-1),'Не удалось открыть видео в mpv+');
 f.play(video);f.tick();assert.equal(f.calls.length,2);
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
