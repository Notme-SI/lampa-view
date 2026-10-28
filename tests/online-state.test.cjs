const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom'),native=require('./fixtures/native-lampa.cjs');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/online-state.js')],bundle:true,write:false,format:'iife',globalName:'OnlineState'}).outputFiles[0].text;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tag=row=>'<div class="videos__item" data-json="'+JSON.stringify(row).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"></div>';

test('provider folders resolve only a unique matching title and requested season, never another film or sequel',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);const pick=w.OnlineState.folderTarget,card={name:'Гангстерленд',original_name:'MobLand',first_air_date:'2025-01-01'};
 const row=(text,url='/lite/source/season')=>({text,url,method:'link',similar:true});
 assert.equal(pick([row('Гангстерленд 2 сезон')],card,1),'');assert.equal(pick([row('Гангстерленд 2 сезон')],card,2),'/lite/source/season');assert.equal(pick([row('Other film')],card,1),'');assert.equal(pick([row('MobLand'),row('Гангстерленд')],card,1),'');assert.equal(pick([row('MobLand', 'javascript:alert(1)')],card,1),'');assert.equal(pick([row('MobLand'),{method:'play',url:'/film'}],card,1),'');
 assert.equal(pick([row('Обсессия 2025')],{title:'Обсессия',release_date:'2026-01-01'}),'/lite/source/season');assert.equal(pick([row('Обсессия 1990')],{title:'Обсессия',release_date:'2026-01-01'}),'');
 }finally{w.close();}
});
test('source availability checks real entries, excludes similar titles and distinguishes access failures from empty catalogues',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);const state=w.OnlineState.availability;
 assert.equal(state(tag({method:'play',url:'/file'})).state,'ok');assert.equal(state(tag({method:'call',url:'/call',similar:true})).state,'empty');assert.equal(state('<div class="videos__line"></div>').state,'empty');assert.equal(state('<html><h1>Access denied</h1></html>').state,'unknown');assert.equal(state('').state,'unknown');assert.equal(state(JSON.stringify({accsdb:true})).state,'unknown');assert.equal(state({data:[{method:'call',url:'/film'}]}).state,'ok');assert.equal(state({data:[]}).state,'empty');assert.equal(state('<script>'+tag({method:'play',url:'/fake'})+'</script>').state,'unknown');assert.equal(state('<div class="videos__item">No valid data</div>').state,'empty');
 }finally{w.close();}
});
test('native progress picks the latest title alias, advances completed seasons and isolates profiles without writing records',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);let profile='file_view',update,writes=0;const records={file_view:{},file_view_other:{}},L={Utils:{hash:t=>t},Storage:{get:k=>records[k],set:()=>writes++},Timeline:{filename:()=>profile,listener:{follow:(e,f)=>update=f}}},api=w.OnlineState.default(L),card={id:1,name:'Перевод',original_name:'Original',number_of_seasons:2,seasons:[{season_number:1,episode_count:2},{season_number:2,episode_count:3}]};
 records.file_view['11Original']={percent:50,time:600,updated:1};records.file_view['11Перевод']={percent:20,time:240,updated:2};assert.equal(api.reader(card)(1,1).time,240);assert.equal(api.resume(card).episode,1);
 records.file_view['12Original']={percent:95,time:1000,updated:3};update();assert.equal(api.resume(card).season,2);assert.equal(api.resume(card).episode,1);assert.equal(api.resume(card).time,0);
 profile='file_view_other';assert.equal(api.resume(card),null);assert.equal(api.reader(card)(1,1).found,false);assert.equal(writes,0);
 }finally{w.close();}
});
test('season restoration only indexes actual season navigation, never episodes or voice options',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);const api=w.OnlineState.default({Timeline:{},Utils:{},Storage:{}}),rows=tag({method:'link',url:'/lite/source?s=1',name:'Сезон 1'})+tag({method:'link',url:'/lite/source?s=2',name:'Сезон 2'});assert.equal(api.seasonIndex(rows,2),1);assert.equal(api.seasonIndex(rows,3),-1);assert.equal(api.seasonIndex(rows+tag({method:'play',url:'/file'}),2),-1);assert.equal(api.seasonIndex(tag({method:'link',url:'/voice/1',name:'Studio 1'})+tag({method:'link',url:'/voice/2',name:'Studio 2'}),2),-1);
 }finally{w.close();}
});

