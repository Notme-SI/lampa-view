const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/appearance.js')],bundle:true,write:false,loader:{'.css':'text'},format:'iife',globalName:'Appearance'}).outputFiles[0].text;
test('all layouts use the selected material without sampling artwork or changing saved host preferences',async()=>{
 const d=new JSDOM('<body class="lampa_view"><img class="pt-hero__image" src="/poster.jpg"></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;
 const values={lampa_view_theme:'glass',lampa_view_enabled:true,glass_style:true,glass_opacity:'blacked'},writes=[];
 const L={Storage:{get:(k,f)=>values[k]??f,field:k=>values[k],set:(k,v)=>{writes.push(k);values[k]=v;}}};
 let draws=0;w.HTMLCanvasElement.prototype.getContext=()=>{draws++;return null;};w.eval(code);
 try{
  const api=w.Appearance.default(L);
  for(const mode of ['tv','desktop','mobile','tablet']){
   w.document.body.className='lampa_view pt-'+mode;values.lampa_view_theme='glass';api.update();
   assert.ok(w.document.body.classList.contains('pt-theme-glass'));assert.ok(!w.document.body.classList.contains('pt-native-glass'));
   w.document.querySelector('img').dispatchEvent(new w.Event('load'));await new Promise(r=>setTimeout(r,10));assert.equal(draws,0);
   values.lampa_view_theme='minimal';api.update();assert.ok(!w.document.body.classList.contains('glass--style'),'Dark must override native glass even when its saved preference is on');
   assert.equal(w.document.body.dataset.lampaTheme,'minimal');
  }
  values.lampa_view_enabled=false;api.update();assert.ok(w.document.body.classList.contains('glass--style'));assert.ok(w.document.body.classList.contains('glass--style-opacity--blacked'));
  assert.deepEqual(writes,[]);assert.equal(values.glass_style,true);assert.equal(values.glass_opacity,'blacked');
 }finally{w.close();}
});
