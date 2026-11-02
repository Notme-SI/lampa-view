const assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
const png=new (require('@resvg/resvg-js').Resvg)('<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1170"><rect width="780" height="1170" fill="#184052"/></svg>').render().asPng();
const moduleCode=esbuild.buildSync({entryPoints:[path.join(__dirname,'../../src/image-files.js')],bundle:true,format:'iife',globalName:'Files',write:false}).outputFiles[0].text;
const heroCode=esbuild.buildSync({entryPoints:[path.join(__dirname,'../../src/hero-assets.js')],bundle:true,format:'iife',globalName:'HeroAssets',write:false}).outputFiles[0].text;
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{
 const r=await setup(browser,{viewport:{width:960,height:540},deviceScaleFactor:2,mode:'tv'},{beforePlugin:page=>page.evaluate(()=>{for(const api of [Lampa.TMDB,Lampa.Api.sources.tmdb,Lampa.Api.sources.cub])api.img=(p,size)=>'http://lampa.example.invalid/image/t/p/'+(size || 'w780')+p;})}),{page}=r;const calls=new Map(),failed=[];page.on('requestfailed',request=>{if(failed.length<8)failed.push({url:request.url(),error:request.failure()});});
 await page.route(/^blob:/,route=>route.continue());
 await page.route('**/image/t/p/**',route=>{const url=route.request().url();calls.set(url,(calls.get(url)||0)+1);return route.fulfill({contentType:'image/png',headers:{'cache-control':'no-store'},body:png});});
 await page.evaluate(()=>{window.qaCards=[];window.makeCover=(id,top=100)=>{const c=Lampa.Utils.createInstance(Lampa.Maker.get('Card',{}),{id,title:'Film',poster_path:'/cache'+id+'.jpg',source:'tmdb'});c.create();const n=c.render(true);n.style.cssText='position:fixed;left:40px;top:'+top+'px;width:120px';document.body.appendChild(n);c.visible();qaCards.push(c);return c;};for(let i=1;i<=25;i++)makeCover(i);});
 try{await page.waitForFunction(()=>qaCards.every(c=>c.img.src.startsWith('blob:') && c.img.complete && c.img.naturalWidth>0),null,{timeout:15000});}catch(e){console.log(await page.evaluate(()=>qaCards.slice(0,3).map(c=>({src:c.img.src,width:c.img.naturalWidth,path:c.getPosterPath()}))),[...calls],failed);throw e;}
 await page.evaluate(()=>{document.body.classList.add('pt-tv-busy','pt-wheel-active');makeCover(26,innerHeight+300);});
 await page.waitForFunction(()=>qaCards[25].img.src.startsWith('blob:') && qaCards[25].img.complete && qaCards[25].img.naturalWidth>0);
 assert.equal(calls.size,26);assert.ok([...calls.values()].every(n=>n===1),'Fetch once: decoding and DOM paint use the downloaded source, even with no-store');
 await page.evaluate(()=>{for(const c of qaCards){const n=c.render(true);c.destroy();n.remove();}qaCards=[];makeCover(1);});
 await page.waitForFunction(()=>qaCards[0].img.src.startsWith('blob:') && qaCards[0].img.complete);
 assert.equal([...calls.values()].reduce((a,b)=>a+b,0),26,'Returning after decoded memory eviction performs no network request');
 assert.equal(await page.evaluate(()=>qaCards[0].getPosterPath()),await page.locator('.card__img').last().getAttribute('src'),'Native visibility does not replace a cached blob with a placeholder');
 // A fresh JS context in the same origin must reuse IndexedDB source bytes.
 await page.waitForTimeout(900);await page.waitForFunction(async()=>new Promise(resolve=>{const open=indexedDB.open('lampa-view-artwork',1);open.onsuccess=()=>{const db=open.result;const get=db.transaction('files').objectStore('files').get('http://lampa.example.invalid/image/t/p/w780/cache1.jpg');get.onsuccess=()=>{resolve(Boolean(get.result));db.close();};get.onerror=()=>{resolve(false);db.close();};};open.onerror=()=>resolve(false);}),null,{timeout:5000});await page.reload();await page.addScriptTag({content:moduleCode});await page.evaluate(()=>{window.qaFiles=Files.createImageFiles(window);window.qaCached='';});await page.waitForFunction(()=>qaFiles.has('http://lampa.example.invalid/image/t/p/w780/cache1.jpg'));assert.equal(await page.evaluate(()=>qaFiles.size().entries),0,'Disk index identifies a cache hit before decoding or allocating an image');await page.evaluate(()=>qaFiles.load('http://lampa.example.invalid/image/t/p/w780/cache1.jpg',src=>qaCached=src));await page.waitForFunction(()=>qaCached.startsWith('blob:'));
 assert.equal([...calls.values()].reduce((a,b)=>a+b,0),26,'A page reload also reuses the persisted original bytes');
 // Drive carousel-specific decoded eviction and compressed source pressure.
 // Old code retained revoked blob URLs in its separate logo/studio maps.
 const coverPng=new (require('@resvg/resvg-js').Resvg)('<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160"><rect width="3840" height="2160" fill="#294755"/></svg>').render().asPng();
 const heavyCover=Buffer.concat([coverPng,Buffer.alloc(5*1024*1024)]);
 await page.route('**/branding/t/p/**',route=>route.fulfill({contentType:'image/png',body:route.request().url().includes('/cover')?heavyCover:png}));
 await page.addScriptTag({content:heroCode});
 await page.evaluate(()=>{
  document.body.innerHTML='<img id="qa-cover"><img id="qa-logo"><img id="qa-studio">';
  const cards=Array.from({length:8},(_,id)=>({id,backdrop_path:'/cover'+id+'.png'}));
  window.qaHero=HeroAssets.default({TMDB:{image:p=>'http://lampa.example.invalid/branding'+p}},cards,(card,ok)=>ok('/logo'+card.id+'.png',{path:'/studio'+card.id+'.png',name:'Studio '+card.id},'ru'));
  window.qaSelect=i=>{qaHero.cover(i,'original',url=>document.querySelector('#qa-cover').src=url);qaHero.logo(i,url=>document.querySelector('#qa-logo').src=url);qaHero.studio(i,value=>document.querySelector('#qa-studio').src=value?value.url:'');};
 });
 for(const i of [0,1,2,3,4,5,6,7,0,7,0]){
  await page.evaluate(i=>{for(const img of document.querySelectorAll('img'))img.removeAttribute('src');qaSelect(i);},i);
  await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(img=>img.hasAttribute('src') && img.complete && img.naturalWidth>0),null,{timeout:15000});
 }
 await page.evaluate(()=>qaHero.dispose());
 assert.deepEqual(r.errors,[]);await r.context.close();console.log(engine.name()+': one fetch, decoded eviction, remount, persisted reload and carousel branding eviction passed');
 }finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
