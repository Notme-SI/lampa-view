const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:['src/transient-cache.js'],bundle:true,write:false,format:'iife',globalName:'Caches'}).outputFiles[0].text;
test('metadata migration shrinks native backup and preserves all user state',()=>{
 const dom=new JSDOM('',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
 try{const key='minimal_catalogue_cache_v1',metadata=[{title:'test'}];w.localStorage.setItem(key,JSON.stringify(metadata));w.localStorage.setItem('timeline','history');w.localStorage.setItem('player','other');w.eval(code);
 const L={Storage:{get:(key,fallback)=>JSON.parse(w.localStorage.getItem(key) || JSON.stringify(fallback))}};
 assert.equal(JSON.stringify(w.Caches.readCache(L,key)),JSON.stringify(metadata));
 assert.equal(w.localStorage.getItem(key),null);assert.equal(w.localStorage.getItem('timeline'),'history');assert.equal(w.localStorage.getItem('player'),'other');assert.equal(w.sessionStorage.getItem(key),JSON.stringify(metadata));
 assert.throws(()=>w.Caches.writeCache(L,'timeline',[]),/Unknown/);
 }finally{w.close();}
});
