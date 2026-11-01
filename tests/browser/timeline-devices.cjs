const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true}),rows=new Map(),traffic=[];let version=100;const clients=[];try{
 async function open(mode){
  const r=await setup(browser,{viewport:{width:1280,height:800},mode},{beforePlugin:async page=>{
   await page.exposeFunction('qaTimecode',p=>{
    const url=new URL(p.url);traffic.push(url.pathname);if(!url.pathname.includes('/timecode/'))return null;
    assert.equal(url.searchParams.get('profile_id'),'7');assert.equal(url.searchParams.get('account_email'),'viewer@example.test');
    if(p.type==='POST'){for(const row of JSON.parse(p.data).rows)rows.set(row.hash,{...row,updated_at:++version});return {success:true,version,skipped:0};}
    const result=Array.from(rows.values()).filter(row=>!url.pathname.endsWith('/changelog') || row.updated_at>Number(url.searchParams.get('since')));if(!result.length && !url.pathname.endsWith('/changelog'))return {rows:[]};return {rows:result,version:result.length?result.at(-1).updated_at:Number(url.searchParams.get('since')),truncated:false};
   });
   await page.evaluate(()=>{
    window.lampa_settings.account_use=true;window.lampa_settings.account_sync=true;Lampa.Storage.set('account_use',true,true);Lampa.Storage.set('account',{email:'viewer@example.test',token:'isolated-test',profile:{id:7,main:true}},true);Lampa.Timeline.read();
    Lampa.Plugins.get=()=>[{url:'http://lampac.test/timecode.js'}];Lampa.Account.Timeline.update=()=>{};Lampa.Account.Bookmarks.update=cb=>cb && cb();
    Lampa.Account.Api.watchHistory=(p,ok)=>ok({results:[{id:2,title:'Гангстерленд',watch_history:{watched_at:200}},{id:1,title:'Фильм',watch_history:{watched_at:100}}],page:p.page,total_pages:1});
    jQuery.ajax=p=>{let canceled=false;qaTimecode({url:p.url,type:p.type,data:p.data}).then(result=>{if(canceled)return;if(result)p.success && p.success(result);else p.error && p.error();});return {abort(){canceled=true;}};};
   });
  }});clients.push(r);await r.page.waitForFunction(()=>LampaView.sync.status().state==='ready');return r.page;
 }
 const a=await open('desktop'),b=await open('tv');
 await a.evaluate(()=>Lampa.Timeline.view(Lampa.Utils.hash('12MobLand')).handler(40,1304,3200));
 await a.waitForFunction(()=>LampaView.sync.status().pending===0);await b.evaluate(()=>LampaView.sync.refresh());
 await b.waitForFunction(()=>Lampa.Timeline.view(Lampa.Utils.hash('12MobLand')).time===1304);
 const value=await b.evaluate(()=>Lampa.Timeline.view(Lampa.Utils.hash('12MobLand')));assert.equal(value.percent,40);assert.equal(value.duration,3200);assert.equal(value.profile,7);
 await b.evaluate(()=>Lampa.Timeline.view(Lampa.Utils.hash('12MobLand')).handler(0,0,3200));await b.waitForFunction(()=>LampaView.sync.status().pending===0);
 await a.evaluate(()=>LampaView.sync.refresh());await a.waitForFunction(()=>Lampa.Timeline.view(Lampa.Utils.hash('12MobLand')).percent===0);
 const writes=traffic.filter(p=>p.endsWith('/set')).length;await a.waitForTimeout(1200);assert.equal(traffic.filter(p=>p.endsWith('/set')).length,writes,'Received updates do not echo');
 for(const r of clients)assert.deepEqual(r.errors,[]);console.log(engine.name()+': two isolated native clients share episode time and clears');
 }finally{for(const r of clients)await r.context.close();await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
