const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/favorite-menu.js')],bundle:true,write:false,format:'iife',globalName:'FavoriteMenu'}).outputFiles[0].text;
test('card menus hide unavailable status actions, retain native handlers and never change saved collections',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'});try{
  const w=dom.window;w.eval(code);let premium=false,enabled=true,shown,checked=0;
  const L={Account:{hasPremium:()=>premium},Select:{show(options){shown=options;return 42;}}};w.FavoriteMenu.default(L,()=>enabled);
  const callback=()=>checked++,items=['book','like','wath','history'].map(where=>({where,title:where,onCheck:callback,checked:true}));
  items.push({separator:true,title:'Status'},...['look','viewed','scheduled','continued','thrown'].map(where=>({where,collect:true,onSelect:callback})),{title:'Plugin action',onSelect:callback});
  const original={items,onBack:callback};assert.equal(L.Select.show(original),42);
  assert.deepEqual(Array.from(shown.items,row=>row.where || row.title),['book','like','wath','history','Plugin action']);
  assert.ok(shown.items.slice(0,3).every(row=>row.subtitle));assert.equal(shown.onBack,callback);assert.equal(shown.items[0].onCheck,callback);shown.items[0].onCheck();assert.equal(checked,1);
  assert.equal(items.length,11);assert.equal(items[0].subtitle,undefined,'Do not mutate the native menu or its data');
  premium=true;L.Select.show(original);assert.equal(shown.items.length,11);assert.equal(shown.items[5],items[5],'Premium status callback and selection remain native');
  enabled=false;L.Select.show(original);assert.equal(shown,original);
  enabled=true;const unrelated={items:[{where:'viewed',noenter:true}]};L.Select.show(unrelated);assert.equal(shown,unrelated,'Do not decorate other plugin menus');
 }finally{dom.window.close();}
});
