const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('posters appear at final quality, share cached originals and cancel stale quality loads',async()=>{
 const n=await native({built:true}),{w,L}=n,loaders=[];
 try{
  w.Image=class{constructor(){loaders.push(this);}set src(v){this.url=v;}get src(){return this.url;}};
  const Card=L.Maker.get('Card',{}),cards=[];
  for(let i=0;i<4;i++){
   const c=L.Utils.createInstance(Card,{id:i+1,title:'Film',poster_path:'/poster'+i+'.jpg',source:'tmdb'});
   c.create();w.document.body.appendChild(c.render(true));cards.push(c);
   assert.ok(!c.img.src.includes('/t/p/'),'Hidden card must stay lazy');
   c.visible();assert.match(c.img.src,/^data:image\/gif/,'No blurry intermediate poster');
  }
  await wait(50);assert.equal(loaders.filter(l=>l.url).length,4,'Visible originals use bounded parallel requests');
  assert.equal(loaders[0].fetchPriority,'high');assert.match(loaders[0].url,/\/w780\//);
  loaders[0].onload();assert.match(cards[0].img.src,/\/w780\//);
  loaders[1].onerror();assert.match(cards[1].img.src,/img_broken/,'Failed original has a stable fallback');
  await wait(50);assert.equal(loaders.filter(l=>l.url).length,4);
  const repeated=L.Utils.createInstance(Card,{id:8,title:'Repeat',poster_path:'/poster0.jpg',source:'tmdb'});repeated.create();w.document.body.appendChild(repeated.render(true));repeated.visible();cards.push(repeated);
  await wait(30);assert.equal(loaders.length,4,'Repeated posters reuse the decoded cache');assert.match(repeated.img.src,/\/w780\//);
  const pending=loaders[2].onload;
  L.Storage.set('minimal_banner_quality','medium');
  L.SettingsApi.getParam('minimal_settings_appearance').find(p=>p.param.name==='minimal_banner_quality').onChange();
  pending();assert.match(cards[2].img.src,/\/w500\//,'An old request must not overwrite a new quality setting');
  cards.forEach(c=>c.destroy());assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('a rejected high-quality placeholder never enters native mirror retries or paints a data URI diagnostic',async()=>{
 const n=await native({built:true}),{w,L}=n,loaders=[];let card;
 try{
  w.Image=class{constructor(){loaders.push(this);}set src(v){this.url=v;}get src(){return this.url;}};
  card=L.Utils.createInstance(L.Maker.get('Card',{}),{id:81,title:'Film',poster_path:'/safari.jpg',source:'tmdb'});card.create();w.document.body.appendChild(card.render(true));card.visible();
  assert.match(card.img.src,/^data:image\/gif/);
  for(let i=0;i<4;i++)card.img.onerror(new w.Event('error'));
  assert.equal(card.img_errors,0);assert.equal(card.render(true).querySelector('.card__img-broken'),null);
  await wait(40);assert.equal(loaders.length,1);loaders[0].onload();assert.match(card.img.src,/\/w780\/safari.jpg$/);assert.equal(card.render(true).querySelector('.card__img-broken'),null);
  card.img.src='https://images.example.invalid/t/p/w780/failure.jpg';card.img.onerror(new w.Event('error'));assert.equal(card.img_errors,1,'Real image failures still reach the native handler');assert.deepEqual(n.errors,[]);
 }finally{if(card)card.destroy();n.close();}
});


test('a stalled look-ahead poster cannot block the next row while scrolling',async()=>{
 for(const tv of [false,true]){
  const n=await native({built:true,prepare(w,L){L.Platform.tv=()=>tv;}}),{w,L}=n,loaders=[],cards=[];
  try{
   w.document.body.classList.add('pt-wheel-active');if(tv)w.document.body.classList.add('pt-tv-busy');
   w.Image=class{constructor(){loaders.push(this);}set src(value){this.url=value;}get src(){return this.url;}};
   for(let i=0;i<4;i++){
    const card=L.Utils.createInstance(L.Maker.get('Card',{}),{id:1900+i,title:'Next row',poster_path:'/ahead'+i+'.jpg',source:'tmdb'});
    card.create();const node=card.render(true);w.document.body.appendChild(node);cards.push(card);
    node.getBoundingClientRect=()=>({width:120,height:180,left:i*130,right:i*130+120,top:w.innerHeight+120,bottom:w.innerHeight+300});card.visible();
   }
   await wait(60);assert.ok(loaders.length>=2,'One slow upcoming image must not serialize the whole next row');assert.ok(loaders.length<=(tv?4:8));
   for(let i=1;i<4;i++){if(loaders[i])loaders[i].onload();await wait(20);}
   assert.ok(cards.slice(1).every(c=>/\/w780\//.test(c.img.src)),'Other upcoming covers paint before the first request completes');
   assert.deepEqual(n.errors,[]);
  }finally{cards.forEach(c=>c.destroy());n.close();}
 }
});
