const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('built plugin migrates image quality and applies both quality levels to posters and backdrops without changing native preferences',async()=>{
 const n=await native({built:true,initialStorage:{minimal_banner_quality:'auto',poster_size:'w300'}}),{w,L}=n;
 try{
  const setting=L.SettingsApi.getParam('minimal_settings_appearance').find(p=>p.param.name==='minimal_banner_quality');
  assert.equal(setting.param.default,'high');assert.deepEqual(Object.values(setting.param.values),['Среднее','Высокое']);
  assert.equal(L.Storage.get('minimal_banner_quality'),'high');
  assert.match(L.Api.sources.tmdb.img('/poster.jpg'),/\/w780\//);assert.match(L.Api.img('/poster.jpg','w300'),/\/w780\//);
  assert.match(L.Api.sources.tmdb.img('/backdrop.jpg','w1280'),/\/w1280\//);assert.match(L.Api.img('/avatar.jpg','w92'),/\/w92\//);
  const root=w.document.createElement('div');root.innerHTML='<img class="card__img" src="https://image.tmdb.org/t/p/original/poster.jpg"><img class="full-start__background" src="https://image.tmdb.org/t/p/original/backdrop.jpg"><img class="card__img" src="https://shikimori.io/poster.jpg">';w.document.body.appendChild(root);
  for(const [quality,poster,backdrop] of [['medium','w500','w1280'],['high','w780','w1280']]){
   L.Storage.set('minimal_banner_quality',quality);setting.onChange();
   assert.ok(L.Api.img('/poster.jpg').includes('/'+poster+'/'));assert.ok(L.Api.sources.tmdb.img('/backdrop.jpg','w780').includes('/'+backdrop+'/'));
   assert.ok(root.children[0].src.includes('/'+poster+'/'));assert.ok(root.children[1].src.includes('/'+backdrop+'/'));assert.equal(root.children[2].src,'https://shikimori.io/poster.jpg');
  }
  assert.equal(L.Storage.get('poster_size'),'w300');L.Storage.set('lampa_view_enabled',false);assert.match(L.Api.img('/poster.jpg'),/\/w300\//);
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('Shikimori poster variants follow the same quality setting while offscreen cards stay lazy',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  const Card=L.Maker.get('Card',{}),setting=L.SettingsApi.getParam('minimal_settings_appearance').find(p=>p.param.name==='minimal_banner_quality');
  const sources={medium:'https://images.test/preview.webp',high:'https://images.test/main.webp',maximum:'https://images.test/original.jpg'};
  const data={id:123,source:'minimal_shiki',name:'Аниме',img:sources.maximum,minimalPosterSources:sources};
  const card=L.Utils.createInstance(Card,data);card.create();w.document.body.appendChild(card.render(true));
  assert.ok(!card.img.src.includes('images.test'),'offscreen card fetched its cover on creation');
  L.Storage.set('minimal_banner_quality','medium');setting.onChange();assert.ok(!card.img.src.includes('images.test'));
  card.visible();assert.equal(card.img.src,sources.high);
  L.Storage.set('minimal_banner_quality','high');setting.onChange();assert.equal(card.img.src,sources.maximum);
  card.destroy();assert.equal(card.img._minimalArtwork,undefined);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('back in a quality selection closes the selection without leaving the activity',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  let closed=0;const count=L.Activity.all().length;
  L.Select.show({title:'Качество',items:[{title:'Максимальное'}],onSelect(){},onBack(){closed++;L.Select.hide();L.Controller.toggle('head');}});
  const button=L.Select.render(true).querySelector('.minimal-back--overlay');assert.ok(button);assert.equal(w.getComputedStyle(button).display,'flex');
  button.click();assert.equal(closed,1);assert.equal(L.Select.opened(),false);assert.equal(L.Activity.all().length,count);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('back button follows the native stack, closes the current controller once and is created when the host omitted it',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  const $=w.jQuery;let button=w.document.querySelector('.head__backward.minimal-back');assert.ok(button);assert.equal(w.getComputedStyle(button).display,'none');
  L.Api.category=(p,ok)=>w.setTimeout(()=>ok([{title:p.title,url:p.url,source:'cub',results:[{id:1,title:'Фильм'}]}]),0);
  L.Activity.push({component:'category',url:'movie',source:'cub',title:'Фильмы'});await wait(100);
  button=w.document.querySelector('.head__backward.minimal-back');assert.equal(w.getComputedStyle(button).display,'flex');assert.equal(button.getAttribute('aria-label'),'Назад');
  let closes=0;const stack=L.Activity.all().length;
  L.Controller.add('minimal-test-dialog',{toggle(){},back(){closes++;}});L.Controller.toggle('minimal-test-dialog');
  button.click();assert.equal(closes,1);assert.equal(L.Activity.all().length,stack,'Back must close the active controller, not pop an underlying page');
  button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(closes,2);
  $(button).trigger('hover:enter');assert.equal(closes,3);
  button.remove();L.Listener.send('activity',{type:'start'});button=w.document.querySelector('.head__backward.minimal-back');assert.ok(button && button.isConnected);assert.equal(w.document.querySelectorAll('.head__backward.minimal-back').length,1);
  L.Controller.toggle('head');button.click();await wait(250);assert.equal(L.Activity.all().length,stack-1);assert.equal(w.getComputedStyle(button).display,'none');
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