function screen(n,{id=900,season=1,episodes=[1,2,3],serial=true,component={}}={}){
 const {w,L}=n,$=w.jQuery,root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div></div>').appendTo(w.document.body),body=root.find('.scroll__body'),filter=new L.Filter({search:false,sort:true,filter:true});root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Test',source:'test',selected:true},{title:'Other',source:'other',ghost:false}]);filter.set('filter',serial?[{stype:'season',title:'Сезон',items:[{title:'Сезон '+season,selected:true}]},{stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true}]}]:[]);
 const movie={id,title:'Русское название',original_title:'Original',...(serial?{name:'Сериал',original_name:'Original',number_of_seasons:2,seasons:[{season_number:1,episode_count:3},{season_number:2,episode_count:3}]}:{}),source:'tmdb'};let played=0;
 for(const num of episodes)$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__img"><img src="https://image.example.test/frame.jpg"></div><div class="online-prestige__title">Серия '+num+'</div>'+(serial?'<div class="online-prestige__episode-number">'+num+'</div>':'')+'<div class="online-prestige__quality">1080p</div><div class="online-prestige__info"><span>TVShows</span></div><div class="time-line"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played=num).appendTo(body);
 Object.assign(component,{render:()=>root});L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component}});L.Listener.send('activity',{type:'start'});return {root,body,movie,filter,component,played:()=>played,close(){L.Listener.send('activity',{type:'destroy'});root.remove();}};
}

test('late episode number and thumbnail arrive without per-card 60ms polling',async()=>{
 const n=await native({built:true}),{w}=n;try{
  const interval=w.setInterval.bind(w),polls=[];w.setInterval=(fn,delay,...args)=>{if(delay===60)polls.push(fn);return interval(fn,delay,...args);};
  const s=screen(n,{id:1608,episodes:[1]}),origin=s.body.find('.online-prestige').first();origin.find('img').removeAttr('src');origin.find('.online-prestige__episode-number').empty();
  await wait(200);assert.equal(polls.length,0,'modern hosts watch metadata changes instead of polling every card');
  origin.find('img').attr('src','https://image.example.test/late.jpg');origin.find('.online-prestige__episode-number').text('7');await wait(180);
  const card=s.root.find('.nova-card').first();assert.match(card.find('.nova-card__num').text(),/7/);assert.equal(card.find('.nova-card__thumb img').attr('src'),'https://image.example.test/late.jpg');assert.equal(card.find('.nova-card__thumb img').attr('loading'),'lazy');assert.deepEqual(n.errors,[]);s.close();
 }finally{n.close();}
});
test('online UI resumes the latest native timecode, keeps external images and handles reverse episode order',async()=>{
 const n=await native({built:true}),{w,L}=n;let s;try{
 const hash=(season,episode,title='Original')=>L.Utils.hash([season,season>10?':':'',episode,title].join(''));L.Timeline.update({hash:hash(1,2),percent:40,time:720,duration:1800});
 s=screen(n,{episodes:[3,2,1]});await wait(250);const label=s.root.find('.nova-btn__label').first().text();assert.match(label,/Продолжить/);assert.match(label,/Серия 2/);assert.match(label,/12:00/);assert.equal(s.root.find('.nova-card').length,3);s.root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),2);const next=s.root.find('[data-nova-focus=hero-next]');assert.equal(next.length,0);assert.equal(s.played(),2);assert.equal(s.root.find('.online-prestige__img img').first().attr('src'),'https://image.example.test/frame.jpg');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});
