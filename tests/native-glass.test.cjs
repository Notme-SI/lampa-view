const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/appearance.js')],bundle:true,write:false,loader:{'.css':'text'},format:'iife',globalName:'Appearance'}).outputFiles[0].text;
test('TV uses native glass and opacity without sampling artwork or overwriting native preferences',async()=>{
 const d=new JSDOM('<head><style>body.glass--style .settings__content{background-color:rgba(70,70,70,.3);backdrop-filter:blur(1.6em)}body.glass--style-opacity--blacked .settings__content{background-color:rgba(56,56,56,.7)}</style></head><body class="lampa_view pt-tv"><img class="pt-hero__image" src="/poster.jpg"></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;
 const values={lampa_view_theme:'glass',lampa_view_enabled:true,glass_style:false,glass_opacity:'blacked'},writes=[];let draws=0;
 const L={Storage:{get:(k,f)=>values[k]??f,field:k=>values[k],set:(k,v)=>{writes.push(k);values[k]=v;}}};
 const image=w.document.querySelector('img');Object.defineProperties(image,{complete:{value:true},naturalWidth:{value:1280}});w.HTMLCanvasElement.prototype.getContext=()=>{draws++;return null;};w.eval(code);
 try{const api=w.Appearance.default(L);image.dispatchEvent(new w.Event('load'));await new Promise(r=>setTimeout(r,20));
  assert.ok(w.document.body.classList.contains('pt-native-glass'));assert.ok(!w.document.body.classList.contains('pt-theme-glass'));assert.ok(w.document.body.classList.contains('glass--style-opacity--blacked'));assert.equal(draws,0);assert.equal(w.document.body.style.getPropertyValue('--pt-glass-scene'),'');assert.deepEqual(writes,[]);
  w.document.body.classList.replace('pt-tv','pt-desktop');api.update();assert.ok(w.document.body.classList.contains('pt-theme-glass'));assert.equal(w.document.getElementById('lampa-view-native-glass').media,'not all');
  w.document.body.classList.replace('pt-desktop','pt-tv');api.update();const before=draws;image.dispatchEvent(new w.Event('load'));await new Promise(r=>setTimeout(r,20));assert.equal(draws,before);assert.equal(w.document.querySelectorAll('#lampa-view-native-glass').length,1);
  values.lampa_view_enabled=false;api.update();assert.ok(!w.document.body.classList.contains('pt-native-glass'));assert.ok(!w.document.body.classList.contains('glass--style'));assert.equal(values.glass_opacity,'blacked');assert.equal(values.glass_style,false);assert.deepEqual(writes,[]);
 }finally{w.close();}
});
