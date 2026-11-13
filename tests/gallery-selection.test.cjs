const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm'),esbuild=require('esbuild');
const {stableSample,sampleFrames,frameLimit}=require('../src/frame-catalogue.cjs');

test('a card has a stable fifteen-frame sample from the whole gallery, independent of source order',()=>{
 const rows=Array.from({length:120},(_,i)=>({url:'https://frames.example/scene-'+i+'.jpg'}));
 const first=sampleFrames(rows,'movie:91');
 assert.equal(frameLimit,15);assert.equal(first.length,15);assert.equal(new Set(first.map(r=>r.url)).size,15);
 assert.deepEqual(sampleFrames(rows.slice().reverse(),'movie:91'),first);
 assert.notDeepEqual(sampleFrames(rows,'movie:92'),first);
 assert.ok(first.some(row=>Number(row.url.match(/scene-(\d+)/)[1])>90),'The end of a large gallery participates');
 assert.notDeepEqual(first,rows.slice(0,15));
 assert.deepEqual(sampleFrames([{url:'javascript:bad'},{url:rows[0].url},{url:rows[0].url}],'movie:91'),[{img:rows[0].url,url:rows[0].url}]);
 assert.deepEqual(stableSample([], 'empty'),[]);
});

function runtime(readCatalogue=async()=>({ok:true,json:async()=>({version:1,entries:{},records:{}})})){
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/gallery-frames.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
 const context={module:{exports:{}},exports:{},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,
  fetch:readCatalogue};
 vm.createContext(context);vm.runInContext(code,context);return context.module.exports;
}

test('gallery deduplicates alternate sizes and rejects portrait artwork with known dimensions',()=>{
 const {selectGalleryFrames}=runtime();
 const rows=selectGalleryFrames([
  {minimal_still_url:'https://frames.example/1920x1080/scene.jpg'},
  {minimal_still_url:'https://frames.example/1280x720/scene.jpg?version=1'},
  {minimal_still_url:'https://frames.example/portrait.jpg',width:800,height:1200},
  {still_path:'/another.jpg',width:1280,height:720}
 ],'movie:1423191');
 assert.equal(rows.length,2);
 assert.ok(rows.some(row=>row.still_path==='/another.jpg'));
 assert.ok(rows.every(row=>!row.minimal_still_url?.includes('portrait')));
});

test('the reported movie keeps its fourteen catalogue frames with an obsolete external key present',async()=>{
 const fs=require('node:fs'),requests=[];
 const {loadDetailGallery}=runtime(async url=>{
  requests.push(url);
  const name=new URL(url).pathname.split('/').at(-1);
  assert.match(url,/^https:\/\/notme-si\.github\.io\/lampa-view\/frames\/v1\/[\da-f]{2}\.json$/);
  return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/frames/v1',name),'utf8'))};
 });
 const movie={source:'cub',id:1423191,title:'Обитель зла',original_title:'Resident Evil',release_date:'2026-01-01'};
 const frames=await loadDetailGallery({Storage:{get:(key,fallback)=>key==='minimal_poiskkino_frames_key'?'obsolete-fixture-key':fallback}},{movie},()=>assert.fail('Movie stills do not need episode requests'));
 assert.equal(frames.length,14);
 assert.equal(new Set(frames.map(row=>row.minimal_still_url)).size,14);
 assert.ok(requests.length>0);
});

