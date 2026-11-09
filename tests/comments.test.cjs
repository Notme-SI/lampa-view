const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
test('comment rows keep native lazy loading and focus without arrows',async()=>{
 const r=await native(),{w,L}=r;
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);L.Storage.set('animation',false);
  L.Api.full=(p,ok)=>ok({movie:{id:403,title:'Фильм',original_title:'Film',production_countries:[],production_companies:[],spoken_languages:[],genres:[],release_date:'2026-01-01',source:'tmdb'},persons:{cast:[],crew:[]},discuss:{total_pages:1,result:Array.from({length:12},(_,i)=>({id:800+i,email:'Viewer '+i,comment:'Комментарий '+i,liked:0}))},reactions:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
  L.Activity.push({component:'full',id:403,method:'movie',source:'tmdb',card:{id:403,title:'Фильм',source:'tmdb'}});await new Promise(resolve=>setTimeout(resolve,150));
  const full=L.Activity.active().activity.component,index=full.rows.findIndex(row=>Array.isArray(row)&&row[0]==='discuss'),row=full.items[index],node=row.render(true),scroll=row.scroll,viewport=scroll.render(true),body=scroll.body(true);viewport.querySelector('.scroll__content').style.padding='0px';
  Object.defineProperty(viewport,'offsetWidth',{value:600});Object.defineProperty(body,'scrollWidth',{get:()=>body.children.length*320});Object.defineProperty(body,'offsetWidth',{get:()=>body.children.length*320});viewport.getBoundingClientRect=()=>({left:0,right:600,width:600,height:200});body.getBoundingClientRect=()=>({left:scroll.position(),width:body.children.length*320});
  function geometry(card){card.getBoundingClientRect=()=>({left:Array.from(body.children).indexOf(card)*320+scroll.position(),width:300,height:180});Object.defineProperty(card,'offsetWidth',{value:300,configurable:true});}
  Array.from(body.children).forEach(geometry);row.use({onAppend:item=>geometry(item.render(true))});row.emit('visible');await new Promise(resolve=>setTimeout(resolve,30));
  const count=row.items.length;assert.equal(node.querySelectorAll('.minimal-comments-arrow').length,0);
  assert.ok(node.querySelector('.full-review-add').getAttribute('aria-label'));
  row.items[4].render(true).dispatchEvent(new w.Event('hover:focus',{bubbles:true}));assert.equal(row.active,4);row.emit('scroll');
  assert.ok(row.items.length>count || row.items.length>=row.data.results.length,'Native focus advances the lazy batch');
  row.items[3].render(true).dispatchEvent(new w.Event('hover:focus',{bubbles:true}));assert.equal(row.active,3);assert.ok(scroll.position()<-320,'native remote focus still scrolls comments');assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
