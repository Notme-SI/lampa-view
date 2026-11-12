const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
const png=new (require('@resvg/resvg-js').Resvg)('<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1170"><rect width="780" height="1170" fill="#294755"/></svg>').render().asPng();
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv','mobile']){
 const width=mode==='mobile'?390:mode==='tv'?960:1440,height=mode==='tv'?540:900,count=mode==='mobile'?2:mode==='tv'?6:9;
 const r=await setup(browser,{viewport:{width,height},mode},{beforePlugin:page=>page.evaluate(()=>{for(const api of [Lampa.TMDB,Lampa.Api.sources.tmdb,Lampa.Api.sources.cub])api.img=(p,size)=>'http://lampa.example.invalid/image/t/p/'+(size || 'w780')+p;})}),{page}=r;
 const calls=new Map();let releaseFirst;
 try{
  await page.route('**/image/t/p/**',async route=>{const url=route.request().url();calls.set(url,(calls.get(url)||0)+1);if(url.endsWith('/ahead0.jpg'))return new Promise(resolve=>{releaseFirst=async()=>{await route.fulfill({contentType:'image/png',headers:{'cache-control':'no-store'},body:png});resolve();};});await new Promise(resolve=>setTimeout(resolve,120));return route.fulfill({contentType:'image/png',headers:{'cache-control':'no-store'},body:png});});
  await page.evaluate(count=>{document.body.classList.add('pt-wheel-active');window.qaAhead=[];window.makeAhead=i=>{const card=Lampa.Utils.createInstance(Lampa.Maker.get('Card',{}),{id:2000+i,title:'Ahead '+i,poster_path:'/ahead'+i+'.jpg',source:'tmdb'});card.create();const node=card.render(true);node.style.cssText='position:fixed;left:'+(i*100)+'px;top:'+(innerHeight+140)+'px;width:90px';document.body.appendChild(node);card.visible();qaAhead.push(card);};for(let i=0;i<count;i++)makeAhead(i);},count);
  await page.waitForFunction(()=>qaAhead.slice(1).every(c=>c.img.complete && c.img.naturalWidth>1),null,{timeout:5000});
  assert.ok(releaseFirst,'The first stalled request is still in flight');assert.equal(calls.size,count);assert.ok([...calls.values()].every(n=>n===1));
  await page.evaluate(()=>qaAhead.forEach((c,i)=>{c.render(true).style.top='100px';if(i)c.visible();}));
  assert.ok(await page.evaluate(()=>qaAhead.slice(1).every(c=>c.img.complete && c.img.naturalWidth>1)),'Prepared covers remain decoded when the row reaches the viewport');
  await releaseFirst();await page.waitForFunction(()=>qaAhead[0].img.complete && qaAhead[0].img.naturalWidth>1);
  await page.evaluate(()=>{qaAhead.forEach(c=>{const node=c.render(true);c.destroy();node.remove();});qaAhead=[];makeAhead(1);});await page.waitForFunction(()=>qaAhead[0].img.complete && qaAhead[0].img.naturalWidth>1);
  assert.equal([...calls.values()].reduce((a,b)=>a+b,0),count,'Returning to a prepared poster reuses its file instead of downloading again');assert.deepEqual(r.errors,[]);
  if(mode==='desktop'){
   await page.evaluate(()=>{
    const root=document.createElement('section'),grid=document.createElement('div');
    root.className='activity--active';grid.className='mapping--grid';
    root.style.cssText='position:fixed;top:'+(innerHeight+100)+'px;left:100px;width:600px';
    root.appendChild(grid);document.body.appendChild(root);
    const card=Lampa.Utils.createInstance(Lampa.Maker.get('Card',{}),{id:9000,title:'Next grid poster',source:'tmdb',poster_path:'/direct-grid.jpg'});
    card.create();grid.appendChild(card.render(true));window.qaGrid=card;
   });
   await page.waitForFunction(()=>qaGrid.img.complete && qaGrid.img.naturalWidth>1,null,{timeout:5000});
   const cover=await page.evaluate(()=>({source:qaGrid.img.currentSrc,decoding:qaGrid.img.decoding,loading:qaGrid.img.loading}));
   assert.match(cover.source,/\/t\/p\/w500\/direct-grid\.jpg$/,'Grid assigns a native display-sized URL before native visibility');
   assert.equal(cover.decoding,'async');assert.equal(cover.loading,'lazy');
   await page.evaluate(()=>qaGrid.visible());
   assert.equal(await page.evaluate(()=>qaGrid.img.fetchPriority),'high');
   assert.equal([...calls].filter(([url])=>url.endsWith('/direct-grid.jpg')).length,1);
  }
  console.log(engine.name()+' '+mode+': next row prepares during scrolling despite a stalled cover; return reuses cache');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
