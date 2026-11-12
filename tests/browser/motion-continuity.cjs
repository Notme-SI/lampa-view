// Usage: node tests/browser/motion-continuity.cjs BASELINE.js [CANDIDATE.js]
// JSON goes to stdout; this profiler never overwrites either bundle or fixtures.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup:nativeSetup}=require('../fixtures/native-browser.cjs');
const response=require('../fixtures/discovery-response.cjs');
async function setup(...args){
 const r=await nativeSetup(...args),rate=Number(process.env.MOTION_CPU_RATE)||1;
 if(rate>1){const session=await r.context.newCDPSession(r.page);await session.send('Emulation.setCPUThrottlingRate',{rate});}
 return r;
}

function stats(values){
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
 return {count:sorted.length,p95:sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]:null,max:sorted.length?sorted.at(-1):null};
}
async function startTrace(page,kind){
 await page.evaluate(kind=>{
  const view=()=>kind==='rail'?document.querySelector('.activity--active .pt-overlay-row .scroll--horizontal'):document.querySelector('.activity--active .pt-browser-catalogue');
  const samples=[],inputs=[],longtasks=[];let frame=0,stopped=false;
  function state(){
   const node=view(),body=node?.querySelector('.scroll__body'),focused=document.querySelector('.activity--active .card.focus');
   const transform=body?getComputedStyle(body).transform:'none';
   return {position:kind==='rail'?(transform==='none'?0:new DOMMatrixReadOnly(transform).m41):node?.scrollTop || 0,
    native:node?.Scroll?.position?.() ?? null,focus:focused?Array.prototype.indexOf.call(focused.parentElement.children,focused):-1};
  }
  const read=time=>{if(stopped)return;samples.push({time,...state()});frame=requestAnimationFrame(read);};
  const observer=typeof PerformanceObserver==='function' && PerformanceObserver.supportedEntryTypes?.includes('longtask')?new PerformanceObserver(list=>longtasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))):null;
  observer?.observe({type:'longtask'});frame=requestAnimationFrame(read);
  window.qaMotion={mark(label){inputs.push({label,time:performance.now(),before:state()});},finish(){
   stopped=true;cancelAnimationFrame(frame);if(observer){longtasks.push(...observer.takeRecords().map(e=>({start:e.startTime,duration:e.duration})));observer.disconnect();}
   return {samples,inputs,longtasks,longtaskSupported:Boolean(observer)};
  }};
 },kind);
 await page.waitForTimeout(60);
}
function summarize(trace){
 const {samples,inputs}=trace,intervals=samples.slice(1).map((s,i)=>s.time-samples[i].time);
 const steps=samples.slice(1).map((s,i)=>({time:s.time,delta:s.position-samples[i].position})).filter(s=>Math.abs(s.delta)>.01);
 const responses=inputs.map((input,i)=>{
  const end=inputs[i+1]?.time ?? Infinity;
  const next=samples.find(s=>s.time>=input.time && s.time<end && (Math.abs(s.position-input.before.position)>.1 || s.focus!==input.before.focus));
  return {label:input.label,delayMs:next?next.time-input.time:null};
 });
 return {framesMs:stats(intervals),movementStepsPx:stats(steps.map(s=>Math.abs(s.delta))),
  lastMovementSteps:steps.slice(-12).map(s=>s.delta),tailMaxStepPx:Math.max(0,...steps.slice(-12).map(s=>Math.abs(s.delta))),
  inputToFirstChangedFrameMs:stats(responses.map(s=>s.delayMs).filter(v=>v!==null)),responses,
  unresolvedInputs:responses.filter(s=>s.delayMs===null).map(s=>s.label),
  longtasksOver50Ms:trace.longtasks.filter(t=>t.duration>50),longtaskSupported:trace.longtaskSupported,
  first:samples[0],last:samples.at(-1)};
}
async function desktop(browser,plugin){
 const r=await setup(browser,{viewport:{width:1280,height:720},mode:'desktop',reducedMotion:'no-preference'},{plugin,beforePlugin:page=>page.evaluate(()=>{
  Lampa.Params.init();Lampa.Layer.init();Lampa.Storage.set('lampa_view_hero',false);Lampa.Storage.set('animation',true);
  Lampa.Api.main=(o,ok)=>ok(Array.from({length:3},(_,row)=>({title:'Motion row '+row,url:'qa/'+row,total_pages:2,
   results:Array.from({length:40},(_,n)=>({id:row*100+n+1,title:'Фильм '+n,poster_path:'/p.jpg',release_date:'2020-01-01',vote_average:8,source:'tmdb',media_type:'movie'}))})));
 })});
 try{
  const {page}=r;await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));
  const rail=page.locator('.activity--active .pt-overlay-row .scroll--horizontal').first();await rail.waitFor();await page.waitForFunction(()=>document.querySelector('.activity--active .pt-overlay-row .scroll--horizontal')?.Scroll?.minimalPosterFit?.width>0,null,{timeout:6000});await page.waitForTimeout(150);
  const fit=await rail.evaluate(n=>n.Scroll.minimalPosterFit);assert.ok(fit?.width>0,'The native row must be fitted before profiling');
  // A nonintegral pitch exposes an abrupt final snap without reaching bounds.
  const distance=(fit.width+fit.gap)*2.38;
  await startTrace(page,'rail');
  await rail.evaluate((node,distance)=>{
   window.qaMotion.mark('horizontal-wheel');
   node.querySelector('.card').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:Math.min(350,distance),deltaY:0}));
  },distance);
  await page.waitForFunction(()=>!document.body.classList.contains('pt-wheel-active'),null,{timeout:5000});
  await page.waitForTimeout(200);
  const trace=await page.evaluate(()=>qaMotion.finish()),summary=summarize(trace);
  const final=await rail.evaluate(node=>({position:node.Scroll.position(),preview:node.querySelector('.scroll__body').style.getPropertyValue('--pt-rail-preview'),pitch:node.Scroll.minimalPosterFit.width+node.Scroll.minimalPosterFit.gap}));
  assert.ok(final.position<0,'Horizontal wheel must move the row');assert.equal(final.preview,'','The rail must commit and clear its preview');
  summary.finalSlotErrorPx=Math.abs(final.position-Math.round(final.position/final.pitch)*final.pitch);
  assert.ok(summary.finalSlotErrorPx<1,'Settled rows retain complete poster slots');
  assert.deepEqual(r.errors,[]);return {...summary,errors:r.errors};
 }finally{await r.context.close();}
}
async function tv(browser,plugin){
 const r=await setup(browser,{viewport:{width:1280,height:520},mode:'tv',reducedMotion:'no-preference'},{plugin});
 try{
  const {page}=r;
  await page.evaluate(fixture=>{
   const L=Lampa;for(const api of ['Params','Layer','DeviceInput'])L[api].init();
   L.Controller.observe();L.Keypad.init();L.Keypad.enable();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
   L.Storage.set('animation',true);const data=eval('('+fixture+')');
   L.Api.sources.tmdb.get=(url,p,ok)=>setTimeout(()=>ok({...data(url,p.page),total_pages:12}),10);
   L.Api.full=(p,ok)=>setTimeout(()=>ok({movie:{id:p.id,title:'Motion detail',source:'tmdb',release_date:'2024-01-01',production_countries:[],production_companies:[],spoken_languages:[],genres:[],overview:'Back restoration'},persons:{cast:[],crew:[]},images:{logos:[]},videos:{results:[]},discuss:{result:[]}}),10);
   L.Activity.push({component:'category',url:'movie',source:'tmdb',page:1,title:'Motion catalogue'});
  },response.toString());
  const grid=page.locator('.activity--active .pt-browser-catalogue');await grid.locator('.card').first().waitFor({timeout:6000});
  await page.waitForTimeout(600);await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>document.querySelector('.activity--active .card.focus'));await page.waitForTimeout(400);
  await startTrace(page,'grid');
  // Repeated keydowns, including repeat=true after the first, use real Keypad.
  for(let i=0;i<15;i++){
   await page.evaluate(i=>qaMotion.mark('down-'+i),i);await page.keyboard.down('ArrowDown');await page.waitForTimeout(85);
  }
  await page.keyboard.up('ArrowDown');await page.waitForTimeout(220);
  for(let i=0;i<4;i++){
   await page.evaluate(i=>qaMotion.mark('reverse-up-'+i),i);await page.keyboard.down('ArrowUp');await page.waitForTimeout(85);
  }
  await page.keyboard.up('ArrowUp');await page.waitForTimeout(650);
  const trace=await page.evaluate(()=>qaMotion.finish()),summary=summarize(trace);
  const before=await grid.evaluate(node=>{
   const focused=node.querySelector('.card.focus'),a=node.getBoundingClientRect(),b=focused?.getBoundingClientRect();
   return {top:node.scrollTop,focus:focused?Array.prototype.indexOf.call(focused.parentElement.children,focused):-1,visible:!!b && b.top<a.bottom && b.bottom>a.top};
  });
  assert.ok(before.top>0,'Remote repeat must scroll the catalogue');assert.ok(before.visible,'The final focused card remains visible');
  const reverse=trace.samples.filter(s=>s.time>=trace.inputs.find(i=>i.label==='reverse-up-0').time);
  assert.ok(reverse.length>1 && reverse.at(-1).position<reverse[0].position,'Reversing the remote must reverse scroll direction');
  await page.evaluate(()=>Lampa.Activity.push({component:'full',id:123,source:'tmdb',method:'movie',card:{id:123,title:'Motion detail',source:'tmdb'}}));
  await page.waitForSelector('.activity--active .minimal-detail-header');await page.evaluate(()=>Lampa.Activity.backward());
  await grid.waitFor();await page.waitForTimeout(350);
  const restored=await grid.evaluate(node=>({top:node.scrollTop,focus:node.querySelector('.card.focus')?Array.prototype.indexOf.call(node.querySelector('.card.focus').parentElement.children,node.querySelector('.card.focus')):-1}));
  assert.ok(Math.abs(restored.top-before.top)<1,'Back restores the catalogue position');assert.equal(restored.focus,before.focus,'Back restores the same focused poster');
  // Reverse while the previous animation is still running, rather than only
  // after the 220 ms pause above. Direct controller calls bypass key repeat's
  // intentional debounce while exercising the real focus/scroll wrappers.
  await page.evaluate(()=>Lampa.Controller.enabled().controller.down());await page.waitForTimeout(35);
  await page.evaluate(()=>Lampa.Controller.enabled().controller.up());await page.waitForTimeout(250);
  const fastReverse=await grid.evaluate(node=>{
   const card=node.querySelector('.card.focus'),view=node.getBoundingClientRect(),rect=card.getBoundingClientRect();
   return {top:node.scrollTop,visible:rect.top>=view.top-1 && rect.bottom<=view.bottom+1};
  });
  assert.ok(fastReverse.visible,'Fast reversal cancels the previous destination and keeps the newly focused card visible');
  assert.deepEqual(r.errors,[]);return {...summary,back:{before,restored},fastReverse,errors:r.errors};
 }finally{await r.context.close();}
}
async function main(){
 const files=process.argv.slice(2).map(p=>path.resolve(p));assert.ok(files.length>=1 && files.length<=2,'Pass BASELINE.js and optionally CANDIDATE.js');
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});const report={schema:1,engine:'headless Chromium',note:'Synthetic fixture; frame timing is a comparison on this host, not a physical TV FPS claim. Input delay ends at the first rAF sample with changed focus/scroll; raster presentation is not measured.',runs:[]};
 try{
  for(const [index,plugin] of files.entries()){
   const run={label:index?'candidate':'baseline',plugin,sha256:crypto.createHash('sha256').update(fs.readFileSync(plugin)).digest('hex')};
   report.runs.push(run);run.desktop=await desktop(browser,plugin);run.tv=await tv(browser,plugin);
  }
  if(report.runs.length===2){
   const [baseline,candidate]=report.runs;
   report.comparison={desktopTailStepChangePx:candidate.desktop.tailMaxStepPx-baseline.desktop.tailMaxStepPx,tvMaxStepChangePx:candidate.tv.movementStepsPx.max-baseline.tv.movementStepsPx.max};
   assert.ok(candidate.desktop.tailMaxStepPx<=Math.max(24,baseline.desktop.tailMaxStepPx*.8),'Candidate must reduce the large final snap or remain below 24px per tail frame');
   assert.ok(candidate.tv.movementStepsPx.max<=Math.max(120,baseline.tv.movementStepsPx.max*.8),'Candidate must reduce abrupt TV catalogue scroll steps');
  }
 }finally{await browser.close();process.stdout.write(JSON.stringify(report,null,2)+'\n');}
}
main().catch(error=>{console.error(error.stack || error);process.exitCode=1;});