test('series prefer the latest aired season and diversify its episodes regardless of network order',async()=>{
 async function run(reverse){
  const {loadDetailGallery}=runtime(),requests=[],storage=new Map();
  const card={source:'tmdb',id:991,name:'Series',first_air_date:'2020-01-01',seasons:Array.from({length:4},(_,i)=>({season_number:i+1,episode_count:12,air_date:'2020-01-01'}))};
  card.seasons.push({season_number:5,episode_count:12,air_date:'2099-01-01'});
  const episodes=season=>Array.from({length:12},(_,i)=>({season_number:season,episode_number:i+1,air_date:i===11?'2099-01-01':'2020-01-01',still_path:'/s'+season+'e'+(i+1)+'-cover.jpg'}));
  const read=(route,done)=>{
   requests.push(route);
   const match=route.match(/^tv\/991\/season\/(\d+)(?:\/episode\/(\d+)\/images\?include_image_language=null)?$/);
   assert.ok(match,route);const season=Number(match[1]),episode=Number(match[2]);
   assert.notEqual(season,5);assert.notEqual(episode,12);
   if(!episode)return done({episodes:episodes(season)});
   const stills=Array.from({length:80},(_,i)=>({file_path:'/s'+season+'e'+episode+'-scene-'+i+'.jpg',width:1920}));
   stills.push({file_path:'/s'+season+'e'+episode+'-cover.jpg',width:1920},{file_path:'/banner.jpg',width:3840});
   setTimeout(()=>done({stills:reverse?stills.reverse():stills}),reverse?(episode%3)*4:((episode+1)%3)*4);
  };
  const L={Storage:{get:(key,fallback)=>storage.get(key) || fallback,set:(key,value)=>storage.set(key,value)}};
  const result=await loadDetailGallery(L,{movie:card,episodes:{episodes:episodes(4).slice(9,11)},images:{backdrops:[{file_path:'/banner.jpg'}]}},read);
  assert.equal(result.length,15);assert.equal(new Set(result.map(r=>r.still_path)).size,15);
  assert.ok(result.every(row=>!row.still_path.includes('cover') && row.still_path!=='/banner.jpg'));
  assert.ok(new Set(result.map(row=>row.minimal_frame_group)).size>=6,'An episode with many images cannot crowd out other sampled episodes');
  assert.ok(result.every(row=>row.minimal_frame_season===4));
  assert.ok(requests.every(route=>route.startsWith('tv/991/season/4')),requests.join(' '));
  assert.equal(requests.length,7,'One season book and a batch of six episode galleries');
  return JSON.parse(JSON.stringify(result));
 }
 assert.deepEqual(await run(false),await run(true));
});

test('a large single-source gallery cannot crowd all episode groups out of the final selection',()=>{
 const {selectGalleryFrames}=runtime();
 const rows=Array.from({length:100},(_,i)=>({minimal_still_url:'https://frames.example/'+i+'.jpg'}));
 for(let episode=1;episode<=6;episode++)for(let frame=1;frame<=30;frame++)rows.push({still_path:'/e'+episode+'-'+frame+'.jpg',minimal_frame_group:'episode:'+episode});
 const result=selectGalleryFrames(rows,'tv:991');
 assert.equal(result.length,15);
 assert.equal(new Set(result.map(row=>row.minimal_frame_group || 'gallery')).size,7);
 assert.deepEqual(JSON.parse(JSON.stringify(selectGalleryFrames(rows.reverse(),'tv:991'))),JSON.parse(JSON.stringify(result)));
});

test('a sparse latest season checks further episodes before supplementing from older seasons',async()=>{
 const {loadDetailGallery}=runtime(),calls=[];
 const seasons=[1,2,3].map(season_number=>({season_number,episode_count:10,air_date:'2020-01-01'}));
 const movie={id:991,source:'tmdb',name:'Series',first_air_date:'2020-01-01',seasons};
 const episodes=season=>Array.from({length:10},(_,i)=>({season_number:season,episode_number:i+1,air_date:i===9?'2099-01-01':'2020-01-01',still_path:'/s'+season+'e'+(i+1)+'-cover.jpg'}));
 const read=(route,done)=>{
  calls.push(route);
  const [,s,e]=route.match(/season\/(\d+)(?:\/episode\/(\d+))?/),season=Number(s),episode=Number(e);
  if(!e)return done({episodes:episodes(season)});
  assert.notEqual(episode,10);
  const preview={file_path:'/s'+s+'e'+e+'-cover.jpg',width:1280};
  const count=season===3?Number(episode%2===0):4;
  return done({stills:[preview,...Array.from({length:count},(_,i)=>({file_path:'/s'+s+'e'+e+'-scene'+i+'.jpg',width:1280}))]});
 };
 const rows=await loadDetailGallery({}, {movie},read);
 assert.equal(rows.length,15);
 assert.deepEqual(Array.from(rows,row=>row.minimal_frame_season),[...Array(4).fill(3),...Array(11).fill(2)]);
 assert.ok(rows.every(row=>!row.still_path.includes('cover')));
 const latest=calls.filter(path=>path.startsWith('tv/991/season/3/episode/'));
 assert.equal(latest.length,9);
 assert.equal(calls.indexOf('tv/991/season/2'),10);
 assert.ok(calls.every(path=>!path.startsWith('tv/991/season/1')));
});
