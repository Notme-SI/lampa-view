const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail-suggestions.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text;
test('late installation replaces an owned suggestion controller, preserves source and restores picker focus',async()=>{
 const r=await native({deferPlugin:true}),{L,w}=r;
 try{
  const card={id:91,title:'Film',source:'cub',production_countries:[],production_companies:[],spoken_languages:[],genres:[]};
  L.Api.full=(p,ok)=>ok({movie:card,persons:{cast:[],crew:[]},videos:{results:[]},recomend:{results:[{id:201,name:'Inherited',first_air_date:'2025-01-01'},{id:202,title:'Explicit',source:'tmdb'}]},simular:{results:[{id:301,title:'Similar'}]}});
  L.Activity.push({component:'full',id:91,source:'cub',method:'movie',card});
  await new Promise(resolve=>setTimeout(resolve,80));
  const link=L.Activity.active().activity.component,index=link.rows.findIndex(row=>row[1]?.title===L.Lang.translate('title_recomendations')),old=link.items[index];old.toggle();assert.ok(L.Controller.own(old));
  const module={exports:{}};new Function('window','document','module','exports',code)(w,w.document,module,module.exports);module.exports.default(L,link);
  const item=link.items[index],control=item.render(true).querySelector('button');assert.ok(item.minimalSuggestions);assert.ok(L.Controller.own(item));assert.equal(link.active,index);assert.equal(item.render(true).querySelector('.card'),null);
  L.Controller.enabled().controller.down();assert.equal(link.active,index+1);L.Controller.enabled().controller.up();assert.equal(link.active,index);
  let select,pushed;L.Select.show=options=>{select=options;};L.Select.hide=()=>{};L.Activity.push=object=>{pushed=object;};
  control.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));select.onBack();assert.ok(L.Controller.own(item));assert.equal(w.document.activeElement,control);assert.equal(control.getAttribute('aria-expanded'),'false');
  control.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));select.onSelect(select.items[0]);assert.equal(pushed.source,'cub');assert.equal(pushed.method,'tv');
  control.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));select.onSelect(select.items[1]);assert.equal(pushed.source,'tmdb');assert.equal(pushed.method,'movie');
  assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
