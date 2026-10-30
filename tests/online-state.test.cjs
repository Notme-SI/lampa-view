const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom'),native=require('./fixtures/native-lampa.cjs');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/online-state.js')],bundle:true,write:false,format:'iife',globalName:'OnlineState'}).outputFiles[0].text;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function selectMovie(s,L,index){s.root.find('[data-nova-focus=movievoice]').trigger('hover:enter');L.Select.render().find('.selectbox-item').eq(index).trigger('hover:enter');}
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

test('clearing a timecode clears title aliases in the active profile without touching another film or profile',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);
  const records={file_view:{'11Original':{time:700,percent:70},'11Перевод':{time:600,percent:60},Other:{time:4,percent:4}},other:{'11Original':{time:500,percent:50}}},L={Storage:{get:k=>records[k]},Utils:{hash:v=>v},Timeline:{filename:()=> 'file_view',update:v=>records.file_view[v.hash]=v}},api=w.OnlineState.default(L),card={title:'Перевод',original_title:'Original'};
  api.clearProgress(card,1,1,'11Original');assert.equal(api.reader(card)(1,1).time,0);assert.equal(records.file_view['11Перевод'].percent,0);assert.equal(records.file_view.Other.time,4);assert.equal(records.other['11Original'].time,500);
 }finally{w.close();}
});

function screen(n,{id=900,season=1,episodes=[1,2,3],serial=true,voices=true,component={}}={}){
 const {w,L}=n,$=w.jQuery,root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div></div>').appendTo(w.document.body),body=root.find('.scroll__body'),filter=new L.Filter({search:false,sort:true,filter:true});root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Test',source:'test',selected:true},{title:'Other',source:'other',ghost:false}]);filter.set('filter',serial?[{stype:'season',title:'Сезон',items:[{title:'Сезон '+season,selected:true}]},...(voices?[{stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true}]}]:[])]:[]);
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
  s.root.find('[data-nova-focus=source]').trigger('hover:enter');await wait(90);assert.equal(L.Select.render().find('.selectbox-item').length,21);assert.ok(!L.Select.render().text().includes('Источник 21'),'Unavailable ghost sources stay hidden');L.Controller.back();assert.equal(s.root.find('[data-nova-focus="src:more"]').length,0);
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

