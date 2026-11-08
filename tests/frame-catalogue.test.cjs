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
