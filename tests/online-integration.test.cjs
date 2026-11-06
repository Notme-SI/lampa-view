const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('all media types omit missing portraits and retain shared actor/director portraits',()=>{
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text,m={exports:{}};new Function('module','exports','window',code)(m,m.exports,{});
 for(const anime of [false,true]){
  const data={movie:anime?{genres:[{id:16}],original_language:'ja'}:{genres:[{id:18}]},persons:{cast:[{id:1,name:'Без фото',profile_path:null,character:'A'},{id:2,name:'С фото',profile_path:'/actor.jpg',character:'B'},{id:3,name:'Актёр и режиссёр',profile_path:'/shared.jpg',character:'C'}],crew:[{id:4,name:'Режиссёр без фото',job:'Director'},{id:3,name:'Актёр и режиссёр',job:'Director'}]}};
  m.exports.prepareDetail(data);const cast=data.persons.cast;
  assert.equal(cast.some(p=>p.id===1),false);assert.equal(cast.some(p=>p.id===4),false);assert.ok(cast.some(p=>p.id===2));assert.equal(cast.filter(p=>p.id===3).length,1);assert.equal(cast.find(p=>p.id===3).profile_path,'/shared.jpg');
 }
});
test('anime cards render with a Node-only append and recover when season grouping is unavailable',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  const append=w.Element.prototype.append;
  w.Element.prototype.append=function(...nodes){
   if(!this.closest('.full-start-new__details'))return append.apply(this,nodes);
   nodes.forEach(node=>this.appendChild(node));
  };
  let reply;
  w.LampaView.animeBase.groups=(card,files,done)=>{reply=done;};
  for(const seasons of [2,1]){
   const card={id:4000+seasons,source:'cub',name:'Аниме',original_name:'Anime',original_language:'ja',first_air_date:'2022-01-01',number_of_seasons:seasons,number_of_episodes:12,genres:[{id:16,name:'мультфильм'}],networks:[],production_companies:[],production_countries:[],spoken_languages:[]};
   card.seasons=Array.from({length:seasons},(_,i)=>({season_number:i+1,episode_count:12/seasons}));
   L.Api.full=(p,ok)=>ok({movie:card,persons:{cast:[],crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
   L.Activity.push({component:'full',id:card.id,source:'cub',method:'tv',card});
   await wait(150);
   const root=L.Activity.active().activity.render(true);
   assert.ok(root.querySelector('.minimal-detail-header'),JSON.stringify(n.errors));
   assert.ok(root.querySelector('.minimal-detail-identity .full-start-new__buttons'));
   assert.ok(root.querySelector('.minimal-detail-facts'));
   const counter=Array.from(root.querySelectorAll('.full-start-new__details > span')).find(span=>span.textContent.startsWith(L.Lang.translate('title_seasons')+':'));
   assert.ok(counter);
   if(seasons===1){
    assert.equal(counter.hidden,true);
    reply(null);
   }
   assert.equal(counter.hidden,false);
   assert.equal(counter.textContent,L.Lang.translate('title_seasons')+': '+seasons);
  }
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
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

test('complete absolute anime list navigates confirmed arcs locally and keeps original playback items',async()=>{
 const n=await native({built:true}),{w,L}=n,$=w.jQuery;try{
 const root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body),filter=new L.Filter({search:false,sort:true,filter:true});root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Kodik',source:'kodik',selected:true}]);filter.set('filter',[{stype:'season',title:'Сезон',items:[{title:'Сезон 2',selected:true}]}]);
 let played=0,requests=0,done;w.LampaView.kinoapi={enabled:()=>true,groups(card,files,cb){requests++;assert.equal(files.length,5);done=cb;}};w.LampaView.episodeMetadata={alternate:()=>false,book:()=>false};
 for(let i=1;i<=5;i++)$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+i+'</div><div class="online-prestige__episode-number">'+i+'</div><div class="time-line" data-hash="physical-season2-episode'+i+'"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played=i).appendTo(root.find('.scroll__body'));
 const movie={id:31910,name:'Naruto',original_name:'Naruto',source:'tmdb',media_type:'tv',minimal_anime:true};L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:{}}});L.Listener.send('activity',{type:'start'});await wait(250);assert.equal(requests,1);done([{number:1,name:'Спасение Казекаге',count:2,episodes:[1,2]},{number:2,name:'Воссоединение',count:3,episodes:[3,4,5]}]);await wait(150);
 assert.equal(root.find('.nova-card').length,2);assert.equal(root.find('[data-nova-focus="anime-season:2"] .nova-chip__label').text(),'Сезон 2');root.find('[data-nova-focus="anime-season:2"]').trigger('hover:enter');await wait(100);assert.equal(root.find('.nova-card').length,3);root.find('.nova-card').last().trigger('hover:enter');assert.equal(played,5,'Provider handler retains the absolute file');assert.equal(requests,1,'Arc changes do not reload the provider');assert.ok(root.find('[data-hash="physical-season2-episode5"]').length,'Native Timeline identity is intact');assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});


test('KinoAPI and Trakt settings transfer through native backup/restore with separate toggle and key fields',async()=>{
 const n=await native({built:true}),{w,L}=n;let restored;try{
 const params=()=>L.SettingsApi.getParam('minimal_settings_catalogue');
 const toggle=params().find(p=>p.param.name==='minimal_kinoapi_enabled');assert.ok(toggle);assert.equal(toggle.param.type,'trigger');assert.ok(!params().some(p=>p.param.name==='minimal_kinoapi'));
 let submit;L.Input.edit=(options,fn)=>{assert.notEqual(options.password,true);assert.equal(options.nosave,true);assert.equal(options.value,'');submit=fn;};
 L.Storage.set('minimal_kinoapi_enabled',true);toggle.onChange();assert.equal(w.LampaView.kinoapi.enabled(),false,'Cancelling first entry leaves no enabled integration');submit('backup-fixture-key');
 const param=params().find(p=>p.param.name==='minimal_kinoapi');assert.ok(param);assert.match(toggle.field.description,/https:\/\/kinoapi\.lampac\.dev\//);for(const p of params().filter(p=>/minimal_(kinoapi|trakt)/.test(p.param.name))){assert.doesNotMatch(p.field.description,/резерв|восстановлен/);if(p.param.name==='minimal_kinoapi' || p.param.name==='minimal_trakt_client_id')assert.equal(p.field.description,'');}
 const item=w.jQuery('<div></div>');param.onRender(item);assert.equal(item.text(),'backup-fixture-key');assert.equal(L.Storage.get('lampa_view_kinoapi_key'),'backup-fixture-key');
 L.Storage.set('minimal_trakt_enabled',true);L.Storage.set('minimal_trakt_client_id','backup-public-id');assert.match(params().find(p=>p.param.name==='minimal_trakt_enabled').field.description,/https:\/\/trakt\.tv\/oauth\/applications/);
 // Native Settings.backup serializes localStorage, excluding app.js; restore writes it before reload.
 const backup=JSON.stringify(w.localStorage,(key,value)=>key==='app.js'?undefined:value);
 restored=await native({built:true,prepare(win){Object.entries(JSON.parse(backup)).forEach(([key,value])=>win.localStorage.setItem(key,value));}});
 assert.equal(restored.w.LampaView.kinoapi.enabled(),true);assert.equal(restored.L.Storage.get('lampa_view_kinoapi_key'),'backup-fixture-key');assert.equal(restored.L.Storage.get('minimal_trakt_client_id'),'backup-public-id');assert.equal(restored.L.Storage.get('minimal_trakt_enabled'),true);
 assert.ok(restored.L.SettingsApi.getParam('minimal_settings_catalogue').some(p=>p.param.name==='minimal_kinoapi'));assert.deepEqual(n.errors,[]);assert.deepEqual(restored.errors,[]);
 }finally{n.close();if(restored)restored.close();}
});

test('anime provider with two labels and an absolute list exposes twenty catalogue arcs without a key',async()=>{
 const n=await native({built:true}),{w,L}=n,$=w.jQuery;try{
 const root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body),filter=new L.Filter({search:false,sort:true,filter:true});root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Kodik',source:'kodik',selected:true}]);filter.set('filter',[{stype:'season',title:'Сезон',items:[{title:'Сезон 1'},{title:'Сезон 2',selected:true}]}]);
 let played=0;for(let i=1;i<=40;i++)$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+i+'</div><div class="online-prestige__episode-number">'+i+'</div><div class="time-line" data-hash="provider-2-'+i+'"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played=i).appendTo(root.find('.scroll__body'));
 const movie={id:31910,name:'Anime',original_name:'Anime',source:'tmdb',media_type:'tv',minimal_anime:true,seasons:Array.from({length:20},(_,i)=>({season_number:i+1,episode_count:2,name:'Арка '+(i+1)}))};
 L.Api.sources.tmdb.get=(url,p,ok)=>{const number=Number((url.match(/season\/(\d+)/)||[])[1]);ok({episodes:[1,2].map(i=>({episode_number:i,season_number:number,name:'Арка '+number+' серия '+i,overview:'Описание арки '+number}))});};
 assert.equal(w.LampaView.kinoapi.enabled(),false);L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:{}}});L.Listener.send('activity',{type:'start'});await wait(500);
 assert.equal(root.find('.nova-card').length,2);assert.equal(root.find('.nova-hero__season-name').text(),'Арка 1');const picker=root.find('[data-nova-focus="anime-season"]');assert.equal(picker.find('.nova-chip__label').text(),'Сезон 1');assert.equal(picker.find('.nova-chip__sub').text(),'2 эпизода');assert.equal(root.find('[data-nova-focus^="anime-season:"]').length,0);picker.trigger('hover:enter');assert.equal(L.Select.render().find('.selectbox-item').length,20);L.Select.render().find('.selectbox-item').last().trigger('hover:enter');await wait(200);assert.equal(root.find('.nova-hero__season-name').text(),'Арка 20');assert.equal(root.find('.nova-card').length,2);assert.match(root.find('.nova-card__overview').first().text(),/Описание арки 20/);
 assert.equal(root.find('.nova-hero__season-name').parent()[0],root.find('.nova-hero__season-label').parent()[0]);assert.equal(root.find('.nova-hero__season-label .nova-hero__season-name').length,0,'Confirmed arc names have their own badge');
 root.find('.nova-card').last().trigger('hover:enter');assert.equal(played,40);assert.ok(root.find('[data-hash="provider-2-40"]').length);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('live anime 5/4 layout keeps four source seasons, honest counts and original Timeline handlers without guessing arc metadata',async()=>{
 const live=require('./fixtures/anime-season-layout.json');
 for(const selected of [2,4]){
  const n=await native({built:true}),{w,L}=n,$=w.jQuery;try{
   const root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body),filter=new L.Filter({search:false,sort:true,filter:true});root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Phantom',source:'phantom',selected:true}]);filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'Сезон '+selected,items:live.provider.map(s=>({title:'Сезон '+s.number,selected:s.number===selected}))}]);
   let played=0;for(const i of live.provider[selected-1].episodes)$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+i+'</div><div class="online-prestige__episode-number">'+i+'</div><div class="time-line" data-hash="phantom-'+selected+'-'+i+'"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played=i).appendTo(root.find('.scroll__body'));
   const metadataRequests=[];L.Api.sources.tmdb.get=(url,p,ok)=>{metadataRequests.push(url);if(url.includes('episode_groups'))return ok(live.index);if(url.includes('episode_group/'))return ok(live.group);const match=url.match(/season\/(\d+)/);ok(match?live.seasons[Number(match[1])]:live.card);};
   const movie={...live.card,source:'tmdb',media_type:'tv'};L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:{}}});L.Listener.send('activity',{type:'start'});await wait(650);
   assert.equal(root.find('.nova-card').length,live.provider[selected-1].episodes.length);assert.equal(root.find('[data-nova-focus^="season:"]').length,4);assert.equal(root.find('[data-nova-focus^="anime-season"]').length,0);
   assert.equal(root.find('.nova-hero__season-counts').length,0,'Do not put catalogue/source diagnostics on the banner');
   if(selected===2){assert.equal(root.find('.nova-hero__season-name').length,0);assert.equal(root.find('.nova-card__overview').length,0,'No Mugen Train descriptions on an unmatched source list');assert.match(root.find('.nova-chip--active .nova-chip__sub').first().text(),/11/);}
   else{assert.equal(root.find('.nova-hero__season-name').length,0);assert.equal(root.find('.nova-card__overview').length,0,'Do not treat the matching eight files as proof of another catalogue season');}
   root.find('.nova-card').last().trigger('hover:enter');assert.equal(played,live.provider[selected-1].episodes.at(-1));assert.ok(root.find('[data-hash="phantom-'+selected+'-'+played+'"]').length);assert.deepEqual(n.errors,[]);
  }finally{n.close();}
 }
});


