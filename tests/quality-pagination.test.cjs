const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('grid cards beyond 120 and detached filter cards acquire quality when scrolled into view, including empty native slots',async()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window,requests=[],listeners={},entries=[];
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text);
 function Card(data){this.data=data;this.hooks=[];this.use=hook=>this.hooks.push(hook);this.node=w.document.createElement('div');this.node.className='card';this.node.innerHTML='<div class="card__view"><div class="card__quality"></div></div>';this.visible=false;this.node.getBoundingClientRect=()=>({width:120,left:0,right:120,top:this.visible?0:5000,bottom:this.visible?180:5180});this.render=()=>this.node;}
 const L={Storage:{get:(key,def)=>key==='jackett_url'?'http://parser.test':def},Listener:{follow:(key,fn)=>listeners[key]=fn},Utils:{createInstance:(Base,data)=>new Base(data)},Maker:{get:()=>Card},Reguest:function(){this.timeout=()=>{};this.silent=(url,success)=>requests.push({url,success});}};
 w.Quality.default(L);
 try{
  for(let i=0;i<161;i++){const item=L.Utils.createInstance(Card,{title:'Movie '+i,release_date:'2020-01-01'});entries.push(item);if(i!==160)w.document.body.appendChild(item.node);}
  await sleep(20);assert.equal(requests.length,0,'offscreen cards requested');
  const late=entries[140];late.visible=true;w.document.dispatchEvent(new w.Event('scroll'));
  await sleep(150);assert.equal(requests.length,1,'later grid page was forgotten');requests[0].success({Results:[{Title:'Movie 140 (2020) WEB-DL 1080p'}]});
  assert.equal(late.node.querySelector('.pt-quality').textContent,'1080p');
  const filtered=entries[160];filtered.visible=true;w.document.body.appendChild(filtered.node);w.document.dispatchEvent(new w.Event('scroll'));
  await sleep(150);assert.equal(requests.length,2,'detached filter result was forgotten');requests[1].success({Results:[{Title:'Movie 160 (2020) WEB-DL 2160p'}]});assert.equal(filtered.node.querySelector('.pt-quality').textContent,'4K');
  for(const hook of filtered.hooks)if(hook.onDestroy)hook.onDestroy();filtered.node.getBoundingClientRect=()=>assert.fail('destroyed item is still observed');w.document.dispatchEvent(new w.Event('scroll'));await sleep(150);
 }finally{dom.window.close();}
});
test('intersection changes revisit cards without additional native visible events',async()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;let intersection,follow,requests=0,observed;
 w.IntersectionObserver=class{constructor(fn){intersection=fn;}observe(node){observed=node;}unobserve(){}};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text);
 w.Quality.default({Listener:{follow:(key,fn)=>follow=fn},Storage:{get:(key,def)=>key==='jackett_url'?'http://parser.test':def},Reguest:function(){this.timeout=()=>{};this.silent=()=>requests++;}});
 const node=w.document.createElement('div');node.className='card';node.innerHTML='<div class="card__view"></div>';let visible=false;node.getBoundingClientRect=()=>({width:100,left:0,right:100,top:visible?0:4000,bottom:visible?150:4150});w.document.body.appendChild(node);
 try{follow({type:'append',items:[{data:{title:'Film',release_date:'2020'},render:()=>node}]});assert.equal(observed,node);assert.equal(requests,0);visible=true;intersection([{target:node,isIntersecting:true}]);await sleep(15);assert.equal(requests,1);}finally{dom.window.close();}
});
test('studio artwork retains original colors and opaque backgrounds instead of being flattened white',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../src/theme.css'),'utf8');
 for(const name of ['pt-hero__studio','minimal-detail-studio']){const rule=css.match(new RegExp('body\\.lampa_view \\.'+name+' \\{([^}]+)\\}'))[1];assert.ok(!rule.includes('brightness(0)'));assert.ok(!rule.includes('invert(1)'));assert.ok(rule.includes('drop-shadow'));}
});
