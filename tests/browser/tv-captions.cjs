const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true,...(engine===chromium?{args:['--blink-settings=minimumFontSize=8']}: {})});try{
 for(const width of [960,1280,1920]){
  const r=await setup(browser,{viewport:{width,height:Math.round(width*9/16)},deviceScaleFactor:2,mode:'tv'},{beforePlugin:page=>page.evaluate(()=>{Lampa.Params.init();Lampa.Layer.init();})}),{page}=r;
  await page.evaluate(()=>{
   document.body.classList.add('platform--android','light--version','advanced--animation');
   const line=document.createElement('div');line.className='items-line';line.id='qa-tv-captions';line.style.cssText='position:fixed;top:80px;left:40px;width:90vw';
   const grid=document.createElement('div');grid.className='category-full';grid.style.cssText='position:fixed;top:400px;left:40px;width:90vw';document.body.appendChild(line);document.body.appendChild(grid);
   const items=[];
   for(const parent of [line,grid])for(const title of ['Очень длинное название сериала, которое занимает две строки','Коротко']){
    const card=document.createElement('div');card.className='card';card.innerHTML='<div class="card__view"></div><div class="card__title"></div><div class="card__age">2025</div>';parent.appendChild(card);
    const data={id:740001+items.length,title,original_title:title,release_date:'2025-01-01',source:'test',release_quality:'4K'};items.push({data,render:()=>card});
   }
   window.qaCaptionItems=items;Lampa.Listener.send('line',{type:'visible',data:{results:items.map(i=>i.data)},items});
  });
  for(const size of ['small','normal','bigger','normal']){
   await page.evaluate(size=>Lampa.Storage.set('interface_size',size),size);await page.waitForTimeout(350);
   // Schedule legacy history and ordinary row cards through real native events.
   await page.evaluate(()=>Lampa.Listener.send('line',{type:'visible',data:{results:qaCaptionItems.map(i=>i.data)},items:qaCaptionItems}));await page.waitForTimeout(180);
   const values=await page.locator('#qa-tv-captions .card,.category-full .card').evaluateAll(cards=>cards.map(card=>{
    const t=card.querySelector('.card__title'),y=card.querySelector('.card__age'),s=getComputedStyle(t),a=t.getBoundingClientRect(),b=y.getBoundingClientRect();
    return {text:t.textContent,height:a.height,line:parseFloat(s.lineHeight),gap:b.top-a.bottom,display:s.display};
   }));
   assert.equal(values.length,4);
   for(const v of values){const lines=v.text==='Коротко'?1:2;assert.ok(v.height>=v.line*(lines-.06) && v.height<=v.line*(lines+.08),'Full title lines '+JSON.stringify({size,width,v}));assert.ok(v.gap>=0 && v.gap<8,'Year immediately below '+JSON.stringify({size,width,v}));if(size!=='bigger')assert.equal(v.display,'block');}
  }
  assert.deepEqual(r.errors,[]);await r.context.close();console.log(engine.name()+' '+width+': TV row/history, all sizes and resizing passed');
 }
 }finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
