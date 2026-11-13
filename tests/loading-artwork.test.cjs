const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');

test('native torrent loading keeps fullscreen backdrop quality and preserves previous High without a quality downgrade',async()=>{
 const n=await native({built:true,initialStorage:{minimal_banner_quality:'high'}}),{w,L}=n;
 try{
  const setting=L.SettingsApi.getParam('minimal_settings_appearance').find(p=>p.param.name==='minimal_banner_quality');
  assert.equal(L.Storage.get('minimal_banner_quality'),'high');
  assert.equal(L.Storage.get('minimal_artwork_quality_revision'),3);
  assert.match(L.Api.img('/poster.jpg'),/\/w780\//);
  w.innerWidth=1920;
  L.Loading.start(()=>{},'Загрузка',{media:{card:{title:'Film',backdrop_path:'/loading-backdrop.jpg'}}});
  const image=w.document.querySelector('.media-loading__backdrop');
  assert.ok(image,'The actual native torrent-loading overlay must be exercised');
  assert.match(image.src,/\/original\/+loading-backdrop.jpg$/,'Original backdrop request must never become a 500px poster');
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

test('torrent preloading keeps the native artwork and renders detailed statistics, then cancels cleanly',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  let cancelled=0;
  L.Loading.start(()=>{cancelled++;L.Loading.stop();},'',{media:{url:'/stream?link=example&index=1&preload',card:{title:'Film',backdrop_path:'/scene.jpg'}}});
  const host=w.document.querySelector('.media-loading--standalone'),panel=host.querySelector('.pt-torrent-loading');
  assert.ok(host.querySelector('.media-loading__backdrop').src.endsWith('scene.jpg'));
  assert.equal(host.querySelector('.media-loading__status').hidden,true);
  L.Loading.setProgress(51.2,{active_peers:15,total_peers:152,speed:'36 Мбит/с',seeders:11,preloaded:25*1048576,preload_size:50*1048576,eta:7});
  const values=()=>Array.from(panel.querySelectorAll('dl>div:not([hidden]) dd'),node=>node.textContent);
  assert.deepEqual(values(),['51%','36 Мбит/с','15 / 152','11',L.Utils.bytesToSize(25*1048576)+' / '+L.Utils.bytesToSize(50*1048576),'≈ 7 с']);
  L.Loading.setProgress(70,{active_peers:0,total_peers:8,speed:'0.0'});
  assert.deepEqual(values(),['70%','0 / 8']);
  L.Controller.back();assert.equal(cancelled,1);assert.equal(host.isConnected,false);
  L.Loading.start(()=>{},'',{media:{card:{title:'Online'}}});
  assert.equal(w.document.querySelector('.pt-torrent-loading'),null);
  assert.equal(w.document.querySelector('.media-loading__status').hidden,false);
  L.Loading.stop();
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});


test('legacy plugin Medium conflicting with native High is reconciled once; later explicit choices remain stable',async()=>{
 const n=await native({built:true,initialStorage:{lampa_view_layout:'tv',minimal_banner_quality:'medium',minimal_artwork_quality_revision:2,poster_size:'w500'}}),{L}=n;
 try{
  const setting=L.SettingsApi.getParam('minimal_settings_appearance').find(p=>p.param.name==='minimal_banner_quality');
  assert.equal(L.Storage.get('minimal_banner_quality'),'high');assert.match(L.Api.img('/banner.jpg','w1280'),/\/original\//);assert.match(L.Api.img('/poster.jpg'),/\/w780\//);
  L.Storage.set('minimal_banner_quality','medium');setting.onChange();assert.equal(L.Storage.get('minimal_artwork_quality_choice'),'medium');assert.equal(L.Storage.get('poster_size'),'w300');assert.match(L.Api.img('/banner.jpg','w1280'),/\/w1280\//);
  L.Storage.set('poster_size','w500');assert.equal(L.Storage.get('minimal_banner_quality'),'high');assert.equal(L.Storage.get('minimal_artwork_quality_choice'),'high');assert.match(L.Api.img('/banner.jpg','w1280'),/\/original\//);
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
