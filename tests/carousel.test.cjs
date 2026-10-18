const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),{JSDOM}=require('jsdom');
function setup(){
 const dom=new JSDOM('<section></section>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,node=w.document.querySelector('section');
 const timers=new Map();let now=0,id=0,active=true,count=0,observer;
 w.setTimeout=(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;};w.clearTimeout=id=>timers.delete(id);
 w.IntersectionObserver=class{constructor(fn){observer=this;this.callback=fn;}observe(){}disconnect(){this.disconnected=true;}};
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/carousel.js')],bundle:true,format:'iife',globalName:'Carousel',write:false}).outputFiles[0].text;w.eval(code);
 const rotation=w.Carousel.default(node,()=>count++,()=>active);
 const advance=ms=>{const end=now+ms;while(true){const due=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!due || due[1].at>end)break;now=due[1].at;timers.delete(due[0]);due[1].fn();}now=end;};
 return {dom,w,node,timers,rotation,observer,advance,count:()=>count,enabled:value=>{active=value;rotation.refresh();},close(){rotation.dispose();w.close();}};
}
test('carousel changes at 10 seconds and manual selection resets the single timer',()=>{
 const f=setup();try{f.advance(9999);assert.equal(f.count(),0);f.advance(1);assert.equal(f.count(),1);assert.equal(f.timers.size,1);f.advance(9000);f.rotation.refresh();f.advance(9999);assert.equal(f.count(),1);f.advance(1);assert.equal(f.count(),2);}finally{f.close();}
});
test('hidden, inactive and offscreen heroes keep no recurring timers or background rotations',()=>{
 const f=setup();try{
   Object.defineProperty(f.w.document,'hidden',{value:true,configurable:true});f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(f.timers.size,0);f.advance(30000);assert.equal(f.count(),0);
   Object.defineProperty(f.w.document,'hidden',{value:false,configurable:true});f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(f.timers.size,1);
   f.enabled(false);assert.equal(f.timers.size,0);f.enabled(true);f.observer.callback([{isIntersecting:false}]);assert.equal(f.timers.size,0);f.advance(30000);assert.equal(f.count(),0);
   f.observer.callback([{isIntersecting:true}]);f.advance(10000);assert.equal(f.count(),1);
 }finally{f.close();}
});
test('pointer and touch interaction pause rotation; destroy disconnects visibility observation and timer',()=>{
 const f=setup();try{
   const hover=new f.w.Event('pointerenter');hover.pointerType='mouse';f.node.dispatchEvent(hover);assert.equal(f.timers.size,0);f.node.dispatchEvent(new f.w.Event('pointerleave'));assert.equal(f.timers.size,1);
   f.node.dispatchEvent(new f.w.Event('touchstart'));assert.equal(f.timers.size,0);f.node.dispatchEvent(new f.w.Event('touchend'));f.advance(10000);assert.equal(f.count(),1);
   f.rotation.dispose();assert.equal(f.timers.size,0);assert.equal(f.observer.disconnected,true);f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(f.timers.size,0);
 }finally{f.close();}
});
