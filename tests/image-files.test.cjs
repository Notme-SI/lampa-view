const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/image-files.js')],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text;
const mod={exports:{}};new Function('module','exports',code)(mod,mod.exports);
function fixture(limits){let calls=0,sequence=0;const revoked=[];const w={setTimeout,clearTimeout,AbortController,URL:{createObjectURL:()=> 'blob:test-'+(++sequence),revokeObjectURL:value=>revoked.push(value)},fetch:async()=>{calls++;return {ok:true,blob:async()=>({size:60,type:'image/jpeg'})};}};const cache=mod.exports.createImageFiles(w,limits);return {cache,revoked,calls:()=>calls};}
const url=n=>'https://images.test/t/p/original/'+n+'.jpg';
test('compressed sources share in-flight requests and synchronous cache hits without a second fetch',async()=>{
 const n=fixture();let a,b,c;
 const release=n.cache.load(url(1),value=>a=value),other=n.cache.load(url(1),value=>b=value);
 await new Promise(r=>setTimeout(r,10));assert.equal(n.calls(),1);assert.equal(a,b);release();other();
 const again=n.cache.load(url(1),value=>c=value);assert.equal(c,a,'Returning screens get the ready blob synchronously');assert.equal(n.cache.peek(url(1)),a,'A new hero can reuse ready source bytes without another decode preloader');assert.equal(n.calls(),1);again();
});
test('compressed LRU is bounded and revokes inactive object URLs after decoded owners release them',async()=>{
 const n=fixture({memory:100});const first=n.cache.load(url(1),()=>{});await new Promise(r=>setTimeout(r,5));first();
 const second=n.cache.load(url(2),()=>{});await new Promise(r=>setTimeout(r,5));second();
 assert.ok(n.cache.size().bytes<=100);assert.equal(n.cache.has(url(1)),false);assert.ok(n.revoked.includes('blob:test-1'));
});
test('failed or blocked fetches fall back to native image loading without caching a broken result',async()=>{
 let calls=0;const w={setTimeout,clearTimeout,URL:{createObjectURL(){throw Error('not reached');}},fetch:async()=>{calls++;throw Error('CORS');}};
 const cache=mod.exports.createImageFiles(w);let value;const release=cache.load(url(1),v=>value=v);await new Promise(r=>setTimeout(r,5));assert.equal(value,url(1));assert.equal(cache.has(url(1)),false);assert.equal(calls,1);release();
});

test('a corrupt decoded image removes its downloaded source so a later selection can retry',async()=>{
 const n=fixture();const release=n.cache.load(url(1),()=>{});await new Promise(r=>setTimeout(r,5));n.cache.invalidate(url(1));assert.equal(n.cache.has(url(1)),false);release();assert.ok(n.revoked.includes('blob:test-1'));
 const retry=n.cache.load(url(1),()=>{});await new Promise(r=>setTimeout(r,5));assert.equal(n.calls(),2);retry();
});
