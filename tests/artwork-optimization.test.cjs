const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function assets(){
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,images=[];
 w.Image=class{constructor(){images.push(this);this.naturalWidth=1920;this.naturalHeight=1080;}set src(v){this.url=v;}get src(){return this.url;}decode(){return Promise.resolve();}};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/hero-assets.js')],bundle:true,write:false,format:'iife',globalName:'Assets'}).outputFiles[0].text);
 const cards=[{backdrop_path:'/a.jpg'},{backdrop_path:'/b.jpg'},{backdrop_path:'/a.jpg'},{backdrop_path:'/c.jpg'}];
 const api=w.Assets.default({TMDB:{image:p=>'https://images.test'+p}},cards,(_,ok)=>ok(''));
 return {w,images,api,close(){api.dispose();w.close();}};
}
test('banner requests share actual URLs, cancel obsolete originals and retain two decoded full-size selections',async()=>{
 const n=assets(),{api,images}=n;
 try{
  let stale=0,shared=0;
  api.cover(0,'original',()=>stale++);const late=images[0].onload;
  api.select(1);assert.equal(images[0].src,'','Switching cancels the obsolete full-size request');late();await wait(0);assert.equal(stale,0);
  api.cover(1,'original',()=>{});images[1].onload();await wait(0);
  api.cover(0,'original',()=>{});images[2].onload();await wait(0);
  api.cover(2,'original',()=>shared++);assert.equal(images.length,3,'Two slides with the same artwork use one decoded image');assert.equal(shared,1);
  api.cover(1,'original',()=>{});assert.equal(images.length,3,'Returning to the previous banner performs no image request or decode');
  api.cover(3,'original',()=>{});images[3].onload();await wait(0);
  assert.equal(api.ready(0,'original'),'','Oldest full-size selection is released beyond the working set');
  assert.ok(api.ready(1,'original') && api.ready(3,'original'));
 }finally{n.close();}
});
test('banner prefetch pauses while hidden and resumes once, without fetching full-size neighbours',async()=>{
 const n=assets(),{w,api,images}=n;let hidden=true;
 Object.defineProperty(w.document,'hidden',{get:()=>hidden,configurable:true});
 try{
  api.warm(0);await wait(1250);assert.equal(images.length,0);
  hidden=false;w.document.dispatchEvent(new w.Event('visibilitychange'));await wait(350);
  assert.equal(images.length,2);assert.ok(images.every(i=>i.url.includes('/w780/')));
  api.warm(0);await wait(1250);assert.equal(images.length,2,'Already warmed neighbours are reused');
 }finally{n.close();}
});
test('decoded banner memory pressure evicts old full-size images without reducing the selected source',async()=>{
 const n=assets(),{w,api,images}=n;w.document.body.classList.add('pt-tv');
 try{
  api.cover(0,'original',()=>{});images[0].naturalWidth=3840;images[0].naturalHeight=2160;images[0].onload();await wait(0);
  api.cover(1,'original',()=>{});images[1].naturalWidth=3840;images[1].naturalHeight=2160;images[1].onload();await wait(0);
  assert.equal(api.ready(0,'original'),'');assert.ok(api.ready(1,'original').includes('/original/'));
  assert.equal(images[0].src,'','Eviction releases the decoded image reference');
 }finally{n.close();}
});
test('desktop posters skip offscreen work, share active requests and paint cached covers while network slots are busy',async()=>{
 let observer;
 const n=await native({built:true,prepare(w){w.IntersectionObserver=class{constructor(fn){observer=fn;}observe(){}unobserve(){}};}}),{w,L}=n,loaders=[],cards=[];
 w.Image=class{constructor(){loaders.push(this);}set src(v){this.url=v;}get src(){return this.url;}};
 const Card=L.Maker.get('Card',{});
 function card(id,poster,onscreen=true){
  const c=L.Utils.createInstance(Card,{id,title:'Film',poster_path:poster,source:'tmdb'});c.create();const node=c.render(true);w.document.body.appendChild(node);c.onscreen=onscreen;
  node.getBoundingClientRect=()=>({width:120,height:180,left:0,right:120,top:c.onscreen?0:4000,bottom:c.onscreen?180:4180});
  c.visible();cards.push(c);return c;
 }
 try{
  const offscreen=card(1,'/offscreen.jpg',false),one=card(2,'/one.jpg');await wait(30);assert.equal(loaders.length,1);loaders[0].onload();
  card(3,'/two.jpg');card(4,'/three.jpg');card(5,'/four.jpg');await wait(30);assert.equal(loaders.length,4);
  const repeat=card(6,'/one.jpg'),shared=card(7,'/two.jpg');await wait(30);
  assert.equal(repeat.img.src,one.img.src,'A cached image must not wait behind three unrelated network requests');assert.equal(loaders.length,4);
  loaders[1].onload();assert.match(shared.img.src,/\/w500\/two.jpg$/,'Attach repeated covers to the same in-flight request');
  const before=repeat.img.src;
  L.SettingsApi.getParam('minimal_settings_appearance').find(p=>p.param.name==='minimal_banner_quality').onChange();
  assert.equal(repeat.img.src,before,'An unchanged quality refresh must not blank a loaded cover');assert.equal(loaders.length,4);
  offscreen.onscreen=true;observer([{target:offscreen.render(true),isIntersecting:true}]);await wait(30);assert.equal(loaders.length,5);
  assert.match(loaders[4].url,/offscreen.jpg$/);assert.deepEqual(n.errors,[]);
 }finally{cards.forEach(c=>c.destroy());n.close();}
});