test('late Kodik continuations retain the original arc count and show separate menu sections',async()=>{
 const n=await native({built:true}),{w,L}=n,$=w.jQuery;
 try{
  const root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body);
  const filter=new L.Filter({search:false,sort:true,filter:true});
  root.find('.explorer__files-head').append(filter.render());
  const sort=[{title:'Kodik',source:'kodik',selected:true}];
  filter.set('sort',sort);
  filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'Сезон 1',items:[{title:'Сезон 1',selected:true}]}]);
  for(let i=1;i<=32;i++)$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+i+'</div><div class="online-prestige__episode-number">'+i+'</div><div class="time-line"><div style="width:0%"></div></div></div>').appendTo(root.find('.scroll__body'));
  const movie={id:30984,name:'Блич',original_name:'Bleach',source:'tmdb',minimal_anime:true,media_type:'tv'},comp={};
  w.LampaView.episodeMetadata={isAnime:()=>true,alternate:()=>false,book:()=>false,groups(card,files,done){done(Array.from({length:16},(_,i)=>({number:i+1,count:2,episodes:[i*2+1,i*2+2]})));}};
  L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:comp}});
  L.Listener.send('activity',{type:'start'});
  await wait(300);
  let chosen;
  comp.lampaViewContinuations={groups:null,selected:null,parts:[{order:1,season:2,count:13,section:'Тысячелетняя кровавая война',name:'Тысячелетняя кровавая война'},{order:2,season:2,count:13,section:'Тысячелетняя кровавая война',name:'Прощание'}],select(part){chosen=part;}};
  root.find('[data-nova-focus="anime-season"]').trigger('hover:enter');
  L.Select.render().find('.selectbox-item').eq(12).trigger('hover:enter');
  await wait(200);
  root.find('[data-nova-focus="anime-season"]').trigger('hover:enter');
  const menu=L.Select.render(),options=menu.find('.selectbox-item'),sections=menu.find('.minimal-season-section');
  assert.equal(options.length,18);
  assert.equal(sections.map((_,node)=>node.textContent).get().join('|'),'Основной сериал|Тысячелетняя кровавая война');
  assert.equal(options.eq(16).find('.selectbox-item__title').text(),'Сезон 17');
  assert.equal(options.eq(17).find('.selectbox-item__title').text(),'Сезон 18');
  assert.ok(!menu.text().includes('~'));
  assert.equal(sections.filter('.selector').length,0);
  options.eq(16).trigger('hover:enter');
  assert.equal(chosen.order,1);
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});


