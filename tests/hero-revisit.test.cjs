const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
test('decoded banners and branding survive carousel destruction without retaining obsolete requests',async()=>{
 const dom=new JSDOM('<body class="pt-tv"></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,images=[];
 w.Image=class{constructor(){images.push(this);this.naturalWidth=1280;this.naturalHeight=720;}set src(v){this.url=v;}get src(){return this.url;}decode(){return Promise.resolve();}};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/hero-assets.js')],bundle:true,write:false,format:'iife',globalName:'Assets'}).outputFiles[0].text);
 const L={TMDB:{image:p=>'http://images.test'+p}},cards=[{id:1,backdrop_path:'/one.jpg'},{id:2,backdrop_path:'/two.jpg'}],load=(c,ok)=>ok('/title.png');
 let first=w.Assets.default(L,cards,load),shown;
 first.cover(0,'w1280',u=>shown=u);images[0].onload();await new Promise(r=>setTimeout(r,0));
 first.logo(0,()=>{});images[1].onload();await new Promise(r=>setTimeout(r,0));
 first.cover(1,'w1280',()=>assert.fail('Disposed request must not paint'));const late=images[2].onload;
 first.dispose();late();await new Promise(r=>setTimeout(r,0));
 assert.equal(images[0].src,shown,'Successful decoded cover remains bounded in the shared pool');assert.equal(images[2].src,'','Unfinished request is cancelled');
 const second=w.Assets.default(L,cards,load);assert.equal(second.ready(0,'w1280'),shown);
 second.cover(0,'w1280',u=>assert.equal(u,shown));second.logo(0,u=>assert.match(u,/title.png/));
 assert.equal(images.length,3,'Reopening creates no extra Image or decode for cached cover and logo');
 second.dispose();
 const third=w.Assets.default(L,cards,load);let called=0;
 third.cover(1,'w1280',()=>assert.fail('Destroyed screen must not receive a shared result'));
 const loader=images[3],fourth=w.Assets.default(L,cards,load);fourth.cover(1,'w1280',()=>called++);
 third.dispose();loader.onload();await new Promise(r=>setTimeout(r,0));
 assert.equal(called,1,'Another live screen keeps a shared in-flight request alive');assert.equal(images.length,4);
 fourth.dispose();w.close();
});

for(const tv of [false,true])test('branding rehydrates after bounded decoded cache eviction: '+(tv?'TV':'desktop'),async()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,images=[];if(tv)w.document.body.classList.add('pt-tv');
 w.Image=class{constructor(){images.push(this);this.naturalWidth=1200;this.naturalHeight=400;}set src(v){this.url=v;}get src(){return this.url;}decode(){return Promise.resolve();}};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/hero-assets.js')],bundle:true,write:false,format:'iife',globalName:'Assets'}).outputFiles[0].text);
 const cards=Array.from({length:8},(_,id)=>({id,backdrop_path:'/cover'+id+'.jpg'})),L={TMDB:{image:p=>'http://images.test'+p}},requests=[],assets=w.Assets.default(L,cards,(card,ok)=>{requests.push(card.id);ok('/logo'+card.id+'.png',{path:'/studio'+card.id+'.png',name:'Studio '+card.id},'ru');});
 const complete=async()=>{for(const image of images)if(image.onload){image.onload();await new Promise(r=>setTimeout(r,0));}};
 try{for(let i=0;i<8;i++){assets.cover(i,'original',()=>{});const cover=images.at(-1);cover.naturalWidth=3840;cover.naturalHeight=2160;await complete();assets.logo(i,()=>{});assets.studio(i,()=>{});await complete();assert.ok(images.find(image=>image.src.endsWith('/logo'+i+'.png')),'current title is retained');assert.ok(images.find(image=>image.src.endsWith('/studio'+i+'.png')),'current studio is retained');}
  assert.ok(!images.some(image=>image.src.endsWith('/logo0.png')),'old decoded branding is actually evicted');assets.select(0);let logo,studio;const count=images.length;assets.logo(0,url=>logo=url);assets.studio(0,value=>studio=value);assert.equal(images.length,count+2,'canonical metadata reopens evicted assets instead of returning stale blob references');assert.equal(logo,undefined);await complete();assert.match(logo,/logo0.png$/);assert.equal(studio.name,'Studio 0');assert.equal(requests.filter(id=>id===0).length,1,'metadata is reused');
 }finally{assets.dispose();w.close();}
});
