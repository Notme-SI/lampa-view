const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const native=require('./fixtures/native-lampa.cjs'),C=require('../vendor/torrent-catalogue.js'),identity=require('../src/identity.cjs');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/torrent-episodes.js')],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text;
const moduleObject={exports:{}};new Function('module','exports',code)(moduleObject,moduleObject.exports);const install=moduleObject.exports.default;
const movie={id:85937,name:'Истребитель демонов',original_name:'鬼滅の刃',original_title:'鬼滅の刃',first_air_date:'2019-04-06',number_of_seasons:5,source:'tmdb',seasons:[{season_number:1,episode_count:26,air_date:'2019-04-06'},{season_number:2,episode_count:7,air_date:'2021-10-10'},{season_number:3,episode_count:11,air_date:'2021-12-05'}]};
function release(){return {Title:'Истребитель демонов (ТВ-2) / Kimetsu no Yaiba: Yuukaku Hen [TV] [11 из 11] [2021, WEBRip]',Tracker:'rutracker',Size:16920000000,Seeders:45,Peers:10,PublishDate:'2022-12-24T00:00:00Z',MagnetUri:'magnet:?xt=urn:btih:0123456789012345678901234567890123456789',info:{}};}
test('release TMDB season replaces only an inferred season; explicit other seasons and bundles survive',()=>{
 const L={Torrent:{start(){},open(){}},Torserver:{parse(){return {serial:true,season:1,episode:2,hash:'old'};}},Activity:{active:()=>({movie})},Utils:{hash:v=>'hash:'+v},Listener:{follow(){}}};
 install(L,{TorrentCatalogueCore:C});L.Torrent.start(release(),movie);
 let info=L.Torserver.parse({movie,path:'Demon Slayer Entertainment District Arc/02.mkv'});
 assert.equal(info.season,3);assert.equal(info.episode,2);assert.equal(info.hash,'hash:32鬼滅の刃');
 assert.equal(L.Torserver.parse({movie,path:'Anime.S01E02.mkv'}).season,1,'Explicit conflicting file season must not be silently relabelled');
 assert.equal(L.Torserver.parse({movie,path:'Anime.S02E02.mkv'}).season,3,'Verified release numbering can be translated to the catalogue');
 assert.equal(L.Torserver.parse({movie:{...movie,id:12},path:'02.mkv'}).season,1,'A different card cannot inherit the selected release');
 L.Torrent.open('other',movie);assert.equal(L.Torserver.parse({movie,path:'02.mkv'}).season,1,'Opening another torrent clears context');
 L.Torrent.start({Title:'Истребитель демонов / 鬼滅の刃 S01-S03'},movie);assert.equal(L.Torserver.parse({movie,path:'02.mkv'}).season,1,'A bundle must not stamp one season on all files');
});
test('native Lampa uses the mapped season for episode artwork, playback coordinates and bridge identity',async()=>{
 const n=await native({built:true}),{L,w}=n;try{
  const row=release();L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[row]}),0);
  L.Activity.push({component:'torrents',movie,search:movie.original_name,url:''});await new Promise(r=>setTimeout(r,200));
  L.Torserver.url=()=>true;L.Torserver.connected=ok=>ok();L.Torserver.hash=(p,ok)=>ok({hash:'0123456789012345678901234567890123456789'});
  L.Torserver.files=(hash,ok)=>ok({file_stats:[{id:1,path:'Demon Slayer - Kimetsu no Yaiba Entertainment District Arc/01.mkv',length:1000},{id:2,path:'Demon Slayer - Kimetsu no Yaiba Entertainment District Arc/02.mkv',length:1000}]});
  L.Torserver.viewed=(hash,ok)=>ok([]);L.Torserver.stream=(file,hash,id)=>'http://localhost/stream?link='+hash+'&index='+id+'&play';
  let requested,played;L.Api.seasons=(card,seasons,ok)=>{requested=Array.from(seasons);ok({3:{episodes:[{season_number:3,episode_number:1,name:'Третья арка, начало',still_path:'/arc3-1.jpg'},{season_number:3,episode_number:2,name:'Третья арка, серия 2',still_path:'/arc3-2.jpg'}]}});};
  L.Player.play=data=>{played=data;};L.Player.playlist=()=>{};L.Player.callback=()=>{};
  L.Torrent.start(row,movie);await new Promise(r=>setTimeout(r,2250));
  assert.deepEqual(requested,[3]);const files=[...w.document.querySelectorAll('.torrent-files .selector')];
  const second=files.find(el=>el.textContent.includes('Третья арка, серия 2'));assert.ok(second,'Episode label must be loaded from season 3');
  assert.ok(!w.document.querySelector('.torrent-files').textContent.includes('Сезон - 1'));
  second.dispatchEvent(new w.CustomEvent('hover:enter',{bubbles:true}));assert.equal(played.season,3);assert.equal(played.episode,2);assert.ok(played.img.includes('/arc3-2.jpg'));
  const ctx=identity.context(movie,played);assert.equal(ctx.entries[0].identity.season,3);assert.equal(ctx.entries[0].identity.episode,2);
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