test('the patched online host restores the watched season and preserves the manually selected season and voice',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
 const hash=L.Utils.hash('21Original');L.Timeline.update({hash,percent:35,time:300,duration:900});const choices={test:{voice_name:'TVShows'},other:{}};let parsed=0,selected='test';const component={changeBalanser:name=>{selected=name;},getChoice:name=>choices[name||selected],saveChoice:(choice,name)=>choices[name||selected]=choice,parse:()=>parsed++};s=screen(n,{component});await wait(150);
 const body=tag({method:'link',url:'/lite/test?s=1',name:'Сезон 1'})+tag({method:'link',url:'/lite/test?s=2',name:'Сезон 2'});component.parse(body);assert.equal(choices.test.season,1);component.lampaViewManualSeason=1;component.parse(body);assert.equal(choices.test.season,0);component.changeBalanser('other');assert.equal(choices.other.voice_name,'TVShows');assert.equal(parsed,2);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('all episodes and ambiguous folders remain available while failed sources stay out of the selector',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n,{episodes:Array.from({length:54},(_,i)=>i+1)});s.filter.set('sort',Array.from({length:36},(_,i)=>({title:'Источник '+i,source:'source'+i,selected:!i,ghost:i>20})));await wait(220);
  assert.equal(s.root.find('.nova-card').length,54);assert.equal(s.root.find('[data-nova-focus=jump]').length,0);assert.equal(s.root.find('.nova-card__title').first().text(),'Серия 1');assert.doesNotMatch(s.root.find('.nova-card__tag').text(),/S\d|E\d/);
  s.root.find('[data-nova-focus=source]').trigger('hover:enter');await wait(90);assert.equal(s.root.find('.nova-drop .nova-chip').length,21);assert.equal(s.root.find('[data-nova-src="source21"]').length,0,'Unavailable ghost sources stay hidden');assert.equal(s.root.find('[data-nova-focus="src:more"]').length,0);
  s.close();s=screen(n,{episodes:[]});for(let i=0;i<27;i++)n.w.jQuery('<div class="online-prestige online-prestige--folder selector"><div class="online-prestige__title">Папка '+i+'</div></div>').on('hover:enter',()=>{}).appendTo(s.body);await wait(180);assert.equal(s.root.find('.nova-card--nav').length,27);assert.equal(s.root.find('[data-nova-focus=jump]').length,0);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('the online host follows a matching folder through its native request, bounds cycles and preserves manual season choices',async()=>{
 const n=await native({built:true}),requests=[],parsed=[];let s;try{
  let rows=[],choice={};const comp={changeBalanser(){},reset(){},request:url=>requests.push(url),parse:body=>parsed.push(body),parseJsonDate:()=>rows,getChoice:()=>choice,saveChoice:v=>choice=v};
  s=screen(n,{component:comp});await wait(160);
  rows=[{method:'link',similar:true,text:'Сериал 1 сезон',url:'/lite/test/season1'}];const body=tag(rows[0]);comp.request('/lite/test/search');comp.parse(body);assert.equal(requests.at(-1),'/lite/test/season1');assert.equal(parsed.length,0);
  comp.parse(body);assert.equal(parsed.at(-1),body);assert.equal(requests.length,2,'A repeated folder URL must not loop');
  comp.request('/lite/test/search');comp.lampaViewManualSeason=2;comp.parse(body);assert.equal(requests.at(-1),'/lite/test/search');assert.equal(parsed.at(-1),body);
  rows=[{method:'link',similar:true,text:'Сериал 2 сезон',url:'/lite/test/season2'}];comp.parse(tag(rows[0]));assert.equal(requests.at(-1),'/lite/test/season2');assert.equal(comp.lampaViewManualSeason,2);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('a long voice list uses one native selection menu and keeps the provider original selection handler',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n);let selected=-1;s.filter.onSelect=(type,group,item)=>{assert.equal(type,'filter');assert.equal(group.stype,'voice');selected=item.index;};
  s.filter.set('filter',[{stype:'voice',title:'Озвучка',items:Array.from({length:18},(_,i)=>({title:'Студия '+i,selected:i===0}))}]);await wait(200);
  assert.equal(s.root.find('[data-nova-group=voice]').length,0);assert.equal(s.root.find('[data-nova-focus=voice]').length,1);
  s.root.find('[data-nova-focus=voice]').trigger('hover:enter');assert.equal(L.Select.render().find('.selectbox-item').length,18);L.Select.render().find('.selectbox-item').eq(17).trigger('hover:enter');await wait(90);assert.equal(selected,17);assert.equal(L.Select.opened(),false);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('movies always use the wide banner, expose all voice choices and play selected versions from the compact main button',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n,{serial:false});s.movie.overview='Описание уже есть на странице фильма';await wait(200);
  assert.ok(s.root.find('.nova-plus-root').hasClass('nova-plus'));assert.equal(s.root.find('.nova-card').length,0);assert.equal(s.root.find('[data-nova-group=movievoice] .nova-chip').length,3);assert.equal(s.root.find('.nova-hero__descr').css('display'),'none');
  s.root.find('[data-nova-focus="movievoice:1"]').trigger('hover:enter');await wait(100);assert.equal(s.played(),0,'choosing a voice must not start playback');const button=s.root.find('[data-nova-focus=hero]');assert.equal(button.text(),'Смотреть');assert.equal(button.attr('aria-label'),'Смотреть');assert.equal(button.find('.nova-btn__details').length,0);button.trigger('hover:enter');assert.equal(s.played(),2);assert.equal(s.root.find('.nova-card').length,0);assert.equal(s.root.find('[data-nova-focus=view]').length,0);
  L.Storage.set('nova_plus_mode','skin');L.Listener.send('activity',{type:'start'});await wait(180);assert.ok(s.root.find('.nova-plus-root').hasClass('nova-plus'));assert.equal(s.root.find('.nova-card').length,0);s.root.find('[data-nova-focus="movievoice:2"]').trigger('hover:enter');await wait(90);s.root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),3);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});
