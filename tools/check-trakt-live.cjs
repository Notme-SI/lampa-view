// Optional read-only check. Credentials are supplied through the environment,
// never committed or printed. All Trakt requests use the production adapter.
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup}=require('../tests/fixtures/native-browser.cjs');
(async()=>{
 assert.ok(process.env.TRAKT_CLIENT_ID,'Set TRAKT_CLIENT_ID to your public app Client ID');
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   const r=await setup(browser,{viewport:{width:1280,height:720},mode:'tv'},{url:process.env.LAMPA_ORIGIN || 'http://lampac.rest/'});
   await r.page.route('https://api.trakt.tv/**',route=>route.continue());
   const result=await r.page.evaluate(async client=>{
    const L=Lampa;L.Storage.set('minimal_trakt_client_id',client);L.Storage.set('minimal_trakt_enabled',true);
    L.SettingsApi.getParam('minimal_settings_catalogue').find(row=>row.param.name==='minimal_trakt_enabled').onChange();
    const main=await new Promise((resolve,reject)=>L.Api.main({source:'trakt',component:'main'},resolve,e=>reject(new Error(e.status_message))));
    const rows=main.filter(row=>row.source==='trakt');
    const next=await new Promise((resolve,reject)=>L.Api.list({source:'trakt',url:rows[0].url,page:2},resolve,e=>reject(new Error(e.status_message))));
    const anime=await new Promise((resolve,reject)=>L.Api.category({source:'trakt',url:'anime'},resolve,e=>reject(new Error(e.status_message))));
    return {origin:location.origin,rows:rows.map(row=>({path:row.url,count:row.results.length})),nextPage:next.page,nextCount:next.results.length,animeRows:anime.length,identities:rows.every(row=>row.results.every(card=>card.source==='tmdb' && card.id>0 && card.trakt_id>0)),images:rows.every(row=>row.results.some(card=>/^https:\/\/media.trakt.tv\//.test(card.img)))};
   },process.env.TRAKT_CLIENT_ID);
   assert.equal(result.rows.length,4);assert.ok(result.rows.every(row=>row.count>0));assert.equal(result.nextPage,2);assert.ok(result.nextCount>0);assert.equal(result.animeRows,2);assert.ok(result.identities);assert.ok(result.images);assert.deepEqual(r.errors,[]);
   console.log(name+': live Trakt catalogue, CORS, page 2, anime filters and verified identities passed '+JSON.stringify(result));await r.context.close();
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
