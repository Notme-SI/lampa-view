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

function runtime(){
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/gallery-frames.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
 const context={module:{exports:{}},exports:{},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,
  fetch:async()=>({ok:true,json:async()=>({version:1,entries:{},records:{}})})};
 vm.createContext(context);vm.runInContext(code,context);return context.module.exports;
}

test('series sample distinct aired episodes and seasons before filling the limit; network order cannot change the result',async()=>{
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
  assert.ok(new Set(result.map(row=>row.still_path.match(/^\/s(\d+)/)[1])).size>=3);
  assert.ok(requests.length<=12,'At most three season books and nine episode galleries');
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
