const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try {for(const width of [393,1280]){
  const r=await setup(browser,{viewport:{width,height:852},mode:width<500?'mobile':'desktop'}),{page}=r;
  await page.evaluate(()=>{window.qaNotices=0;Lampa.Noty.show=()=>qaNotices++;Lampa.Player.listener.send('create',{data:{url:'https://example.invalid/video.mp4'},abort(){}});});
  const status=page.locator('.lv-playback-status');await status.waitFor();
  assert.equal(await status.textContent(),'Открываем видео…');
  const box=await status.boundingBox();const actualWidth=await page.evaluate(()=>innerWidth);assert.ok(box.width<width*.85);assert.ok(box.height<90);assert.ok(Math.abs(box.x+box.width/2-actualWidth/2)<2);
  await page.evaluate(()=>Lampa.PlayerVideo.listener.send('playing',{}));assert.equal(await status.count(),0);
  await page.evaluate(()=>Lampa.PlayerVideo.listener.send('error',{}));await status.waitFor();assert.equal(await status.getAttribute('role'),'alert');assert.equal(await status.textContent(),'Не удалось открыть видео');
  const output=path.resolve('../playback-status-qa');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,name+'-'+width+'.png'),animations:'disabled'});
  await page.keyboard.press('Escape');assert.equal(await status.count(),0);assert.equal(await page.evaluate(()=>qaNotices),0);
  assert.deepEqual(r.errors,[]);console.log(name+' '+width+': loading/error/ready/Escape, no native notification; box '+JSON.stringify(box));await r.context.close();
 }}finally{await browser.close();}
}})().catch(error=>{console.error(error);process.exitCode=1;});

