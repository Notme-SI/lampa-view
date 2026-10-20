const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/card-info.js')],bundle:true,write:false,format:'iife',globalName:'Info'}).outputFiles[0].text;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setup(saved={}){
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,requests=[];w.eval(code);
 const L={Storage:{get:(key,def)=>saved[key]===undefined?def:saved[key],set:(key,value)=>saved[key]=JSON.parse(JSON.stringify(value))},Api:{sources:{tmdb:{get:(url,params,ok,fail)=>requests.push({url,ok,fail})}}}};
 return {w,requests,info:w.Info.default(L),close:()=>w.close()};
}
test('saved anime classification survives restart without mixing TMDB movies, series and Shikimori IDs',async()=>{
 const saved={},r=setup(saved);
 try{
  r.info.remember({id:12,source:'cub',media_type:'movie',title:'Anime film',vote_average:7.6,genres:[{id:16}],original_language:'ja'});
  assert.equal(r.info.read({id:12,source:'tmdb',media_type:'movie'}).minimal_anime,true);
  assert.equal(r.info.read({id:12,source:'tmdb',media_type:'tv'}).minimal_anime,undefined);
  assert.equal(r.info.read({id:12,source:'minimal_shiki',media_type:'movie'}).minimal_anime,undefined);
  await wait(280);
 }finally{r.close();}
 const next=setup(saved);try{assert.equal(next.info.read({id:12,source:'tmdb',title:'Saved film'}).minimal_anime,true);assert.equal(next.info.read({id:12,source:'tmdb',title:'Saved film'}).vote_average,7.6);assert.equal(next.requests.length,0);}finally{next.close();}
});
test('metadata requests pause during TV navigation, deduplicate, and reject mismatched response identities',()=>{
 const r=setup(),{w,info,requests}=r;
 try{
  w.document.body.classList.add('pt-tv-busy');let completed=0;
  const card={id:42,source:'tmdb',media_type:'movie'};
  info.fetch(card,result=>{assert.equal(result,null);completed++;});info.fetch(card,result=>{assert.equal(result,null);completed++;});assert.equal(requests.length,0);
  w.document.body.classList.remove('pt-tv-busy');w.document.dispatchEvent(new w.Event('minimal:tv-idle'));assert.equal(requests.length,1);
  requests[0].ok({id:999,genres:[{id:16}],original_language:'ja'});assert.equal(completed,2);assert.equal(info.read(card).minimal_anime,undefined);
  info.fetch(card,result=>assert.equal(result,null));assert.equal(requests.length,1,'Failed lookup should cool down');
 }finally{r.close();}
});
