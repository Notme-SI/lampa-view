const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
(async()=>{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});try{
   for(const mode of ['desktop','tv','mobile']){
    const r=await setup(browser,{viewport:{width:mode==='mobile'?393:1440,height:mode==='mobile'?852:1000},mode}),{page}=r;
    await stage(page,true,2);await page.mouse.move(0,0);await page.waitForTimeout(500);
    await page.evaluate(()=>{window.qaEpisodes=[...document.querySelectorAll('.nova-card')];window.qaEpisodeFocus=i=>{qaEpisodes.forEach(n=>n.classList.remove('focus','hover'));qaEpisodes[i].classList.add('focus');};qaEpisodeFocus(0);if(document.body.classList.contains('pt-tv'))qaEpisodes[1].classList.add('hover');});await page.waitForTimeout(350);
    const initial=await page.locator('.nova__list').screenshot();
    const progress=await page.locator('.nova-card__line .time-line').count();assert.ok(progress>0,'Progress strips remain present');
    for(let i=0;i<18;i++){await page.evaluate(i=>qaEpisodeFocus(i%2),i);await page.waitForTimeout(20);}
    await page.evaluate(()=>{qaEpisodeFocus(0);if(document.body.classList.contains('pt-tv'))qaEpisodes[1].classList.add('hover');});await page.waitForTimeout(350);
    const final=await page.locator('.nova__list').screenshot();
    const difference=await page.evaluate(async({before,after})=>{
     async function pixels(data){const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;}
     const a=await pixels(before),b=await pixels(after);let changed=0;for(let i=0;i<a.length;i+=4)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>2)changed++;return changed;
    },{before:initial.toString('base64'),after:final.toString('base64')});
    assert.equal(difference,0,name+' '+mode+': old episode focus leaves no residual pixels');
    const style=await page.evaluate(()=>qaEpisodes.map(card=>{const thumb=card.querySelector('.nova-card__thumb'),s=getComputedStyle(thumb);return {transform:s.transform,shadow:s.boxShadow,border:getComputedStyle(thumb,'::after').borderColor,title:getComputedStyle(card.querySelector('.nova-card__title')).color,frameWidth:parseFloat(getComputedStyle(thumb,'::after').width),frameHeight:parseFloat(getComputedStyle(thumb,'::after').height),width:thumb.clientWidth,height:thumb.clientHeight};}));
    assert.ok(Math.abs(style[0].frameWidth-style[0].width)<=1 && Math.abs(style[0].frameHeight-style[0].height)<=1,'Frame covers the entire thumbnail, not the old play icon: '+JSON.stringify(style[0]));assert.ok(style[0].transform.includes('1.045'));assert.notEqual(style[0].shadow,'none');assert.equal(style[1].shadow,'none');assert.notEqual(style[0].title,style[1].title,'A stale pointer hover cannot mark another TV title');assert.equal(await page.locator('.nova-card__line .time-line').count(),progress);
    if(process.env.LAMPA_QA_OUTPUT){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,name+'-'+mode+'-episode-focus.png')});}
    assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+' '+mode+': main-card selection, retained progress and no residual episode rings');
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
