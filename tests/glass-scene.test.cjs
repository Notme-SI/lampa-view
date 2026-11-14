const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
const {JSDOM}=require('jsdom');
test('TV palette sampling reuses pending and cached results and releases its reduced bitmap',async()=>{
 const dom=new JSDOM('<body class="pt-tv"><div class="activity--active"><img class="pt-hero__image" src="https://image.example/t/p/original/cover.jpg"></div></body>',{runScripts:'outside-only'}),w=dom.window;
 try{
  const image=w.document.querySelector('img');
  for(const [key,value]of Object.entries({complete:true,naturalWidth:3840,naturalHeight:2160}))Object.defineProperty(image,key,{value});
  let sampled=0,draws=0,closed=0;
  w.createImageBitmap=async(source,options)=>{assert.equal(source,image);assert.deepEqual({...options},{resizeWidth:24,resizeHeight:16,resizeQuality:'low'});sampled++;return {width:24,height:16,close(){closed++;}};};
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(source){assert.equal(source.width,24);draws++;},getImageData(){return {data:new Uint8ClampedArray(24*16*4).fill(160)};}});
  const activity={component:'main'},L={Activity:{active:()=>activity,all:()=>[activity]},Storage:{get:(name,fallback)=>fallback,listener:{follow(){}}},Listener:{follow(){}}};
  const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/glass-scene.js')],bundle:true,write:false,format:'iife',globalName:'Scene'}).outputFiles[0].text;w.eval(bundle);
  w.Scene.default(L,()=>true);
  image.dispatchEvent(new w.Event('load'));
  image.dispatchEvent(new w.Event('load'));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(sampled,1);assert.equal(draws,1);assert.equal(closed,1);
  image.dispatchEvent(new w.Event('load'));await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(sampled,1,'A loaded banner uses its existing palette before any new canvas read');
  assert.ok(w.document.body.style.getPropertyValue('--pt-scene-rgb'));
 }finally{w.close();}
});
