const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom'),native=require('./fixtures/native-lampa.cjs');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/online-state.js')],bundle:true,write:false,format:'iife',globalName:'OnlineState'}).outputFiles[0].text;
const until=require('./fixtures/until.cjs');
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

test('linked native timelines identify opaque hashes and newer active episodes without relying on a title hash',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
 try{
  w.eval(code);const records={
   '15Original':{percent:95,time:0,updated:10},
   opaque:{card:'tv_91',season:1,episode:6,percent:20,time:240,duration:1200,updated:20},
   foreign:{card:'tv_92',season:1,episode:7,percent:30,time:360,updated:30}
  };
  const L={Storage:{get:(key,fallback)=>key==='file_view'?records:fallback},Utils:{hash:v=>v},Timeline:{filename:()=> 'file_view'}};
  const state=w.OnlineState.default(L),card={id:91,source:'tmdb',name:'Сериал',original_name:'Original'};
  assert.equal(state.lastWatched(card).episode,6);assert.equal(state.reader(card)(1,6).hash,'opaque');
  assert.equal(state.reader(card)(1,6).time,240);assert.equal(state.resume(card).episode,6);
 }finally{w.close();}
});
test('source availability checks real entries, excludes similar titles and distinguishes access failures from empty catalogues',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);const state=w.OnlineState.availability;
 assert.equal(state(tag({method:'play',url:'/file'})).state,'ok');assert.equal(state(tag({method:'call',url:'/call',similar:true})).state,'empty');assert.equal(state('<div class="videos__line"></div>').state,'empty');assert.equal(state('<html><h1>Access denied</h1></html>').state,'unknown');assert.equal(state('').state,'unknown');assert.equal(state(JSON.stringify({accsdb:true})).state,'unknown');assert.equal(state({data:[{method:'call',url:'/film'}]}).state,'ok');assert.equal(state({data:[]}).state,'empty');assert.equal(state('<script>'+tag({method:'play',url:'/fake'})+'</script>').state,'unknown');assert.equal(state('<div class="videos__item">No valid data</div>').state,'empty');
 }finally{w.close();}
});
test('native progress picks the latest title alias, advances completed seasons and isolates profiles without writing records',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{w.eval(code);let profile='file_view',update,writes=0;const records={file_view:{},file_view_other:{}},L={Utils:{hash:t=>t},Storage:{get:k=>records[k],set:()=>writes++},Timeline:{filename:()=>profile,listener:{follow:(e,f)=>update=f}}},api=w.OnlineState.default(L),card={id:1,name:'Перевод',original_name:'Original',number_of_seasons:2,seasons:[{season_number:1,episode_count:2,air_date:"2020-01-01"},{season_number:2,episode_count:3,air_date:"2021-01-01"}]};
 records.file_view['11Original']={percent:50,time:600,updated:1};records.file_view['11Перевод']={percent:20,time:240,updated:2};assert.equal(api.reader(card)(1,1).time,240);assert.equal(api.resume(card).episode,1);
 records.file_view['12Original']={percent:95,time:1000,updated:3};update();assert.equal(api.resume(card).season,2);assert.equal(api.resume(card).episode,1);assert.equal(api.resume(card).time,0);
 profile='file_view_other';assert.equal(api.resume(card),null);assert.equal(api.reader(card)(1,1).found,false);assert.equal(writes,0);
 }finally{w.close();}
});
test('resume never offers an unaired season or an episode beyond the last release',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;try{
  w.eval(code);const records={'18Original':{percent:100,time:0,updated:1}},L={Utils:{hash:t=>t},Storage:{get:k=>k==='file_view'?records:{}},Timeline:{filename:()=> 'file_view'}},api=w.OnlineState.default(L);
  const card={name:'Кэрри',original_name:'Original',number_of_seasons:2,seasons:[{season_number:1,episode_count:8,air_date:'2020-01-01'},{season_number:2,episode_count:10,air_date:'2099-01-01'}],last_episode_to_air:{season_number:1,episode_number:8,air_date:'2020-02-01'}};
  assert.equal(api.resume(card).complete,true,'announced season is not playable');
  assert.equal(api.resume({...card,last_episode_to_air:undefined}).complete,true,'future season date is not playable either');
  const released={...card,last_episode_to_air:{season_number:2,episode_number:6,air_date:'2021-02-01'}};
  assert.equal(api.resume(released).season,2);assert.equal(api.resume(released).episode,1);assert.equal(api.resume(released).percent,0);assert.equal(api.resume(released).time,0);
  const current={...released,id:99};delete records['18Original'];records['26Original']={percent:100,time:0,updated:2};assert.equal(api.resume(current).complete,true,'all currently released episodes completed');
  const partial={...released,id:100};records['26Original']={percent:35,time:600,updated:3};assert.equal(api.resume(partial).episode,6);assert.equal(api.resume(partial).time,600);assert.equal(api.resume(partial).complete,undefined);
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
 const body=tag({method:'link',url:'/lite/test?s=1',name:'Сезон 1'})+tag({method:'link',url:'/lite/test?s=2',name:'Сезон 2'});component.parse(body);assert.equal(choices.test.season,1);component.lampaViewManualSeason=1;component.parse(body);assert.equal(choices.test.season,0);component.changeBalanser('other');assert.equal(choices.other.voice_name,undefined,'Another source keeps its own dub list');assert.equal(component.lampaViewManualSeason,undefined);assert.equal(parsed,2);assert.deepEqual(n.errors,[]);
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
  async function action(name,bulk=false){
   s.root.find('.nova-card').first().trigger('contextmenu');assert.equal(L.Select.opened(),true);
   const pick=title=>{const button=L.Select.render().find('.selectbox-item').filter(function(){return w.jQuery(this).find('.selectbox-item__title').text().trim()===title;}).first();assert.equal(button.length,1,title+': '+L.Select.render().text());button.trigger('hover:enter');};
   if(bulk)pick('Сезон и сериал…');pick(name);if(bulk && name!=='Отметить все вышедшие серии')pick('Да, сбросить');
   await wait(100);assert.equal(L.Controller.enabled().name,'content');
  }
  await action('Отметить серию просмотренной');assert.equal(s.root.find('.nova-card__viewed,.nova-card__eye').length,1);
  await action('Снять отметку просмотра');assert.equal(s.root.find('.nova-card__viewed,.nova-card__eye').length,0);
  L.Timeline.update({hash:L.Utils.hash('11Original'),percent:35,time:300,duration:900});await wait(80);await action('Очистить таймкод');assert.equal(L.Timeline.view(L.Utils.hash('11Original')).time,0);assert.equal(L.Timeline.view(L.Utils.hash('12Original')).time,300);
  await action('Очистить таймкоды текущего сезона',true);assert.equal(alltimes,1);assert.equal(L.Timeline.view(L.Utils.hash('12Original')).time,0);
  L.Timeline.update({hash:L.Utils.hash('26Original'),percent:40,time:720,duration:1800});L.Storage.set('online_watched_last',{[L.Utils.hash('Original')]:{season:2,episode:6},other:{season:1,episode:1}});
  await action('Очистить таймкоды всего сериала',true);assert.equal(L.Timeline.view(L.Utils.hash('26Original')).time,0);assert.equal(L.Storage.get('online_watched_last',{})[L.Utils.hash('Original')],undefined);assert.equal(L.Storage.get('online_watched_last',{}).other.episode,1);
  await action('Снять отметки текущего сезона',true);assert.equal(allmarks,2);assert.equal(nativeRequests,0);assert.equal(s.played(),0);assert.deepEqual(n.errors,[]);
  L.Timeline.update({hash:L.Utils.hash('11Original'),percent:35,time:300,duration:900});await wait(80);await action('Отметить серию просмотренной');
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
  api.setWatched(card,1,1,true,'provider-item');assert.doesNotThrow(()=>api.lastWatched({...card,seasons:2}),'Numeric season counts must not crash card focus');assert.equal(api.reader(card)(1,1).percent,100);assert.equal(api.lastWatched(card).season,1);assert.equal(api.lastWatched(card).episode,1);assert.equal(api.resume(card).episode,2);assert.equal(api.resume(card).time,0);assert.equal(api.resume(card).percent,0);assert.equal(api.reader(card)(1,2).found,false);assert.equal(api.reader(card)(2,1).found,false);assert.equal(records.file_view['provider-item'].percent,100);
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

test('next episode starts at zero when completed episodes are absent from the current provider',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
 for(let episode=1;episode<=4;episode++)L.Timeline.update({hash:L.Utils.hash('1'+episode+'Original'),percent:100,time:1800,duration:1800});
 s=screen(n,{id:991,episodes:[5,6]});s.movie.number_of_seasons=1;s.movie.seasons=[{season_number:1,episode_count:6}];await wait(250);
 assert.equal(s.root.find('.nova-hero__season').length,0);assert.equal(s.root.find('.nova-hero__season-label').text(),'Сезон 1');assert.equal(s.root.find('.nova-hero__progress .time-line>div').css('width'),'0%');assert.deepEqual(n.errors,[]);
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

test('episode cards share canonical descriptions while hero facts and voice labels stay compact',async()=>{
 const n=await native({built:true,initialStorage:{nova_plus_view:'grid'}}),{L,w}=n;let s;try{
  L.Api.sources.tmdb.get=(url,p,ok)=>w.setTimeout(()=>ok(url.includes('/season/')?{episodes:[{episode_number:1,name:'Пан или пропал',overview:'Краткое описание серии',vote_average:8.4,air_date:'2025-03-30'}]}:{logos:[]}),0);
  s=screen(n,{id:995,episodes:[1,2,3]});Object.assign(s.movie,{first_air_date:'2025-03-30',origin_country:['US'],vote_average:8.5});
  s.filter.set('sort',[{title:'Test - 4K',source:'test',selected:true}]);
  const nativeRows=s.body.find('.online-prestige--full');nativeRows.eq(0).find('.online-prestige__quality').text('720p');nativeRows.eq(1).find('.online-prestige__quality').text('SD');nativeRows.eq(2).find('.online-prestige__quality').empty();
  await wait(260);
  const root=s.root;assert.equal(root.find('.nova-card__title').first().text(),'Пан или пропал');assert.equal(root.find('.nova-card__tag').first().text(),'Серия 1');assert.equal(root.find('.nova-card__quality').eq(0).text(),'HD');assert.equal(root.find('.nova-card__quality').eq(1).text(),'SD');assert.equal(root.find('.nova-card').eq(2).find('.nova-card__quality').length,0);
  assert.equal(root.find('.nova-card__descr,.nova-card__voice,.nova-card__tags,[data-nova-focus=hero-next],.nova-hero__season').length,0);assert.doesNotMatch(root.find('.nova-card').text(),/TVShows/);assert.equal(root.find('.nova-card__overview').first().text(),'Краткое описание серии');
  assert.equal(root.find('.nova-hero__year').text(),'2025, США');assert.equal(root.find('.nova-hero__season-label').text(),'Сезон 1');assert.equal(root.find('.nova-hero__runtime').length,0);assert.equal(root.find('.nova-hero>.nova-hero__quality').text(),'HD');
  // Native metadata can arrive after the interface has already rendered.
  nativeRows.eq(0).find('.online-prestige__quality')[0].firstChild.nodeValue='1920x800';await wait(180);assert.equal(root.find('.nova-card__quality').first().text(),'FHD');assert.equal(root.find('.nova-hero>.nova-hero__quality').text(),'FHD');
  L.Storage.set('nova_plus_view','list');L.Listener.send('activity',{type:'start'});await wait(180);assert.equal(root.find('.nova-card__title').first().text(),'Пан или пропал');assert.doesNotMatch(root.find('.nova-card__meta').text(),/TVShows|Описание/);assert.equal(root.find('.nova-card__descr,.nova-card__voice').length,0);assert.equal(root.find('.nova-card__overview').first().text(),'Краткое описание серии');assert.doesNotMatch(root.find('.nova-card__meta').text(),/●/,'Rating and air date use spacing without a bullet');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('episode list retains the episode label and late rating when switching from tiles',async()=>{
 const n=await native({built:true}),{L,w}=n;let s;try{
  L.Api.sources.tmdb.get=(url,p,ok)=>w.setTimeout(()=>ok(url.includes('/season/')?{episodes:[{episode_number:1,name:'Название эпизода',vote_average:8.7,air_date:'2025-04-01'}]}:{logos:[]}),25);
  s=screen(n,{id:1666,episodes:[1,2]});await wait(200);L.Storage.set('nova_plus_view','list');L.Listener.send('activity',{type:'start'});await wait(150);
  const card=s.root.find('.nova-card').first();assert.equal(card.find('.nova-card__num').text(),'Серия 1');assert.equal(card.find('.nova-card__rate').text(),'8.7');assert.equal(card.find('.nova-card__title').text(),'Название эпизода');assert.equal(card.find('.nova-card__rate').length,1);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('film facts show native countries and runtime below the year while the main button retains selected playback',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  s=screen(n,{id:996,serial:false});Object.assign(s.movie,{release_date:'2026-07-29',runtime:145,production_countries:[{iso_3166_1:'US',name:'United States of America'}],vote_average:8.5});await wait(220);
  const root=s.root,button=root.find('[data-nova-focus=hero]');assert.equal(root.find('.nova-hero__year').text(),'2026, США');assert.equal(root.find('.nova-hero__runtime').text(),'02:25');assert.equal(root.find('.nova-hero__meta .nova-hero__runtime').length,1);assert.equal(root.find('.nova-hero > .nova-hero__runtime').length,0);assert.equal(root.find('.nova-hero__season-label').length,0);assert.equal(button.text(),'Смотреть');
  selectMovie(s,L,2);await wait(90);root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),3);assert.equal(root.find('[data-nova-focus=hero]').text(),'Смотреть');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('online layout settings change source position, episode order and strip direction, and quality applies to native playback',async()=>{
 const n=await native({built:true,initialStorage:{nova_plus_view:'grid'}}),{L}=n;let s;try{
  s=screen(n,{id:997});await wait(190);const setting=name=>L.SettingsApi.getParam('minimal_settings_playback').find(p=>p.param.name===name),change=async(name,value)=>{L.Storage.set(name,value);const param=setting(name) || L.SettingsApi.getParam('nova_plus').find(p=>p.param.name===name);if(param.onChange)param.onChange(value);await wait(110);};
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

test('exact catalogue aliases restore synced native records, manual marks keep unknown time and season completion requires every episode',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;try{
  w.eval(code);const records={file_view_7:{},minimal_card_info_v1:[['tmdb:movie:91',{time:Date.now(),names:['Астрал 6: Они уже здесь']}]]},listeners={};
  const L={Utils:{hash:x=>x},Storage:{get:(k,v)=>records[k] || v,set:(k,v)=>records[k]=v},Listener:{follow:(k,fn)=>listeners[k]=fn},Timeline:{filename:()=> 'file_view_7',view:()=>({}),update:v=>records.file_view_7[v.hash]={...v},read(){}}},api=w.OnlineState.default(L);
  for(const title of ['Астрал 6: Они уже здесь','Вышка 2']){
   records.file_view_7[title]={percent:40,time:915,duration:2400};assert.equal(api.reader({title,original_title:'Original '+title})(0,0).time,915);
  }
  assert.equal(api.reader({id:91,source:'tmdb',title:'Insidious',original_title:'Insidious 6'})(0,0).time,915,'Known alias is read only for the same catalogue ID');
  const card={name:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',seasons:[{season_number:1,episode_count:3}],episode_run_time:[47]};
  records.file_view_7['13Cyberpunk: Edgerunners']={percent:100,time:2832,duration:2832};
  assert.equal(api.lastWatched(card).episode,3);assert.equal(api.seasonWatched(card,1,3),false,'Last completed episode alone cannot complete a season');
  api.setWatched(card,1,1,true);assert.equal(api.reader(card)(1,1).time,0,'A manual mark must not invent runtime');
  assert.equal(api.reader(card)(1,1).percent,100);assert.equal(api.seasonWatched(card,1,3),false);
  records.file_view_7['12Cyberpunk: Edgerunners']={percent:40,time:915};assert.equal(api.seasonWatched(card,1,3),false);
  records.file_view_7['12Cyberpunk: Edgerunners']={percent:89,time:2520};assert.equal(api.seasonWatched(card,1,3),false);
  records.file_view_7['12Cyberpunk: Edgerunners']={percent:90,time:2550};assert.equal(api.seasonWatched(card,1,3),true,'Skipped credits use the same completion threshold as resume');assert.equal(records.file_view_7['12Cyberpunk: Edgerunners'].time,2550,'Status must not invent a later timecode');
  records.file_view_7={'12Cyberpunk: Edgerunners':{percent:30,time:720,updated:100}};listeners['state:changed']({target:'timeline',reason:'read'});
  assert.equal(api.lastWatched(card).episode,2);assert.equal(api.lastWatched(card).time,720,'Sync invalidates the focused snapshot');
  api.setWatched({title:'Вышка 2',runtime:100},0,0,true);assert.equal(api.reader({title:'Вышка 2'})(0,0).time,0);
 }finally{w.close();}
});

test('a single dubbing arriving after the initial empty filter appears without switching source',async()=>{
 const n=await native({built:true}),{w,L}=n;let s;try{
  s=screen(n,{voices:false});const season={stype:'season',title:'Сезон',items:[{title:'Сезон 2',selected:true}]};
  s.filter.set('filter',[season]);await wait(240);assert.equal(s.root.find('[data-nova-focus=voice]').length,0);assert.equal(s.root.find('[data-nova-status=voice]').length,0,'No inert source-audio badge without a real choice');
  const original=s.body.find('.online-prestige')[0];let selected=-1,sourceChanges=0;
  s.filter.onSelect=(type,group,item)=>{if(type==='sort')sourceChanges++;else selected=item.index;};
  const voice={stype:'voice',title:'Перевод',items:[{title:'КОМНАТА ДИДИ',selected:true,index:0}]};
  s.filter.set('filter',[season,voice]);await wait(240);
  const button=s.root.find('[data-nova-focus=voice]');assert.equal(button.length,1,'One available dubbing is a real group, not an absent group');assert.match(button.text(),/КОМНАТА ДИДИ/);
  button.trigger('hover:enter');assert.equal(L.Select.render().find('.selectbox-item').length,1);L.Select.render().find('.selectbox-item').first().trigger('hover:enter');
  assert.equal(selected,-1,'Choosing the already active dubbing must not reload its source');assert.equal(sourceChanges,0);assert.equal(s.played(),0);assert.equal(s.body.find('.online-prestige')[0],original,'Native playback node remains intact');
  voice.items.push({title:'AniLibria',selected:false,index:1});s.filter.set('filter',[season,voice]);await wait(240);
  s.root.find('[data-nova-focus=voice]').trigger('hover:enter');assert.equal(L.Select.render().find('.selectbox-item').length,2);L.Select.render().find('.selectbox-item').last().trigger('hover:enter');assert.equal(selected,1,'A new choice reaches the native handler');assert.equal(sourceChanges,0);assert.equal(s.played(),0);
  s.filter.set('filter',[season]);await wait(240);assert.equal(s.root.find('[data-nova-focus=voice]').length,0,'An empty group removes its old button');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('previous-episodes action is inclusive, explicit about its season, preserves real elapsed time and never invokes provider fake-runtime marks',async()=>{
 const n=await native({built:true}),{L,w}=n;let s;try{
  s=screen(n,{episodes:[4,3,2,1],component:{changeBalanser(){},contextMenu(){}}});await wait(180);let providerMarks=0;
  s.body.find('.online-prestige').each(function(){const origin=w.jQuery(this),num=Number(origin.find('.online-prestige__episode-number').text()),hash=L.Utils.hash('1'+num+'Original');origin.find('.time-line').attr('data-hash',hash);s.component.contextMenu({html:origin,element:{mark(){providerMarks++;L.Timeline.update({hash,percent:100,time:9999,duration:9999});}}});});
  L.Timeline.update({hash:L.Utils.hash('13Original'),percent:35,time:300,duration:900});L.Timeline.update({hash:L.Utils.hash('21Original'),percent:40,time:500,duration:1200});await wait(160);
  s.root.find('.nova-card').eq(1).trigger('contextmenu');const select=L.Select.render(),option=select.find('.selectbox-item').filter(function(){return w.jQuery(this).find('.selectbox-item__title').text()==='Отметить серии 1–3 просмотренными';});
  assert.equal(option.length,1);assert.match(option.find('.selectbox-item__subtitle').text(),/Только сезон 1/);option.trigger('hover:enter');await wait(180);
  for(let e=1;e<=3;e++)assert.equal(L.Timeline.view(L.Utils.hash('1'+e+'Original')).percent,100);
  assert.equal(L.Timeline.view(L.Utils.hash('11Original')).time,0);assert.equal(L.Timeline.view(L.Utils.hash('13Original')).time,300);assert.equal(L.Timeline.view(L.Utils.hash('14Original')).percent,0);assert.equal(L.Timeline.view(L.Utils.hash('21Original')).time,500);
  assert.equal(providerMarks,0);assert.equal(s.played(),0);assert.equal(L.Controller.enabled().name,'content');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('AniLiberty numbered seasons survive stale one-season TMDB metadata while its prequel movie is excluded',()=>{
 const d=new JSDOM('<body>',{runScripts:'outside-only'});try{d.window.eval(code);const api=d.window.OnlineState,card={name:'МАГИЧЕСКАЯ БИТВА',original_name:'呪術廻戦',first_air_date:'2020-10-03',number_of_seasons:1},rows=[
 {title:'Магическая битва / Jujutsu Kaisen',method:'link',similar:true,url:'/lite/aniliberty?season=1'},
 {title:'Магическая битва 0 Фильм / Jujutsu Kaisen 0 Movie',method:'link',similar:true,url:'/lite/aniliberty?movie=0'},
 {title:'Магическая битва 2 / JUJUTSU KAISEN Season 2',method:'link',similar:true,url:'/lite/aniliberty?season=2'},
 {title:'Магическая битва 3 / Jujutsu Kaisen: Shimetsu Kaiyuu - Zenpen',method:'link',similar:true,url:'/lite/aniliberty?season=3'}];
 const kept=api.relevantFolders(rows,card);assert.equal(kept.length,3);const seasons=api.folderSeasons(kept,card);assert.deepEqual(Array.from(seasons,r=>r.season),[1,2,3]);assert.ok(seasons.every(r=>r.url.includes('season='+r.season)));
 }finally{d.window.close();}
});
test('season UI is chronological but preserves provider indexes and selected season when choosing',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{s=screen(n);s.filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'1 сезон',items:[{title:'3 сезон',index:0},{title:'1 сезон',index:1,selected:true},{title:'2 сезон',index:2}]}]);await wait(240);
 assert.deepEqual(Array.from(s.root.find('[data-nova-group=season] .nova-chip__label').map(function(){return n.w.jQuery(this).text();}).get()),['Сезон 1','Сезон 2','Сезон 3']);let index=-1;s.filter.onSelect=(type,group,item)=>index=item.index;s.root.find('[data-nova-focus="season:2"]').trigger('hover:enter');assert.equal(index,2);assert.equal(L.Activity.active().activity.component.lampaViewManualSeason,2);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});
test('Lampac source changes delegate to its fresh native component instead of keeping private season and voice arrays',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{let nativeCalls=0,reused=0;const comp={parseJsonDate(){},display(){},filter(){},createSource(){reused++;return Promise.resolve();},search(){},changeBalanser(){nativeCalls++;}};s=screen(n,{component:comp});s.filter.onSelect=(type,item)=>{if(type==='sort')comp.changeBalanser(item.source);};await wait(230);s.root.find('[data-nova-focus=source]').trigger('hover:enter');L.Select.render().find('.selectbox-item').last().trigger('hover:enter');await wait(60);assert.equal(nativeCalls,1);assert.equal(reused,0);assert.equal(s.played(),0);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('missing localized episode synopsis does not silently substitute English',async()=>{
 const n=await native({built:true,initialStorage:{language:'ru',nova_plus_view:'grid'}}),{L,w}=n;let s;const requests=[];
 try{L.Api.sources.tmdb.get=(url,p,ok)=>{requests.push(url);w.setTimeout(()=>ok(url.includes('episode_groups')?{results:[]}:url.includes('/season/')?{episodes:[{episode_number:1,name:'Первая серия',overview:'',vote_average:8.4,air_date:'2027-03-30'},{episode_number:2,name:'Вторая',overview:'Описание на выбранном языке',vote_average:8.2},{episode_number:3,name:'We Do Not Talk Anymore',overview:'English fallback synopsis'}]}:{id:1887,number_of_seasons:2,seasons:[{season_number:1,episode_count:3},{season_number:2,episode_count:3}]}),0);};
  s=screen(n,{id:1887,episodes:[1,2,3]});s.movie.seasons[0].episode_count=3;for(let i=0;i<50 && s.root.find('.nova-card__overview').first().text()!=='Описание на выбранном языке';i++)await wait(20);assert.equal(s.root.find('.nova-card').first().find('.nova-card__overview').length,0);assert.equal(s.root.find('.nova-card__overview').first().text(),'Описание на выбранном языке',JSON.stringify({requests,text:s.root.find('.nova-card').text()}));assert.equal(s.root.find('.nova-card').eq(2).find('.nova-card__title').text(),'Серия 3');assert.equal(s.root.find('.nova-card').eq(2).find('.nova-card__overview').length,0);assert.ok(!requests.some(url=>url.includes('language=en')));assert.doesNotMatch(s.root.find('.nova-card__rate,.nova-hero__rating').text(),/[★☆]/);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('both themes keep four seasons inline and five in a lower native menu with original provider indices',async()=>{
 for(const theme of ['minimal','glass']){
  const n=await native({built:true,initialStorage:{lampa_view_theme:theme}}),{L}=n;let s;
  try{
   s=screen(n);let selected=-1;s.filter.onSelect=(type,group,item)=>selected=item.index;
   const seasons=count=>({stype:'season',title:'Сезон',items:Array.from({length:count},(_,i)=>({title:(count-i)+' сезон',index:i,selected:i===count-1}))});
   s.filter.set('filter',[seasons(4)]);await wait(220);
   const panel=s.root.find('.nova-plus__panel');assert.equal(panel.find('[data-nova-group=season] .nova-plus__label').length,0);assert.equal(panel.find('[data-nova-group=season] [data-nova-focus^="season:"]').length,4);assert.equal(panel.children('.nova-plus__bar').next().attr('data-nova-group'),'season');
   panel.find('[data-nova-focus="season:2"]').trigger('hover:enter');assert.equal(selected,2);
   s.filter.set('filter',[seasons(5)]);await wait(220);const control=s.root.find('[data-nova-focus=season]');assert.equal(control.closest('[data-nova-group=season]').length,1);assert.equal(s.root.find('[data-nova-focus^="season:"]').length,0);control.trigger('hover:enter');
   assert.equal(L.Select.render().find('.selectbox-item').length,5);L.Select.render().find('.selectbox-item').eq(1).trigger('hover:enter');assert.equal(selected,3,'chronological season 2 retains provider index 3');assert.equal(s.played(),0,'choosing a season does not play an episode');assert.deepEqual(n.errors,[]);
  }finally{if(s)s.close();n.close();}
 }
});


test('source menu shows verified availability and follows later provider answers without another probe',async()=>{
 const now=Date.now(),n=await native({built:true,initialStorage:{nova_probe:{'tmdb:tv:1666':{time:now,list:{test:{s:'ok',c:3,t:now}}}}}}),{L}=n;let s;
 try{
  const comp={request(){},parse(){},changeBalanser(){}};s=screen(n,{id:1666,component:comp});await wait(180);
  s.root.find('[data-nova-focus=source]').trigger('hover:enter');
  const menu=L.Select.render(),items=menu.find('.nova-source-option');assert.equal(items.length,2);assert.equal(s.root.find('.nova-plus__bar [data-nova-focus=source] .nova-source-option__status').length,0,'Closed source control has no availability dot');
  assert.equal(items.filter('[data-nova-provider=test]').find('.nova-source-option__status').length,1);
  assert.equal(items.filter('[data-nova-provider=other]').find('.nova-source-option__status').length,0,'Untested source has no success marker');
  comp.request('https://online.example.test/lite/other?id=1666');comp.parse(tag({method:'play',url:'/file',name:'1080p'}));
  assert.equal(items.filter('[data-nova-provider=other]').find('.nova-source-option__status').length,1,'Open menu updates when a real provider answer confirms videos');
  comp.request('https://online.example.test/lite/other?id=1666');comp.parse('<div class="videos__line"></div>');
  assert.equal(items.filter('[data-nova-provider=other]').find('.nova-source-option__status').length,0,'An empty result clears success');
  L.Select.hide();assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('default background checks start before opening the source menu, share two slots and reuse successful cache',async()=>{
 const n=await native({built:true}),{L,w}=n;let s;try{
  const requests=[],Real=L.Reguest;let running=0,maximum=0;
  L.Reguest=function(){const net=new Real(),nativeRequest=net.native;net.native=(url,ok,fail,...rest)=>{if(!/\/lite\/(one|two|three|other)\?/.test(url))return nativeRequest.call(net,url,ok,fail,...rest);running++;maximum=Math.max(maximum,running);let done=false;requests.push({url,ok(body){if(done)return;done=true;running--;ok(body);},fail(){if(done)return;done=true;running--;fail();}});};return net;};
  const comp={request(){},parse(){},changeBalanser(){}};s=screen(n,{id:1701,component:comp});
  const sources=[{title:'Test',source:'test',selected:true},...['one','two','three'].map(source=>({title:source,source}))];s.filter.set('sort',sources);
  comp.request('https://online.example.test/lite/test?id=1701&s=2&voice=old');await wait(1800);
  assert.equal(requests.length,2,'No menu or provider switch is needed to start checking');assert.equal(L.Select.opened(),false);assert.equal(s.played(),0);
  s.root.find('[data-nova-focus=source]').trigger('hover:enter');assert.equal(requests.length,2,'Opening the menu does not restart active work');
  requests[0].ok(tag({method:'play',url:'/file',name:'1080p'}));assert.equal(requests.length,3);requests[1].ok(tag({method:'play',url:'/file'}));requests[2].ok(tag({method:'play',url:'/file'}));
  assert.equal(maximum,2);assert.equal(L.Select.render().find('.nova-source-option__status').length,4);L.Select.hide();
  s.close();s=screen(n,{id:1701,component:{request(){},parse(){},changeBalanser(){}}});s.filter.set('sort',sources);s.component.request('https://online.example.test/lite/test?id=1701');await wait(1800);
  assert.equal(requests.length,3,'Fresh successful results survive reopening without another probe');assert.equal(s.played(),0);
  s.close();s=screen(n,{id:1702,component:{request(){},parse(){},changeBalanser(){}}});s.component.request('https://online.example.test/lite/test?id=1702');await wait(1800);assert.equal(requests.length,4);
  s.close();requests[3].ok(tag({method:'play',url:'/late'}));assert.ok(!L.Storage.get('nova_probe',{})['tmdb:tv:1702']?.list.other,'A reply after leaving cannot populate the next card');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('source menu leaves the last playback source and native playback saving untouched, ignoring legacy manual preferences',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  L.Storage.set('online_last_balanser',{'1703':'watched'});L.Storage.set('lampa_view_source_choice',{'file_view|last':'old-manual'});
  const legacy=JSON.stringify(L.Storage.get('lampa_view_source_choice',{})),saved=[],selected=[],update=key=>saved.push(key),comp={changeBalanser(){},updateBalanser:update};
  s=screen(n,{id:1703,component:comp});s.filter.onSelect=(type,item)=>selected.push(item.source);await wait(180);
  s.root.find('[data-nova-focus=source]').trigger('hover:enter');L.Select.render().find('[data-nova-provider=other]').trigger('hover:enter');await wait(40);
  assert.deepEqual(selected,['other']);assert.deepEqual(saved,[],'Choosing a source does not pretend playback occurred');assert.equal(comp.updateBalanser,update,'Native playback saving is preserved');assert.equal(L.Storage.get('online_last_balanser',{})['1703'],'watched');assert.equal(JSON.stringify(L.Storage.get('lampa_view_source_choice',{})),legacy);assert.equal(s.played(),0);
  const card=s.movie;s.close();L.Component.add('online_preference_qa',function(object){this.changeBalanser=function(){};this.object=object;});
  const create=(movie,extra={})=>L.Component.create({component:'online_preference_qa',movie,...extra}).object;
  assert.equal(create(card).lampac_auto_select,undefined);assert.equal(create({...card,id:1704}).lampac_auto_select,undefined);
  assert.equal(create(card,{lampac_custom_select:'explicit'}).lampac_custom_select,'explicit');assert.equal(create(card,{lampac_auto_select:'fallback'}).lampac_auto_select,'fallback');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('split provider parts use localized canonical episodes, counts and pictures while native playback hashes stay unchanged',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  L.Api.sources.tmdb.get=(url,p,ok)=>{if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25,network:{id:213}}]});if(url.includes('episode_group/'))return ok({groups:[5,5,7,8].map((count,i)=>({order:i+1,episodes:Array.from({length:count},(_,j)=>({order:j,season_number:i<2?1:i,episode_number:i===1?j+6:j+1}))}))});const season=Number(url.match(/season\/(\d+)/)?.[1]);ok({episodes:Array.from({length:[0,10,7,8][season]||0},(_,i)=>({episode_number:i+1,season_number:season,name:'Верная серия '+season+':'+(i+1),overview:'Русское описание '+season+':'+(i+1),vote_average:7.4,air_date:'2020-01-01',still_path:'/correct'+season+'e'+(i+1)+'.jpg'}))});};
  s=screen(n,{id:1799,season:2,episodes:[1,2,3,4,5]});Object.assign(s.movie,{number_of_seasons:3,number_of_episodes:25,networks:[{id:213}],seasons:[{season_number:1,episode_count:10},{season_number:2,episode_count:7,name:'Часть 3'},{season_number:3,episode_count:8,name:'Часть 4'}]});s.filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'Сезон 2',items:[1,2,3,4].map(i=>({title:'Сезон '+i,selected:i===2}))},{stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true}]}]);
  const timeline=JSON.stringify(L.Storage.get('file_view',{}));await wait(300);
  assert.match(s.root.find('.nova-card').first().find('.nova-card__title').text(),/Верная серия 1:6/);assert.equal(s.root.find('.nova-card__overview').first().text(),'Русское описание 1:6');assert.equal(s.root.find('[data-nova-focus="season:1"] .nova-chip__sub').text(),'5 эпизодов');assert.match(s.root.find('.nova-card__thumb').first().html(),/correct1e6/);
  const counts=()=>Array.from(s.root.find('[data-nova-group=season] .nova-chip__sub').map((i,n)=>n.textContent).get());assert.deepEqual(counts(),['5 эпизодов','5 эпизодов','7 эпизодов','8 эпизодов'],'Synchronous cached metadata cannot erase any season caption');s.filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'Сезон 4',items:[1,2,3,4].map(i=>({title:'Сезон '+i,selected:i===4}))},{stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true}]}]);await wait(180);assert.deepEqual(counts(),['5 эпизодов','5 эпизодов','7 эпизодов','8 эпизодов'],'Switching selection retains all known counts');
  assert.equal(JSON.stringify(L.Storage.get('file_view',{})),timeline);assert.equal(s.played(),0);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('split-season captions survive conflicting current files and delayed metadata failure recovery',async()=>{
 const n=await native({built:true}),{w,L}=n;let s;try{
  let failed=false;const calls=[];
  L.Api.sources.tmdb.get=(url,p,ok,fail)=>{calls.push(url);w.setTimeout(()=>{
   if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25,network:{id:213}}]});
   if(url.includes('episode_group/'))return ok({groups:[5,5,7,8].map((count,i)=>({order:i+1,episodes:Array.from({length:count},(_,j)=>({order:j,season_number:i<2?1:i,episode_number:i===1?j+6:j+1}))}))});
   const season=Number(url.match(/season\/(\d+)/)?.[1]);
   if(season===1 && !failed){failed=true;return fail();}
   ok({episodes:Array.from({length:[0,10,7,8][season]||0},(_,i)=>({episode_number:i+1,season_number:season,name:'Верная серия '+season+':'+(i+1),overview:'Русское описание '+season+':'+(i+1),vote_average:7.4,air_date:season===1?'2021-06-11':'2026-10-23',still_path:'/right'+season+'e'+(i+1)+'.jpg'}))});
  },25);};
  s=screen(n,{id:1800,season:2,episodes:[1,2,3,4,5,6,7]});Object.assign(s.movie,{number_of_seasons:3,number_of_episodes:25,networks:[{id:213}],seasons:[{season_number:1,episode_count:10},{season_number:2,episode_count:7},{season_number:3,episode_count:8}]});
  const choose=season=>s.filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'Сезон '+season,items:[1,2,3,4].map(i=>({title:'Сезон '+i,selected:i===season}))},{stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true}]}]);choose(2);
  const timeline=JSON.stringify(L.Storage.get('file_view',{}));await until(()=>s.root.find('[data-nova-group=season] .nova-chip__sub').length===4,'split-season captions');
  const captions=()=>Array.from(s.root.find('[data-nova-group=season] .nova-chip__sub').map((i,n)=>n.textContent).get());
  assert.deepEqual(captions(),['5 эпизодов','7 эпизодов','7 эпизодов','8 эпизодов'],'catalog counts do not disappear when the current provider list conflicts with the group');
  // The host completes replacing its previous list after updating the filter.
  s.body.find('.online-prestige').slice(5).remove();await wait(220);
  assert.equal(s.root.find('.nova-card__overview').first().text(),'Русское описание 1:6');assert.match(s.root.find('.nova-card__date').first().text(),/11.*2021/);
  choose(4);await wait(160);assert.deepEqual(captions(),['5 эпизодов','5 эпизодов','7 эпизодов','8 эпизодов']);
  choose(2);await wait(160);assert.equal(s.root.find('.nova-card__overview').first().text(),'Русское описание 1:6');
  assert.equal(calls.filter(url=>/season\/1/.test(url)).length,2,'one retry is shared by all episode and caption readers');assert.equal(JSON.stringify(L.Storage.get('file_view',{})),timeline);assert.equal(s.played(),0);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('known provider episode count remains visible after leaving a season while catalog metadata is unavailable',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  L.Api.sources.tmdb.get=(url,p,ok,fail)=>fail();
  s=screen(n,{id:1801,season:2,episodes:[1,2,3,4,5]});Object.assign(s.movie,{number_of_seasons:3,number_of_episodes:25});
  const choose=season=>s.filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'Сезон '+season,items:[1,2,3,4].map(i=>({title:'Сезон '+i,selected:i===season}))},{stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true}]}]);choose(2);await wait(700);
  const caption=()=>s.root.find('[data-nova-focus="season:1"] .nova-chip__sub').text();
  assert.equal(caption(),'5 эпизодов');choose(4);await wait(180);assert.equal(caption(),'5 эпизодов');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('real native TMDB season splitting preserves canonical descriptions and counts of the second provider part',async()=>{
 const n=await native({built:true}),{w,L}=n;let s;try{
  w.testNetwork=(url,ok)=>{w.setTimeout(()=>{
   if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25,network:{id:213}}]});
   if(url.includes('episode_group/'))return ok({groups:[5,5,7,8].map((count,i)=>({order:i+1,episodes:Array.from({length:count},(_,j)=>({order:j,season_number:i<2?1:i,episode_number:i===1?j+6:j+1}))}))});
   const season=Number(url.match(/season\/(\d+)/)?.[1]);
   if(season)return ok({episodes:Array.from({length:[0,10,7,8][season]},(_,i)=>({episode_number:i+1,season_number:season,name:'Глава '+(i+1),overview:'Русское описание '+season+':'+(i+1),vote_average:7.4,air_date:season===1?(i<5?'2021-01-08':'2021-06-11'):'2026-10-23',still_path:'/native'+season+'e'+(i+1)+'.jpg'}))});
   ok({results:[]});
  },10);};
  const raw=await new Promise(resolve=>L.Api.sources.tmdb.get('tv/96677/season/1',{},resolve));
  assert.equal(raw.episodes.length,5,'the actual native API truncates the first season after its 90-day gap');assert.equal(raw.episodes_original.length,10);
  s=screen(n,{id:96677,season:2,episodes:[1,2,3,4,5]});Object.assign(s.movie,{number_of_seasons:3,number_of_episodes:25,networks:[{id:213}],seasons:[{season_number:1,episode_count:10},{season_number:2,episode_count:7},{season_number:3,episode_count:8}]});
  const choose=season=>s.filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'Сезон '+season,items:[1,2,3,4].map(i=>({title:'Сезон '+i,selected:i===season}))},{stype:'voice',title:'Озвучка',items:[{title:'TVShows',selected:true}]}]);choose(2);
  const timeline=JSON.stringify(L.Storage.get('file_view',{}));await wait(350);
  assert.deepEqual(Array.from(s.root.find('.nova-card__overview').map((i,node)=>node.textContent).get()),[6,7,8,9,10].map(i=>'Русское описание 1:'+i));
  assert.equal(s.root.find('[data-nova-focus="season:1"] .nova-chip__sub').text(),'5 эпизодов');assert.match(s.root.find('.nova-card__date').first().text(),/11.*2021/);assert.match(s.root.find('.nova-card__thumb').first().html(),/native1e6/);
  choose(4);await wait(120);assert.equal(s.root.find('[data-nova-focus="season:1"] .nova-chip__sub').text(),'5 эпизодов');assert.equal(JSON.stringify(L.Storage.get('file_view',{})),timeline);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});


