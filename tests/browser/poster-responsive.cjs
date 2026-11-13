const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{
 const {page,context,errors}=await setup(browser,{mode:'desktop',viewport:{width:2560,height:1100}},{beforePlugin:page=>page.evaluate(()=>{
  Lampa.Params.init();Lampa.Layer.init();Lampa.Storage.set('lampa_view_hero',false);
  const results=Array.from({length:40},(_,i)=>({id:8100+i,title:'Название '+i,original_title:'Title '+i,media_type:'movie',source:'tmdb',poster_path:'/p.jpg',release_date:'2020-01-01',quality:'4K',vote_average:8}));
  Lampa.Api.main=(o,ok)=>ok([{title:'Подборка',url:'test',results}]);
  Lampa.Api.sources.tmdb.get=(url,p,ok)=>ok({results,page:1,total_pages:1});
 })});
 await page.evaluate(()=>Lampa.Activity.push({component:'main',source:'tmdb'}));
 await page.waitForSelector('.activity--active .minimal-posters-sized');
 let baseline;
 for(const width of [2560,1920,1440,1000,700]){
  await page.setViewportSize({width,height:1100});await page.waitForTimeout(450);
  const size=await page.locator('.activity--active .card').first().evaluate(n=>({width:n.getBoundingClientRect().width,height:n.querySelector('.card__view').getBoundingClientRect().height,font:getComputedStyle(n).fontSize}));
  if(!baseline)baseline=size;
  assert.ok(Math.abs(size.width-baseline.width)<.5,JSON.stringify({width,size,baseline}));assert.equal(size.font,baseline.font);assert.ok(Math.abs(size.height-baseline.height)<.5);
 }
 await page.evaluate(()=>Lampa.Activity.push({component:'category',url:'movie',source:'tmdb',page:1}));
 await page.waitForSelector('.activity--active .pt-windowed-grid');let previous=0;
 for(const width of [1000,1440,1920,2560,1000]){
  await page.setViewportSize({width,height:1100});await page.waitForTimeout(450);
  const size=await page.locator('.activity--active .pt-windowed-grid').evaluate(n=>({cols:+n.style.getPropertyValue('--pt-window-cols'),width:n.querySelector('.card').getBoundingClientRect().width,first:n.querySelector('.card').getBoundingClientRect().left,last:[...n.querySelectorAll('.card')].find(c=>c.offsetTop===n.querySelector('.card').offsetTop && c.nextElementSibling?.offsetTop!==c.offsetTop)?.getBoundingClientRect().right,edge:n.getBoundingClientRect().right}));
  assert.ok(Math.abs(size.width-baseline.width)<.5,JSON.stringify(size));assert.ok(size.last<=size.edge+1);if(width!==1000)assert.ok(size.cols>=previous);previous=size.cols;
 }
 await page.evaluate(()=>{
  const item=Lampa.Activity.active().activity.component.items[0],node=item.render(true);
  Lampa.Timeline.update({hash:Lampa.Utils.hash('Title 0'),time:915,duration:2287,percent:40});
  node.classList.add('focus');jQuery(node).trigger('hover:focus');
 });
 await page.waitForSelector('.activity--active .card__view>.pt-card-watch__meter');
 const progress=await page.locator('.activity--active .card').first().evaluate(n=>{const meter=n.querySelector('.card__view>.pt-card-watch__meter'),line=meter.querySelector('.time-line'),view=n.querySelector('.card__view'),a=line.getBoundingClientRect(),b=view.getBoundingClientRect();return {count:n.querySelectorAll('.time-line').length,percent:line.firstElementChild.style.width,time:meter.querySelector('.pt-card-watch__time').textContent,bottom:Math.abs(a.bottom-b.bottom),width:a.width,poster:b.width,label:n.querySelector('.pt-card-watch__label').textContent};});
 assert.equal(progress.count,1);assert.equal(progress.percent,'40%');assert.equal(progress.time,'15:15');assert.ok(progress.bottom<1);assert.ok(Math.abs(progress.width-progress.poster)<1);
 if(process.env.LAMPA_QA_OUTPUT){require('node:fs').mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:require('node:path').join(process.env.LAMPA_QA_OUTPUT,'posters-'+engine.name()+'.png')});}
 assert.deepEqual(errors,[]);await context.close();console.log(engine.name()+': fixed desktop posters, reflowing virtual grid, one native progress node on poster passed');
 }finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
