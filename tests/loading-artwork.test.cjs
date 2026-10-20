const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');

test('native torrent loading keeps fullscreen backdrop quality and migrates previous High to Medium once',async()=>{
 const n=await native({built:true,initialStorage:{minimal_banner_quality:'high'}}),{w,L}=n;
 try{
  const setting=L.SettingsApi.getParam('minimal_settings_appearance').find(p=>p.param.name==='minimal_banner_quality');
  assert.equal(L.Storage.get('minimal_banner_quality'),'medium');
  assert.equal(L.Storage.get('minimal_artwork_quality_revision'),2);
  assert.match(L.Api.img('/poster.jpg'),/\/w500\//);
  w.innerWidth=1920;
  L.Loading.start(()=>{},'Загрузка',{media:{card:{title:'Film',backdrop_path:'/loading-backdrop.jpg'}}});
  const image=w.document.querySelector('.media-loading__backdrop');
  assert.ok(image,'The actual native torrent-loading overlay must be exercised');
  assert.match(image.src,/\/w1280\/+loading-backdrop.jpg$/,'Original backdrop request must never become a 500px poster');
  L.Storage.set('minimal_banner_quality','high');setting.onChange();
  assert.match(image.src,/\/original\/+loading-backdrop.jpg$/,'Use the full source on a full-HD screen');
  assert.match(L.Api.img('/poster.jpg'),/\/w780\//,'Delegating APIs must not reclassify a portrait as a backdrop');
  assert.match(L.Api.sources.tmdb.img('/poster.jpg'),/\/w780\//);
  assert.match(L.Api.img('/loading-backdrop.jpg','original'),/\/original\//);
  assert.equal(L.Api.img('/loading-backdrop.jpg','original'),L.TMDB.image('/t/p/original/loading-backdrop.jpg'),'Banner and loading screen share one canonical browser cache URL');
  w.innerWidth=960;setting.onChange();
  assert.match(image.src,/\/w1280\//,'Smaller screens avoid downloading an unnecessary original');
  assert.equal(L.Storage.get('minimal_banner_quality'),'high','A selected new High must not migrate back to Medium');
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
