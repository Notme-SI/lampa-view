const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const esbuild=require('esbuild');
const {version,frameLimit,titleKeys,shardFor,validFrames}=require('../src/frame-catalogue.cjs');
const {normalize}=require('../tools/update-frame-catalogue.cjs');
const {parseFilmGrab}=require('../tools/frame-catalogue-sources.cjs');

const base=path.join(__dirname,'../docs/frames/v1');
const frame={img:'https://frames.example/thumb.jpg',url:'https://frames.example/original.jpg'};

test('Kinoafisha accepts named series and teleshow galleries with their own shots',()=>{
 const {parseGallery,discover}=require('../tools/frame-source-kinoafisha.cjs');
 const origin='https://www.kinoafisha.info',path='/series/show-name/shots/';
 const base='https://static.kinoafisha.info/k/series_shots/1920x1080/upload/series/frames/8/4/2/';
 const anchor=url=>'<a class="stillsList_item" href="'+url+'"></a>';
 const html='<link rel="canonical" href="'+origin+path+'"><h1 class="universalHat_title">Кадры из телешоу «Шоу»</h1>'+
  '<meta property="og:image:alt" content="Кадр из телешоу «Шоу» (2025)">';
 const row=parseGallery(html+anchor(base+'8248/frame.jpg'),path);
 assert.equal(row.media,'tv');
 assert.equal(row.title,'Шоу');
 assert.equal(row.frames.length,1);
 assert.equal(parseGallery(html+anchor(base+'8248/frame.jpg')+anchor(base+'8249/frame.jpg'),path),null);
 assert.deepEqual(discover('<a href="/series/11487/music/"><a href="/movies/12/posters/">'),['/series/11487/shots/']);
});

test('Kinonews uses the gallery image and ignores unrelated or promotional images',()=>{
 const {parseGallery}=require('../tools/frame-source-kinonews.cjs');
 const img='/insimgs/2026/shotimg/thumbs/shotimg142405_6.webp';
 const html='<h1 class="new">Все кадры из фильма &quot;Надежда&quot; (2026)</h1>'+
  '<a href="/shot275976/"><img src="'+img+'"></a><img src="/insimgs/2026/poster/poster142791_1_p.webp">';
 const row=parseGallery(html,'/shots_369771_all/',1058424);
 assert.deepEqual([row.media,row.title,row.year,row.tmdb],['movie','Надежда',2026,1058424]);
 const original='https://www.kinonews.ru'+img.replace('/thumbs/','/');
 assert.deepEqual(row.frames,[{img:original,url:original}]);
 assert.equal(parseGallery(html,'/movie_369771/hopeu'),null);
});

test('a plugin update revalidates a fresh shard that missed the release before publication',async()=>{
 const key='tmdb:movie:91',record=normalize({media:'movie',tmdb:91,title:'Gallery Film',year:2025,source:'test',origin:'https://frames.example/',frames:[frame]});
 const initial={minimal_frame_catalogue_v1:{[shardFor(key)]:{at:Date.now(),data:{version,entries:{},records:{}}}}};
 const {read,L}=runtime(async(_url,options)=>{
  assert.equal(options.cache,'no-cache');
  return {ok:true,json:async()=>shard(record,key)};
 },initial);
 assert.equal((await read(L,{id:91,source:'tmdb'},'movie'))[0].minimal_still_url,frame.url);
});

test('Kinoafisha imports release-specific stills and rejects posters and other editions',()=>{
 const {parseGallery,discover}=require('../tools/frame-source-kinoafisha.cjs');
 const origin='https://www.kinoafisha.info',path='/series/8248/shots/';
 const base='https://static.kinoafisha.info/k/series_shots/1920x1080/upload/series/frames/8/4/2/';
 const anchor=url=>'<a class="stillsList_item" href="'+url+'"></a>';
 const html='<link rel="canonical" href="'+origin+path+'"><h1 class="universalHat_title">Кадры из сериала «Один &amp; два»</h1>'+
  '<meta property="og:image:alt" content="Кадр из сериала «Один &amp; два» (2023)">'+
  anchor(base+'8248/frame.jpg')+anchor(base+'8248/frame.jpg')+anchor(base+'8249/unrelated.jpg')+
  anchor(base.replace('series_shots','posters')+'8248/poster.jpg');
 const row=parseGallery(html,path);
 assert.equal(row.media,'tv');
 assert.equal(row.title,'Один & два');
 assert.equal(row.year,2023);
 assert.deepEqual(row.frames,[{img:base.replace('1920x1080','1280x720')+'8248/frame.jpg',url:base+'8248/frame.jpg'}]);
 assert.equal(parseGallery(html,'/series/8249/shots/'),null);
 assert.deepEqual(discover('<a href="/movies/10/"><a href="/movies/10/"><a href="/series/12/"><a href="/movies/12/posters/">'),
  ['/movies/10/shots/','/series/12/shots/']);
});

test('original and localized archive titles do not make a verified original ambiguous',async()=>{
 const original=normalize({media:'movie',title:'English Title',year:2025,source:'test',origin:'https://frames.example/',frames:[frame]});
 const localized=normalize({media:'movie',title:'Русское название',year:2025,source:'kinoafisha',origin:'https://frames.example/ru',frames:[{url:'https://frames.example/ru.jpg'}]});
 const data=new Map();
 for(const row of [original,localized])for(const key of row.keys){
  const name=shardFor(key),current=data.get(name) || {version,entries:{},records:{}};
  Object.assign(current.entries,shard(row,key).entries);current.records[row.id]=row;data.set(name,current);
 }
 const {read,L}=runtime(async url=>({ok:true,json:async()=>data.get(url.split('/').at(-1).split('.')[0])}));
 const rows=await read(L,{original_title:original.title,title:localized.title,release_date:'2025-01-01'},'movie');
 assert.deepEqual(Array.from(rows,row=>row.minimal_still_url),[frame.url]);
});