test('one or two native dubbing options use the same compact menu, preserve original indices and do not autoplay',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  for(const count of [1,2,6]){
   if(s)s.close();s=screen(n);let selected=-1;s.filter.onSelect=(type,group,item)=>{selected=item.index;};
   s.filter.set('filter',[{stype:'voice',title:'Перевод',items:Array.from({length:count},(_,i)=>({title:'Студия '+i,selected:i===0}))}]);await wait(300);
   assert.equal(s.root.find('[data-nova-group=voice]').length,0);assert.equal(s.root.find('[data-nova-focus=voice]').length,1);
   s.root.find('[data-nova-focus=voice]').trigger('hover:enter');assert.equal(L.Select.render().find('.selectbox-item').length,count);
   L.Select.render().find('.selectbox-item').last().trigger('hover:enter');await wait(60);assert.equal(selected,count===1?-1:count-1);assert.equal(s.played(),0);assert.equal(L.Controller.enabled().name,'content');
  }
  assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('source and dubbing menus restore content control so Back keeps working after selection and cancellation',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n);s.filter.set('filter',[{stype:'voice',title:'Перевод',items:Array.from({length:8},(_,i)=>({title:'Студия '+i,selected:i===0}))}]);await wait(200);
  let backs=0;L.Controller.add('content',{toggle(){L.Controller.collectionSet(s.root[0]);},back(){backs++;}});L.Controller.toggle('content');
  for(const name of ['source','voice'])for(const select of [false,true]){
   s.root.find('[data-nova-focus='+name+']').trigger('hover:enter');assert.equal(L.Controller.enabled().name,'select');
   if(name==='voice')assert.equal(L.Select.render().find('.selectbox__title').text(),'Дубляж');
   if(select)L.Select.render().find('.selectbox-item.selected').first().trigger('hover:enter');else L.Controller.back();
   assert.equal(L.Select.opened(),false);assert.equal(L.Controller.enabled().name,'content');L.Controller.back();
  }
  assert.equal(backs,4);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('online context actions mark files and clear current or all timecodes without resolving a video',async()=>{
 const n=await native({built:true}),{L,w}=n;let s;try{
  const component={changeBalanser(){},contextMenu(){}};s=screen(n,{component});await wait(180);let nativeRequests=0,allmarks=0,alltimes=0;
  s.body.find('.online-prestige').each(function(index){const origin=w.jQuery(this),hash=L.Utils.hash('1'+(index+1)+'Original');origin.find('.time-line').attr('data-hash',hash);L.Timeline.update({hash,percent:35,time:300,duration:900});
   origin.on('hover:long',()=>nativeRequests++);
   component.contextMenu({html:origin,element:{mark(){origin.append('<div class="online-prestige__viewed"></div>');},unmark(){origin.find('.online-prestige__viewed').remove();},timeclear(){L.Timeline.update({hash,percent:0,time:0,duration:0});}},onClearAllMark(){allmarks++;s.body.find('.online-prestige__viewed').remove();},onClearAllTime(){alltimes++;}});
  });await wait(120);
  async function action(name){s.root.find('.nova-card').first().trigger('contextmenu');assert.equal(L.Select.opened(),true);const button=L.Select.render().find('.selectbox-item').filter(function(){return w.jQuery(this).text().trim()===name;}).first();assert.equal(button.length,1,name+': '+L.Select.render().text());button.trigger('hover:enter');await wait(80);assert.equal(L.Controller.enabled().name,'content');}
  await action('Отметить просмотренным');assert.equal(s.root.find('.nova-card__viewed,.nova-card__eye').length,1);
  await action('Снять отметку просмотра');assert.equal(s.root.find('.nova-card__viewed,.nova-card__eye').length,0);
  await action('Очистить таймкод');assert.equal(L.Timeline.view(L.Utils.hash('11Original')).time,0);assert.equal(L.Timeline.view(L.Utils.hash('12Original')).time,300);
  await action('Очистить таймкоды всех файлов');assert.equal(alltimes,1);assert.equal(L.Timeline.view(L.Utils.hash('12Original')).time,0);
  L.Timeline.update({hash:L.Utils.hash('26Original'),percent:40,time:720,duration:1800});L.Storage.set('online_watched_last',{[L.Utils.hash('Original')]:{season:2,episode:6},other:{season:1,episode:1}});
  await action('Очистить таймкоды сериала');assert.equal(L.Timeline.view(L.Utils.hash('26Original')).time,0);assert.equal(L.Storage.get('online_watched_last',{})[L.Utils.hash('Original')],undefined);assert.equal(L.Storage.get('online_watched_last',{}).other.episode,1);
  await action('Снять отметки у всех файлов');assert.equal(allmarks,1);assert.equal(nativeRequests,0);assert.equal(s.played(),0);assert.deepEqual(n.errors,[]);
  L.Timeline.update({hash:L.Utils.hash('11Original'),percent:35,time:300,duration:900});await wait(80);await action('Отметить просмотренным');
  assert.match(s.root.find('[data-nova-focus=hero]').text(),/Серия 2/);assert.equal(s.root.find('.nova-hero__progress .time-line>div').css('width'),'0%');assert.equal(L.Timeline.view(L.Utils.hash('11Original')).percent,100);assert.equal(L.Timeline.view(L.Utils.hash('12Original')).percent,0);assert.equal(w.LampaView.online.lastWatched(s.movie).episode,1);assert.equal(w.LampaView.online.resume(s.movie).episode,2);assert.equal(w.LampaView.online.resume(s.movie).percent,0);
 }finally{if(s)s.close();n.close();}
});

test('clearing a title resets all known seasons and aliases only in the active profile and removes stale last-played history',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{
  w.eval(code);const records={file_view:{'11Original':{percent:100,time:1800},'26Перевод':{percent:40,time:720},'provider-hash':{percent:20,time:360},'11Other':{percent:50,time:900}},other:{'11Original':{percent:70,time:1260}},online_watched_last:{Original:{season:2,episode:6},Перевод:{season:2,episode:6},Other:{season:1,episode:1}}};let reads=0;
  const L={Utils:{hash:t=>t},Storage:{get:k=>records[k],set:(k,v)=>records[k]=v},Timeline:{filename:()=> 'file_view',update:r=>records.file_view[r.hash]={...r},read:()=>reads++}},api=w.OnlineState.default(L),card={name:'Перевод',original_name:'Original',number_of_seasons:2};
  assert.equal(api.resume(card).episode,6);api.clearTitleProgress(card,['provider-hash']);
  assert.equal(api.reader(card)(1,1).time,0);assert.equal(api.reader(card)(2,6).time,0);assert.equal(records.file_view['provider-hash'].time,0);assert.equal(api.resume(card),null);
  assert.equal(records.online_watched_last.Original,undefined);assert.equal(records.online_watched_last.Перевод,undefined);assert.equal(records.online_watched_last.Other.episode,1);assert.equal(records.file_view['11Other'].time,900);assert.equal(records.other['11Original'].time,1260);assert.equal(reads,1);
 }finally{w.close();}
});

