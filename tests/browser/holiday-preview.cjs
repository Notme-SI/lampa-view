const fs=require('node:fs'),path=require('node:path'),{chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const {page,context}=await setup(browser,{viewport:{width:760,height:900},mode:'desktop'}),cards=[];
  const cases=[['halloween','Хэллоуин'],['black-friday','Чёрная пятница'],['snow','Зимнее оформление'],['new-year','Новый год'],['womens-day','8 Марта']];
  await page.evaluate(()=>{jQuery('body').append(Lampa.Template.get('icons_sprite'));});
  const sprite=await page.evaluate(()=>Lampa.Template.get('icons_sprite',{},true));
  for(const [name,title] of cases){
   await page.evaluate(()=>{document.querySelectorAll('.head .halloween__button,.head .black-friday__button,.head .new-year__button,.head .womens_day__button,.head .garland').forEach(n=>n.remove());jQuery('.head__logo-icon').replaceWith('<div class="head__logo-icon"><span class="pt-brand">LAMPA</span></div>');delete window.plugin_snow_ready;if(!document.querySelector('.head .open--search'))jQuery('<div class="head__action open--search selector"></div>').appendTo('.head__actions');});
   if(name==='new-year')await page.addScriptTag({content:fs.readFileSync(path.join(process.env.LAMPA_HOLIDAY_SCRIPT_DIR || '../research-065','lampa-snow.js'),'utf8')});
   await page.addScriptTag({content:fs.readFileSync(path.join(process.env.LAMPA_HOLIDAY_SCRIPT_DIR || '../research-065','lampa-'+name+'.js'),'utf8')});await page.waitForTimeout(80);
   const head=await page.locator('.head').evaluate(n=>{const copy=n.cloneNode(true);copy.querySelectorAll('.head__actions,.head__backward,.head__title,.head__time,.head__split').forEach(n=>n.remove());return copy.outerHTML;});
   cards.push('<section class="preview-card"><h2>'+title+'</h2>'+head+'</section>');
  }
  const styles=await page.locator('style').allTextContents();
  const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Праздничные иконки Lampa View</title><style>'+styles.join('\n')+'\nbody.lampa_view{font-size:18px!important;background:#080b10!important;padding:32px;box-sizing:border-box;width:760px}.preview-title{font-size:28px;margin:0 0 8px;font-weight:650}.preview-subtitle{font-size:15px;color:#9299a3;margin-bottom:28px}.preview-card{border:1px solid #ffffff16;border-radius:16px;background:#000;margin:0 0 14px;overflow:hidden}.preview-card h2{font-size:15px;font-weight:500;color:#9299a3;margin:17px 22px 8px}.preview-card .head{position:relative!important;inset:auto!important;width:100%!important;height:62px;border:0;margin-bottom:8px}.preview-card .head__body{padding:0 18px;max-width:none;height:100%;justify-content:flex-start}.preview-card .head__logo-icon{margin-right:0!important}.preview-card .head__logo-local{display:none!important}</style></head><body class="lampa_view">'+sprite+'<h1 class="preview-title">Праздничное оформление</h1><p class="preview-subtitle">Тонкие линии и единый голубой акцент</p>'+cards.join('')+'</body></html>';
  const out=process.env.LAMPA_PREVIEW_OUTPUT || path.resolve(__dirname,'../../../qa-071');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'lampa-holidays-modern.html'),html);
  await page.setContent(html);await page.waitForTimeout(100);await page.screenshot({path:path.join(out,'lampa-holidays-modern.png'),fullPage:true});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
