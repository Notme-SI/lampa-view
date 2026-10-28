const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');

(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   for(const mode of ['tv','desktop']){
    const r=await setup(browser,{viewport:{width:1920,height:1080},mode},{beforePlugin:async page=>page.evaluate(()=>{
     Lampa.TMDB.image=path=>'http://images.example.invalid/tmdb/img'+path+'?uid=test&account_email=viewer%40example.invalid';
     const get=Lampa.Api.sources.tmdb.get;
     Lampa.Api.sources.tmdb.get=(url,p,ok,fail)=>{
      const match=url.match(/^movie\/(\d+)\?append_to_response=images/);
      if(!match)return get.call(Lampa.Api.sources.tmdb,url,p,ok,fail);
      const id=match[1];setTimeout(()=>ok({images:{logos:[{file_path:'/logo'+id+'.png',iso_639_1:'ru'}]},production_companies:[{name:'Studio '+id,logo_path:'/studio'+id+'.png'}]}),5);
     };
    })});
    const {page}=r;
    await page.route('http://images.example.invalid/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#28474c"/></svg>'}));
    await page.evaluate(()=>{
     const root=jQuery('<main style="position:relative;width:100vw;min-height:100vh"><div class="items-line"></div></main>').appendTo(document.body);
     const activity={render:()=>root};
     const cards=[1,2,3].map(id=>({id,title:'Фильм '+id,overview:'Описание',backdrop_path:'/cover'+id+'.jpg',source:'tmdb'}));
     Lampa.Listener.send('line',{type:'append',params:{object:{component:'main',activity}},data:{results:cards}});
    });
    for(const id of [1,2,3,1]){
     await page.waitForSelector('.pt-hero__dot');
     await page.evaluate(id=>jQuery('.pt-hero__dot').eq(id-1).trigger('hover:enter'),id);
     await page.waitForFunction(id=>{
      const image=document.querySelector('.pt-hero__image'),logo=document.querySelector('.pt-hero__logo'),studio=document.querySelector('.pt-hero__studio');
      return image?.src.includes('/cover'+id+'.jpg?') && image.complete && image.naturalWidth>0
       && logo?.src.includes('/logo'+id+'.png?') && logo.complete && logo.naturalWidth>0 && !logo.classList.contains('pt-hidden')
       && studio?.src.includes('/studio'+id+'.png?') && !studio.classList.contains('pt-hidden');
     },id,{timeout:6000});
     assert.equal(await page.locator('.pt-hero__logo').getAttribute('alt'),'Фильм '+id);
    }
    assert.deepEqual(r.errors,[]);
    console.log(name+' '+mode+': proxied carousel covers, title logos, studios and returning to cached slides passed');
    await r.context.close();
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