test('manual completion records the selected season and aliases, while resume starts the next episode at zero',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{
  w.eval(code);const records={file_view:{},online_watched_last:{}},L={Utils:{hash:v=>v},Storage:{get:k=>records[k],set:(k,v)=>records[k]=v},Timeline:{filename:()=> 'file_view',update:v=>records.file_view[v.hash]={...v,updated:Date.now()},read(){}}},api=w.OnlineState.default(L),card={name:'Перевод',original_name:'Original',number_of_seasons:2,seasons:[{season_number:1,episode_count:10},{season_number:2,episode_count:10}]};
  api.setWatched(card,1,1,true,'provider-item');assert.equal(api.reader(card)(1,1).percent,100);assert.equal(api.lastWatched(card).season,1);assert.equal(api.lastWatched(card).episode,1);assert.equal(api.resume(card).episode,2);assert.equal(api.resume(card).time,0);assert.equal(api.resume(card).percent,0);assert.equal(api.reader(card)(1,2).found,false);assert.equal(api.reader(card)(2,1).found,false);assert.equal(records.file_view['provider-item'].percent,100);
  api.setWatched(card,1,1,false,'provider-item');assert.equal(api.lastWatched(card),null);assert.equal(records.online_watched_last.Original,undefined);
  api.setWatched(card,2,1,true);assert.equal(api.lastWatched(card).season,2);assert.equal(api.resume(card).season,2);
 }finally{w.close();}
});

test('online controls start with a layout icon and source popup; long movie voices select a file without autoplay',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n,{serial:false,episodes:Array.from({length:10},(_,i)=>i+1)});await wait(180);
  const keys=Array.from(s.root.find('.nova-plus__bar .nova-chip'),node=>node.getAttribute('data-nova-focus'));assert.deepEqual(keys,['source','movievoice']);assert.equal(s.root.find('[data-nova-group=movievoice]').length,0);assert.equal(s.root.find('[data-nova-focus=order],[data-nova-focus=look]').length,0);
  s.root.find('[data-nova-focus=movievoice]').trigger('hover:enter');assert.equal(L.Select.render().find('.selectbox-item').length,10);L.Select.render().find('.selectbox-item').last().trigger('hover:enter');await wait(100);assert.equal(s.played(),0);s.root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),10);
 }finally{if(s)s.close();n.close();}
});

test('movies always use the wide banner, expose all voice choices and play selected versions from the compact main button',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n,{serial:false});s.movie.overview='Описание уже есть на странице фильма';await wait(200);
  assert.ok(s.root.find('.nova-plus-root').hasClass('nova-plus'));assert.equal(s.root.find('.nova-card').length,0);assert.equal(s.root.find('[data-nova-group=movievoice] .nova-chip').length,0);assert.equal(s.root.find('[data-nova-focus=movievoice]').length,1);assert.equal(s.root.find('.nova-hero__descr').css('display'),'none');
  selectMovie(s,L,1);await wait(100);assert.equal(s.played(),0,'choosing a voice must not start playback');const button=s.root.find('[data-nova-focus=hero]');assert.equal(button.text(),'Смотреть');assert.equal(button.attr('aria-label'),'Смотреть');assert.equal(button.find('.nova-btn__details').length,0);button.trigger('hover:enter');assert.equal(s.played(),2);assert.equal(s.root.find('.nova-card').length,0);assert.equal(s.root.find('[data-nova-focus=view]').length,0);
  L.Storage.set('nova_plus_mode','skin');L.Listener.send('activity',{type:'start'});await wait(180);assert.ok(s.root.find('.nova-plus-root').hasClass('nova-plus'));assert.equal(s.root.find('.nova-card').length,0);selectMovie(s,L,2);await wait(90);s.root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),3);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});
