const test=require('node:test');
const assert=require('node:assert/strict');
const native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('TV starts visible posters immediately and a stalled first cover does not hold the second',async()=>{
 const loaders=[],cards=[];
 const n=await native({built:true,prepare(w,L){L.Platform.tv=()=>true;}}),{w,L}=n;
 try{
  w.document.body.classList.add('pt-tv-busy'); // Visible covers must not wait for remote idle.
  w.Image=class{constructor(){loaders.push(this);}set src(value){this.url=value;}get src(){return this.url;}};
  for(let i=0;i<5;i++){
   const card=L.Utils.createInstance(L.Maker.get('Card',{}),{id:100+i,title:'Film',poster_path:'/visible'+i+'.jpg'});
   card.create();const node=card.render(true);w.document.body.appendChild(node);cards.push(card);
   node.getBoundingClientRect=()=>({width:180,height:270,left:0,right:180,top:0,bottom:270});card.visible();
  }
  await wait(60);
  assert.equal(loaders.length,4,'No initial 360ms delay and at most four visible requests');
  assert.match(cards[0].img.src,/^data:/);
  loaders[1].onload();
  assert.match(cards[1].img.src,/w780\/visible1/,'A slow first image must not leave the entire row blank');
  await wait(30);assert.equal(loaders.length,5,'Next request starts without another 80ms gap');
  assert.deepEqual(n.errors,[]);
 }finally{cards.forEach(card=>card.destroy());n.close();}
});

test('TV displays a quick preview, defers its selected original while moving, and preloads only a lightweight neighbour',async()=>{
 const images=[],requests=[];
 const n=await native({built:true,prepare(w,L){L.Platform.tv=()=>true;L.TMDB.image=path=>'http://images.test/tmdb/img'+path+'?uid=test';}}),{w,L}=n,$=w.jQuery;
 try{
  w.innerWidth=3840;w.devicePixelRatio=2;
  w.Image=class{constructor(){images.push(this);}set src(value){this.url=value;}get src(){return this.url;}decode(){return Promise.resolve();}};
  const get=L.Api.sources.tmdb.get;
  L.Api.sources.tmdb.get=(url,p,ok,fail)=>url.includes('append_to_response=images')?requests.push({url,ok}):get.call(L.Api.sources.tmdb,url,p,ok,fail);
  const root=$('<main><div class="items-line"></div></main>').appendTo(w.document.body),activity={render:()=>root};
  const cards=[1,2,3].map(id=>({id,title:'Film '+id,overview:'Summary',backdrop_path:'/banner'+id+'.jpg',source:'tmdb'}));
  L.Listener.send('line',{type:'append',params:{object:{component:'main',activity}},data:{results:cards}});await wait(30);
  assert.equal(images.length,1);assert.match(images[0].url,/\/w1280\/banner1/);assert.equal(requests.length,0);
  await wait(1250);assert.equal(images.length,1,'A stalled selected preview never starts neighbour downloads');
  w.document.body.classList.add('pt-tv-busy');images[0].onload();await wait(20);
  assert.match(root.find('.pt-hero__image').attr('src'),/\/w1280\/banner1/);assert.equal(requests.length,1);
  requests[0].ok({images:{logos:[{file_path:'/title.png',iso_639_1:'ru'}]}});images[1].onload();await wait(750);
  assert.equal(images.filter(i=>/\/original\/banner/.test(i.url)).length,0,'No 4K decode competes with remote movement');
  w.document.body.classList.remove('pt-tv-busy');w.document.dispatchEvent(new w.Event('minimal:tv-idle'));await wait(750);
  const original=images.find(i=>/\/original\/banner1/.test(i.url));assert.ok(original);original.onload();await wait(20);
  assert.match(root.find('.pt-hero__image').attr('src'),/\/original\/banner1/,'Explicit High finishes with the source original');
  await wait(1250);const warmed=images.filter(i=>/banner[23]/.test(i.url));assert.equal(warmed.length,1);assert.match(warmed[0].url,/\/w1280\/banner2/);warmed[0].onload();await wait(10);
  const before=images.length;root.find('.pt-hero__dot').eq(1).trigger('hover:enter');assert.match(root.find('.pt-hero__image').attr('src'),/\/w1280\/banner2/);assert.equal(images.length,before,'The warmed preview displays immediately without a second preview request');
  await wait(750);const selected=images.find(i=>/\/original\/banner2/.test(i.url));assert.ok(selected);selected.onload();await wait(20);assert.match(root.find('.pt-hero__image').attr('src'),/\/original\/banner2/);
  assert.equal(images.filter(i=>/\/original\/banner3/.test(i.url)).length,0);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('unchanged card focus does not rewrite persistent metadata but changed ratings still persist',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  const Card=L.Maker.get('Card',{}),card=L.Utils.createInstance(Card,{id:981,title:'Film',release_date:'2025-01-01',genre_ids:[28],vote_average:8,source:'tmdb'});
  card.create();w.document.body.appendChild(card.render(true));card.visible();
  await wait(400);
  const writes=[],set=L.Storage.set;
  L.Storage.set=function(key,value){if(key==='minimal_card_info_v1')writes.push(value);return set.apply(this,arguments);};
  for(let i=0;i<30;i++)card.render(true).dispatchEvent(new w.Event('hover:focus',{bubbles:true}));
  await wait(400);assert.equal(writes.length,0);
  card.data.vote_average=9;
  card.render(true).dispatchEvent(new w.Event('hover:focus',{bubbles:true}));
  await wait(400);assert.equal(writes.length,1);
  assert.ok(writes[0].some(([key,value])=>key==='tmdb:movie:981' && value.vote_average===9));
  card.destroy();assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
