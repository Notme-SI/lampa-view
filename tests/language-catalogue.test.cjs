const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
function mod(name){const m={exports:{}},code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text;new Function('module','exports',code)(m,m.exports);return m.exports;}
test('English discovery keeps translated titles and artwork',async()=>{
 global.window={Lampa:{Storage:{get:()=> 'en'}}};try{
 const source=mod('discovery-source').default({Api:{sources:{tmdb:{get(url,p,ok){ok({page:1,total_pages:1,results:[{id:1,name:'English title',genre_ids:[18],poster_path:'/p',backdrop_path:'/b',origin_country:['US']}]});}}}}});
 const json=await new Promise((ok,fail)=>source.list({page:1,url:JSON.stringify({kind:'tv',type:'tv',sort:'popular'})},ok,fail));assert.equal(json.results.length,1);assert.equal(json.results[0].name,'English title');
 }finally{delete global.window;}
});
test('list deduplication preserves media identity, repeated page reads and fresh visits',()=>{
 const L={Api:{list(p,ok){ok({page:p.page,total_pages:2,results:p.page===1?[{id:1,name:'Series'},{id:1,name:'Series'},{id:1,title:'Movie',media_type:'movie'}]:[{id:1,name:'Series'},{id:2,name:'Next'}]});}}};mod('tmdb').installListGuard(L);
 const read=page=>{let json;L.Api.list({source:'tmdb',url:'trending/all/day',page},j=>json=j);return json.results;};assert.equal(read(1).length,2);assert.deepEqual(read(2).map(c=>c.id),[2]);assert.deepEqual(read(2).map(c=>c.id),[2]);assert.equal(read(1).length,2);
});
test('unanswered cloud history releases initial screen once and accepts a late response',()=>{
 const {JSDOM}=require('jsdom'),d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/watch-history.js')],bundle:true,write:false,format:'iife',globalName:'HistoryModule'}).outputFiles[0].text;w.eval(code);let timeout,reply,rendered=0;
 w.setTimeout=(fn,ms)=>{if(ms===5000)timeout=fn;return 1;};w.clearTimeout=()=>{};
 const L={Storage:{get:(k,f)=>f},Favorite:{get:()=>[]},Account:{Permit:{sync:true,account:{profile:{id:1}}},Api:{watchHistory:(p,ok)=>reply=ok}}};const h=w.HistoryModule.default(L);h.ready(()=>rendered++);assert.equal(rendered,0);timeout();assert.equal(rendered,1);reply({results:[{id:3,title:'Movie'}]});assert.equal(rendered,1);assert.equal(h.cards()[0].id,3);
 }finally{w.close();}
});

test('anime source follows selection, never interface language; shared Discover stays shared',()=>{
 const {cataloguePlan,catalogueRow}=mod('catalogue');let language='ru';global.window={Lampa:{Storage:{get:()=>language}}};
 try{const snapshots={};for(const lang of ['ru','en','fr','uk']){language=lang;for(const source of ['cub','tmdb']){
  const rows=cataloguePlan('anime','standard',new Date(2026,10,6)).map(job=>catalogueRow(job,'anime',source,true));
  assert.equal(rows[0].source,source);assert.equal(rows[1].source,source);
  const routes=rows.map(row=>[row.source,row.url]);if(snapshots[source])assert.deepEqual(routes,snapshots[source]);else snapshots[source]=routes;
 }for(const kind of ['movie','tv','cartoon']){const job=cataloguePlan(kind)[0];const {minimal_catalogue_fallback,...row}=catalogueRow(job,kind,'cub');assert.equal(minimal_catalogue_fallback,true);assert.deepEqual(row,catalogueRow(job,kind,'tmdb'));}}
 }finally{delete global.window;}
});
