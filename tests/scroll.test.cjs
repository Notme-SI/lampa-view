const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),fs=require('fs'),esbuild=require('esbuild');const {JSDOM}=require('jsdom');
function setup(){
 const dom=new JSDOM('<body><div class="scroll" id="vertical"><div class="scroll scroll--horizontal" id="horizontal"><div id="card"></div></div></div><input id="input"></body>',{runScripts:'outside-only'}),w=dom.window;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/wheel.js')],bundle:true,write:false,format:'iife',globalName:'Wheel'}).outputFiles[0].text;w.eval(bundle);
 const calls=[],v=w.document.querySelector('#vertical'),h=w.document.querySelector('#horizontal'),params={scroll_by_item:true};
 v.Scroll={params:()=>params,wheel:delta=>calls.push({axis:'y',delta,byItem:params.scroll_by_item})};h.Scroll={params:()=>({horizontal:true}),wheel:delta=>calls.push({axis:'x',delta})};
 let legacyCalls=0;h.addEventListener('wheel',()=>legacyCalls++);v.addEventListener('wheel',()=>legacyCalls++);
 w.Wheel.default({},()=>true);
 const target=w.document.querySelector('#card');
 return {dom,w,calls,params,target,legacy:()=>legacyCalls};
}
test('standard wheel up/down keeps direction and bypasses stale row index and focus handlers',()=>{
 const {dom,w,calls,params,target,legacy}=setup();
 target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-120}));
 target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120}));
 assert.deepEqual(calls,[{axis:'y',delta:-120,byItem:false},{axis:'y',delta:120,byItem:false}]);assert.equal(params.scroll_by_item,true);assert.equal(legacy(),0);dom.window.close();
});
test('legacy duplicate is consumed once; horizontal intent stays horizontal',()=>{
 const {dom,w,calls,target}=setup();target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,deltaY:90}));
 const legacy=new w.Event('mousewheel',{bubbles:true,cancelable:true});Object.defineProperty(legacy,'wheelDelta',{value:-120});target.dispatchEvent(legacy);assert.equal(calls.length,1);
 target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,deltaX:-80,deltaY:2}));assert.equal(calls.at(-1).axis,'x');assert.equal(calls.at(-1).delta,-80);
 target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,shiftKey:true,deltaY:100}));assert.equal(calls.at(-1).axis,'x');assert.equal(calls.at(-1).delta,100);dom.window.close();
});
test('line units and ctrl zoom are preserved and remote scrolling mode is restored',()=>{
 const {dom,w,calls,target,params}=setup();target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,deltaY:-3,deltaMode:1}));assert.equal(calls[0].delta,-54);
 const zoom=new w.WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:10});target.dispatchEvent(zoom);assert.equal(zoom.defaultPrevented,false);assert.equal(calls.length,1);
 assert.equal(params.scroll_by_item,true);dom.window.close();
});
test('real Lampa Scroll reproduces wrong-direction movement; adapter fixes deltaY and stale item index',()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync(path.join(__dirname,'fixtures/jquery.js'),'utf8'));
 w.Element.prototype.toggleClass=function(name,value){this.classList.toggle(name,value);};
 w.Platform={screen:()=>true};w.Storage={field:()=>false};w.Layer={visible(){}};
 w.Template={js:()=>{const node=w.document.createElement('div');node.className='scroll';node.innerHTML='<div class="scroll__content" style="padding:0px"><div class="scroll__body"></div></div>';return node;}};
 w.eval(fs.readFileSync(path.join(__dirname,'fixtures/native-scroll.js'),'utf8'));
 const scroll=new w.Scroll({scroll_by_item:true}),node=scroll.render(true),body=scroll.body(true),params=scroll.params();w.document.body.appendChild(node);
 Object.defineProperty(node,'offsetHeight',{value:500});Object.defineProperty(body,'offsetHeight',{value:3000});Object.defineProperty(body,'scrollHeight',{value:3000});
 node.getBoundingClientRect=()=>({top:0,left:0,width:800,height:500});
 for(let i=0;i<6;i++){const card=w.document.createElement('div');card.getBoundingClientRect=()=>({top:i*500+scroll.position(),left:0});body.appendChild(card);}
 // No legacy wheelDelta: Lampa interprets an upward deltaY as downward.
 body.firstChild.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-120,clientX:1}));assert.ok(scroll.position()<0,'native regression no longer reproduces');
 scroll.reset();params.scroll_by_item=false;scroll.wheel(800);params.scroll_by_item=true;body.scroll_position=4;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/wheel.js')],bundle:true,write:false,format:'iife',globalName:'Wheel'}).outputFiles[0].text;w.eval(bundle);w.Wheel.default({},()=>true);
 body.firstChild.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-120,clientX:1}));assert.equal(scroll.position(),-680);assert.equal(params.scroll_by_item,true);
 body.firstChild.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120,clientX:1}));assert.equal(scroll.position(),-800);
 dom.window.close();
});
test('frame scrolling coalesces a burst, reverses immediately, and leaves no animation backlog',()=>{
 const {dom,w,target}=setup();let time=0,id=0,position=-500,writes=0,notifications=0;
 const frames=new Map();w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};w.cancelAnimationFrame=key=>frames.delete(key);
 const node=w.document.querySelector('#vertical');
 node.Scroll={wheel(){throw Error("animated path used legacy wheel");},position:()=>position,shift:delta=>{position=Math.min(0,Math.max(-3000,position-delta));writes++;},onScroll:()=>notifications++};
 function tick(){time+=16.67;const current=Array.from(frames.values());frames.clear();current.forEach(fn=>fn(time));}
 for(let n=0;n<12;n++)target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,deltaY:10}));
 assert.equal(frames.size,1);assert.equal(writes,0,'input handler performed layout writes');
 tick();assert.equal(writes,1);assert.ok(position<-500 && position>-620);
 const before=position;target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,deltaY:-90}));tick();assert.ok(position>before,'old momentum overrode reverse direction');
 for(let n=0;n<100 && frames.size;n++)tick();
 assert.equal(frames.size,0);assert.ok(!w.document.body.classList.contains('pt-wheel-active'));assert.ok(notifications<writes/2,'lazy loading was called on every frame');
 const idle=position;target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,deltaY:120}));w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
 assert.equal(frames.size,0);tick();assert.equal(position,idle,'old wheel animation moved after keyboard took over');dom.window.close();
});

test('first wheel frame after long page uptime stays small and blur cancels remaining motion',()=>{
 const {dom,w,target}=setup();let position=-500,id=0;
 const frames=new Map();w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};w.cancelAnimationFrame=key=>frames.delete(key);
 w.document.querySelector('#vertical').Scroll={wheel(){},position:()=>position,shift:delta=>{position-=delta;}};
 target.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120}));
 const current=[...frames.values()];frames.clear();current.forEach(fn=>fn(50000));
 assert.ok(position<-500 && position>-530,'first frame jumped as though 40 ms had elapsed');
 w.dispatchEvent(new w.Event('blur'));assert.equal(frames.size,0);assert.equal(w.document.body.classList.contains('pt-wheel-active'),false);
 dom.window.close();
});

test('wheel leaves player, form fields and browser zoom to their native handlers',()=>{
 const {dom,w,calls,target}=setup();
 const player=w.document.createElement('div');player.className='player';target.appendChild(player);
 for(const node of [player,w.document.querySelector('#input')]){
  const event=new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120});node.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
 }
 const zoom=new w.WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:120});target.dispatchEvent(zoom);
 assert.equal(zoom.defaultPrevented,false);assert.equal(calls.length,0);dom.window.close();
});
