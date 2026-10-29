const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom'),native=require('./fixtures/native-lampa.cjs');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports','window',code)(module,module.exports,{});return module.exports;}
test('catalogue sorter never attaches to the shared Main class used by full and person screens',()=>{
 function Main(){}const registered=[];
 const L={Storage:{get:(k,d)=>d,set(){}},SettingsApi:{addParam(){}},Api:{main(){}},Maker:{get:()=>Main},Utils:{createInstance:(Base,object)=>({use:()=>registered.push(object.component)})}};
 mod('collections').default(L,{});for(const component of ['full','actor','main','category'])L.Utils.createInstance(Main,{component,url:'tv'});assert.deepEqual(registered,['main','category']);
});
test('series aggregate credits add directors without replacing the main cast with guests on both catalogues',()=>{
 const {installTmdb}=mod('tmdb');
 for(const name of ['tmdb','cub'])for(const outcome of ['ok','empty','error']){
  const calls=[],pending={},sources={tmdb:{get:(route,p,ok,fail)=>{calls.push(route);pending.aggregate={ok,fail};}}};
  sources[name]=sources[name] || {};sources[name].full=(p,ok)=>{pending.full=ok;return 'native-request';};const L={Api:{sources},Storage:{get:()=>true}};installTmdb(L);
  let answer,count=0;assert.equal(sources[name].full({id:9,method:'tv'},data=>{answer=data;count++;}),'native-request');assert.deepEqual(calls,['tv/9/aggregate_credits']);
  const original={movie:{id:9},persons:{cast:[{id:1,profile_path:'/person.jpg',character:'Original'}],crew:[]}};pending.full(original);assert.equal(count,0);
  if(outcome==='ok')pending.aggregate.ok({cast:[{id:1,roles:[{character:'A'},{character:'B'}]},{id:2,roles:[{character:'Guest'}]}],crew:[{id:3,jobs:[{job:'Director'},{job:'Producer'}]}]});
  else if(outcome==='empty')pending.aggregate.ok({cast:[]});else pending.aggregate.fail();
  assert.equal(count,1);if(outcome==='ok'){assert.equal(answer.persons.cast[0].character,'Original');assert.equal(answer.persons.cast.length,1);assert.equal(answer.persons.crew.find(p=>p.job==='Director').id,3);}else assert.equal(answer.persons.cast[0].character,'Original');
 }
});

test('cast roster is finite and deduplicated; a different title cannot replace its credits',()=>{
 const {prepareDetail}=mod('detail'),{normalizeCredits}=mod('tmdb');
 const actors=Array.from({length:300},(_,id)=>({id:id+1,name:'Actor '+id,profile_path:'/person.jpg',character:'Role'})),crew=Array.from({length:200},(_,id)=>({id:id+400,name:'Director '+id,profile_path:'/person.jpg',job:'Director',episode_count:id}));
 const data={persons:{cast:[...actors,...actors],crew:[...crew,...crew]}};prepareDetail(data);
 assert.equal(data.persons.cast.length,15);assert.equal(new Set(data.persons.cast.map(p=>p.id)).size,15);assert.equal(data.persons.cast[0].id,599);assert.equal(data.persons.cast[3].id,1);
 assert.equal(normalizeCredits({id:12,cast:actors},{cast:actors.slice(0,1)},13),null);
});

