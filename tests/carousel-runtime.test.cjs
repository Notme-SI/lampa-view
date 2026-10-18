const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
test('native home rotates cards, pauses behind settings and cleans up with its activity',async()=>{
 const r=await native(),{w,L}=r,$=w.jQuery,timers=new Map();let now=0,id=0;
 const nativeTimer=w.setTimeout.bind(w),nativeClear=w.clearTimeout.bind(w);
 w.setTimeout=(fn,delay,...args)=>delay===10000?(timers.set(++id,{fn,at:now+delay}),-id):nativeTimer(fn,delay,...args);
 w.clearTimeout=key=>key<0?timers.delete(-key):nativeClear(key);
 const advance=()=>{now+=10000;const due=[...timers].filter(([,t])=>t.at<=now);due.forEach(([key,t])=>{timers.delete(key);t.fn();});};
 const tick=()=>new Promise(resolve=>setTimeout(resolve,20)),hooks=[];
 try{
  const root=$('<main><div class="items-line"><div class="items-line__body"></div></div></main>').appendTo(w.document.body),activity={render:()=>root,component:{use:hook=>hooks.push(hook)}};
  L.Activity.active=()=>({activity});
  const cards=[{id:1,title:'Первый',overview:'Описание',backdrop_path:'/a.jpg',source:'tmdb'},{id:2,title:'Второй',overview:'Описание',backdrop_path:'/b.jpg',source:'tmdb'}];
  L.Listener.send('line',{type:'append',params:{object:{component:'main',activity}},data:{results:cards}});await tick();
  const selected=()=>root.find('.pt-hero__dot.active').attr('title');assert.equal(selected(),'Первый');assert.equal(timers.size,1);
  advance();assert.equal(selected(),'Второй');assert.equal(timers.size,1);
  w.document.body.classList.add('settings--open');L.Settings.listener.send('open',{});await tick();assert.equal(timers.size,0);advance();assert.equal(selected(),'Второй');
  w.document.body.classList.remove('settings--open');L.Settings.listener.send('close',{});await tick();assert.equal(timers.size,1);advance();assert.equal(selected(),'Первый');
  L.Controller.toggle('menu');await tick();assert.equal(timers.size,0);L.Controller.toggle('content');await tick();assert.equal(timers.size,1);
  L.Controller.add('modal',{toggle(){}});L.Controller.toggle('modal');L.Modal.listener.send('fullshow',{});await tick();assert.equal(timers.size,0);
  L.Controller.toggle('content');L.Modal.listener.send('close',{});await tick();assert.equal(timers.size,1);advance();assert.equal(selected(),'Второй');
  hooks.forEach(hook=>hook.onDestroy?.());assert.equal(timers.size,0);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
