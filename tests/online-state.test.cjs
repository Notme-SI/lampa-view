const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom'),native=require('./fixtures/native-lampa.cjs');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/online-state.js')],bundle:true,write:false,format:'iife',globalName:'OnlineState'}).outputFiles[0].text;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tag=row=>'<div class="videos__item" data-json="'+JSON.stringify(row).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"></div>';
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
test('online UI resumes the latest native timecode, keeps external images and handles reverse episode order',async()=>{
 const n=await native({built:true}),{w,L}=n;let s;try{
 const hash=(season,episode,title='Original')=>L.Utils.hash([season,season>10?':':'',episode,title].join(''));L.Timeline.update({hash:hash(1,2),percent:40,time:720,duration:1800});
 s=screen(n,{episodes:[3,2,1]});await wait(250);const label=s.root.find('.nova-btn__label').first().text();assert.match(label,/Продолжить/);assert.match(label,/E2/);assert.match(label,/12:00/);assert.equal(s.root.find('.nova-card').length,3);s.root.find('[data-nova-focus=hero]').trigger('hover:enter');assert.equal(s.played(),2);const next=s.root.find('[data-nova-focus=hero-next]');assert.equal(next.length,1);next.trigger('hover:enter');assert.equal(s.played(),3);assert.equal(s.root.find('.online-prestige__img img').first().attr('src'),'https://image.example.test/frame.jpg');assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});
test('the patched online host restores the watched season and preserves the manually selected season and voice',async()=>{
 const n=await native({built:true}),{L}=n;let s;try{
 const hash=L.Utils.hash('21Original');L.Timeline.update({hash,percent:35,time:300,duration:900});const choices={test:{voice_name:'TVShows'},other:{}};let parsed=0,selected='test';const component={changeBalanser:name=>{selected=name;},getChoice:name=>choices[name||selected],saveChoice:(choice,name)=>choices[name||selected]=choice,parse:()=>parsed++};s=screen(n,{component});await wait(150);
 const body=tag({method:'link',url:'/lite/test?s=1',name:'Сезон 1'})+tag({method:'link',url:'/lite/test?s=2',name:'Сезон 2'});component.parse(body);assert.equal(choices.test.season,1);component.lampaViewManualSeason=1;component.parse(body);assert.equal(choices.test.season,0);component.changeBalanser('other');assert.equal(choices.other.voice_name,'TVShows');assert.equal(parsed,2);assert.deepEqual(n.errors,[]);
 }finally{if(s)s.close();n.close();}
});
test('logo metadata requests share the native API and deduplicate concurrent full-card notifications',async()=>{
 const n=await native({built:true}),{L}=n;try{let calls=0,answer;L.Api.sources.tmdb.get=(url,p,ok)=>{if(url==='tv/975/images'){calls++;answer=ok;}};const card={id:975,name:'Сериал',source:'tmdb'},event={type:'complite',data:{movie:card},object:{card,activity:{render:()=>n.w.jQuery('<div></div>')}}};L.Listener.send('full',event);L.Listener.send('full',event);assert.equal(calls,1);answer({logos:[]});L.Listener.send('full',event);assert.equal(calls,1);assert.deepEqual(n.errors,[]);}finally{n.close();}
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
 const text=s.root.find('.nova-hero__season').text();assert.match(text,/Просмотрено 4 из 6/);assert.match(text,/осталось 2/);assert.match(text,/у источника 2 из 6/);assert.doesNotMatch(text,/4 из 2/);assert.deepEqual(n.errors,[]);
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
