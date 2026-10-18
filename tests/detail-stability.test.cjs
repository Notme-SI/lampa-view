const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom'),native=require('./fixtures/native-lampa.cjs');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}
test('catalogue sorter never attaches to the shared Main class used by full and person screens',()=>{
 function Main(){}const registered=[];
 const L={Storage:{get:(k,d)=>d,set(){}},SettingsApi:{addParam(){}},Api:{main(){}},Maker:{get:()=>Main},Utils:{createInstance:(Base,object)=>({use:()=>registered.push(object.component)})}};
 mod('collections').default(L,{});for(const component of ['full','actor','main','category'])L.Utils.createInstance(Main,{component,url:'tv'});assert.deepEqual(registered,['main','category']);
});
test('series aggregate credits preserve guest roles, directors, fallback and response timing on both catalogues',()=>{
 const {installTmdb}=mod('tmdb');
 for(const name of ['tmdb','cub'])for(const outcome of ['ok','empty','error']){
  const calls=[],pending={},sources={tmdb:{get:(route,p,ok,fail)=>{calls.push(route);pending.aggregate={ok,fail};}}};
  sources[name]=sources[name] || {};sources[name].full=(p,ok)=>{pending.full=ok;return 'native-request';};const L={Api:{sources},Storage:{get:()=>true}};installTmdb(L);
  let answer,count=0;assert.equal(sources[name].full({id:9,method:'tv'},data=>{answer=data;count++;}),'native-request');assert.deepEqual(calls,['tv/9/aggregate_credits']);
  const original={movie:{id:9},persons:{cast:[{id:1,character:'Original'}],crew:[]}};pending.full(original);assert.equal(count,0);
  if(outcome==='ok')pending.aggregate.ok({cast:[{id:1,roles:[{character:'A'},{character:'B'}]},{id:2,roles:[{character:'Guest'}]}],crew:[{id:3,jobs:[{job:'Director'},{job:'Producer'}]}]});
  else if(outcome==='empty')pending.aggregate.ok({cast:[]});else pending.aggregate.fail();
  assert.equal(count,1);if(outcome==='ok'){assert.equal(answer.persons.cast[0].character,'A / B');assert.equal(answer.persons.cast.length,2);assert.equal(answer.persons.crew.find(p=>p.job==='Director').id,3);}else assert.equal(answer.persons.cast[0].character,'Original');
 }
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
test('native full keeps cast first, stretches facts, places episodes above ratings and routes hidden sources through More',async()=>{
 const r=await native(),{w,L}=r,tick=()=>new Promise(resolve=>setTimeout(resolve,120));
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);let select;const show=L.Select.show;L.Select.show=function(o){select=o;return show.call(this,o);};
  L.Api.full=(p,ok)=>ok({movie:{id:91,name:'Сериал',original_name:'Show',first_air_date:'2025-01-01',production_countries:[],production_companies:[],spoken_languages:[],number_of_seasons:2,number_of_episodes:20,vote_average:8,genres:[],source:'tmdb'},persons:{crew:[{id:90,name:'Режиссёр',job:'Director'}],cast:Array.from({length:18},(_,i)=>({id:100+i,name:'Актёр '+i,character:'Role'}))},discuss:{result:[]},images:{logos:[]},videos:{results:[{site:'YouTube',key:'x',name:'Trailer'}]},simular:{results:[]},recomend:{results:[]}});
  L.Activity.push({component:'full',id:91,method:'tv',source:'tmdb',card:{id:91,name:'Сериал',source:'tmdb'}});await tick();
  const link=L.Activity.active().activity.component,root=L.Activity.active().activity.render(true),columns=root.querySelector('.minimal-detail-columns'),cast=root.querySelector('.minimal-cast-native'),facts=root.querySelector('.minimal-detail-facts');
  assert.equal(columns.firstElementChild,cast);assert.equal(columns.lastElementChild,facts);assert.equal(w.getComputedStyle(columns).alignItems,'stretch');assert.equal(w.getComputedStyle(facts).alignSelf,'stretch');assert.equal(w.getComputedStyle(cast).order,'0');assert.equal(w.getComputedStyle(facts).order,'1');
  for(let i=0;i<3;i++){link.emit('pushLoaded');link.emit('scroll',0);await tick();assert.equal(columns.firstElementChild,cast);assert.equal(columns.lastElementChild,facts);}
  const right=root.querySelector('.full-start-new__right'),details=right.querySelector('.full-start-new__details'),rates=right.querySelector('.full-start-new__rate-line');assert.ok(details.compareDocumentPosition(rates)&w.Node.DOCUMENT_POSITION_FOLLOWING);assert.ok((details.textContent || details.innerText).includes('20'));
  const container=root.querySelector('.buttons--container'),online=w.document.createElement('div');online.className='full-start__button selector';online.setAttribute('data-subtitle','Lampac v1.8.0');online.innerHTML='<svg></svg><span>Онлайн</span>';container.appendChild(online);let nativeCalls=0,jqueryCalls=0,trailerCalls=0;online.addEventListener('hover:enter',()=>nativeCalls++);w.jQuery(online).on('hover:enter',()=>jqueryCalls++);
  const trailer=container.querySelector('.view--trailer');w.jQuery(trailer).off('hover:enter').on('hover:enter',()=>trailerCalls++);
  const actions=root.querySelector('.full-start-new__buttons'),auto=w.document.createElement('div');auto.className='full-start__button selector button--alc-auto';auto.innerHTML='<span>Смотреть</span>';actions.prepend(auto);await tick();
  const sources=actions.querySelector('.button--play');assert.equal(w.getComputedStyle(sources).display,'none');assert.equal(sources.classList.contains('selector'),false);assert.equal(sources.getAttribute('aria-hidden'),'true');
  w.jQuery(actions.querySelector('.button--options')).trigger('hover:enter');let chosen=select.items.find(i=>i.title==='Онлайн');assert.ok(chosen);assert.equal(chosen.subtitle,'Lampac v1.8.0');chosen.onSelect();assert.equal(nativeCalls,1);assert.equal(jqueryCalls,1);
  w.jQuery(actions.querySelector('.button--options')).trigger('hover:enter');chosen=select.items.find(i=>i.title===L.Lang.translate('full_trailers'));assert.ok(chosen);chosen.onSelect();assert.equal(trailerCalls,1);
  // The native adapter can already have supplied another watch button. Exercise
  // the actual no-watch-button state, then flush MutationObserver microtasks;
  // waiting an arbitrary 120ms allows unrelated adapter timers to add one back.
  actions.querySelectorAll('.button--alc-auto').forEach(button=>button.remove());
  await new Promise(resolve=>w.queueMicrotask(()=>w.queueMicrotask(resolve)));
  assert.equal(actions.querySelectorAll('.button--alc-auto').length,0);
  assert.equal(sources.classList.contains('minimal-source-hidden'),false);assert.equal(sources.classList.contains('selector'),true);assert.equal(sources.hasAttribute('aria-hidden'),false);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
