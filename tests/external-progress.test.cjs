const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/external-progress.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text;
function fixture(){
 const dom=new JSDOM('',{url:'http://lampac.rest/?card=91&media=tv&source=tmdb',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,storage=new Map(),events={},writes=[],requests=[];let file='one',answer=null;
 const hash=value=>{let h=0;for(const c of value)h=(31*h+c.charCodeAt(0))|0;return String(Math.abs(h));};
 const L={Storage:{get:(k,d)=>storage.has(k)?storage.get(k):d,set:(k,v)=>storage.set(k,v)},Utils:{hash},Timeline:{filename:()=>file,update:r=>writes.push(r)},Activity:{active:()=>({movie:{id:91,name:'Show',original_name:'Show'}})},Player:{listener:{follow:(name,fn)=>events[name]=fn}}};
 w.jQuery={ajax:options=>{requests.push(options);w.setTimeout(()=>options.success(options.type==='POST'?{success:true}:{result:answer}),0);}};
 w.module={exports:{}};w.eval(code);const api=w.module.exports.default(L,()=>true);
 const video={season:1,episode:2,timeline:{hash:'episode2',time:341,duration:1440,profile:0}};
 async function launch(url='custom-player://x-callback-url/play?url='+encodeURIComponent('https://media.invalid/episode2')){let result=url;const tasks=[];events.external_url({url,data:video,setUrl:value=>result=value,waitUntil:p=>tasks.push(p)});await Promise.all(tasks);return new URL(result);}
 return {w,L,api,storage,events,writes,requests,video,launch,profile:value=>file=value,answer:value=>answer=value,close:()=>dom.window.close()};
}
test('an arbitrary registered x-callback player gets the common return protocol without a player-name allowlist',async()=>{
 const f=fixture();try{const url=await f.launch();assert.equal(url.protocol,'custom-player:');assert.equal(url.searchParams.get('position'),'341');assert.equal(f.writes.length,0,'Opening an app must not invent viewing');const callback=new URL(url.searchParams.get('x-success'));assert.match(callback.pathname,/lampa-view-progress\/return\/[a-f0-9]{32}$/);const session=f.storage.get('minimal_external_sessions_v1')[0];assert.ok(!callback.pathname.endsWith(session.id),'Return capability differs from read capability');assert.equal(f.requests[0].data.includes('account'),false);f.answer({position:700,duration:1440,status:'stopped',result:'success'});f.api.refresh();await new Promise(r=>setTimeout(r,20));assert.equal(f.writes[0].time,700);assert.equal(f.writes[0].episode,2);assert.equal(f.writes[0].card,'tv_91');assert.equal(f.storage.get('minimal_external_sessions_v1').length,0);}finally{f.close();}
});
test('native adapter callbacks and non-callback URI contracts stay owned by their adapter',async()=>{
 const f=fixture();try{let uri=await f.launch('custom-player://video?url=abc');assert.equal(uri.href,'custom-player://video?url=abc');uri=await f.launch('custom-player://x-callback-url/play?url=abc&x-success=custom-app%3A%2F%2Freturn');assert.equal(uri.searchParams.get('x-success'),'custom-app://return');assert.equal(f.requests.length,0);}finally{f.close();}
});
test('only actual measured returns update the original title/episode in the original account scope',async()=>{
 const f=fixture();try{await f.launch();const s=f.storage.get('minimal_external_sessions_v1')[0];for(const values of [{status:'finished'},{position:NaN},{position:-3},{position:99999,duration:10},{position:600,'lastPlayedUrl':'https://media.invalid/other'},{position:600,'request-id':'other'},{position:600,result:'cancel'}])assert.equal(f.api.report(s.id,values),false);f.profile('other');assert.equal(f.api.report(s.id,{position:600,duration:1440}),false);assert.equal(f.writes.length,0);f.profile('one');assert.equal(f.api.report(s.id,{position:1440,duration:1440,status:'finished'}),true);assert.equal(f.writes[0].percent,100);assert.equal(f.api.report(s.id,{position:1}),false,'A replay cannot replace the final time');}finally{f.close();}
});
test('direct web return survives reload and removes only callback parameters',async()=>{
 const f=fixture();try{await f.launch();const s=f.storage.get('minimal_external_sessions_v1')[0];f.w.history.replaceState({},'','?card=91&media=tv&source=tmdb&lampa_view_return='+s.id+'&lampa_view_result=success&position=701&duration=1440&status=stopped');f.api.consume();assert.equal(f.writes[0].time,701);assert.equal(f.w.location.search,'?card=91&media=tv&source=tmdb');}finally{f.close();}
});

test('external playlist reports only the identified episode and cannot resurrect cleared progress',async()=>{
 const f=fixture();
 try{
  f.video.episode=5;f.video.timeline.hash='episode5';
  f.video.playlist=[6,7,8].map(episode=>({season:1,episode,url:'https://media.invalid/episode'+episode,timeline:{hash:'episode'+episode,duration:1440}}));
  const url='custom-player://x-callback-url/play?url='+encodeURIComponent('https://media.invalid/episode5');
  await f.launch(url);
  let session=f.storage.get('minimal_external_sessions_v1').at(-1);
  assert.equal(f.api.report(session.id,{position:700,duration:1440}),false);
  assert.equal(f.writes.length,0,'A playlist callback without a file identity must not mark the launch episode');
  const result={position:700,duration:1440,lastPlayedUrl:'https://media.invalid/episode8'};
  assert.equal(f.api.report(session.id,result),true);
  assert.deepEqual(f.writes.map(({hash,episode,time})=>({hash,episode,time})),[{hash:'episode8',episode:8,time:700}]);
  await f.launch(url);
  session=f.storage.get('minimal_external_sessions_v1').at(-1);
  f.storage.set('one',{episode8:{percent:0,time:0,updated:session.at+1}});
  assert.equal(f.api.report(session.id,result),false);assert.equal(f.writes.length,1);
 }finally{f.close();}
});
