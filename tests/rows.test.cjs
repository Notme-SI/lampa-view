const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild');const {JSDOM}=require('jsdom');
test('TV prepares a full upcoming row without measuring distant rail contents or mounting a half-screen surplus',async()=>{
 const dom=new JSDOM('<body class="pt-tv"><div class="items-line"><div class="card"></div></div></body>',{runScripts:'outside-only'}),w=dom.window;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/rows.js')],bundle:true,write:false,format:'iife',globalName:'Rows'}).outputFiles[0].text;w.eval(bundle);
 const root=w.document.querySelector('.items-line'),card=root.firstChild;let top=4000,reads=0,appends=0;
 root.getBoundingClientRect=()=>({width:960,top,bottom:top+200});card.getBoundingClientRect=()=>({width:100});
 const line={view:7,params:{items:{view:7}},render:()=>root,scroll:{render(){reads++;return {querySelector:()=>null};}},emit(){appends++;}};
 const data={results:Array.from({length:50},(_,id)=>({id}))},event=w.Rows.default({},()=>true);
 try{
  event({type:'visible',line,data});await new Promise(r=>setTimeout(r,30));assert.equal(reads,0);assert.equal(appends,0);
  top=w.innerHeight+200;event({type:'visible',line,data});await new Promise(r=>setTimeout(r,30));assert.equal(reads,1);assert.equal(appends,1);assert.equal(line.view,11,'One complete 960px row plus one poster is prepared ahead');
 }finally{event({type:'destroy',line});w.close();}
});
test('wide screen prepares the next visible row without prebuilding distant catalogue rows',async()=>{
 const dom=new JSDOM('<body><div class="items-line"><div class="card"></div></div></body>',{runScripts:'outside-only'}),w=dom.window;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/rows.js')],bundle:true,write:false,format:'iife',globalName:'Rows'}).outputFiles[0].text;w.eval(bundle);
 const root=w.document.querySelector('.items-line'),card=root.firstChild;root.getBoundingClientRect=()=>({width:1800,top:100,bottom:400});card.getBoundingClientRect=()=>({width:170});
 const data={results:Array.from({length:20},(_,i)=>({id:i}))};let created=7,updates=0;
 const line={view:7,params:{items:{view:7}},render:()=>root,emit:event=>{assert.equal(event,'scroll');created=Math.min(data.results.length,line.view+1);updates++;}};
 const event=w.Rows.default({},()=>true);event({type:'visible',line,data});event({type:'append',line,data});
 await new Promise(resolve=>setTimeout(resolve,15));assert.ok(created>=11);assert.ok(created<20);assert.equal(updates,1);
 root.getBoundingClientRect=()=>({width:2400,top:2000,bottom:2300});event({type:'visible',line,data});await new Promise(resolve=>setTimeout(resolve,15));assert.equal(updates,1);
 root.getBoundingClientRect=()=>({width:2400,top:w.innerHeight+300,bottom:w.innerHeight+600});event({type:'visible',line,data});await new Promise(resolve=>setTimeout(resolve,15));assert.equal(updates,2,'Prepare complete next-screen rows before the wheel reaches them');
 root.getBoundingClientRect=()=>({width:2400,top:100,bottom:400});w.document.body.classList.add('pt-wheel-active');event({type:'visible',line,data});await new Promise(resolve=>setTimeout(resolve,15));assert.equal(updates,2);
 w.document.body.classList.remove('pt-wheel-active');w.document.dispatchEvent(new w.Event('minimal:wheel-idle'));await new Promise(resolve=>setTimeout(resolve,15));assert.equal(updates,3);
 event({type:'destroy',line});dom.window.close();
});
