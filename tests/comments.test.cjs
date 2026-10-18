const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
test('comment arrows page real Lampa Scroll, respect bounds, accept touch and clean up',async()=>{
 const r=await native(),{w,L}=r;
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);L.Storage.set('animation',false);w.document.body.classList.add('pt-reduce-motion');
  w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/comments.js')],bundle:true,write:false,format:'iife',globalName:'Comments'}).outputFiles[0].text);
  const row=w.document.createElement('section');row.innerHTML='<div class="items-line__head"><div class="items-line__title">Комментарии</div></div><div class="items-line__body"></div>';w.document.body.appendChild(row);
  const scroll=new L.Scroll({horizontal:true,scroll_by_item:true}),viewport=scroll.render(true),body=scroll.body(true);row.lastChild.appendChild(viewport);viewport.querySelector('.scroll__content').style.padding='0px';let width=600;
  Object.defineProperty(viewport,'offsetWidth',{get:()=>width});Object.defineProperty(viewport,'clientWidth',{get:()=>width});Object.defineProperty(body,'scrollWidth',{get:()=>1600});Object.defineProperty(body,'offsetWidth',{get:()=>1600});
  viewport.getBoundingClientRect=()=>({left:0,right:width,width,height:200});body.getBoundingClientRect=()=>({left:scroll.position(),right:1600+scroll.position(),width:1600,height:180});
  const cards=Array.from({length:5},(_,i)=>{const card=w.document.createElement('div');card.className='full-review selector';card.textContent='Комментарий '+i;card.getBoundingClientRect=()=>({left:i*320+scroll.position(),right:i*320+300+scroll.position(),width:300,height:180});body.appendChild(card);return card;});
  const modules=[],item={active:0,items:cards.map(card=>({render:()=>card})),data:{results:cards},use:m=>modules.push(m),emit:event=>modules.forEach(m=>{const callback=m['on'+event[0].toUpperCase()+event.slice(1)];if(callback)callback();})};scroll.onScroll=()=>item.emit('scroll');
  w.Comments.default(item,row);w.Comments.default(item,row);const [previous,next]=row.querySelectorAll('button');assert.equal(row.querySelectorAll('.minimal-comments-nav').length,1);assert.equal(previous.disabled,true);assert.equal(next.disabled,false);
  next.click();assert.equal(scroll.position(),-320);assert.equal(item.active,1);next.click();assert.equal(scroll.position(),-640,'rapid clicks must advance again');previous.click();assert.equal(scroll.position(),-320);
  for(let n=0;n<10;n++)next.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal(scroll.position(),-1000);assert.equal(next.disabled,true);assert.equal(previous.disabled,false);
  while(scroll.position()<0)previous.click();assert.equal(scroll.position(),0);assert.equal(previous.disabled,true);
  function touch(type,x){const event=new w.Event(type,{bubbles:true});Object.defineProperty(event,'touches',{value:[{clientX:x,clientY:10}]});Object.defineProperty(event,'changedTouches',{value:[{clientX:x,clientY:10}]});viewport.dispatchEvent(event);}
  touch('touchstart',500);touch('touchmove',180);touch('touchend',180);assert.equal(scroll.position(),-320);
  cards[1].dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,shiftKey:true,deltaY:100}));assert.equal(scroll.position(),-420);assert.equal(scroll.params().scroll_by_item,true);
  width=2000;w.dispatchEvent(new w.Event('resize'));await new Promise(resolve=>setTimeout(resolve,30));scroll.reset();item.emit('visible');await new Promise(resolve=>setTimeout(resolve,30));assert.equal(row.querySelector('.minimal-comments-nav').hidden,true,'no arrows when every card fits');
  item.emit('destroy');const position=scroll.position();next.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal(scroll.position(),position);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('comment arrows advance native lazy batches and native focus keeps controlling the same row',async()=>{
 const r=await native(),{w,L}=r;
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);L.Storage.set('animation',false);
  L.Api.full=(p,ok)=>ok({movie:{id:403,title:'Фильм',original_title:'Film',production_countries:[],production_companies:[],spoken_languages:[],genres:[],release_date:'2026-01-01',source:'tmdb'},persons:{cast:[],crew:[]},discuss:{total_pages:1,result:Array.from({length:12},(_,i)=>({id:800+i,email:'Viewer '+i,comment:'Комментарий '+i,liked:0}))},reactions:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
  L.Activity.push({component:'full',id:403,method:'movie',source:'tmdb',card:{id:403,title:'Фильм',source:'tmdb'}});await new Promise(resolve=>setTimeout(resolve,150));
  const full=L.Activity.active().activity.component,index=full.rows.findIndex(row=>Array.isArray(row)&&row[0]==='discuss'),row=full.items[index],node=row.render(true),scroll=row.scroll,viewport=scroll.render(true),body=scroll.body(true);viewport.querySelector('.scroll__content').style.padding='0px';
  Object.defineProperty(viewport,'offsetWidth',{value:600});Object.defineProperty(body,'scrollWidth',{get:()=>body.children.length*320});Object.defineProperty(body,'offsetWidth',{get:()=>body.children.length*320});viewport.getBoundingClientRect=()=>({left:0,right:600,width:600,height:200});body.getBoundingClientRect=()=>({left:scroll.position(),width:body.children.length*320});
  function geometry(card){card.getBoundingClientRect=()=>({left:Array.from(body.children).indexOf(card)*320+scroll.position(),width:300,height:180});Object.defineProperty(card,'offsetWidth',{value:300,configurable:true});}
  Array.from(body.children).forEach(geometry);row.use({onAppend:item=>geometry(item.render(true))});row.emit('visible');await new Promise(resolve=>setTimeout(resolve,30));
  const count=row.items.length,next=node.querySelectorAll('.minimal-comments-arrow')[1];assert.equal(next.disabled,false);next.click();assert.equal(row.active,1);assert.ok(row.items.length>count,'arrow must advance the native lazy batch');assert.equal(scroll.position(),-320);
  row.items[3].render(true).dispatchEvent(new w.Event('hover:focus',{bubbles:true}));assert.equal(row.active,3);assert.ok(scroll.position()<-320,'native remote focus still scrolls comments');assert.equal(node.querySelectorAll('.minimal-comments-nav .selector').length,0,'pointer arrows must not enter the remote card collection');assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