test('credits retain leads, recurring and recognizable supporting roles while excluding extras and guest directors',()=>{
 const {prepareDetail}=mod('detail'),cast=Array.from({length:12},(_,i)=>({id:i+1,name:'Actor '+i,order:i,profile_path:'/person.jpg',character:'Role '+i,popularity:1}));
 cast.push({id:40,name:'Supporting',order:22,profile_path:'/person.jpg',character:'Professor',popularity:20},{id:41,name:'Recurring',order:25,profile_path:'/person.jpg',character:'Neighbour',total_episode_count:8},{id:42,name:'Extra',order:23,profile_path:'/person.jpg',character:'Crowd (uncredited)',popularity:100},{id:43,name:'Unspecified',order:24,profile_path:'/person.jpg'});
 cast[0].popularity=0;cast[0].total_episode_count=10;
 const data={movie:{name:'Show'},persons:{cast,crew:[{id:100,name:'Main director',job:'Director',episode_count:10,popularity:1,profile_path:'/person.jpg'},{id:101,name:'Guest director',job:'Director',episode_count:1,popularity:100,profile_path:'/person.jpg'},{id:102,name:'Co-director',job:'Director',episode_count:5,popularity:0,profile_path:'/person.jpg'}]}};
 prepareDetail(data);const ids=data.persons.cast.map(p=>p.id);for(const id of [1,40,41,100,102])assert.ok(ids.includes(id),String(id));for(const id of [42,43,101])assert.ok(!ids.includes(id),String(id));assert.deepEqual(ids.slice(0,2),[100,102]);
});
test('wide cast rows fill past seven people and keep the remainder lazy',async()=>{
 const dom=new JSDOM('<body><div class="items-line"><div class="full-person"></div></div></body>',{runScripts:'outside-only'}),w=dom.window;
 try{
  w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/rows.js')],bundle:true,write:false,format:'iife',globalName:'Rows'}).outputFiles[0].text);
  const root=w.document.querySelector('.items-line');root.getBoundingClientRect=()=>({width:1400,top:200,bottom:500});root.firstChild.getBoundingClientRect=()=>({width:110});
  let built=7;const data={results:Array.from({length:40},(_,id)=>({id}))},line={view:7,params:{items:{view:7}},render:()=>root,emit(){built=line.view;}};
  const event=w.Rows.default({},()=>true);event({type:'visible',line,data});await new Promise(r=>setTimeout(r,20));assert.equal(built,14);assert.equal(line.params.items.view,14);assert.ok(built<data.results.length);event({type:'destroy',line});
 }finally{w.close();}
});
test('native full keeps cast first, stretches facts, places episodes above ratings and routes Watch directly to Online',async()=>{
 const r=await native(),{w,L}=r,tick=()=>new Promise(resolve=>setTimeout(resolve,120));
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);let select;const show=L.Select.show;L.Select.show=function(o){select=o;return show.call(this,o);};
  L.Api.full=(p,ok)=>ok({movie:{id:91,name:'Сериал',original_name:'Show',first_air_date:'2025-01-01',production_countries:[],production_companies:[],spoken_languages:[],number_of_seasons:2,number_of_episodes:20,vote_average:8,genres:[],source:'tmdb'},persons:{crew:[{id:90,name:'Режиссёр',profile_path:'/person.jpg',job:'Director'}],cast:Array.from({length:18},(_,i)=>({id:100+i,name:'Актёр '+i,profile_path:'/person.jpg',character:'Role'}))},discuss:{result:[]},images:{logos:[]},videos:{results:[{site:'YouTube',key:'x',name:'Trailer'}]},simular:{results:[]},recomend:{results:[]}});
  L.Activity.push({component:'full',id:91,method:'tv',source:'tmdb',card:{id:91,name:'Сериал',source:'tmdb'}});await tick();
  const link=L.Activity.active().activity.component,root=L.Activity.active().activity.render(true),columns=root.querySelector('.minimal-detail-columns'),cast=root.querySelector('.minimal-cast-native'),facts=root.querySelector('.minimal-detail-facts');
  assert.equal(columns.firstElementChild,cast.parentElement);assert.ok(cast.parentElement.classList.contains('minimal-detail-cast'));assert.equal(columns.lastElementChild,facts);assert.equal(w.getComputedStyle(columns).alignItems,'stretch');assert.equal(w.getComputedStyle(facts).alignSelf,'stretch');assert.equal(w.getComputedStyle(cast).order,'0');assert.equal(w.getComputedStyle(facts).order,'1');
  for(let i=0;i<3;i++){link.emit('pushLoaded');link.emit('scroll',0);await tick();assert.equal(columns.firstElementChild,cast.parentElement);assert.ok(cast.parentElement.classList.contains('minimal-detail-cast'));assert.equal(columns.lastElementChild,facts);}
  const right=root.querySelector('.full-start-new__right'),details=right.querySelector('.full-start-new__details'),rates=right.querySelector('.full-start-new__rate-line');assert.ok(details.compareDocumentPosition(rates)&w.Node.DOCUMENT_POSITION_FOLLOWING);assert.ok((details.textContent || details.innerText).includes('20'));
  const container=root.querySelector('.buttons--container'),online=w.document.createElement('div');online.className='full-start__button selector';online.setAttribute('data-subtitle','Lampac v1.8.0');online.innerHTML='<svg></svg><span>Онлайн</span>';container.appendChild(online);let nativeCalls=0,jqueryCalls=0,trailerCalls=0;online.addEventListener('hover:enter',()=>nativeCalls++);w.jQuery(online).on('hover:enter',()=>jqueryCalls++);
  const trailer=container.querySelector('.view--trailer');w.jQuery(trailer).off('hover:enter').on('hover:enter',()=>trailerCalls++);
  const actions=root.querySelector('.full-start-new__buttons'),auto=w.document.createElement('div');auto.className='full-start__button selector button--alc-auto';auto.innerHTML='<span>Смотреть</span>';actions.prepend(auto);await tick();
  const sources=actions.querySelector('.button--play');assert.notEqual(w.getComputedStyle(sources).display,'none');assert.equal(sources.classList.contains('selector'),true);assert.equal(sources.hasAttribute('aria-hidden'),false);assert.equal(actions.querySelectorAll('.button--alc-auto').length,0);
  w.jQuery(sources).trigger('hover:enter');assert.equal(nativeCalls,1);assert.equal(jqueryCalls,1);
  w.jQuery(actions.querySelector('.button--options')).trigger('hover:enter');assert.ok(!select.items.some(i=>i.title==='Онлайн'));const chosen=select.items.find(i=>i.title===L.Lang.translate('full_trailers'));assert.ok(chosen);chosen.onSelect();assert.equal(trailerCalls,1);
  // The native adapter can already have supplied another watch button. Exercise
  // the actual no-watch-button state, then flush MutationObserver microtasks;
  // waiting an arbitrary 120ms allows unrelated adapter timers to add one back.
  actions.querySelectorAll('.button--alc-auto').forEach(button=>button.remove());
  await new Promise(resolve=>w.queueMicrotask(()=>w.queueMicrotask(resolve)));
  assert.equal(actions.querySelectorAll('.button--alc-auto').length,0);
  assert.equal(sources.classList.contains('minimal-source-hidden'),false);assert.equal(sources.classList.contains('selector'),true);assert.equal(sources.hasAttribute('aria-hidden'),false);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
