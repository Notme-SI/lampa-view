// Source-level browser regression; no app/API/network fixture is required.
// Optional PLAYWRIGHT_MODULE, ESBUILD_MODULE and CHROMIUM_EXECUTABLE locate
// existing local dependencies without installing or changing the project.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const esbuild=require(process.env.ESBUILD_MODULE || 'esbuild');
const root=path.resolve(__dirname,'../..');
const source=esbuild.buildSync({entryPoints:[path.join(root,'src/hero-transition.js')],bundle:true,write:false,format:'iife',globalName:'HeroTransition'}).outputFiles[0].text;
const css=['theme.css','material.css'].map(name=>fs.readFileSync(path.join(root,'src',name),'utf8')).join('\n');

async function screen(browser,mode,theme,reduced=false){
 const context=await browser.newContext({viewport:mode==='mobile'?{width:393,height:852}:{width:1280,height:720},reducedMotion:reduced?'reduce':'no-preference'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.abort());
 await page.setContent('<body class="lampa_view pt-home pt-'+mode+(theme==='glass'?' pt-theme-glass':'')+'" data-lampa-theme="'+theme+'"><section class="pt-hero"><div class="pt-hero__artwork" aria-hidden="true"><img class="pt-hero__image" alt="" decoding="async"></div><div class="pt-hero__body">Hero transition test</div></section></body>');
 await page.addStyleTag({content:css});await page.addScriptTag({content:source});
 await page.evaluate(async()=>{
  const svg=color=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="'+color+'"/></svg>');
  window.qaUrls=['#aa2211','#1122aa','#22aa11','#aa11aa'].map(svg);
  const image=document.querySelector('.pt-hero__image');image.src=qaUrls[0];await image.decode();
  window.qaHero=HeroTransition.default(image);
  // Decode all destinations before testing animation, as heroAssets does.
  await Promise.all(qaUrls.map(async url=>{const preload=new Image();preload.src=url;await preload.decode();}));
 });
 return {page,context,errors};
}
async function run(browser,mode,theme,transformed=false){
 const r=await screen(browser,mode,theme),{page}=r;
 try{
  await page.evaluate(transformed=>{
   if(transformed)document.querySelector('.pt-hero__image').style.setProperty('transform','translate3d(6px,4px,0) scale(1.03)','important');
   qaHero.show(qaUrls[1]);
  },transformed);
  await page.waitForFunction(()=>document.querySelector('.pt-hero__previous')?.getAnimations().some(a=>a.playState==='running'));
  const geometry=await page.evaluate(()=>{
   const image=document.querySelector('.pt-hero__image'),overlay=document.querySelector('.pt-hero__previous');
   const a=image.getBoundingClientRect(),b=overlay.getBoundingClientRect();
   return {image:{left:a.left,top:a.top,width:a.width,height:a.height},overlay:{left:b.left,top:b.top,width:b.width,height:b.height},sourceTransform:getComputedStyle(image).transform,overlayTransform:getComputedStyle(overlay).transform};
  });
  assert.ok(geometry.image.width>0 && geometry.image.height>0,'The real hero CSS must produce a visible image');
  for(const field of ['left','top','width','height'])assert.ok(Math.abs(geometry.image[field]-geometry.overlay[field])<1,mode+' '+theme+' outgoing layer must match image '+field+': '+JSON.stringify(geometry));
  assert.equal(geometry.sourceTransform,geometry.overlayTransform,'The outgoing layer preserves the source transform');
  if(transformed)assert.notEqual(geometry.sourceTransform,'none','Transform preservation must also be exercised with an actual transform');
  await page.waitForTimeout(100);
  const interrupted=await page.evaluate(()=>{
   const overlay=document.querySelector('.pt-hero__previous'),before=Number(getComputedStyle(overlay).opacity);
   qaHero.show(qaUrls[2]);const next=document.querySelector('.pt-hero__previous');
   return {before,after:Number(getComputedStyle(next).opacity),sameLayer:next===overlay,count:document.querySelectorAll('.pt-hero__previous').length};
  });
  assert.ok(interrupted.before>0 && interrupted.before<.95,'A to B must be partway through the fade');
  assert.ok(interrupted.after<=interrupted.before+.02,'B to C must not revive the outgoing layer at opacity 1: '+JSON.stringify(interrupted));
  assert.equal(interrupted.count,1,'Interrupted transitions keep at most one outgoing layer');
  // A cancelled animation's rejected promise must not clear the reused layer.
  await page.waitForTimeout(20);assert.equal(await page.locator('.pt-hero__previous').count(),1);
  await page.waitForFunction(()=>!document.querySelector('.pt-hero__previous'));
  assert.equal(await page.locator('.pt-hero__image').getAttribute('src'),await page.evaluate(()=>qaUrls[2]));
  await page.evaluate(()=>qaHero.show(qaUrls[3]));
  await page.waitForFunction(()=>!!document.querySelector('.pt-hero__previous'));
  const disposed=await page.evaluate(()=>{qaHero.dispose();const image=document.querySelector('.pt-hero__image'),src=image.getAttribute('src');qaHero.show(qaUrls[0]);return {count:document.querySelectorAll('.pt-hero__previous').length,unchanged:src===image.getAttribute('src')};});
  assert.equal(disposed.count,0);assert.equal(disposed.unchanged,true,'Disposed helpers ignore later asset callbacks');
  await page.waitForTimeout(300);assert.equal(await page.locator('.pt-hero__previous').count(),0);
  assert.deepEqual(r.errors,[]);return {mode,theme,transformed,geometry,interrupted,dispose:true,errors:r.errors};
 }finally{await r.context.close();}
}
async function reduced(browser,os){
 const r=await screen(browser,'mobile','minimal',os),{page}=r;
 try{
  const result=await page.evaluate(async os=>{
   if(!os)document.body.classList.add('pt-reduce-motion');
   qaHero.show(qaUrls[1]);await document.querySelector('.pt-hero__image').decode();
   const result={overlays:document.querySelectorAll('.pt-hero__previous').length,src:document.querySelector('.pt-hero__image').getAttribute('src')===qaUrls[1]};qaHero.dispose();return result;
  },os);
  assert.equal(result.overlays,0);assert.equal(result.src,true);assert.deepEqual(r.errors,[]);
  return {reducedMotion:os?'OS preference':'body flag',passed:true};
 }finally{await r.context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 try{
  const results=[];for(const mode of ['desktop','mobile'])for(const theme of ['minimal','glass'])results.push(await run(browser,mode,theme));
  results.push(await run(browser,'desktop','minimal',true),await run(browser,'mobile','glass',true));
  results.push(await reduced(browser,true),await reduced(browser,false));console.log(JSON.stringify({source:'src/hero-transition.js',engine:'headless Chromium',results},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack || error);process.exitCode=1;});
