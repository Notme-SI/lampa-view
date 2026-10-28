// Deterministic Chromium comparison; CPU throttling approximates a slow client,
// not a measurement of a physical TV or of the user's image server.
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../tests/fixtures/native-browser.cjs');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const plugin of process.argv.slice(2))for(let trial=0;trial<2;trial++){
   const r=await setup(browser,{viewport:{width:1920,height:1080},mode:'tv'}, {
    plugin:path.resolve(plugin),
    beforePlugin:async page=>{
     const session=await page.context().newCDPSession(page);
     await session.send('Emulation.setCPUThrottlingRate',{rate:4});
     await page.evaluate(()=>{
      Lampa.Platform.tv=()=>true;
      Lampa.TMDB.image=p=>'http://images.example.invalid'+p;
      window.qaCounts={rect:0,writes:0};
      const rect=Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect=function(){qaCounts.rect++;return rect.apply(this,arguments);};
      const set=Lampa.Storage.set;
      Lampa.Storage.set=function(key){if(key==='minimal_card_info_v1')qaCounts.writes++;return set.apply(this,arguments);};
      window.qaLongTasks=[];
      new PerformanceObserver(list=>qaLongTasks.push(...list.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});
     });
    }
   });
   const {page}=r,urls=[];
   await page.route('http://images.example.invalid/**',route=>{
    const url=route.request().url();urls.push(url);
    const width=url.includes('/original/')?3840:url.includes('/w1280/')?1280:url.includes('/w780/')?780:500;
    return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+Math.round(width*9/16)+'"><rect width="100%" height="100%" fill="#294355"/></svg>'});
   });
   await page.evaluate(()=>{
    const $=jQuery,L=Lampa;
    const root=$('<main class="qa-home" style="padding:60px 80px"></main>').appendTo('.wrap__content');
    const activity={render:()=>root};
    window.qaCards=[];
    const data=Array.from({length:60},(_,i)=>({id:1000+i,title:'Film '+i,overview:'Test synopsis',poster_path:'/poster'+i+'.jpg',backdrop_path:'/backdrop'+i+'.jpg',release_date:'2025-01-01',genre_ids:[28],vote_average:8,source:'tmdb'}));
    for(let row=0;row<6;row++){
     const line=$('<div class="items-line"><div class="items-line__body" style="display:flex;height:310px"></div></div>').appendTo(root);
     const items=data.slice(row*10,row*10+10).map(d=>{
      const card=L.Utils.createInstance(L.Maker.get('Card',{}),d);
      card.create();line.find('.items-line__body').append(card.render(true));card.visible();qaCards.push(card);return card;
     });
     L.Listener.send('line',{type:'append',params:{object:{component:'main',activity}},data:{results:data.slice(row*10,row*10+10)},items});
    }
   });
   await page.waitForTimeout(1800);
   const initial=await page.evaluate(()=>({rect:qaCounts.rect,writes:qaCounts.writes,longTasks:qaLongTasks.length}));
   await page.evaluate(()=>{
    qaCounts={rect:0,writes:0};qaLongTasks=[];
    // Unrelated controls should never trigger a whole-catalogue layout pass.
    const button=document.querySelector('.pt-hero__action');
    for(let i=0;i<30;i++)button.dispatchEvent(new Event('transitionend',{bubbles:true}));
   });
   await page.waitForTimeout(450);
   const idle=await page.evaluate(()=>({...qaCounts,longTasks:qaLongTasks.length}));
   await page.evaluate(()=>{
    qaCounts={rect:0,writes:0};qaLongTasks=[];
    for(let i=0;i<30;i++)qaCards[i%10].render(true).dispatchEvent(new Event('hover:focus',{bubbles:true}));
   });
   await page.waitForTimeout(950);
   const focus=await page.evaluate(()=>({...qaCounts,longTasks:qaLongTasks.length}));
   console.log(JSON.stringify({plugin:path.basename(plugin),trial,initial,idle,focus,originals:urls.filter(url=>url.includes('/original/')).length,requests:urls.length,errors:r.errors}));
   await r.context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
