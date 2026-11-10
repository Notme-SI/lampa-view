const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
const material=async(page,selector)=>page.locator(selector).first().evaluate(n=>{const s=getComputedStyle(n);return {bg:s.backgroundColor,blur:s.backdropFilter,radius:parseFloat(s.borderTopLeftRadius)/parseFloat(s.fontSize),animation:s.animationName};});
const alpha=value=>{const numbers=value.match(/[\d.]+/g);return numbers.length===4?Number(numbers[3]):1;};
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['tv','desktop','mobile','tablet']){
 const r=await setup(browser,{mode,viewport:mode==='tv'?{width:960,height:540}:mode==='mobile'?{width:390,height:844}:mode==='tablet'?{width:834,height:1194}:{width:1440,height:900}},{beforePlugin:p=>p.evaluate(()=>{Lampa.Params.init();Lampa.Layer.init();Lampa.Search.init();})}),{page}=r;
 try{
  await page.evaluate(()=>{Lampa.Storage.set('lampa_view_theme','glass');document.body.classList.add('advanced--animation');});
  for(const opacity of ['easy','medium','blacked']){
   await page.evaluate(opacity=>Lampa.Storage.set('glass_opacity',opacity),opacity);
   for(const selector of ['.wrap__left','.settings__content','.head .open--search','.head .open--settings']){const m=await material(page,selector);assert.ok(alpha(m.bg)>=.75 && alpha(m.bg)<1,JSON.stringify({mode,opacity,selector,m}));if(mode==='tv'||selector.startsWith('.head')||selector==='.wrap__left')assert.equal(m.blur,'none');else assert.match(m.blur,/blur\(/);}
  }
  if(mode==='tv')for(const selector of ['.head .open--search','.head .open--settings','.head__menu-icon']){await page.locator(selector).first().evaluate(n=>n.classList.add('focus'));assert.ok(alpha((await material(page,selector)).bg)>=.9,'Focused TV header stays dense: '+selector);await page.locator(selector).first().evaluate(n=>n.classList.remove('focus'));}
  await page.evaluate(()=>{Lampa.Controller.toggle('settings');Lampa.Settings.create('lampa_view');});await page.waitForSelector('.settings--open .settings__content',{state:'visible'});
  if(mode==='tv' && process.env.LAMPA_QA_OUTPUT){fs.mkdirSync(process.env.LAMPA_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-tv-settings.png')});}
  await page.evaluate(()=>{Lampa.Controller.back();Lampa.Select.show({title:'Действие',items:[{title:'Избранное',separator:true},{title:'Нравится',checkbox:true}]});});await page.waitForSelector('.selectbox-item');
  const panel=await material(page,'.selectbox__content');assert.ok(alpha(panel.bg)>=.8 && alpha(panel.bg)<1);if(mode==='tv')assert.equal(panel.blur,'none');else assert.match(panel.blur,/blur\(/);
  await page.evaluate(()=>{Lampa.Controller.back();document.body.appendChild(Lampa.Search.render(true));Lampa.Search.open({sources:[{title:'CUB',params:{},search(p,ok){ok([]);}}]});});await page.waitForSelector('.main-search .search');
  const search=await material(page,'.main-search .search');assert.ok(alpha(search.bg)>=.8 && alpha(search.bg)<1);if(mode==='tv')assert.equal(search.blur,'none');else assert.match(search.blur,/blur\(/);
  if(mode==='tv' && process.env.LAMPA_QA_OUTPUT)await page.screenshot({path:path.join(process.env.LAMPA_QA_OUTPUT,engine.name()+'-tv-search.png')});
  await page.evaluate(()=>{Lampa.Search.close();const row=document.createElement('div');row.className='mapping--line';row.appendChild(Lampa.Template.get('full_review',{text:'Комментарий',like_count:1})[0]);row.insertAdjacentHTML('beforeend','<div class="full-review-add selector"></div><div class="full-review-all selector">Все комментарии</div>');document.querySelector('.wrap__content').appendChild(row);});
  for(const theme of ['minimal','glass']){await page.evaluate(theme=>Lampa.Storage.set('lampa_view_theme',theme),theme);if(theme==='minimal'){for(const selector of ['.wrap__left','.settings__content','.selectbox__content'])assert.equal((await material(page,selector)).bg,'rgb(0, 0, 0)');}for(const selector of ['.full-review','.full-review-add','.full-review-all']){let m=await material(page,selector);assert.ok(m.radius>=1,JSON.stringify({mode,theme,selector,m}));await page.locator(selector).first().evaluate(n=>n.classList.add('focus'));m=await material(page,selector);assert.ok(m.radius>=1);if(mode==='tv' && selector!=='.full-review-all')assert.equal(m.animation,'none');}}
  assert.deepEqual(r.errors,[]);console.log(engine.name()+' '+mode+': native settings/actions/search surfaces, opacity preferences and rounded comments PASS');
 }finally{await r.context.close();}
}}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
