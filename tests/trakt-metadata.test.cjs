const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/trakt-metadata.js')],bundle:true,write:false,format:'iife',globalName:'Metadata'}).outputFiles[0].text;
function setup(){const w=new JSDOM('',{runScripts:'outside-only'}).window,store={},sent=[];w.eval(code);const L={Storage:{get:(k,d)=>store[k] ?? d,set:(k,v)=>store[k]=v},Api:{sources:{tmdb:{get(path,params,ok,fail){sent.push({path,params,ok,fail});}}}}};return {w,L,store,sent,api:w.Metadata.default(L),close:()=>w.close()};}
const raw=(id,type='movie')=>({id,source:'tmdb',media_type:type,title:'English '+id,...(type==='tv'?{name:'English '+id}:{}),trakt_id:9000+id,img:'https://media.trakt.tv/poster.jpg'});
const translated=(id,type='movie')=>({id,media_type:type,...(type==='tv'?{name:'Сериал '+id,original_name:'Original '+id}:{title:'Фильм '+id,original_title:'Original '+id}),overview:'Описание',poster_path:'/ru'+id+'.jpg',backdrop_path:'/bg'+id+'.jpg'});

test('slow localization publishes the catalogue once at its deadline and still warms the cache',()=>{
 const r=setup(),timers=[];r.w.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};r.w.clearTimeout=()=>{};
 try{let count=0,out;r.api.enrich([raw(30)],v=>{out=v;count++;});timers.find(t=>t.ms===2500).fn();assert.equal(count,1);assert.equal(out[0].title,'English 30');
  r.sent[0].ok({results:[]});r.sent[1].ok({results:[]});r.sent[2].ok({results:[]});r.sent[3].ok(translated(30));assert.equal(count,1);r.api.enrich([raw(30)],v=>out=v);assert.equal(out[0].title,'Фильм 30');
 }finally{r.close();}
});
test('localized batch metadata restores Russian titles, posters and carousel data while keeping Trakt IDs and rank',()=>{
 const r=setup();try{let out,other;r.api.enrich([raw(10),raw(20,'tv')],v=>out=v);r.api.enrich([raw(20,'tv'),raw(10)],v=>other=v);assert.equal(r.sent.length,2);
  r.sent[0].ok({results:[translated(10),translated(20,'tv')]});assert.equal(r.sent.length,3);r.sent[1].ok({results:[]});r.sent[2].ok({results:[]});
  assert.equal(out[0].title,'Фильм 10');assert.equal(out[1].title,'Сериал 20');assert.equal(out[1].name,'Сериал 20');assert.equal(out[1].original_title,'Original 20');assert.equal(out[0].poster_path,'/ru10.jpg');assert.equal(out[0].backdrop_path,'/bg10.jpg');assert.equal(out[0].trakt_id,9010);assert.deepEqual(Array.from(other,v=>v.id),[20,10]);assert.equal(r.sent.length,3,'No per-card requests for titles already present in localized lists');assert.ok(r.sent.every(q=>q.params.langs==='ru'));
 }finally{r.close();}
});
test('missing batch cards use one deduplicated detail request and an unrelated TMDB ID cannot replace them',()=>{
 const r=setup();try{let out;r.api.enrich([raw(30)],v=>out=v);r.sent[0].ok({results:[]});r.sent[1].ok({results:[]});r.sent[2].ok({results:[]});assert.equal(r.sent[3].path,'movie/30');r.sent[3].ok(translated(99));assert.equal(out[0].title,'English 30');assert.equal(out[0].id,30);
  r.api.enrich([raw(30)],v=>out=v);r.sent[4].ok(translated(30));assert.equal(out[0].title,'Фильм 30');r.api.enrich([raw(30)],v=>out=v);assert.equal(r.sent.length,5);
 }finally{r.close();}
});
test('localized cache survives reopening, is scoped by language and skips stale callbacks after navigation',async()=>{
 const r=setup();try{let count=0;r.api.enrich([raw(10)],()=>count++);r.sent[0].ok({results:[translated(10)]});r.sent[1].ok({results:[]});r.sent[2].ok({results:[]});await new Promise(resolve=>setTimeout(resolve,280));
  const next=r.w.Metadata.default(r.L);let out;next.enrich([raw(10)],v=>out=v);assert.equal(out[0].title,'Фильм 10');assert.equal(r.sent.length,3);
  r.store.tmdb_lang='ja';next.enrich([raw(10)],()=>count++);assert.equal(r.sent.length,5);next.clear();r.sent[3].ok({results:[translated(10)]});r.sent[4].ok({results:[]});assert.equal(count,1);assert.equal(r.sent.length,5,'Queued localization is cancelled on navigation');
 }finally{r.close();}
});
