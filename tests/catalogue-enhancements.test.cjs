const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom'),native=require('./fixtures/native-lampa.cjs');
const code=esbuild.buildSync({stdin:{contents:"export {default as quality} from './src/quality.js';export {default as info} from './src/card-info.js';export {default as cache} from './src/cache-control.js';export {providerQuality} from './src/online-quality.js';export {placeBadges} from './src/badge-layout.js';",resolveDir:path.join(__dirname,'..')},bundle:true,write:false,format:'iife',globalName:'Features'}).outputFiles[0].text;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('provider quality uses explicit metadata and never invents HD from an unknown description',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);assert.equal(w.Features.providerQuality({data:[{quality:'1080p'},{quality:{'2160p':'stream','720p':'stream'}}]}),'4K');assert.equal(w.Features.providerQuality({data:{uhd:true,quality:'1080p'}}),'4K');assert.equal(w.Features.providerQuality({data:{quality:'unknown',name:'Movie 2026'}}),'');assert.equal(w.Features.providerQuality({data:[{method:'play',name:'TVShows 1080p'}]}),'1080p');}finally{w.close();}
});
test('the parser precedes online fallback; clearing quality cancels old callbacks and visible results can be checked again',async()=>{
 const dom=new JSDOM('<body><div class="card"><div class="card__view"></div><div class="card__title">Film</div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 try{
  w.eval(code);const requests=[],fallback=[],store={jackett_url:'http://parser.test',favorite:{history:[{id:1}]}};let line;
  const L={Storage:{get:(k,d)=>store[k]===undefined?d:store[k],set:(k,v)=>store[k]=v},Listener:{follow:(name,fn)=>line=fn},Reguest:function(){this.timeout=()=>{};this.clear=()=>{};this.silent=(url,ok,fail)=>requests.push({url,ok,fail});}};
  w.alc_auto_api={metadataQuality:(card,cb)=>{fallback.push(cb);return ()=>{};}};
  const node=w.document.querySelector('.card');node.getBoundingClientRect=()=>({width:100,height:150,left:0,right:100,top:0,bottom:150});w.Features.quality(L);const item={data:{id:1,title:'Film',source:'tmdb',release_date:'2026-01-01',genre_ids:[18]},render:()=>node};
  line({type:'visible',items:[item]});assert.equal(requests.length,1);assert.equal(fallback.length,0);requests[0].fail();assert.equal(fallback.length,1);
  w.Features.cache(L).clear('quality');fallback[0]({data:{quality:'2160p'}});assert.equal(node.querySelector('.pt-quality'),null,'An old answer survived cache reset');assert.deepEqual(Array.from(store.minimal_quality_v2),[]);
  await wait(130);assert.equal(requests.length,2);requests[1].fail();fallback[1]({data:{quality:'1080p'}});assert.equal(node.querySelector('.pt-quality').textContent,'1080p');await wait(280);assert.equal(store.minimal_quality_v2.length,1);assert.equal(store.favorite.history.length,1);
 }finally{w.close();}
});
test('rating reset preserves cached release dates and genres and discards ratings from an in-flight old request',()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 try{
  w.eval(code);let pending;const store={},L={Storage:{get:(k,d)=>store[k]===undefined?d:store[k],set:(k,v)=>store[k]=v},Api:{sources:{tmdb:{get:(u,p,ok)=>pending=ok}}}},info=w.Features.info(L),card={id:5,source:'tmdb',media_type:'movie',title:'Film'};
  info.remember({...card,release_date:'2020-01-01',genre_ids:[18],vote_average:8});info.fetch(card,()=>{});w.Features.cache(L).clear('ratings');pending({id:5,release_date:'2020-01-01',genres:[{id:18}],vote_average:9});const read=info.read(card);assert.equal(read.release_date,'2020-01-01');assert.equal(read.vote_average,undefined);assert.deepEqual(Array.from(read.genre_ids),[18]);assert.equal(store.minimal_card_info_v1[0][1].vote_average,undefined);
 }finally{w.close();}
});
test('corner placement separates quality, type, playback icons and scores on narrow and wide posters',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);for(const [width,height] of [[110,165],[220,330],[150,85]]){
  const out=w.Features.placeBadges(width,height,[{id:'rating',corner:'br',width:25,height:15},{id:'quality',corner:'tl',width:30,height:16},{id:'type',corner:'tr',width:44,height:16},{id:'icons',corner:'tl',width:34,height:16},{id:'marker',corner:'bl',width:32,height:16}]);assert.equal(out.length,5);for(const a of out){assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=width&&a.y+a.height<=height);for(const b of out)if(a!==b)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
 }}finally{w.close();}
});
test('legacy history cards restore missing years from metadata without changing the saved history',async()=>{
 const n=await native({built:true}),{w,L}=n,cards=[];
 try{
  const history=[{id:910,name:'Series',original_name:'Series',source:'tmdb',genre_ids:[18],release_quality:'1080p'},{id:911,title:'Film',source:'tmdb',genre_ids:[18],release_quality:'1080p'}];L.Favorite.get=({type})=>type==='history'?history:[];
  L.Api.sources.tmdb.get=(url,p,ok)=>w.setTimeout(()=>ok(url.startsWith('tv/')?{id:910,first_air_date:'2026-10-07',genres:[{id:18}]}:{id:911,release_date:'2025-05-12',genres:[{id:18}]}),0);
  for(const data of history){const c=new L.Card(data,{});c.create();const node=c.render(true);node.getBoundingClientRect=()=>({width:120,height:180,top:0,bottom:180,left:0,right:120});w.document.body.appendChild(node);cards.push(c);}
  await wait(170);assert.equal(cards[0].render(true).querySelector('.card__age').textContent,'2026');assert.equal(cards[1].render(true).querySelector('.card__age').textContent,'2025');assert.equal(history[0].first_air_date,undefined);assert.equal(history[1].release_date,undefined);assert.deepEqual(n.errors,[]);
 }finally{cards.forEach(c=>c.destroy());n.close();}
});
test('settings hide locked and duplicate switches, retain active choices and have working action callbacks',async()=>{
 const n=await native({built:true}),{L,w}=n;try{
  const params=()=>['appearance','catalogue','playback','languages','parser','server'].flatMap(g=>L.SettingsApi.getParam('minimal_settings_'+g));let list=params();const keys=list.map(p=>p.param.name);assert.equal(new Set(keys).size,keys.length);assert.ok(list.every(p=>p.param.type!=='button'||typeof p.onChange==='function'));for(const name of ['nova_plus_hero','nova_plus_fullscreen','nova_plus_art_size','nova_plus_probe','alc_auto_quick_movie'])assert.ok(!keys.includes(name),name);for(const name of ['minimal_clear_ratings','minimal_clear_quality','minimal_quality_fallback'])assert.ok(keys.includes(name),name);
  L.Storage.set('nova_plus_mode','skin');list=params();assert.ok(list.some(p=>p.param.name==='nova_plus_hero'));assert.ok(!list.some(p=>p.param.name==='nova_plus_layout'));L.Storage.set('nova_plus_enabled',false);assert.ok(params().every(p=>!p.param.name.startsWith('nova_plus_')||p.param.name==='nova_plus_enabled'));
  for(const name of ['minimal_clear_quality','minimal_clear_ratings'])params().find(p=>p.param.name===name).onChange();w.lampac_plugin=true;assert.ok(params().every(p=>!/^alc_auto_(fav_btn|src_btn|studios_btn|langs|visible_languages|autosubs)$/.test(p.param.name)));assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('Alloha reserve reads only catalogue metadata on the configured server and respects a disabled provider',async()=>{
 const n=await native({built:true,initialStorage:{alc_auto_server:'https://online.example.test'}}),{w,L}=n,urls=[];
 try{
  w.XMLHttpRequest=class{open(method,url){this.url=url;}setRequestHeader(){}getResponseHeader(){return null;}abort(){}send(){const url=this.url;urls.push(url);w.setTimeout(()=>{this.status=200;this.responseText=JSON.stringify(url.includes('/lite/events')?[{balanser:'alloha',url:'https://online.example.test/lite/alloha'}]:url.includes('/lite/alloha')?{data:[{method:'call',quality:'2160p',voice_name:'TVShows'}]}:{});if(this.onload)this.onload();},0);}};
  const movie={id:555,title:'Film',source:'tmdb',release_date:'2025-01-01'};
  const result=await new Promise(resolve=>w.alc_auto_api.metadataQuality(movie,resolve));
  assert.equal(result.data[0].quality,'2160p');assert.ok(urls.some(u=>u.includes('/lite/events')));assert.ok(urls.some(u=>u.includes('/lite/alloha')));
  assert.ok(urls.every(u=>new URL(u).origin==='https://online.example.test'));assert.ok(urls.filter(u=>/\/lite\/(events|alloha)/.test(u)).every(u=>new URL(u).searchParams.get('rjson')==='true'));assert.ok(urls.every(u=>!/(\/video|\.m3u8|token=)/.test(u)));
  L.Storage.set('alc_auto_src_off',['alloha']);urls.length=0;const disabled=await new Promise(resolve=>w.alc_auto_api.metadataQuality(movie,resolve));assert.equal(disabled,null);assert.ok(!urls.some(u=>u.includes('/lite/alloha')));assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
