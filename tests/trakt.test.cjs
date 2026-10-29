const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/trakt.js')],bundle:true,write:false,format:'iife',globalName:'Trakt'}).outputFiles[0].text;
function setup(){
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window,storage={},sent=[],settings=[];
 w.eval(code);
 w.XMLHttpRequest=class {
  constructor(){this.headers={};}open(method,url){this.method=method;this.url=url;}setRequestHeader(k,v){this.headers[k]=v;}send(){sent.push(this);}abort(){this.onabort();}
  getResponseHeader(name){return name==='X-Pagination-Page-Count'?'9':null;}
  reply(data,status=200){this.status=status;this.responseText=JSON.stringify(data);this.onload();}
 };
 const tmdb={full(p,ok){ok({id:p.id});}},L={Storage:{get:(k,d)=>storage[k] ?? d,set:(k,v)=>storage[k]=v},Api:{sources:{tmdb}},Params:{values:{source:{tmdb:'TMDB',cub:'CUB',custom:'Custom'}},select(k,v){this.values[k]=v;}},SettingsApi:{addParam:p=>settings.push(p)}};
 const api=w.Trakt.default(L);return {w,L,api,storage,sent,settings,close:()=>w.close()};
}
const movie=(id,title)=>({title,year:2026,ids:{tmdb:id,trakt:id+10000},rating:8.3,images:{poster:['media.trakt.tv/images/movies/'+id+'/poster.webp']}});
test('Trakt is disabled by default, prompts for Client ID on enable and uses the native main-source setting',()=>{
 const r=setup();try{
  assert.equal(r.L.Params.values.source.trakt,undefined);assert.equal(r.L.Params.values.source.custom,'Custom');let message;
  r.api.main({},()=>assert.fail('No fake TMDB lists'),e=>message=e.status_message);assert.match(message,/Включите Trakt/);assert.equal(r.sent.length,0);
  const toggle=r.settings.find(row=>row.param.name==='minimal_trakt_enabled');assert.equal(toggle.param.default,false);let prompt,submit;
  r.L.Input={edit:(params,callback)=>{prompt=params;submit=callback;}};r.storage.source='cub';r.storage.minimal_trakt_enabled=true;toggle.onChange();assert.match(prompt.title,/Client ID/);assert.equal(r.L.Params.values.source.trakt,undefined);assert.equal(r.sent.length,0);
  submit(' own-public-id ');assert.equal(r.storage.minimal_trakt_enabled,true);assert.equal(r.L.Params.values.source.trakt,'Trakt');assert.equal(r.storage.source,'cub','Enabling must not change the native main source');assert.equal(r.storage.minimal_trakt_client_id,'own-public-id');
  r.storage.source='trakt';r.storage.minimal_trakt_enabled=false;toggle.onChange();assert.equal(r.L.Params.values.source.trakt,undefined);assert.equal(r.storage.source,'cub');assert.equal(r.storage.minimal_trakt_client_id,'own-public-id');
  const input=r.settings.find(row=>row.param.name==='minimal_trakt_client_id');assert.doesNotMatch(input.param.name,/secret/);
 }finally{r.close();}
});
test('empty or cancelled Client ID input leaves Trakt disabled and does not request the network',()=>{
 const r=setup();try{let submit;r.L.Input={edit:(p,callback)=>submit=callback};r.storage.minimal_trakt_enabled=true;r.settings[0].onChange();submit('');assert.equal(r.storage.minimal_trakt_enabled,false);assert.equal(r.L.Params.values.source.trakt,undefined);assert.equal(r.sent.length,0);}finally{r.close();}
});
test('Trakt preserves ranking, verified TMDB identities, images and pagination; coalesces and caches public requests',()=>{
 const r=setup();try{
  r.storage.minimal_trakt_enabled=true;r.storage.minimal_trakt_client_id='own-public-client-id';const results=[];
  for(let i=0;i<2;i++)r.api.list({url:'movies/trending',page:3},v=>results.push(v),assert.fail);
  assert.equal(r.sent.length,1);const req=r.sent[0];assert.equal(req.headers['trakt-api-key'],'own-public-client-id');assert.equal(req.headers['trakt-api-version'],'2');assert.equal(req.headers.Authorization,undefined);assert.match(req.url,/^https:\/\/api\.trakt\.tv\/movies\/trending\?extended=full&limit=20&page=3$/);
  req.reply([{movie:movie(22,'First')},{movie:movie(11,'Second')},{movie:movie(22,'Duplicate')},{movie:{title:'Missing TMDB ID',ids:{trakt:99}}}]);
  assert.equal(results.length,2);assert.equal(results[0].page,3);assert.equal(results[0].total_pages,9);assert.deepEqual(Array.from(results[0].results,v=>v.id),[22,11]);assert.equal(results[0].results[0].source,'tmdb');assert.equal(results[0].results[0].trakt_id,10022);assert.match(results[0].results[0].img,/^https:\/\/media.trakt.tv\//);
  r.api.list({url:'movies/trending',page:3},()=>{},assert.fail);assert.equal(r.sent.length,1);
  let full;r.api.full({id:22},v=>full=v);assert.equal(full.id,22);
 }finally{r.close();}
});
test('Trakt limits parallel list loads, does not cache failures or send its key to arbitrary routes',()=>{
 const r=setup();try{
  r.storage.minimal_trakt_enabled=true;r.storage.minimal_trakt_client_id='own-id';let output,error;
  r.api.main({},rows=>output=rows,e=>error=e);assert.equal(r.sent.length,2);
  r.sent[0].reply([movie(1,'A')]);assert.equal(r.sent.length,3);r.sent[1].reply([movie(2,'B')]);assert.equal(r.sent.length,4);r.sent[2].reply([{show:movie(3,'C')}]);r.sent[3].reply([{show:movie(4,'D')}]);
  for(let i=4;i<r.sent.length;i++){const type=r.sent[i].url.includes('/shows/')?'show':'movie';r.sent[i].reply([{[type]:movie(10+i,'Extra '+i)}]);}
  assert.equal(output.length,5);assert.equal(r.sent.length,10);assert.equal(error,undefined);assert.equal(output[0].results[1].media_type,'tv');assert.ok(output.every(row=>row.source==='trakt'));
  let failed;r.api.list({url:'https://evil.invalid/'},assert.fail,e=>failed=e);assert.match(failed.status_message,/Неизвестная/);assert.equal(r.sent.length,10);
  r.api.list({url:'movies/popular',page:2},assert.fail,e=>failed=e);r.sent[10].reply({},401);assert.match(failed.status_message,/Client ID/);
  r.api.list({url:'movies/popular',page:2},()=>{},()=>{});assert.equal(r.sent.length,12);r.sent[11].reply([],200);
  assert.ok(r.w.Trakt.traktPlan('anime')[0].url.endsWith('genres=animation&languages=ja'));
 }finally{r.close();}
});
test('changing Trakt client invalidates pending requests and old cached results',()=>{
 const r=setup();try{
  r.storage.minimal_trakt_enabled=true;r.storage.minimal_trakt_client_id='first';let stale=0,fresh=0;r.api.list({url:'movies/trending'},()=>stale++,()=>stale++);
  r.storage.minimal_trakt_enabled=true;r.storage.minimal_trakt_client_id='second';r.api.list({url:'movies/trending'},()=>fresh++,assert.fail);assert.equal(r.sent.length,2);r.sent[1].reply([movie(2,'B')]);r.sent[0].reply([movie(1,'A')]);assert.equal(stale,0);assert.equal(fresh,1);assert.equal(r.sent[1].headers['trakt-api-key'],'second');
 }finally{r.close();}
});

test('Trakt categories expose five genuine public feeds, retain animation filters and support More on the added routes',()=>{
 const r=setup();try{
  r.storage.minimal_trakt_enabled=true;r.storage.minimal_trakt_client_id='own-id';
  for(const kind of ['movie','tv','anime','cartoon']){
   const plan=r.w.Trakt.traktPlan(kind);assert.equal(plan.length,kind==='cartoon'?10:5);
   assert.ok(plan.some(row=>row.url.includes('/watched/weekly')));assert.ok(plan.some(row=>row.url.includes('/collected/monthly')));assert.ok(plan.some(row=>row.url.includes('/anticipated')));
   if(kind==='anime')assert.ok(plan.every(row=>row.url.endsWith('?genres=animation&languages=ja')));
   if(kind==='cartoon')assert.ok(plan.every(row=>row.url.endsWith('?genres=animation')));
  }
  let answer;r.api.category({url:'movie'},rows=>answer=rows,assert.fail);
  for(let i=0;i<r.sent.length;i++)r.sent[i].reply([{movie:movie(i+1,'Ranked '+i)}]);
  assert.equal(answer.length,5);assert.deepEqual(Array.from(answer,row=>row.results[0].id),[1,2,3,4,5]);
  for(const url of ['movies/watched/weekly','shows/collected/monthly?genres=animation&languages=ja','movies/anticipated']){
   let result;r.api.list({url,page:2},v=>result=v,assert.fail);const request=r.sent.at(-1);assert.equal(new URL(request.url).searchParams.get('page'),'2');
   request.reply([{[url.startsWith('shows')?'show':'movie']:movie(99,'Next')}]);assert.equal(result.page,2);assert.equal(result.total_pages,9);assert.equal(result.results[0].id,99);
  }
  const count=r.sent.length;for(const url of ['movies/watched/weekly?api_key=bad','movies/anticipated?redirect=https://evil.invalid','movies/watched/../users/me'])r.api.list({url},assert.fail,()=>{});assert.equal(r.sent.length,count);
 }finally{r.close();}
});
