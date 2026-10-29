const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('live-action credits omit missing portraits before limits, anime keeps them, and shared director portraits survive',()=>{
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text,m={exports:{}};new Function('module','exports','window',code)(m,m.exports,{});
 for(const anime of [false,true]){
  const data={movie:anime?{genres:[{id:16}],original_language:'ja'}:{genres:[{id:18}]},persons:{cast:[{id:1,name:'Без фото',profile_path:null,character:'A'},{id:2,name:'С фото',profile_path:'/actor.jpg',character:'B'},{id:3,name:'Актёр и режиссёр',profile_path:'/shared.jpg',character:'C'}],crew:[{id:4,name:'Режиссёр без фото',job:'Director'},{id:3,name:'Актёр и режиссёр',job:'Director'}]}};
  m.exports.prepareDetail(data);const cast=data.persons.cast;
  assert.equal(cast.some(p=>p.id===1),anime);assert.equal(cast.some(p=>p.id===4),anime);assert.ok(cast.some(p=>p.id===2));assert.equal(cast.filter(p=>p.id===3).length,1);assert.equal(cast.find(p=>p.id===3).profile_path,'/shared.jpg');
 }
});
test('studio activation opens the native company page; TV networks use a network filter even with CUB selected',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  for(const network of [false,true]){
   const card={id:400+Number(network),source:'cub',title:'Проект',...(network?{name:'Сериал',production_companies:[],networks:[{id:1024,name:'Сеть',logo_path:'/network.png'}]}:{production_companies:[{id:33,name:'Студия',logo_path:'/studio.png'}]}),production_countries:[],spoken_languages:[],genres:[]};
   L.Api.full=(p,ok)=>ok({movie:card,persons:{cast:[],crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
   L.Activity.push({component:'full',id:card.id,source:'cub',method:network?'tv':'movie',card});await wait(150);
   const root=L.Activity.active().activity.render(true),studio=root.querySelector('.minimal-detail-studio');assert.ok(studio,JSON.stringify({network,errors:n.errors}));studio.onload();assert.equal(studio.getAttribute('role'),'button');assert.equal(studio.tabIndex,0);
   const push=L.Activity.push;let target;L.Activity.push=data=>target=data;studio.click();L.Activity.push=push;
   assert.equal(target.source,'tmdb');assert.equal(target.component,network?'category_full':'company');assert.equal(network?target.networks:target.id,network?1024:33);assert.equal(target.url,network?'discover/tv':'movie');
  }
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('bundled Nova transforms online files and series, preserves original playback handlers and never rewrites posters',async()=>{
 const n=await native({built:true}),{w,L}=n,$=w.jQuery;
 try{
  assert.equal(w.nova_plus,true);assert.ok(w.document.getElementById('nova-plus-css'));assert.equal(w.posterObfuscated,undefined);
  assert.ok(L.SettingsApi.getParam('minimal_settings_playback').some(p=>p.param.name==='nova_plus_quality'));
  assert.ok(!Object.keys(L.SettingsApi.allComponents()).includes('nova_plus'));
  const current=L.Activity.active;
  for(const serial of [false,true]){
   const root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div></div>').appendTo(w.document.body),body=root.find('.scroll__body');
   const filter=new L.Filter({search:false,sort:true,filter:true});root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Источник',source:'test',selected:true}]);filter.set('filter',serial?[{stype:'season',title:'Сезон',items:[{title:'Сезон 1',selected:true}]},{stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true}]}]:[]);
   let played=0;for(let i=1;i<=3;i++)$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__img"><img src="/poster.jpg"></div><div class="online-prestige__title">'+(serial?'Серия '+i:'Файл '+i)+'</div>'+(serial?'<div class="online-prestige__episode-number">'+i+'</div>':'')+'<div class="online-prestige__quality">1080p</div><div class="online-prestige__info"><span>TVShows</span></div><div class="time-line"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played++).appendTo(body);
   const movie={id:500+Number(serial),title:'Фильм',...(serial?{name:'Сериал',number_of_seasons:1}:{}),source:'tmdb'};L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:{}}});
   L.Listener.send('activity',{type:'start'});await wait(250);
   assert.equal(root.find('.nova-plus-root').length,1);assert.equal(root.find('.nova-card').length,serial?3:0);if(!serial)assert.equal(root.find('[data-nova-focus=movievoice]').length,1);assert.equal(root.find('.online-prestige--full.selector').length,0);assert.equal(root.find('.online-prestige__img img').first().attr('src'),'/poster.jpg');
   root.find(serial?'.nova-card':'[data-nova-focus=hero]').first().trigger('hover:enter');assert.equal(played,1);L.Listener.send('activity',{type:'destroy'});root.remove();
  }
  L.Activity.active=current;assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
