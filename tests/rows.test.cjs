const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild');const {JSDOM}=require('jsdom');
test('wide screen expands the native seven-card batch without prebuilding offscreen rows',async()=>{
 const dom=new JSDOM('<body><div class="items-line"><div class="card"></div></div></body>',{runScripts:'outside-only'}),w=dom.window;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/rows.js')],bundle:true,write:false,format:'iife',globalName:'Rows'}).outputFiles[0].text;w.eval(bundle);
 const root=w.document.querySelector('.items-line'),card=root.firstChild;root.getBoundingClientRect=()=>({width:1800,top:100,bottom:400});card.getBoundingClientRect=()=>({width:170});
 const data={results:Array.from({length:20},(_,i)=>({id:i}))};let created=7,updates=0;
 const line={view:7,params:{items:{view:7}},render:()=>root,emit:event=>{assert.equal(event,'scroll');created=Math.min(data.results.length,line.view+1);updates++;}};
 const event=w.Rows.default({},()=>true);event({type:'visible',line,data});event({type:'append',line,data});
 await new Promise(resolve=>setTimeout(resolve,15));assert.ok(created>=11);assert.ok(created<20);assert.equal(updates,1);
 root.getBoundingClientRect=()=>({width:2400,top:2000,bottom:2300});event({type:'visible',line,data});await new Promise(resolve=>setTimeout(resolve,15));assert.equal(updates,1);
 root.getBoundingClientRect=()=>({width:2400,top:100,bottom:400});w.document.body.classList.add('pt-wheel-active');event({type:'visible',line,data});await new Promise(resolve=>setTimeout(resolve,15));assert.equal(updates,1);
 w.document.body.classList.remove('pt-wheel-active');w.document.dispatchEvent(new w.Event('minimal:wheel-idle'));await new Promise(resolve=>setTimeout(resolve,15));assert.equal(updates,2);
 event({type:'destroy',line});dom.window.close();
});
