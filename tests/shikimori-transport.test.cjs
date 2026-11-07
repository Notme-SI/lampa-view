const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function adapter(){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/shikimori.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports.default;}
test('Shikimori rejects HTML, switches to the official fallback, remembers it and preserves the poster host',async()=>{
 const calls=[],L={Api:{sources:{}},Reguest:function(){this.timeout=()=>{};this.silent=(url,ok)=>{calls.push(url);if(url.startsWith('https://shikimori.io'))ok('<!doctype html>');else ok([{id:1,kind:'tv',name:'Anime',image:{original:'/poster.jpg'}}]);};}},shiki=adapter()(L);
 const first=await new Promise((ok,fail)=>shiki.list({url:'order=popularity'},ok,fail));assert.equal(calls.length,2);assert.equal(first.results[0].img,'https://shikimori.one/poster.jpg');const second=await new Promise((ok,fail)=>shiki.list({url:'order=ranked'},ok,fail));assert.equal(calls.length,3);assert.ok(calls[2].startsWith('https://shikimori.one'));assert.equal(second.results.length,1);
});
test('an older failing Shikimori request cannot repeat a host or suppress a concurrent success',async()=>{
 const calls=[],L={Api:{sources:{}},Reguest:function(){this.timeout=()=>{};this.silent=(url,ok,fail)=>calls.push({url,ok,fail});}};
 const shiki=adapter()(L),anime=L.Api.sources.minimal_shiki;
 let failure=0,genres,metadata;
 anime.genres(()=>assert.fail('failed request must not succeed'),()=>failure++);
 anime.metadata(100,()=>assert.fail('failed request must not succeed'),()=>failure++);
 calls[0].fail();calls[2].fail();assert.equal(failure,1);
 shiki.retry();anime.genres(value=>genres=value,assert.fail);calls[3].ok([{id:1}]);
 calls[1].fail();assert.equal(failure,2);assert.deepEqual(genres,[{id:1}]);assert.equal(calls.length,4);
 anime.metadata(100,value=>metadata=value,assert.fail);calls[4].ok({id:100});assert.equal(metadata.id,100);
 assert.deepEqual(calls.map(call=>new URL(call.url).host),['shikimori.io','shikimori.io','shikimori.one','shikimori.io','shikimori.io']);
});

test('built plugin shows an actionable network error and retry restores Shikimori through the native request pipeline',async()=>{
 const n=await native({built:true,requestPipeline:true}),{w,L}=n;
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);
  Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected?w.document.body:null;},configurable:true});
  let available=false,calls=[];const network=w.testNetwork;w.testNetwork=(url,ok,fail)=>{if(/shikimori\.(io|one)\/api\/animes/.test(url)){calls.push(url);w.setTimeout(()=>available?ok([{id:100,kind:'tv',name:'Anime',russian:'Аниме',score:'8',image:{original:'/poster.jpg'}}]):fail(),0);}else network(url,ok,fail);};
  L.Activity.push({component:'category',url:'anime',source:'cub',minimal_anime_catalogue:'shikimori',minimal_anime_focus_tabs:true,title:'Аниме'});await wait(3650);let link=L.Activity.active().activity.component,root=link.render(true);assert.equal(link.items.length,0);assert.equal(root.querySelector('.minimal-anime-status').hidden,false);assert.match(root.querySelector('.minimal-anime-status').textContent,/Не удалось загрузить Shikimori/);assert.equal(root.querySelector('.minimal-anime-retry').hidden,false);assert.ok(calls.length<=4,'outage must not cause twenty failing requests');assert.equal(w.getComputedStyle(root.querySelector('.minimal-anime-tabs')).justifyContent,'center');
  const retry=root.querySelector('.minimal-anime-retry');Object.defineProperty(retry,'offsetWidth',{value:180});Object.defineProperty(retry,'offsetHeight',{value:44});assert.equal(L.Controller.enabled().name,'minimal_anime_tabs');L.Controller.enabled().controller.down();assert.equal(w.Navigator.getFocusedElement(),retry);const outageCalls=calls.length;available=true;w.jQuery(retry).trigger('hover:enter');await wait(3650);link=L.Activity.active().activity.component;root=link.render(true);assert.equal(link.object.minimal_catalogue_status.state,'ready');assert.ok(link.items.length>0);assert.equal(root.querySelector('.minimal-anime-status').hidden,true);const retries=calls.slice(outageCalls);assert.ok(retries.length>0);assert.ok(retries.every(url=>url.startsWith('https://shikimori.io')));assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('focused Shikimori release resolves its own TV season, shares metadata and related requests and caches the result',async()=>{
 const calls=[],L={Api:{sources:{}},Reguest:function(){this.timeout=()=>{};this.silent=(url,ok)=>{calls.push(url);if(url.endsWith('/related'))ok([{relation:'Sequel',anime:{id:2,kind:'tv',name:'Next'}}]);else ok({id:16498,kind:'tv',name:'Shingeki no Kyojin',episodes:25,episodes_aired:25,status:'released'});};}};
 adapter()(L);const source=L.Api.sources.minimal_shiki;
 const results=await Promise.all([new Promise((ok,fail)=>source.release(16498,ok,fail)),new Promise((ok,fail)=>source.release(16498,ok,fail))]);
 for(const result of results){assert.equal(result.minimal_release_season,1);assert.equal(result.episodes_aired,25);assert.equal(result.id,16498);}
 assert.equal(calls.length,2);assert.ok(calls.every(url=>url.startsWith('https://shikimori.io/api/animes/16498')));
 await new Promise((ok,fail)=>source.release(16498,ok,fail));assert.equal(calls.length,2);
});
