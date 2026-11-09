const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE),{setup}=require('../fixtures/native-browser.cjs'),messages=require('../../src/i18n-messages.json');
// Bound text writes so a regression reports a failure instead of starving the browser event loop.
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{
 for(const language of ['ru','en','uk','be','zh','pt','bg','he','cs','ro','fr','pl','es']){
  const {page,context,errors}=await setup(browser,{viewport:{width:1280,height:800},mode:'desktop'},{beforePlugin:page=>page.evaluate(language=>Lampa.Storage.set('language',language),language)});
  await page.evaluate(()=>{
   const descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');window.qaWrites=0;window.qaOnline=0;
   Object.defineProperty(Node.prototype,'textContent',{...descriptor,set(value){if(this.nodeType===1 && this.closest('.button--play') && ++qaWrites>32)return;descriptor.set.call(this,value);}});
   Lampa.Api.full=(p,ok)=>ok({movie:{id:992,title:'Example',original_title:'Example',overview:'Description',release_date:'2025-01-01',production_countries:[],production_companies:[],spoken_languages:[],runtime:100,vote_average:8,genres:[],source:'tmdb'},persons:{cast:[],crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
   Lampa.Activity.push({component:'full',id:992,method:'movie',source:'tmdb',card:{id:992,title:'Example'}});
  });
  await page.waitForSelector('.minimal-detail-header');
  await page.evaluate(()=>{
   const button=document.createElement('div');button.className='full-start__button view--online';button.innerHTML='<span>Online</span>';button.addEventListener('hover:enter',()=>qaOnline++);
   document.querySelector('.buttons--container').appendChild(button);
   const late=document.createElement('div');late.className='full-start__button button--alc-auto';late.textContent='Online';document.querySelector('.full-start-new__buttons').appendChild(late);
   window.qaHeartbeat=false;setTimeout(()=>{qaHeartbeat=true;},50);
  });
  await page.waitForFunction(()=>qaHeartbeat);
  const first=await page.evaluate(()=>qaWrites);await page.waitForTimeout(100);
  const state=await page.evaluate(()=>({writes:qaWrites,label:document.querySelector('.button--play span').textContent,language:Lampa.Storage.get('language')}));
  assert.equal(state.language,language);assert.equal(state.label,language==='ru'?'Смотреть':messages['Смотреть'][language] || messages['Смотреть'].en);assert.ok(state.writes<=2,language+': localized Watch must not rewrite itself');assert.equal(state.writes,first,language+': no self-triggering observer');
  await page.locator('.button--play').click();assert.equal(await page.evaluate(()=>qaOnline),1,language+': Watch opens the late provider once');assert.deepEqual(errors,[]);
  console.log(engine.name(),language,'full card, late provider, stable observer and Watch OK');await context.close();
 }
}finally{await browser.close();}}})().catch(error=>{console.error(error);process.exitCode=1;});
