const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('High trims small posters while retaining two source pixels per displayed pixel and protecting large and high-DPI cards',async()=>{
 const n=await native({built:true}),{w,L}=n,loaders=[],cards=[];
 w.Image=class{constructor(){loaders.push(this);}set src(v){this.url=v;}get src(){return this.url;}};
 const Card=L.Maker.get('Card',{});
 async function card(id,width,dpr){
  w.devicePixelRatio=dpr;
  const c=L.Utils.createInstance(Card,{id,title:'Film',poster_path:'/size'+id+'.jpg',source:'tmdb'});c.create();const node=c.render(true);w.document.body.appendChild(node);cards.push(c);
  node.getBoundingClientRect=()=>({width,height:width*1.5,left:0,right:width,top:0,bottom:width*1.5});
  c.visible();await wait(30);const loader=loaders.at(-1);loader.onload();return {c,loader};
 }
 try{
  const small=await card(1,220,1);assert.match(small.loader.url,/\/w500\//);assert.equal(small.c.img.src,small.loader.url);
  assert.ok(500>=220*2,'The smaller poster still has at least a twofold pixel reserve');
  const large=await card(2,400,1);assert.match(large.loader.url,/\/w780\//);
  const retina=await card(3,220,2);assert.match(retina.loader.url,/\/w780\//);
  w.innerWidth=1440;w.devicePixelRatio=1;assert.match(L.Api.img('/compact-bg.jpg','original'),/\/w1280\//);
  w.innerWidth=1920;assert.match(L.Api.img('/large-bg.jpg','original'),/\/original\//,'Do not soften full-HD loading backdrops');
  assert.deepEqual(n.errors,[]);
 }finally{cards.forEach(c=>c.destroy());n.close();}
});
