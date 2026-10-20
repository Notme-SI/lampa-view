const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
test('pointer arrows animate a ten-card page, clamp at the last page, return left and cancel on destruction',()=>{
 const dom=new JSDOM('<body class="lampa_view"><section class="items-line"><div class="items-line__head"><h2 class="items-line__title">Films</h2></div><div class="scroll"></div></section></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/row-navigation.js')],bundle:true,write:false,format:'iife',globalName:'Rows'}).outputFiles[0].text);
 const root=w.document.querySelector('section'),viewport=root.querySelector('.scroll'),frames=new Map(),hooks=[];let id=0,position=0;
 w.requestAnimationFrame=fn=>(frames.set(++id,fn),id);w.cancelAnimationFrame=key=>frames.delete(key);
 const advance=time=>{const current=[...frames.values()];frames.clear();current.forEach(fn=>fn(time));};
 viewport.getBoundingClientRect=()=>({left:0,right:1000,width:1000});
 const line={active:0,data:{url:'films',results:Array.from({length:20},(_,id)=>({id}))},params:{items:{}},render:()=>root,use:hook=>hooks.push(hook),emit(){},items:[],scroll:{render:()=>viewport,position:()=>position,shift:delta=>position=Math.max(-1040,Math.min(0,position-delta))}};
 line.items=line.data.results.map((data,i)=>{const node=w.document.createElement('div');node.className='card';viewport.appendChild(node);node.getBoundingClientRect=()=>({left:24+i*95+position,right:24+i*95+position+85,width:85});return {data,render:()=>node};});
 try{
  w.Rows.default({Controller:{own:()=>false}},line,()=>true);const [left,right]=root.querySelectorAll('.minimal-row-arrow');assert.ok(!left.disabled);right.click();assert.equal(line.active,10);assert.equal(position,0);
  advance(0);advance(160);assert.ok(position<0 && position>-1000,'Paging must animate rather than jump');advance(320);assert.equal(position,-950);assert.ok(!right.disabled);assert.equal(frames.size,0);assert.ok(line.items[10].render().getBoundingClientRect().left>=24,'First card on the last page clears the left fade');assert.ok(line.items[19].render().getBoundingClientRect().right<=976,'Last card clears the right fade');right.click();advance(330);advance(650);assert.equal(position,-950,'Clicking the active right arrow at the end keeps its bounded position');
  left.click();advance(660);advance(980);assert.equal(position,0);assert.ok(!left.disabled);left.click();advance(990);advance(1310);assert.equal(position,0,'Clicking the active left arrow at the beginning keeps the initial padding');
  right.click();assert.equal(frames.size,1);hooks.forEach(h=>h.onDestroy&&h.onDestroy());assert.equal(frames.size,0);
 }finally{w.close();}
});
