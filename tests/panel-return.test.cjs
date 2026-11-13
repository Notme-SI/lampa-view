const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');

test('a delayed panel close cannot restore over a newer panel session',()=>{
 const dom=new JSDOM('<body><div class="head"><button class="open--search"></button><button class="open--settings"></button></div></body>',{runScripts:'outside-only'}),w=dom.window;
 try{
  const frames=[],scroll={offset:0,position(){return this.offset;},shift(delta){this.offset-=delta;}};
  const activity={component:{scroll}},controller={
   name:'head',enabled(){return {name:this.name};},
   toggle(name){this.name=name;w.document.body.className=name==='search'?'search--open':name==='settings'?'settings--open':'';},
   collectionFocus(){},
  };
  w.requestAnimationFrame=fn=>frames.push(fn);
  const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/panel-return.js')],bundle:true,write:false,format:'iife',globalName:'PanelReturn'}).outputFiles[0].text;
  w.eval(code);
  w.PanelReturn.default({Controller:controller,Activity:{active:()=>({activity})}},()=>true);
  controller.toggle('search');controller.toggle('head');
  scroll.offset=-400;
  controller.toggle('settings');controller.toggle('head');
  assert.equal(frames.length,2);
  frames[1]();frames[0]();
  assert.equal(scroll.position(),-400);
 }finally{w.close();}
});

test('scrolling after panel close takes precedence over a pending restore frame',()=>{
 const dom=new JSDOM('<body><div class="head"><button class="open--settings"></button></div></body>',{runScripts:'outside-only'}),w=dom.window;
 try{
  const frames=[],scroll={offset:-100,position(){return this.offset;},shift(delta){this.offset-=delta;}};
  const activity={component:{scroll}},controller={name:'head',enabled(){return {name:this.name};},toggle(name){this.name=name;w.document.body.className=name==='settings'?'settings--open':'';},collectionFocus(){}};
  w.requestAnimationFrame=fn=>frames.push(fn);
  w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/panel-return.js')],bundle:true,write:false,format:'iife',globalName:'PanelReturn'}).outputFiles[0].text);
  w.PanelReturn.default({Controller:controller,Activity:{active:()=>({activity})}},()=>true);
  controller.toggle('settings');controller.toggle('head');scroll.offset=-450;
  frames[0]();assert.equal(scroll.position(),-450);
 }finally{w.close();}
});
