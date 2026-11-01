const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),{JSDOM}=require('jsdom');
function load(w,name){w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'iife',globalName:'Module'}).outputFiles[0].text);return w.Module.default;}
test('home follows current CUB history order rather than old bookmark order, including pagination and remote changes',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
  const calls=[],events=[],old=[{id:1,title:'Old first'},{id:2,title:'New first'}];
  const L={Storage:{get:(k,f)=>f},Favorite:{get:()=>old},Account:{Permit:{sync:true,account:{email:'a@example.test',profile:{id:7}}},Api:{watchHistory:(p,ok,fail)=>calls.push({p,ok,fail})}},Listener:{send:(n,e)=>events.push(e)}};
  const api=load(w,'watch-history')(L);api.refresh();assert.deepEqual({...calls[0].p},{page:1,group:'card'});calls[0].ok({results:[{id:2,title:'New first',watch_history:{watched_at:200}},{id:1,title:'Old first',watch_history:{watched_at:100}}],page:1,total_pages:3});
  assert.deepEqual(Array.from(api.cards(),c=>c.id),[2,1]);assert.deepEqual(old.map(c=>c.id),[1,2]);assert.equal(events[0].target,'favorite');
  let page;assert.equal(api.page(2,r=>page=r),true);calls[1].ok({results:[{id:3,title:'Page 2'}],page:2,total_pages:3});assert.equal(page.page,2);assert.equal(page.total_pages,3);assert.equal(page.results[0].id,3);
  api.refresh();calls[2].ok({results:[{id:1,title:'Old first',watch_history:{watched_at:300}},{id:2,title:'New first',watch_history:{watched_at:200}}]});assert.deepEqual(Array.from(api.cards(),c=>c.id),[1,2]);assert.equal(events.length,2);
  api.refresh();L.Account.Permit.account.profile.id=8;assert.deepEqual(Array.from(api.cards(),c=>c.id),[1,2]);calls[3].ok({results:[{id:99,title:'Wrong profile'}]});assert.equal(api.cards().some(c=>c.id===99),false);
 }finally{w.close();}
});
test('visible idle refresh updates CUB marks and notifies cards after the native callback; playback and disabled sync pause it',async()=>{
 const d=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;try{
  let poll,marks=0,timeline=0,callback;const events=[];w.setInterval=fn=>{poll=fn;return 1;};
  const L={Storage:{get:(k,f)=>f},Account:{Permit:{sync:true,account:{profile:{id:7}}},Timeline:{update(){timeline++;}},Bookmarks:{update(cb){marks++;callback=cb;}}},Listener:{send:(n,e)=>events.push(e),follow(){}}};
  const sync=load(w,'progress-sync')(L,()=>true);sync.refresh();assert.equal(marks,1);assert.equal(timeline,1);assert.equal(events.length,0);callback();assert.equal(events[0].target,'favorite');
  // Deterministic clock advance, exercising the real periodic refresh callback.
  const real=w.Date.now;w.Date.now=()=>real()+31000;poll();assert.equal(marks,2);assert.equal(timeline,2);callback();
  w.Date.now=()=>real()+62000;L.Controller={enabled:()=>({name:'player'})};poll();assert.equal(marks,2);
  L.Controller.enabled=()=>({name:'content'});L.Account.Permit.sync=false;poll();assert.equal(marks,2);sync.stop();
 }finally{w.close();}
});

test('movie completion follows remote CUB marks and their removal rather than stale local flags, with no fictional time',()=>{
 const d=new JSDOM('<body><div class="card focus"><div class="card__view"></div></div></body>',{runScripts:'outside-only'}),w=d.window;try{
  let marked=true;const records={},L={Account:{Permit:{sync:true}},Favorite:{check:()=>({wath:true}),cloud:()=>({wath:marked})},Storage:{get:(k,f)=>k==='file_view_7'?records:f},Utils:{hash:x=>x},Timeline:{filename:()=> 'file_view_7',view:()=>({percent:0,time:0}),render:value=>{const n=w.document.createElement('div');n.className='time-line';n.dataset.hash=value.hash;n.innerHTML='<div></div>';return n;}}};
  const api=load(w,'series-status')(L,()=>{}),node=w.document.querySelector('.card');api.track(node,{id:77,title:'Фильм',original_title:'Movie',source:'test'});api.paint(node);
  assert.equal(node.querySelector('.pt-card-watch__label').textContent,'Фильм просмотрен');assert.equal(node.querySelector('.pt-card-watch__time').textContent,'');assert.equal(Object.keys(records).length,0);
  marked=false;api.paint(node);assert.ok(node.querySelector('.card-watched').classList.contains('pt-card-watch--empty'),'Remote removal wins over stale local wath');
  records.Movie={percent:40,time:915,duration:2400};api.paint(node);assert.equal(node.querySelector('.pt-card-watch__time').textContent,'15:15');assert.equal(node.querySelector('.pt-card-watch--complete'),null);
 }finally{w.close();}
});
