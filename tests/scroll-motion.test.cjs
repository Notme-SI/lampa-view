const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
const {JSDOM}=require('jsdom');
function setup(){
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let time=0,id=0,value=0;const frames=new Map();
 w.matchMedia=()=>({matches:false});w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};w.cancelAnimationFrame=id=>frames.delete(id);
 Object.defineProperty(w.performance,'now',{value:()=>time});
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/scroll-motion.js')],bundle:true,write:false,format:'iife',globalName:'Motion'}).outputFiles[0].text);
 const motion=w.Motion.default(()=>value,next=>{value=next;});
 return {w,dom,motion,frames,get value(){return value;},tick(ms=16){time+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));}};
}
test('focus scrolling replaces an in-flight destination and reverses on the next frame',()=>{
 const s=setup();s.motion.to(500);assert.equal(s.value,0);s.tick();assert.ok(s.value>0 && s.value<200);
 const first=s.value;s.motion.to(900);assert.equal(s.frames.size,1);assert.equal(s.value,first);s.tick();assert.ok(s.value>first);
 const second=s.value;s.motion.to(0);s.tick();assert.ok(s.value<second);
 for(let i=0;i<15;i++)s.tick();assert.equal(s.value,0);assert.equal(s.frames.size,0);assert.equal(s.motion.active(),false);s.dom.window.close();
});
test('wheel takeover cancels motion and page pause can preserve the selected destination',()=>{
 const s=setup();s.motion.to(500);s.tick();s.motion.stop();const stopped=s.value;s.tick(300);assert.equal(s.value,stopped);
 s.motion.to(900);s.tick();s.motion.stop(true);assert.equal(s.value,900);assert.equal(s.frames.size,0);s.dom.window.close();
});
test('reduced motion applies focus positions immediately without queued frames',()=>{
 const s=setup();s.w.matchMedia=()=>({matches:true});s.motion.to(500);assert.equal(s.value,500);assert.equal(s.frames.size,0);s.dom.window.close();
});
test('badge layout cache survives a busy/idle cycle while real focus still invalidates it',()=>{
 const s=setup(),w=s.w;w.document.body.className='lampa_view pt-tv';
 w.document.body.innerHTML='<div class="card"><div class="card__view"></div></div>';
 const card=w.document.querySelector('.card'),view=card.firstChild;let reads=0;
 Object.defineProperties(view,{clientWidth:{value:180},clientHeight:{value:270}});
 view.getBoundingClientRect=()=>{reads++;return {width:180,height:270,top:0,bottom:270,left:0,right:180};};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/badge-layout.js')],bundle:true,write:false,format:'iife',globalName:'Badges'}).outputFiles[0].text);
 const badges=w.Badges.default();badges.schedule(card);s.tick();assert.equal(reads,1);
 w.document.body.classList.add('pt-tv-busy','pt-arrow-navigation','pt-wheel-active');
 w.document.body.classList.remove('pt-tv-busy','pt-arrow-navigation','pt-wheel-active');
 badges.schedule(card);s.tick();assert.equal(reads,1,'Movement flags must not invalidate identical badge geometry');
 card.classList.add('focus');badges.schedule(card);s.tick();assert.equal(reads,2);s.dom.window.close();
});
test('native catalogue poster visibility starts eager loading without a synchronous poster rectangle read',async()=>{
 const app=await require('./fixtures/native-lampa.cjs')({built:true,initialStorage:{lampa_view_layout:'tv'}}),{w,L}=app;
 try{
  const host=w.document.createElement('div');host.className='activity activity--active';host.innerHTML='<div class="pt-browser-catalogue"><div class="mapping--grid"></div></div>';w.document.body.appendChild(host);
  const card=L.Utils.createInstance(L.Maker.get('Card',{}),{id:777,title:'Проверка',poster_path:'/poster.jpg',source:'tmdb'});card.create();host.querySelector('.mapping--grid').appendChild(card.render(true));
  let reads=0;card.render(true).getBoundingClientRect=()=>{reads++;return {top:0,bottom:270,left:0,right:180,width:180,height:270};};
  card.visible();assert.equal(reads,0,'Request priority must reuse native visibility instead of forcing poster layout');
  assert.equal(card.img.loading,'eager');assert.equal(card.img.fetchPriority,'auto');
 }finally{app.close();}
});