test('logo metadata requests share the native API and deduplicate concurrent full-card notifications',async()=>{
 const n=await native({built:true}),{L}=n;try{let calls=0,answer;L.Api.sources.tmdb.get=(url,p,ok)=>{if(url==='tv/975/images'){calls++;answer=ok;}};const card={id:975,name:'Сериал',source:'tmdb'},event={type:'complite',data:{movie:card},object:{card,activity:{render:()=>n.w.jQuery('<div></div>')}}};L.Listener.send('full',event);L.Listener.send('full',event);assert.equal(calls,1);answer({logos:[]});L.Listener.send('full',event);assert.equal(calls,1);assert.deepEqual(n.errors,[]);}finally{n.close();}
});

test('the film banner keeps native watch progress when changing voices and updates after a new timecode',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  const hash=L.Utils.hash('Original');L.Timeline.update({hash,percent:55,time:3300,duration:6000});s=screen(n,{serial:false});await wait(190);
  const fill=()=>s.root.find('.nova-hero__progress .time-line>div');assert.equal(fill().css('width'),'55%');assert.ok(s.root.find('.nova-btn__focus').length);assert.equal(s.root.find('.nova-card').length,0);
  selectMovie(s,L,2);await wait(90);assert.equal(fill().css('width'),'55%');L.Timeline.update({hash,percent:70,time:4200,duration:6000});await wait(140);assert.equal(fill().css('width'),'70%');s.root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),3);assert.deepEqual(n.errors,[]);
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

