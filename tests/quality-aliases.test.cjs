const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text;
function setup(){
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,requests=[],metadata=[];let listener;
 w.eval(code);
 const L={Storage:{get:(key,def)=>key==='jackett_url'?'http://parser.test':def},Listener:{follow:(key,fn)=>listener=fn},Api:{sources:{tmdb:{get:(url,params,ok)=>metadata.push({url,ok})}}},Reguest:function(){this.timeout=()=>{};this.silent=(url,ok,fail)=>requests.push({url,ok,fail});}};
 w.Quality.default(L);
 function card(data){const node=w.document.createElement('div');node.className='card';node.innerHTML='<div class="card__view"></div>';node.getBoundingClientRect=()=>({width:100,top:0,bottom:150,left:0,right:100});w.document.body.appendChild(node);const item={data,render:()=>node};listener({type:'visible',items:[item]});return node;}
 return {w,L,card,requests,metadata,close:()=>dom.window.close()};
}
test('quality tries verified alternate titles, rejects another movie year, and shares the result with duplicate cards',async()=>{
 const r=setup(),{card,requests,metadata}=r;
 try{
  const data={id:501,title:'Клинок, рассекающий демонов: Собрание высших лун и деревня кузнецов',original_title:'Kimetsu no Yaiba Movie',release_date:'2023-03-03',media_type:'movie',genre_ids:[16],original_language:'ja',source:'tmdb'};
  const a=card(data),b=card({...data});assert.equal(requests.length,1);requests[0].ok({Results:[]});assert.equal(metadata.length,1);
  metadata[0].ok({id:501,alternative_titles:{titles:[{iso_3166_1:'US',title:'Demon Slayer To the Swordsmith Village'}]}});
  assert.equal(new URL(requests[1].url).searchParams.get('title'),data.original_title);requests[1].ok({Results:[]});
  assert.equal(new URL(requests[2].url).searchParams.get('title'),'Demon Slayer To the Swordsmith Village');
  requests[2].ok({Results:[{Title:'Demon Slayer To the Swordsmith Village (2024) 2160p'},{Title:'Demon Slayer To the Swordsmith Village (2023) WEB-DL 1080p'}]});
  await wait(10);for(const node of [a,b]){assert.equal(node.querySelector('.pt-quality').textContent,'1080p');assert.equal(node.querySelectorAll('.pt-quality').length,1);}
  assert.equal(requests.length,3);assert.equal(metadata.length,1);
 }finally{r.close();}
});
test('removing a card during alias lookup frees the parser slot and never paints detached nodes',()=>{
 const r=setup(),{card,requests,metadata}=r;
 try{
  const a=card({id:1,title:'First',release_date:'2020-01-01',genre_ids:[18],source:'tmdb'});requests[0].ok({Results:[]});a.remove();
  card({title:'Second',release_date:'2020'});card({title:'Third',release_date:'2020'});assert.equal(requests.length,2);
  metadata[0].ok({id:1,genres:[{id:18}]});assert.equal(requests.length,3,'Detached alias lookup retained a concurrency slot');assert.equal(a.querySelector('.pt-quality'),null);
 }finally{r.close();}
});
test('Shikimori quality uses English aliases without opening the interactive TMDB match screen',()=>{
 const r=setup(),{card,requests,L}=r;let meta;
 L.Api.sources.minimal_shiki={metadata:(id,ok)=>meta=ok,full:()=>assert.fail('Interactive full-card lookup was invoked')};
 try{
  const node=card({id:20,shikimori_id:20,title:'Другое название',original_title:'Romaji Name',release_date:'2023',media_type:'movie',source:'minimal_shiki'});
  requests[0].ok({Results:[]});meta({id:20,english:['English Verified Title']});requests[1].ok({Results:[]});
  assert.equal(new URL(requests[2].url).searchParams.get('title'),'English Verified Title');requests[2].ok({Results:[{Title:'English Verified Title (2023) BDRip 1080p'}]});assert.equal(node.querySelector('.pt-quality').textContent,'1080p');
 }finally{r.close();}
});