test('logo metadata requests share the native API and deduplicate concurrent full-card notifications',async()=>{
 const n=await native({built:true}),{L}=n;try{let calls=0,answer;L.Api.sources.tmdb.get=(url,p,ok)=>{if(url==='tv/975/images'){calls++;answer=ok;}};const card={id:975,name:'Сериал',source:'tmdb'},event={type:'complite',data:{movie:card},object:{card,activity:{render:()=>n.w.jQuery('<div></div>')}}};L.Listener.send('full',event);L.Listener.send('full',event);assert.equal(calls,1);answer({logos:[]});L.Listener.send('full',event);assert.equal(calls,1);assert.deepEqual(n.errors,[]);}finally{n.close();}
});

test('the film banner keeps native watch progress when changing voices and updates after a new timecode',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  const hash=L.Utils.hash('Original');L.Timeline.update({hash,percent:55,time:3300,duration:6000});s=screen(n,{serial:false});await wait(190);
  const fill=()=>s.root.find('.nova-hero__progress .time-line>div');assert.equal(fill().css('width'),'55%');assert.ok(s.root.find('.nova-btn__focus').length);assert.equal(s.root.find('.nova-card').length,0);
  s.root.find('[data-nova-focus="movievoice:2"]').trigger('hover:enter');await wait(90);assert.equal(fill().css('width'),'55%');L.Timeline.update({hash,percent:70,time:4200,duration:6000});await wait(140);assert.equal(fill().css('width'),'70%');s.root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),3);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('late background source replies are ignored after switching and root checks discard season/voice parameters',async()=>{
 const n=await native({built:true,initialStorage:{nova_plus_probe:true}}),{L}=n;let s;try{
 const requests=[],Real=L.Reguest;L.Reguest=function(){const net=new Real();net.native=(url,ok,fail)=>requests.push({url,ok,fail});return net;};
 const component={request(){},parse(){},changeBalanser(){}};s=screen(n,{id:988,component});await wait(100);component.request('https://online.example.test/lite/test?id=988&s=9&voice=old&rjson=true&token=own-test');await wait(1700);
 const pending=requests.find(row=>new URL(row.url).pathname==='/lite/other');assert.ok(pending,JSON.stringify(requests.map(r=>r.url)));const url=new URL(pending.url);assert.equal(url.searchParams.has('s'),false);assert.equal(url.searchParams.has('voice'),false);assert.equal(url.searchParams.get('id'),'988');assert.equal(url.searchParams.get('token'),'own-test');
 component.changeBalanser('other');pending.ok(tag({method:'play',url:'/file',name:'2160p'}));const cache=L.Storage.get('nova_probe',{});assert.ok(!cache['tmdb:tv:988'] || !cache['tmdb:tv:988'].list.other);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('season progress uses the full season when watched episodes are absent from the current provider',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
 for(let episode=1;episode<=4;episode++)L.Timeline.update({hash:L.Utils.hash('1'+episode+'Original'),percent:100,time:1800,duration:1800});
 s=screen(n,{id:991,episodes:[5,6]});s.movie.number_of_seasons=1;s.movie.seasons=[{season_number:1,episode_count:6}];await wait(250);
 assert.equal(s.root.find('.nova-hero__season').length,0);assert.equal(s.root.find('.nova-hero__season-label').text(),'Сезон 1');assert.equal(s.root.find('.nova-hero__progress .time-line>div').css('width'),'67%');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('availability is cleared on source switch, retry and reset and nested requests cannot inherit an earlier empty page',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
 let nested=false;const comp={request(){},reset(){},changeBalanser(){},parse(){if(nested)comp.request('https://online.example.test/lite/other?s=2');}};
 s=screen(n,{id:992,component:comp});await wait(100);comp.request('https://online.example.test/lite/test?id=992');comp.parse('<div class="videos__line"></div>');assert.equal(comp.lampaViewAvailability,'empty');assert.equal(comp.lampaViewAvailabilitySource,'test');
 comp.changeBalanser('other');assert.equal(comp.lampaViewAvailability,'unknown');assert.equal(comp.lampaViewAvailabilitySource,'');
 comp.request('https://online.example.test/lite/other?id=992');comp.parse(JSON.stringify({accsdb:true}));assert.equal(comp.lampaViewAvailability,'unknown');const cached=L.Storage.get('nova_probe',{});assert.ok(!cached['tmdb:tv:992'].list.other);
 comp.parse('<div class="videos__line"></div>');assert.equal(comp.lampaViewAvailabilitySource,'other');assert.equal(comp.lampaViewAvailability,'empty');comp.request('https://online.example.test/lite/other?id=992');assert.equal(comp.lampaViewAvailability,'unknown');
 comp.parse('<div class="videos__line"></div>');comp.reset();assert.equal(comp.lampaViewAvailability,'unknown');nested=true;comp.parse('<div class="videos__line"></div>');assert.equal(comp.lampaViewAvailability,'unknown');assert.equal(comp.lampaViewAvailabilitySource,'');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('compact episode cards keep titles, file quality and season facts without repeated descriptions or voices',async()=>{
 const n=await native({built:true,initialStorage:{nova_plus_view:'grid'}}),{L,w}=n;let s;try{
  L.Api.sources.tmdb.get=(url,p,ok)=>w.setTimeout(()=>ok(url.includes('/season/')?{episodes:[{episode_number:1,name:'Пан или пропал',overview:'Описание не нужно повторять',vote_average:8.4,air_date:'2025-03-30'}]}:{logos:[]}),0);
  s=screen(n,{id:995,episodes:[1,2,3]});Object.assign(s.movie,{first_air_date:'2025-03-30',origin_country:['US'],vote_average:8.5});
  s.filter.set('sort',[{title:'Test - 4K',source:'test',selected:true}]);
  const nativeRows=s.body.find('.online-prestige--full');nativeRows.eq(0).find('.online-prestige__quality').text('720p');nativeRows.eq(1).find('.online-prestige__quality').text('SD');nativeRows.eq(2).find('.online-prestige__quality').empty();
  await wait(260);
  const root=s.root;assert.equal(root.find('.nova-card__title').first().text(),'Пан или пропал');assert.equal(root.find('.nova-card__tag').first().text(),'Серия 1');assert.equal(root.find('.nova-card__quality').eq(0).text(),'HD');assert.equal(root.find('.nova-card__quality').eq(1).text(),'SD');assert.equal(root.find('.nova-card').eq(2).find('.nova-card__quality').length,0);
  assert.equal(root.find('.nova-card__descr,.nova-card__voice,.nova-card__tags,[data-nova-focus=hero-next],.nova-hero__season').length,0);assert.doesNotMatch(root.find('.nova-card').text(),/TVShows|Описание не нужно повторять/);
  assert.equal(root.find('.nova-hero__year').text(),'2025, США');assert.equal(root.find('.nova-hero__season-label').text(),'Сезон 1');assert.equal(root.find('.nova-hero__runtime').length,0);assert.equal(root.find('.nova-hero__meta .nova-badge').text(),'HD');
  // Native metadata can arrive after the interface has already rendered.
  nativeRows.eq(0).find('.online-prestige__quality')[0].firstChild.nodeValue='1920x800';await wait(180);assert.equal(root.find('.nova-card__quality').first().text(),'FHD');assert.equal(root.find('.nova-hero__meta .nova-badge').text(),'FHD');
  L.Storage.set('nova_plus_view','list');L.Listener.send('activity',{type:'start'});await wait(180);assert.equal(root.find('.nova-card__title').first().text(),'Пан или пропал');assert.doesNotMatch(root.find('.nova-card__meta').text(),/TVShows|Описание/);assert.equal(root.find('.nova-card__descr,.nova-card__voice').length,0);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('film facts show native countries and runtime below the year while the main button retains selected playback',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n,{id:996,serial:false});Object.assign(s.movie,{release_date:'2026-07-29',runtime:145,production_countries:[{iso_3166_1:'US',name:'United States of America'}],vote_average:8.5});await wait(220);
  const root=s.root,button=root.find('[data-nova-focus=hero]');assert.equal(root.find('.nova-hero__year').text(),'2026, США');assert.equal(root.find('.nova-hero__runtime').text(),'02:25');assert.equal(root.find('.nova-hero__date').children().last().attr('class'),'nova-hero__runtime');assert.equal(root.find('.nova-hero__season-label').length,0);assert.equal(button.text(),'Смотреть');
  root.find('[data-nova-focus="movievoice:2"]').trigger('hover:enter');await wait(90);root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),3);assert.equal(root.find('[data-nova-focus=hero]').text(),'Смотреть');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('online layout settings change source position, episode order and strip direction, and quality applies to native playback',async()=>{
 const n=await native({built:true,initialStorage:{nova_plus_view:'grid'}}),{L}=n;let s;try{
  s=screen(n,{id:997});await wait(190);const setting=name=>L.SettingsApi.getParam('minimal_settings_playback').find(p=>p.param.name===name),change=async(name,value)=>{L.Storage.set(name,value);const param=setting(name);if(param.onChange)param.onChange(value);await wait(110);};
  const panel=()=>s.root.find('.nova-plus__panel');await change('nova_plus_source_pos','bottom');assert.ok(panel().children().last().hasClass('nova-plus__bar'));await change('nova_plus_source_pos','top');assert.ok(panel().children().first().hasClass('nova-plus__bar'));
  await change('nova_plus_order','reverse');assert.equal(s.root.find('.nova-card__tag').first().text(),'Серия 3');await change('nova_plus_order','straight');assert.equal(s.root.find('.nova-card__tag').first().text(),'Серия 1');await change('nova_plus_layout','row');assert.ok(s.root.find('.nova__list').hasClass('nova__list--row'));await change('nova_plus_layout','grid');assert.ok(!s.root.find('.nova__list').hasClass('nova__list--row'));
  L.Storage.set('nova_plus_quality','720');const data={url:'/default',quality:{'2160p':'/4k','1080p':'/fullhd','720p':'/hd'}};L.Player.listener.send('start',data);assert.equal(data.url,'/hd');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});
