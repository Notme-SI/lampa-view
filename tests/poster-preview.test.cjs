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
  await wait(50);assert.equal(loaders.filter(l=>l.url).length,3,'Original downloads stay bounded');
  assert.equal(loaders[0].fetchPriority,'low');assert.match(loaders[0].url,/\/original\//);
  loaders[0].onload();assert.match(cards[0].img.src,/\/original\//);
  loaders[1].onerror();assert.match(cards[1].img.src,/img_broken/,'Failed original has a stable fallback');
  await wait(50);assert.equal(loaders.filter(l=>l.url).length,4);
  const repeated=L.Utils.createInstance(Card,{id:8,title:'Repeat',poster_path:'/poster0.jpg',source:'tmdb'});repeated.create();w.document.body.appendChild(repeated.render(true));repeated.visible();cards.push(repeated);
  await wait(30);assert.equal(loaders.length,4,'Repeated posters reuse the decoded cache');assert.match(repeated.img.src,/\/original\//);
  const pending=loaders[2].onload;
  L.Storage.set('minimal_banner_quality','high');
  L.SettingsApi.getParam('minimal_settings_appearance').find(p=>p.param.name==='minimal_banner_quality').onChange();
  pending();assert.match(cards[2].img.src,/\/w500\//,'An old request must not overwrite a new quality setting');
  cards.forEach(c=>c.destroy());assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