test('episode list retains the episode label and late rating when switching from tiles',async()=>{
 const n=await native({built:true}),{L,w}=n;let s;try{
  L.Api.sources.tmdb.get=(url,p,ok)=>w.setTimeout(()=>ok(url.includes('/season/')?{episodes:[{episode_number:1,name:'Название эпизода',vote_average:8.7,air_date:'2025-04-01'}]}:{logos:[]}),25);
  s=screen(n,{id:1666,episodes:[1,2]});await wait(200);L.Storage.set('nova_plus_view','list');L.Listener.send('activity',{type:'start'});await wait(150);
  const card=s.root.find('.nova-card').first();assert.equal(card.find('.nova-card__num').text(),'Серия 1');assert.equal(card.find('.nova-card__rate').text(),'★ 8.7');assert.equal(card.find('.nova-card__title').text(),'Название эпизода');assert.equal(card.find('.nova-card__rate').length,1);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('film facts show native countries and runtime below the year while the main button retains selected playback',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n,{id:996,serial:false});Object.assign(s.movie,{release_date:'2026-07-29',runtime:145,production_countries:[{iso_3166_1:'US',name:'United States of America'}],vote_average:8.5});await wait(220);
  const root=s.root,button=root.find('[data-nova-focus=hero]');assert.equal(root.find('.nova-hero__year').text(),'2026, США');assert.equal(root.find('.nova-hero__runtime').text(),'02:25');assert.equal(root.find('.nova-hero__date').children().last().attr('class'),'nova-hero__runtime');assert.equal(root.find('.nova-hero__season-label').length,0);assert.equal(button.text(),'Смотреть');
  selectMovie(s,L,2);await wait(90);root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),3);assert.equal(root.find('[data-nova-focus=hero]').text(),'Смотреть');assert.deepEqual(n.errors,[]);
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


test('bilingual provider folders resolve the exact original title, preserving year, sequel and ambiguity guards',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{
  w.eval(code);const pick=w.OnlineState.folderTarget,card={name:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',first_air_date:'2022-09-13'};
  const rows=[{method:'link',url:'/lite/aniliberty?releases=9307',title:'Киберпанк: Бегущие по краю / Cyberpunk: Edgerunners',year:2022,similar:true},{method:'link',url:'/lite/aniliberty?releases=10364',title:'Киберпанк: Бегущие по краю 2 / Cyberpunk: Edgerunners 2',year:2026,similar:true}];
  assert.equal(pick(rows,card),rows[0].url);assert.equal(pick(rows,{name:'Cyberpunk: Edgerunners',first_air_date:'2022-09-13'}),rows[0].url);
  assert.equal(pick([rows[1]],card),'');assert.equal(pick([{...rows[0],year:1990}],card),'');assert.equal(pick([...rows,{...rows[0],url:'/duplicate'}],card),'');
  assert.equal(pick([{...rows[0],title:'Другой тайтл | Cyberpunk: Edgerunners',season:2}],card,1),'');
  assert.equal(pick([{...rows[0],title:'Другой тайтл | Cyberpunk: Edgerunners',season:2}],card,2),rows[0].url);
  assert.equal(pick([{...rows[0],url:'javascript:alert(1)'}],card),'');
  assert.equal(pick([{...rows[0],title:'Другое произведение Cyberpunk: Edgerunners'}],card),'','No loose substring matching');
 }finally{w.close();}
});

test('online host follows native bilingual search HTML to the title without an intermediate manual folder click',async()=>{
 const n=await native({built:true}),{w}=n;let s;try{
  const requests=[],parsed=[],comp={changeBalanser(){},reset(){},request:url=>requests.push(url),parse:body=>{parsed.push(body);const nativeRows=Array.from(w.jQuery('<div>').html(body).find('.videos__item'),node=>JSON.parse(w.jQuery(node).attr('data-json')));if(nativeRows.length && nativeRows.every(row=>row.method==='link' && !row.similar))comp.request(nativeRows[0].url);},parseJsonDate:body=>Array.from(w.jQuery('<div>').html(body).find('.videos__item'),node=>JSON.parse(w.jQuery(node).attr('data-json')))};
  s=screen(n,{component:comp});Object.assign(s.movie,{name:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',first_air_date:'2022-09-13'});await wait(180);
  const rows=[{method:'link',url:'/lite/aniliberty?releases=9307',title:'Киберпанк: Бегущие по краю / Cyberpunk: Edgerunners',year:2022,similar:true},{method:'link',url:'/lite/aniliberty?releases=10364',title:'Киберпанк: Бегущие по краю 2 / Cyberpunk: Edgerunners 2',year:2026,similar:true}],body=rows.map(tag).join('');
  comp.request('/lite/aniliberty?title=Cyberpunk');comp.parse(body);assert.equal(requests.at(-1),rows[0].url);assert.equal(parsed.length,1);assert.equal(parsed[0].includes('similar'),false,'Native season page retains the picker URLs');assert.deepEqual(Array.from(w.jQuery('<div>').html(parsed[0]).find('.videos__item'),node=>node.textContent),['Сезон 1','Сезон 2']);assert.equal(s.played(),0);
  comp.parse(body);assert.equal(parsed.length,2,'Repeated target must not recurse');
  const seasonBody=tag({method:'link',url:'/lite/provider?season=1',title:'Киберпанк: Бегущие по краю / Cyberpunk: Edgerunners',season:1}).replace('videos__item','videos__item videos__season');
  comp.request('/lite/provider/search');comp.parse(seasonBody);assert.equal(requests.at(-1),'/lite/provider?season=1','Native season folders do not require the similar flag');
  comp.request('/lite/provider/search');comp.parse(tag({method:'link',similar:true,title:'Посторонний фильм',url:'/wrong'}));assert.equal(parsed.at(-1),'<div class="videos__line"></div>');assert.notEqual(requests.at(-1),'/wrong');
  const episode=tag({method:'play',url:'/test.mp4',title:'Серия 1'});comp.parse(episode);assert.equal(parsed.at(-1),episode);assert.equal(s.played(),0);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('provider folders accept native JSON objects, JSON strings and escaped HTML attributes uniformly',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);
  const api=w.OnlineState,card={name:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',first_air_date:'2022-09-13'};
  for(const source of ['animebesst','aniliberty','animelib','kinobase']){
   const rows=[{title:card.name+' (2 сезон)',method:'link',similar:true,year:2026,url:'/lite/'+source+'?uri=second&s=2'},{title:card.name,text:'Посторонний год и подпись 2022',method:'link',similar:true,year:2022,url:'/lite/'+source+'?uri=first&s=0'}];
   for(const body of [{type:'similar',data:rows},JSON.stringify({type:'similar',data:rows}),rows.map(tag).join('')]){
    const parsed=api.folderRows(body);assert.equal(parsed.length,2);assert.equal(api.folderTarget(parsed,card),rows[1].url);const seasons=api.folderSeasons(parsed,card);assert.deepEqual(Array.from(seasons,row=>row.season),[1,2]);assert.equal(seasons[0].url,rows[1].url);
   }
  }
  assert.equal(api.folderRows(JSON.stringify({type:'video',data:[{method:'play',url:'/movie'}]})).length,0);
  assert.equal(api.folderRows('<script>'+tag({method:'link',similar:true,url:'/bad',title:card.name})+'</script>').length,0);
  assert.equal(api.folderSeasons([{method:'link',similar:true,title:'Other',url:'/other'}],card).length,0);
 }finally{w.close();}
});


test('late native voice choices appear after first entry without changing source or episode DOM',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n,{voices:false});const season={stype:'season',title:'Сезон',items:[{title:'Сезон 1',selected:true}]};
  s.filter.set('filter',[season]);await wait(220);assert.equal(s.root.find('[data-nova-focus=voice]').length,0);
  let selected=-1;s.filter.onSelect=(type,group,item)=>{selected=item.index;};
  const voice={stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true},{title:'LostFilm'}]};
  s.filter.set('filter',[season,voice]);await wait(240);assert.equal(s.root.find('[data-nova-focus=voice]').length,1);
  s.root.find('[data-nova-focus=voice]').trigger('hover:enter');L.Select.render().find('.selectbox-item').last().trigger('hover:enter');assert.equal(selected,1);assert.equal(voice.items.length,2);assert.equal(s.played(),0);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('compact episode direction toggle restores both grid and horizontal rail without changing tile/list preference',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  L.Storage.set('nova_plus_view','grid');L.Storage.set('nova_plus_layout','grid');s=screen(n);await wait(220);
  const button=()=>s.root.find('[data-nova-focus=direction]');assert.equal(button().find('svg').length,1);assert.equal(button().text(),'');assert.equal(button().attr('data-current-direction'),'vertical');
  button().trigger('hover:enter');await wait(150);assert.equal(L.Storage.get('nova_plus_layout'),'row');assert.equal(button().attr('data-current-direction'),'horizontal');assert.equal(s.root.find('.nova__list--row').length,1);
  button().trigger('hover:enter');await wait(150);assert.equal(L.Storage.get('nova_plus_layout'),'grid');assert.equal(s.root.find('.nova__list--row').length,0);assert.equal(L.Storage.get('nova_plus_view'),'grid');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('tile and list progress fill from timeline and watched markers while empty tracks remain visible',async()=>{
 const n=await native({built:true}),{L,w}=n;let s;try{
  L.Storage.set('nova_plus_view','grid');L.Timeline.update({hash:L.Utils.hash('11Original'),percent:40,time:720,duration:1800});
  s=screen(n);s.body.find('.online-prestige').eq(1).append('<div class="online-prestige__viewed"></div>');await wait(250);
  const widths=()=>Array.from(s.root.find('.nova-card__line .time-line>div'),n=>n.style.width);
  assert.deepEqual(widths(),['40%','100%','0%']);assert.equal(s.root.find('.nova-card__line .time-line.hide').length,0);
  s.root.find('[data-nova-focus=view]').trigger('hover:enter');await wait(150);assert.deepEqual(widths(),['40%','100%','0%']);assert.equal(s.root.find('.nova-card__line--body').length,3);
  L.Timeline.update({hash:L.Utils.hash('11Original'),percent:65,time:1170,duration:1800});await wait(180);assert.deepEqual(widths(),['65%','100%','0%']);
  L.Timeline.update({hash:L.Utils.hash('21Original'),percent:80,time:1440,duration:1800});await wait(150);assert.equal(widths()[0],'65%','Another season never overwrites this episode');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('unrelated fuzzy search hits disappear while matching title seasons and native voice rows remain',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);const card={name:'Фактор BY. Дети',original_name:'Factor BY Kids',first_air_date:'2026-01-01'},pick=w.OnlineState.relevantFolders;
 const other=['Adam by Eve','Пси Фактор: Хроники паранормальных явлений','Метаморфозы: Фактор чужого','Человеческий фактор'].map(title=>({title,method:'link',similar:true,url:'/lite/test/'+encodeURIComponent(title)}));
 assert.equal(pick(other,card).length,0);const exact={title:card.name,year:2026,method:'link',similar:true,url:'/lite/test/exact'};assert.equal(pick([...other,exact],card)[0].url,exact.url);
 const seasons=[{...exact,title:'Factor BY Kids (1 сезон)'},{...exact,title:'Factor BY Kids (2 сезон)',year:2027}];assert.equal(pick(seasons,{...card,number_of_seasons:2}).length,2);
 const voices=[{title:'TVShows',method:'link',url:'/voice/1'}];assert.equal(pick(voices,card),voices);
 }finally{w.close();}
});