test('an empty manually chosen season neither hides the entire source nor starts an automatic source hop',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
  const comp={lampaViewManualNavigation:true,request(){},reset(){},parse(){},changeBalanser(){}};s=screen(n,{id:1802,episodes:[],component:comp});await wait(160);
  comp.request('/lite/test?s=4');comp.parse('<div class="videos__line"></div>');
  s.body.empty().append('<div class="online-empty"><div class="online-empty__title">Здесь пусто</div><div class="online-empty__time"></div></div>');await wait(200);
  assert.equal(s.root.find('.nova-note').length,1);assert.ok(!L.Storage.get('nova_probe',{})['tmdb:tv:1802']?.list.test,'A missing season is not a failed provider');assert.doesNotMatch(s.root.find('.nova-note').text(),/Через .*сек/);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});

test('season captions read the selected dub before opening a season',async()=>{
 const n=await native({built:true}),{L}=n;let s;
 try{
  const base='http://lampa.example.invalid/lite/test';
  const lists={
   root:{items:[1,2].map(season=>({season,method:'link',url:base+'?s='+season}))},
   default:{voices:[{text:'Other',active:true},{text:'TVShows',url:base+'?s=2&t=5'}]},
   selected:{items:[1,2,3].map(episode=>({season:2,episode,method:'call'}))}
  };
  const comp={changeBalanser(){},request(){},parse(){},parseJsonDate(name,selector){
   const value=lists[name] || {};return selector==='.videos__item'?value.items || []:value.voices || [];
  }};
  s=screen(n,{id:1910,episodes:[1],component:comp});
  L.Component.add('lampa_view_count_fixture',function(){return comp;});
  L.Component.create({component:'lampa_view_count_fixture',movie:s.movie});
  comp.request(base);
  comp.parseJsonDate('root','.videos__item');
  const calls=[],Request=L.Reguest;
  L.Reguest=function(){
   const net=new Request();
   net.native=(url,ok,fail)=>{
    if(!url.startsWith(base+'?s=2'))return fail();
    calls.push(url);
    setTimeout(()=>ok(url.includes('&t=5')?'selected':'default'),10);
   };
   return net;
  };
  s.filter.set('filter',[{stype:'season',title:'Сезон',subtitle:'Сезон 1',items:[1,2].map(season=>({title:'Сезон '+season,selected:season===1}))},
   {stype:'voice',title:'Озвучка',subtitle:'TVShows',items:[{title:'TVShows',selected:true}]}]);
  await wait(300);
  assert.deepEqual(calls,[base+'?s=2',base+'?s=2&t=5']);
  assert.equal(s.root.find('[data-nova-focus="season:1"] .nova-chip__sub').text(),'3 эпизода');
  assert.equal(s.played(),0);
  assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});
