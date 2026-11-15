const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{
 for(const mode of ['desktop','mobile']){
  const r=await setup(browser,{mode,viewport:mode==='mobile'?{width:393,height:852}:{width:1440,height:900},isMobile:mode==='mobile',hasTouch:mode==='mobile'}),p=r.page;
  try{
   await stage(p,false,2);
   await p.evaluate(()=>{
    const body=qaRoot.find('.scroll__body'),comp=qaComponent;
    Object.assign(comp,{parseJsonDate(){},display(){},filter(){},getEpisodes(){},request(){window.qaSuccess=this.parse.bind(this);window.qaFail=this.doesNotAnswer.bind(this);},reset(){body.empty().append('<div class="online-prestige-watched">History placeholder</div>');},parse(){body.empty().append('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Actual movie</div></div>');},doesNotAnswer(){body.empty().append('<div class="online-empty"><div class="online-empty__title">Network error</div></div>');}});
    LampaView.onlineNavigation(comp);comp.reset();comp.request('/lite/test');
   });
   const loader=p.locator('.nova-loading');await loader.waitFor({state:'visible'});
   const b=await loader.evaluate(n=>{window.qaLoader=n;const b=n.getBoundingClientRect();return {height:b.height,top:b.top,bottom:b.bottom};});assert.ok(b.height>30&&b.top>=0,'Loading stays visible after a native reset '+JSON.stringify(b));
   await p.evaluate(()=>qaRoot.find('.scroll__body').empty().append('<div class="online-empty"><div class="broadcast__scan">Second stage</div></div>'));
   await p.waitForTimeout(120);assert.ok(await loader.evaluate(n=>n===qaLoader),'One loading panel continues across native phases');
   await p.evaluate(()=>qaSuccess('files'));await p.waitForFunction(()=>!document.querySelector('.nova-loading')&&document.querySelector('.nova__hero')?.textContent.trim().length>0);
   await p.evaluate(()=>{qaComponent.reset();qaComponent.request('/lite/test');});await loader.waitFor({state:'visible'});await p.evaluate(()=>qaFail({timeout:true}));await p.waitForSelector('.nova-note');assert.equal(await loader.count(),0,'A terminal error replaces loading');
   assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+': one visible loader through native reset, files and error PASS');
  }finally{await r.context.close();}
 }
}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