function runtime(fetch,initial={}){
 const storage=new Map(Object.entries(initial));
 const context={module:{exports:{}},exports:{},fetch,URL,AbortController,setTimeout,clearTimeout};
 vm.createContext(context);
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/frame-catalogue-client.js')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
 vm.runInContext(code,context);
 return {read:context.module.exports.default,L:{Storage:{get:(key,fallback)=>storage.get(key) || fallback,set:(key,value)=>storage.set(key,value)}},storage};
}

function shard(record,key){
 return {version,entries:{[key]:[record.id]},records:{[record.id]:record}};
}

test('published shards validate every frame and preserve media and release identities',()=>{
 const identities=new Set();
 for(const name of fs.readdirSync(base).filter(name=>/^[0-3][0-9a-f]\.json$/.test(name))){
  const data=JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
  assert.equal(data.version,version);
  for(const [key,ids] of Object.entries(data.entries)){
   assert.equal(shardFor(key)+'.json',name);
   for(const id of ids){
    const row=data.records[id];
    assert.equal(normalize(row).id,id);
    assert.ok(row.keys.includes(key));
    assert.ok(row.frames.length>0 && row.frames.length<=frameLimit);
    assert.deepEqual(validFrames(row.frames),row.frames);
    identities.add(id);
   }
  }
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
 assert.equal(identities.size,manifest.records);
 assert.ok(identities.size>=400);
 assert.notEqual(shardFor('tmdb:movie:273552'),undefined);
 assert.notDeepEqual(titleKeys('movie','Dune',1984),titleKeys('movie','Dune',2021));
 assert.notDeepEqual(titleKeys('movie','Dune',2021),titleKeys('tv','Dune',2021));
});

test('catalogue uses the exact ID first and shares concurrent requests',async()=>{
 const key='tmdb:movie:91',record=normalize({media:'movie',tmdb:91,title:'Gallery Film',year:2025,source:'test',origin:'https://frames.example/',frames:[frame]});
 let calls=0;
 const {read,L}=runtime(async url=>{
  calls++;
  await new Promise(resolve=>setTimeout(resolve,5));
  return {ok:true,json:async()=>url.includes('/'+shardFor(key)+'.json')?shard(record,key):{version,entries:{},records:{}}};
 });
 const card={id:91,source:'tmdb',media_type:'movie'};
 const results=await Promise.all([read(L,card,'movie'),read(L,card,'movie')]);
 assert.equal(results[0][0].minimal_still_url,frame.url);
 assert.equal(calls,1);
 await read(L,card,'movie');
 assert.equal(calls,1);
 assert.ok(results.every(rows=>rows.length===1));
});

test('a catalogue network failure reuses saved data and delays retries',async()=>{
 const key='tmdb:movie:91',record=normalize({media:'movie',tmdb:91,title:'Gallery Film',year:2025,source:'test',origin:'https://frames.example/',frames:[frame]});
 const initial={minimal_frame_catalogue_v1:{[shardFor(key)]:{at:Date.now()-86400000,data:shard(record,key)}}};
 let calls=0;
 const {read,L}=runtime(async()=>{calls++;throw new Error('offline');},initial);
 const card={id:91,source:'tmdb'};
 assert.equal((await read(L,card,'movie'))[0].minimal_still_url,frame.url);
 assert.equal((await read(L,card,'movie'))[0].minimal_still_url,frame.url);
 assert.equal(calls,1);
});

test('wrong IDs, wrong media, wrong years and invalid schema never become a gallery',async()=>{
 const key='tmdb:movie:91',record=normalize({media:'tv',tmdb:91,title:'Gallery Film',year:2025,source:'test',origin:'https://frames.example/',frames:[frame]});
 const {read,L}=runtime(async()=>({ok:true,json:async()=>({version,entries:{[key]:[record.id]},records:{[record.id]:record}})}));
 assert.equal((await read(L,{id:91,source:'tmdb'},'movie')).length,0);
 const invalid=runtime(async()=>({ok:true,json:async()=>({version:999,entries:{[key]:[record.id]},records:{[record.id]:record}})}));
 assert.equal((await invalid.read(invalid.L,{id:91,source:'tmdb'},'movie')).length,0);
 assert.equal(validFrames([{url:'javascript:alert(1)'},{url:'https://user:password@example.com/frame.jpg'}]).length,0);
});

test('FilmGrab collector selects the dated frame gallery and rejects cover images',()=>{
 const make=year=>({title:{rendered:'Gallery &amp; Film'},link:'https://film-grab.com/gallery/',
  content:{rendered:'<p>Year: <strong>'+year+'</strong></p><img src="https://film-grab.com/cover.jpg">'+
   Array.from({length:30},(_,i)=>'<a href="https://film-grab.com/wp-content/uploads/photo-gallery/scene-'+i+'.jpg"></a>').join('')}});
 const record=parseFilmGrab(make(2025));
 assert.equal(record.year,2025);assert.equal(record.title,'Gallery & Film');
 assert.equal(record.frames.length,14);assert.ok(record.frames.every(row=>row.url.includes('/photo-gallery/')));
 assert.equal(parseFilmGrab(make('unknown')),null);
});
