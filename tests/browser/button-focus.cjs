const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs'),{stage}=require('../fixtures/online-browser.cjs');
const output=process.env.LAMPA_QA_OUTPUT;
if(output)fs.mkdirSync(output,{recursive:true});
(async()=>{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{const r=await setup(browser,{viewport:{width:1440,height:1000},mode:'desktop'}),{page}=r;
   await stage(page,true);await page.waitForTimeout(1400);
   await page.evaluate(()=>{
    const host=document.createElement('div');host.id='qa-controls';host.style.cssText='position:fixed;bottom:8px;left:20px;right:20px;display:flex;flex-wrap:wrap;gap:12px;z-index:100;background:#000;padding:8px';
    for(const cls of ['full-start__button','simple-button','tc-info','alc-chip','alc-ap-voice','alc-ep','minimal-comments-arrow','minimal-detail-studio selector','pt-hero__dot','pt-hero__action','minimal-overview-action']){const button=document.createElement('button');button.className=cls+' selector';button.textContent=cls==='pt-hero__dot'?'':'Кнопка';if(cls==='minimal-overview-action')button.innerHTML='<p class="full-start-new__description">Описание фильма</p><span class="minimal-overview-focus"></span>';host.appendChild(button);}
    document.body.appendChild(host);window.qaButtons=[...document.querySelectorAll('.nova-plus-root .nova-chip,.nova-plus-root .nova-btn,.nova-plus-root .nova-group,#qa-controls>button')].filter(n=>n.offsetParent!==null);
    window.qaSetFocus=index=>{document.querySelectorAll('.focus,.hover').forEach(n=>n.classList.remove('focus','hover'));qaButtons[index].classList.add('focus');};qaSetFocus(0);
   });
   await page.mouse.move(0,0);await page.waitForTimeout(150);
   const before=await page.screenshot();
   const buttons=await page.evaluate(()=>qaButtons.length);assert.ok(buttons>8,'test includes compact voice, source, season and watch controls');
   for(let repeat=0;repeat<3;repeat++)for(let i=0;i<buttons;i++){
    const style=await page.evaluate(i=>{qaSetFocus(i);const n=qaButtons[i],s=getComputedStyle(n);return {class:n.className,shadow:s.boxShadow,outline:s.outlineWidth,outlineStyle:s.outlineStyle,inline:n.getAttribute('style'),transform:s.transform,transition:s.transitionProperty,hero:!!n.closest('.nova-hero')};},i);
    assert.equal(style.outlineStyle,'none',JSON.stringify(style));assert.ok(style.shadow==='none' || style.shadow.includes('inset'),'focus shadow stays inside button');assert.ok(!/box-shadow|border|all/.test(style.transition),'focus ring is not animated');
    await page.waitForTimeout(16);
   }
   await page.evaluate(()=>qaSetFocus(0));await page.waitForTimeout(200);const after=await page.screenshot();
   const activeRect=await page.evaluate(()=>{const r=qaButtons[0].getBoundingClientRect();return {left:r.left-1,right:r.right+1,top:r.top-1,bottom:r.bottom+1};});
   const difference=await page.evaluate(async ({before,after,activeRect})=>{
    const pixels=async value=>{const image=new Image();image.src='data:image/png;base64,'+value;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
    // The currently focused rounded border may rasterize a corner differently
    // after compositor promotion. Residual rings are on OTHER controls: every
    // pixel outside the current control must return to its original state.
    const a=await pixels(before),b=await pixels(after);let changed=0;for(let i=0;i<a.length;i+=4){const x=(i/4)%innerWidth,y=Math.floor(i/4/innerWidth);if(x>=activeRect.left && x<=activeRect.right && y>=activeRect.top && y<=activeRect.bottom)continue;if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>2)changed++;}return changed;
   },{before:before.toString('base64'),after:after.toString('base64'),activeRect});
   if(output && difference){fs.writeFileSync(path.join(output,name+'-before.png'),before);fs.writeFileSync(path.join(output,name+'-after.png'),after);}
   assert.equal(await page.locator('#qa-controls .minimal-overview-focus').evaluate(node=>getComputedStyle(node).display),'none','Description does not retain a separate ring layer');
   assert.equal(difference,0,'moving focus leaves no residual pixels (two-level font antialiasing tolerance)');
   if(output)await page.screenshot({path:path.join(output,name+'-button-focus.png')});
   assert.deepEqual(r.errors,[]);await r.context.close();console.log(name+': '+buttons+' button styles, rapid focus changes and pixel equality passed');
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
