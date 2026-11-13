const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),esbuild=require('esbuild');
const {JSDOM}=require('jsdom');
test('quality never contacts a fallback server when no parser is configured',()=>{
 const dom=new JSDOM('<body><div class="card"><div class="card__view"></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text);
 let listener,calls=0;const node=w.document.querySelector('.card');node.getBoundingClientRect=()=>({width:100,top:0,bottom:150,left:0});
 w.Quality.default({Listener:{follow:(k,fn)=>listener=fn},Storage:{get:(k,d)=>d},Reguest:function(){calls++;this.timeout=()=>{};this.silent=()=>{};}},null);
 listener({type:'visible',items:[{data:{title:'Film',release_date:'2026-01-01'},render:()=>node}]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));
 assert.equal(calls,0);w.close();
});
test('visible movie quality is bounded, cached, and rejects unrelated releases and years',()=>{
 const dom=new JSDOM('<html><body></body></html>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text;
 w.eval(bundle);let listener;const requests=[];
 const L={Listener:{follow:(key,fn)=>listener=fn},Storage:{get:(key,def)=>key==='jackett_url'?'http://parser.test':key==='jackett_key'?'1':def},Reguest:function(){this.timeout=()=>{};this.silent=(url,success,error)=>requests.push({url,success,error});}};
 w.Quality.default(L,null);
 function card(title,extra={}){const node=w.document.createElement('div');node.className='card';node.innerHTML='<div class="card__view"></div>';node.getBoundingClientRect=()=>({width:100,top:0,bottom:150,left:0});w.document.body.appendChild(node);return {data:{title,release_date:'2020-01-01',...extra},render:()=>node};}
 const a=card('Arrival'),b=card('Second'),c=card('Third');
 listener({type:'visible',items:[a,b,c]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));assert.equal(requests.length,2,'network concurrency is unbounded');
 requests[0].success({Results:[{Title:'Other (2020) 2160p'},{Title:'Arrival (2021) 2160p'},{Title:'Arrival (2020) 1080p'},{Title:'Arrival (2020) TS 2160p'}]});
 assert.equal(a.render().querySelector('.pt-quality').textContent,'1080p');assert.equal(requests.length,3);
 requests[1].success({Results:[]});requests[2].error();
 listener({type:'visible',items:[a,b,c]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));assert.equal(requests.length,3,'empty results must be cached');
 dom.window.close();
});
for(const mode of ['wheel','tv'])test('quality requests and layout reads wait until '+mode+' navigation finishes',()=>{
 const dom=new JSDOM('<body class="pt-'+(mode==='tv'?'tv-busy':'wheel-active')+'"><div class="card"><div class="card__view"></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text;w.eval(bundle);
 let listener,reads=0,requests=0;const node=w.document.querySelector('.card');node.getBoundingClientRect=()=>{reads++;return {width:100,top:0,bottom:150,left:0};};
 const L={Listener:{follow:(key,fn)=>listener=fn},Storage:{get:(key,def)=>key==='jackett_url'?'http://parser.test':def},Reguest:function(){this.timeout=()=>{};this.silent=()=>requests++;}};w.Quality.default(L,null);
 const item={data:{title:'Movie',release_date:'2020-01-01'},render:()=>node};
 for(let i=0;i<25;i++)listener({type:'visible',items:[item]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));
 assert.equal(reads,0);assert.equal(requests,0);
 w.document.body.classList.remove(mode==='tv'?'pt-tv-busy':'pt-wheel-active');w.document.dispatchEvent(new w.Event('minimal:'+mode+'-idle'));
 assert.equal(reads,1,'deferred items were not deduplicated');assert.equal(requests,1);dom.window.close();
});
test('TV card batches finish decorations before the first layout read',()=>{
 const dom=new JSDOM('<body class="pt-tv pt-tv-busy"></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const source=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text;
 w.eval(source);
 let listener,reads=0;
 w.Quality.default({Listener:{follow:(key,fn)=>listener=fn},Storage:{get:(key,fallback)=>fallback}},null);
 const items=Array.from({length:4},(_,i)=>{
  const node=w.document.createElement('div');
  node.className='card';
  node.innerHTML='<div class="card__view"></div>';
  w.document.body.appendChild(node);
  node.getBoundingClientRect=()=>{
   reads++;
   assert.equal(w.document.querySelectorAll('.pt-kind').length,4);
   return {width:100,top:0,bottom:150,left:0,right:100};
  };
  return {data:{id:i+1,title:'Film '+i,release_date:'2020-01-01'},render:()=>node};
 });
 listener({type:'visible',items});
 assert.equal(reads,0);
 w.document.body.classList.remove('pt-tv-busy');
 w.document.dispatchEvent(new w.Event('minimal:tv-idle'));
 assert.equal(reads,4);
 w.document.dispatchEvent(new w.Event('minimal:tv-idle'));
 assert.equal(reads,4,'An idle event does not remeasure already processed posters');
 w.close();
});

test('series get their own type marker and quality from later-season releases',()=>{
 const dom=new JSDOM('<body><div class="card card--tv"><div class="card__view"></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text;w.eval(bundle);
 let listener,request;const node=w.document.querySelector('.card');node.getBoundingClientRect=()=>({width:100,top:0,bottom:150,left:0});
 w.Quality.default({Listener:{follow:(k,fn)=>listener=fn},Storage:{get:(k,d)=>k==='jackett_url'?'http://parser.test':d},Reguest:function(){this.timeout=()=>{};this.silent=(url,success)=>request={url,success};}},null);
 listener({type:'visible',items:[{data:{id:1,name:'Series',original_name:'Series',first_air_date:'2020-01-01',media_type:'tv'},render:()=>node}]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));
 assert.equal(node.querySelector('.pt-kind').textContent,'Сериал');assert.ok(!request.url.includes('&year='));
 request.success({Results:[{Title:'Other (2025) S01 2160p'},{Title:'Series (2024) S04 WEB-DL 1080p'}]});assert.equal(node.querySelector('.pt-quality').textContent,'1080p');
 dom.window.close();
});

test('custom quality owns one visible slot before and after native rendering',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../src/theme.css'),'utf8');
 const dom=new JSDOM('<head><style>'+css+'</style></head><body class="lampa_view"></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text);
 let listener;
 w.Quality.default({Listener:{follow:(key,fn)=>listener=fn}},null);
 for(const late of [false,true]){
  const node=w.document.createElement('div');node.className='card';node.innerHTML='<div class="card__view"></div>';w.document.body.appendChild(node);
  node.getBoundingClientRect=()=>({width:100,top:0,bottom:150,left:0});
  const native=w.document.createElement('div');native.className='card__quality';native.innerHTML='<div>WEBRip</div>';
  if(!late)node.firstChild.appendChild(native);
  const item={data:{title:'Movie',quality:'WEBRip'},render:()=>node};
  listener({type:'visible',items:[item]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));
  if(late)node.firstChild.appendChild(native);
  listener({type:'append',items:[item]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));
  assert.equal(node.querySelectorAll('.pt-quality').length,1);
  assert.equal(w.getComputedStyle(native).display,'none','native quality overlaps custom badge');
  assert.notEqual(w.getComputedStyle(node.querySelector('.pt-quality')).display,'none');
 }
 dom.window.close();
});

test('all four media types receive one accurate monochrome badge',()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text);
 let listener,requests=0;
 w.Quality.default({Listener:{follow:(key,fn)=>listener=fn},Storage:{get:(key,def)=>def},Reguest:function(){requests++;}},null);
 const cases=[
  [{title:'Anime movie',media_type:'movie',genre_ids:[16],original_language:'ja'},'Аниме'],
  [{name:'Anime series',media_type:'tv',genre_ids:[16],original_language:'ja'},'Аниме'],
  [{title:'Shikimori movie',media_type:'movie',source:'minimal_shiki'},'Аниме'],
  [{title:'Animated movie',media_type:'movie',genre_ids:[16],original_language:'en'},'Мультфильм'],
  [{name:'Animated series',media_type:'tv',genre_ids:[16],original_language:'en',number_of_episodes:1},'Мультсериал'],
  [{title:'Live action movie',media_type:'movie',original_language:'ja'},'Фильм'],
  [{name:'Live action series',media_type:'tv'},'Сериал']
 ];
 try{
  for(const [data,expected] of cases){
   const node=w.document.createElement('div');node.className='card';node.innerHTML='<div class="card__view"></div>';node.getBoundingClientRect=()=>({width:100,top:0,bottom:150,left:0});w.document.body.appendChild(node);
   const item={data,render:()=>node};listener({type:'append',items:[item]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));listener({type:'visible',items:[item]});w.document.dispatchEvent(new w.Event('minimal:catalogue-idle'));
   const badges=node.querySelectorAll('.pt-kind');assert.equal(badges.length,expected?1:0,data.title || data.name);if(expected)assert.equal(badges[0].textContent,expected);
  }
  assert.equal(requests,0,'Type badges need no extra metadata requests');
 }finally{w.close();}
});
