const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});try{
   for(const mode of ['desktop','tv','mobile']){
    const r=await setup(browser,mode==='mobile'?{viewport:{width:393,height:852},isMobile:true,hasTouch:true,mode}:{viewport:{width:1440,height:900},mode}),{page}=r;
    console.log(name+' '+mode+': checking first-entry dubbing');
    await page.evaluate(()=>{Lampa.DeviceInput.init();Lampa.Controller.observe();});
    await stage(page,true,0);
    assert.equal(await page.locator('[data-nova-focus=voice]').count(),0);
    await page.evaluate(()=>{
     window.qaVoiceSelection=-1;window.qaSourceChanges=0;
     qaFilter.onSelect=(type,group,item)=>{if(type==='sort')qaSourceChanges++;else qaVoiceSelection=item.index;};
     window.qaOriginalEpisode=qaRoot.find('.online-prestige')[0];
     const groups=qaFilter.get('filter');groups.find(group=>group.stype==='voice').items=[{title:'КОМНАТА ДИДИ',selected:true,index:0}];
     qaFilter.set('filter',groups);
    });
    const button=page.locator('[data-nova-focus=voice]');await button.waitFor({state:'visible'});
    assert.match(await button.textContent(),/КОМНАТА ДИДИ/);await button.click();
    await page.waitForFunction(()=>Lampa.Select.opened() && Lampa.Select.render().find('.selectbox-item').length===1);
    assert.equal(await page.evaluate(()=>Lampa.Select.render().find('.selectbox-item').length),1);
    await page.evaluate(()=>Lampa.Select.render().find('.selectbox-item').first().trigger('hover:enter'));
    assert.deepEqual(await page.evaluate(()=>({selected:qaVoiceSelection,sourceChanges:qaSourceChanges,sameEpisode:qaOriginalEpisode===qaRoot.find('.online-prestige')[0]})),{selected:-1,sourceChanges:0,sameEpisode:true});
    await page.evaluate(()=>qaFilter.set('filter',qaFilter.get('filter').filter(group=>group.stype!=='voice')));
    await button.waitFor({state:'detached'});assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+' '+mode+': late single dubbing appears on first entry and uses native selection');
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
