const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('startup replaces a restored film category with home once, then preserves ordinary navigation and back',async()=>{
 const n=await native({built:true,requestPipeline:true,url:'http://lampa.example.invalid/?component=category&url=movie&source=cub',initialStorage:{start_page:'last',activity:{component:'category',url:'movie',source:'cub'}}}),{w,L}=n;
 try{
  assert.equal(L.Storage.value('start_page'),'main');assert.equal(L.Activity.active().component,'main');assert.equal(w.start_deep_link.component,'main');assert.equal(new URL(w.location.href).searchParams.get('component'),'main');
  L.Api.category=(p,ok)=>w.setTimeout(()=>ok([{title:'Фильмы',url:'movies',source:'cub',results:[{id:1,title:'Фильм'}]}]),0);L.Activity.push({component:'category',url:'movie',source:'cub',title:'Фильмы'});await wait(80);L.Listener.send('app',{type:'ready'});assert.equal(L.Activity.active().url,'movie');L.Activity.backward();assert.equal(L.Activity.active().component,'main');assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('missing legacy Shikimori posters are repaired in visible batches, cached by Shikimori ID, and normal posters make no request',async()=>{
 const n=await native({built:true,requestPipeline:true}),{w,L}=n;
 try{
  const queries=[];L.Listener.follow('request_before',event=>{if(event.params.url.endsWith('/api/graphql'))queries.push(event.params.post_data.query);});const network=w.testNetwork;
  w.testNetwork=(url,ok,fail)=>{if(url.endsWith('/api/graphql'))w.setTimeout(()=>ok({data:{animes:queries.at(-1).includes('1535')?[{id:'1535',poster:{originalUrl:'https://shikimori.io/uploads/poster/animes/1535/real.jpeg',mainUrl:'https://shikimori.io/uploads/poster/animes/1535/main.webp',previewUrl:'https://shikimori.io/uploads/poster/animes/1535/preview.webp'}},{id:'61316',poster:{originalUrl:'https://shikimori.io/uploads/poster/animes/61316/real.jpeg'}}]:[{id:'16498',poster:null}]}}),0);else network(url,ok,fail);};
  const Card=L.Maker.get('Card',{}),cards=[];
  function create(id,img){const data={id,shikimori_id:id,source:'minimal_shiki',name:'Аниме '+id,img},card=L.Utils.createInstance(Card,data);card.create();w.document.body.appendChild(card.render(true));cards.push(card);card.visible();return card;}
  const one=create(1535,'https://shikimori.io/assets/globals/missing_original.jpg?1'),two=create(1535,'https://shikimori.io/assets/globals/missing_original.jpg?1'),good=create(16498,'https://shikimori.io/system/animes/original/16498.jpg'),removed=create(9999,'');removed.destroy();assert.ok(one.img.src.startsWith('data:image/svg+xml'));
  // Native lazy construction may emit visible while a row is still in its fragment.
  const fragment=w.document.createDocumentFragment(),early=L.Utils.createInstance(Card,{id:61316,shikimori_id:61316,source:'minimal_shiki',name:'Re:Zero',img:'https://shikimori.io/assets/globals/missing_original.jpg'});early.create();cards.push(early);fragment.appendChild(early.render(true));assert.equal(early.render(true).isConnected,false);early.visible();w.document.body.appendChild(fragment);
  await wait(150);assert.equal(queries.length,1);assert.match(queries[0],/ids: "1535,61316"/);assert.ok(!queries[0].includes('9999'));assert.ok(early.img.src.endsWith('/61316/real.jpeg'));assert.ok(one.img.src.endsWith('/1535/real.jpeg'));assert.equal(one.img.src,two.img.src);assert.equal(one.data.id,1535);assert.equal(one.data.source,'minimal_shiki');assert.ok(good.img.src.includes('/system/animes/'));const cached=create(1535,'');assert.equal(cached.img.src,one.img.src);assert.equal(queries.length,1);
  cached.img.onerror();assert.ok(cached.img.src.endsWith('/1535/main.webp'));assert.equal(queries.length,1,'image fallback must not fetch metadata again');cached.img.onerror();assert.ok(cached.img.src.endsWith('/1535/preview.webp'));assert.equal(queries.length,1);
  good.img.onerror();await wait(850);assert.equal(queries.length,2);assert.ok(good.img.src.startsWith('data:image/svg+xml'));assert.equal(good.render(true).querySelectorAll('.card__img-broken').length,0);cards.filter(card=>card!==removed).forEach(card=>card.destroy());assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
