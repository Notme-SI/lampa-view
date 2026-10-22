const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),native=require('./fixtures/native-lampa.cjs');
const source=fs.readFileSync(require.resolve('../plugins/mpvplus-ios.js'),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(const [replacePlayer,direct] of [[false,false],[true,false],[false,true]])test('native torrent selection and long-press transfer'+(direct?' without waiting for preload':replacePlayer?' after another adapter replaces Player.play':' after existing preload'),async()=>{
 const n=await native({built:true}),{L,w}=n;try{
  const movie={id:99,name:'Гангстерленд',original_name:'MobLand',original_title:'MobLand',first_air_date:'2025-01-01',number_of_seasons:1,seasons:[{season_number:1,episode_count:3}],source:'tmdb',genres:[]};
  const release={Title:'Гангстерленд / MobLand (2025) S01 WEB-DL 1080p',Tracker:'test',Size:1e9,Seeders:3,MagnetUri:'magnet:?xt=urn:btih:'+ 'a'.repeat(40)};
  L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[release]}),0);L.Activity.push({component:'torrents',movie,search:'MobLand',url:'',page:1});await wait(200);
  L.Storage.set('player','mpvplus');L.Storage.set('player_torrent','inner');let launched='',calls=0,notices=[];
  L.Player.play=()=>calls++;L.Player.playlist=()=>calls++;L.Player.callback=()=>{};L.Noty.show=value=>notices.push(value);
  const stream=(file,hash,id)=>'/ts/stream/'+file.split('/').pop()+'?link='+hash+'&index='+id+'&preload';
  if(direct)L.Torserver.stream=stream;
  const context={Lampa:L,appready:true,URL,Blob,document:w.document,navigator:{standalone:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)'},setTimeout:w.setTimeout.bind(w),btoa:value=>Buffer.from(value,'binary').toString('base64'),location:{href:'https://lampac.test/',assign:url=>launched=url},alert:assert.fail};context.window=context;vm.runInNewContext(source,context);
  if(replacePlayer)L.Player.play=()=>calls++;
  assert.equal(L.Storage.field('player_torrent'),'mpvplus');assert.equal(L.Params.values.player.mpvplus,'mpv+');assert.equal(L.Params.values.player_torrent.mpvplus,'mpv+');assert.deepEqual(notices,[]);
  L.Storage.set('player_torrent','vlc');L.Storage.set('player','inner');L.Storage.set('player','mpvplus');assert.equal(L.Storage.field('player_torrent'),'mpvplus','choosing mpv+ also activates its torrent player');
  L.Torserver.url=()=>true;L.Torserver.connected=ok=>ok();L.Torserver.hash=(p,ok)=>ok({hash:'a'.repeat(40)});L.Torserver.files=(hash,ok)=>ok({file_stats:[1,2,3].map(id=>({id,path:'MobLand/MobLand.S01E0'+id+'.mkv',length:1e9}))});L.Torserver.viewed=(hash,ok)=>ok([]);
  if(!direct)L.Torserver.stream=stream; // Simulate an older host adapter replacing stream after installation.
  L.Torserver.ip=()=>'/ts';let preloads=0;
  const network=w.testNetwork;w.testNetwork=(url,ok,error)=>/\/ts\/stream\//.test(url)?w.setTimeout(()=>{preloads++;ok({preloaded_bytes:preloads===1?20:100,preload_size:100});},10):network(url,ok,error);
  L.Torserver.toPlayUrl=value=>value.replace('&preload','&play');L.Api.seasons=(card,seasons,ok)=>ok({1:{episodes:[1,2,3].map(episode_number=>({episode_number,name:'Серия '+episode_number,season_number:1}))}});
  L.Torrent.start(release,movie);await wait(2200);
  const files=[...w.document.querySelectorAll('.torrent-files .torrent-serial')];assert.equal(files.length,3);
  L.Torrent.opened(()=>{L.Modal.close();L.Controller.toggle('content');});
  w.jQuery(files[1]).trigger('hover:enter');await wait(100);
  if(direct)assert.equal(preloads,0,'external player does not depend on the native preload endpoint');
  else {assert.equal(w.document.querySelector('.selectbox-item'),null,'no chooser before preloading finishes');assert.equal(preloads,1);await wait(1100);assert.equal(preloads,2,'real preload polling completed');}
  let choice=[...w.document.querySelectorAll('.selectbox-item')].find(node=>node.textContent.includes('Открыть в mpv+'));assert.ok(choice,'torrent reaches the bridge chooser');w.jQuery(choice).trigger('hover:enter');
  const decode=()=>JSON.parse(Buffer.from(new URL(launched).searchParams.get('data'),'base64url').toString('utf8'));let doc=decode();assert.equal(doc.items.length,3);assert.equal(doc.selected,1);assert.equal(doc.items[1].episode,2);assert.match(doc.items[1].url,/^https:\/\/lampac\.test\/ts\/stream\/.*index=2&play$/);assert.equal(calls,replacePlayer?2:0);
  // Re-open because the real torrent activity closes its file dialog on playback.
  L.Torrent.start(release,movie);await wait(2200);const reopened=[...w.document.querySelectorAll('.torrent-files .torrent-serial')];
  launched='';w.jQuery(reopened[2]).trigger('hover:long');choice=[...w.document.querySelectorAll('.selectbox-item')].find(node=>node.textContent.includes('Передать весь список в mpv+'));assert.ok(choice);w.jQuery(choice).trigger('hover:enter');doc=decode();assert.equal(doc.items.length,3);assert.equal(doc.selected,2);assert.equal(doc.items[2].episode,3);assert.deepEqual(notices,[]);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