test('specials keep season zero metadata and show a named menu entry while grouping loads before display',async()=>{
 const n=await native({built:true}),{w,L}=n,$=w.jQuery;
 try{
  const root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body);
  const filter=new L.Filter({search:false,sort:true,filter:true});
  root.find('.explorer__files-head').append(filter.render());
  filter.set('sort',[{title:'Kodik',source:'kodik',selected:true}]);
  filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'0 сезон',items:[{title:'0 сезон',selected:true},{title:'1 сезон'},{title:'2 сезон'},{title:'3 сезон'},{title:'4 сезон'}]}]);
  for(let i=1;i<=7;i++)$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+i+'</div><div class="online-prestige__episode-number">'+i+'</div></div>').appendTo(root.find('.scroll__body'));
  const movie={id:1429,name:'Атака титанов',source:'tmdb',minimal_anime:true,number_of_seasons:4,seasons:[{season_number:0,episode_count:7},{season_number:1,episode_count:25}]};
  const requests=[];const completions={};
  L.Api.sources.tmdb.get=(url,p,ok)=>{requests.push(url);const number=Number(url.match(/season\/(\d+)/)[1]);completions[number]=()=>ok({season_number:number,episodes:Array.from({length:number===0?7:12},(_,i)=>({episode_number:i+1,season_number:number,name:'Спецвыпуск '+(i+1),overview:'Отдельная история '+(i+1)}))});};
  L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:{}}});
  L.Listener.send('activity',{type:'start'});
  await wait(180);
  assert.equal(root.find('.nova-card').length,0,'Wait for metadata before showing series');
  assert.ok(root.find('.nova-loading').length);
  completions[0]();await wait(50);
  assert.equal(root.find('.nova-card').length,0,'Wait for the other season counters too');
  [2,3,4].forEach(number=>completions[number]());await wait(180);
  assert.equal(root.find('.nova-hero__season-label').text(),'Спецвыпуски');
  assert.equal(root.find('[data-nova-focus="season"] .nova-chip__label').text(),'Спецвыпуски');
  assert.equal(root.find('[data-nova-focus="season"] .nova-chip__sub').text(),'7 эпизодов');
  assert.equal(root.find('.nova-card').length,7);
  assert.match(root.find('.nova-card__overview').first().text(),/Отдельная история 1/);
  assert.ok(requests.some(url=>url.includes('/season/0')));
  root.find('[data-nova-focus="season"]').trigger('hover:enter');
  assert.equal(L.Select.render().find('.selectbox-item__title').first().text(),'Спецвыпуски');
  assert.ok(!L.Select.render().text().includes('~'));
  assert.match(L.Select.render().find('.selectbox-item').eq(2).text(),/12 эпизодов/);
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
