const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
test('an unrecognized host header retains its native description instead of deleting it before conversion',()=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<body><div class="host-header"></div><div class="full-descr">Описание хоста</div></body>',{runScripts:'outside-only'}),w=dom.window;
 try{
  w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'iife',globalName:'Detail'}).outputFiles[0].text);
  const link={rows:['start','description'],items:[]},data={movie:{id:1,title:'Фильм',overview:'Описание хоста'},persons:{cast:[],crew:[]}};
  w.Detail.default({}, {type:'start',data,link});assert.equal(link.rows.includes('description'),true);
  w.Detail.default({}, {type:'complite',data,link,body:w.document.body},()=>{});assert.equal(link.rows.includes('description'),true);assert.equal(w.document.querySelector('.full-descr').textContent,'Описание хоста');
 }finally{w.close();}
});
test('a plugin loaded after the full page decorates its existing description, actions, cast and facts without fetching the page again',async()=>{
 const r=await native({deferPlugin:true}),{w,L}=r;
 try{
  let calls=0;L.Api.full=(p,ok)=>{calls++;ok({movie:{id:912,title:'Поздняя загрузка',original_title:'Late load',overview:'Описание из уже открытой карточки',release_date:'2026-01-01',vote_average:8,production_countries:[],production_companies:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{cast:[{id:99,name:'Актёр',profile_path:'/person.jpg',character:'Роль'}],crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});};
  L.Activity.push({component:'full',id:912,method:'movie',source:'tmdb',card:{id:912,title:'Поздняя загрузка',source:'tmdb'}});await new Promise(resolve=>setTimeout(resolve,150));
  const root=L.Activity.active().activity.render(true);assert.equal(root.querySelector('.minimal-detail-header'),null);assert.ok(root.querySelector('.full-descr'));
  // Isolate decoration from the independently tested startup redirect home.
  const replace=L.Activity.replace;L.Activity.replace=()=>{};
  const code=require('fs').readFileSync(path.join(__dirname,'../dist/lampa.js'),'utf8');w.eval(code);L.Activity.replace=replace;await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(root.querySelector('.minimal-detail-overview').textContent,'Описание из уже открытой карточки');assert.ok(root.querySelector('.minimal-detail-facts'));assert.ok(root.querySelector('.minimal-detail-cast .minimal-cast-native'));assert.equal(root.querySelector('.full-descr'),null);assert.equal(calls,1);
  L.Listener.send('activity',{type:'start'});assert.equal(root.querySelectorAll('.minimal-detail-columns').length,1);assert.equal(root.querySelectorAll('.minimal-detail-overview').length,1);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('native movie and TV move the release date, omit Description rows and open the complete overview with return focus',async()=>{
 const r=await native(),{w,L}=r,tick=()=>new Promise(resolve=>setTimeout(resolve,130));
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);
  for(const series of [false,true]){
   const id=series?902:901,overview=('Очень длинное описание. '.repeat(70))+'Последний абзац. <b>Текст</b>\nКонец описания.';
   L.Api.full=(p,ok)=>w.setTimeout(()=>ok({movie:{id,title:'Фильм',original_title:'Film',overview,release_date:series?'':'2026-09-25',...(series?{name:'Сериал',first_air_date:'2026-10-07',original_name:'Series',number_of_seasons:1,number_of_episodes:8}:{}),production_countries:[{iso_3166_1:'US',name:'США'}],production_companies:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{cast:[{id:99,name:'Actor',profile_path:'/person.jpg',character:'Role',popularity:10}],crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}}),0);
   L.Activity.push({component:'full',id,method:series?'tv':'movie',source:'tmdb',card:{id,title:'Фильм',source:'tmdb'}});await tick();
   const activity=L.Activity.active().activity,link=activity.component,root=activity.render(true),facts=Object.fromEntries([...root.querySelectorAll('.minimal-detail-facts>div')].map(row=>[row.children[0].textContent,row.children[1].textContent]));
   assert.equal(facts['Дата релиза'],series?'7 октября 2026':'25 сентября 2026');assert.equal(link.rows.includes('description'),false);assert.equal(root.querySelector('.full-descr'),null);assert.equal(link.rows[2][0],'discuss');assert.equal(link.items[2].render(true),root.querySelector('.minimal-comments-native'));
   link.emit('scroll',0);await tick();assert.equal(root.querySelector('.full-descr'),null);
   const summary=root.querySelector('.minimal-overview-action');assert.equal(summary.textContent,overview);assert.equal(summary.getAttribute('role'),'button');assert.equal(summary.getAttribute('aria-haspopup'),'dialog');assert.ok(summary.classList.contains('selector'));assert.ok(summary.querySelector('.minimal-overview-focus'));assert.ok(!summary.querySelector('.full-start-new__description,.minimal-detail-overview').classList.contains('selector'));
   summary.click();assert.equal(L.Modal.opened(),true);assert.equal(w.document.querySelector('.minimal-overview-full').textContent,overview);assert.equal(w.document.querySelector('.minimal-overview-full b'),null);assert.equal(L.Controller.enabled().name,'modal');
   L.Controller.back();assert.equal(L.Modal.opened(),false);assert.equal(L.Controller.enabled().name,'full_start');assert.equal(link.items[0].last,summary);
   summary.dispatchEvent(new w.Event('hover:enter',{bubbles:true}));assert.equal(L.Modal.opened(),true);L.Controller.back();
   summary.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(L.Modal.opened(),true);L.Controller.back();
  }
  assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('native cast without Line Event fills the available width, stays within two columns and opens later actor profiles',async()=>{
 const r=await native(),{w,L}=r,tick=()=>new Promise(resolve=>setTimeout(resolve,180));
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);let castLine;
  L.Listener.follow('full',event=>{if(event.type==='build' && event.name==='persons'){
   castLine=event.item;const root=castLine.render(true);root.getBoundingClientRect=()=>({width:1400,top:200,bottom:450});
   for(const node of root.querySelectorAll('.full-person'))node.getBoundingClientRect=()=>({width:100,top:250,bottom:400});
  }});
  L.Api.full=(p,ok)=>w.setTimeout(()=>ok({movie:{id:903,title:'Matchbox: фильм',release_date:'2026-01-01',original_title:'Matchbox the Movie',production_countries:[],production_companies:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{crew:[{id:10,name:'Director',profile_path:'/person.jpg',job:'Director'}],cast:Array.from({length:18},(_,i)=>({id:100+i,name:'Actor '+i,profile_path:'/person.jpg',character:'Role',popularity:10}))},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}}),0);
  L.Activity.push({component:'full',id:903,method:'movie',source:'tmdb',card:{id:903,title:'Matchbox: фильм',source:'tmdb'}});await tick();
  const root=L.Activity.active().activity.render(true),cast=root.querySelector('.minimal-cast-native'),columns=root.querySelector('.minimal-detail-columns'),facts=root.querySelector('.minimal-detail-facts');
  assert.ok(castLine.items.length>10,'actual Persons never emitted a global line event');assert.equal(cast.querySelectorAll('.full-person').length,castLine.items.length);assert.equal(castLine.data.results.length,19);assert.equal(w.getComputedStyle(columns).display,'grid');assert.equal(w.getComputedStyle(columns).gridTemplateColumns,'minmax(0,1fr) minmax(15em,22%)');assert.equal(parseFloat(w.getComputedStyle(cast).minWidth),0);assert.equal(w.getComputedStyle(cast).width,'100%');assert.equal(cast.parentElement.className,'minimal-detail-cast');assert.equal(w.getComputedStyle(cast.parentElement).overflow,'hidden');assert.equal(w.getComputedStyle(cast.parentElement).gridColumn,'1');assert.equal(w.getComputedStyle(facts).gridColumn,'2');assert.equal(w.getComputedStyle(cast).overflow,'hidden');assert.equal(parseFloat(w.getComputedStyle(facts).minWidth),0);
  const before=castLine.items.length;castLine.active=before-1;castLine.emit('scroll');await tick();assert.equal(castLine.items.length,19);const last=cast.querySelectorAll('.full-person')[18];last.dispatchEvent(new w.Event('hover:enter',{bubbles:true}));assert.equal(L.Activity.active().component,'actor');assert.equal(L.Activity.active().id,117);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('torrent button spans the whole row only while the notification button is absent or hidden',async()=>{
 const r=await native(),{w,L}=r,tick=()=>new Promise(resolve=>setTimeout(resolve,100));
 try{
  L.Api.full=(p,ok)=>w.setTimeout(()=>ok({movie:{id:904,title:'Film',release_date:'2026-01-01',production_countries:[],production_companies:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{cast:[],crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}}),0);
  L.Activity.push({component:'full',id:904,method:'movie',source:'tmdb',card:{id:904,title:'Film',source:'tmdb'}});await tick();
  const root=L.Activity.active().activity.render(true),actions=root.querySelector('.full-start-new__buttons'),torrent=actions.querySelector('.button--alc-torrent');
  assert.equal(w.getComputedStyle(torrent).gridColumn,'1/-1');const bell=w.document.createElement('div');bell.className='full-start__button selector button--subscribe';actions.insertBefore(bell,actions.querySelector('.button--options'));await tick();assert.equal(w.getComputedStyle(torrent).gridColumn,'span 2');
  bell.classList.add('hide');await tick();assert.equal(w.getComputedStyle(torrent).gridColumn,'1/-1');bell.classList.remove('hide');await tick();assert.equal(w.getComputedStyle(torrent).gridColumn,'span 2');bell.style.display='none';await tick();assert.equal(w.getComputedStyle(torrent).gridColumn,'1/-1');bell.style.display='';await tick();assert.equal(w.getComputedStyle(torrent).gridColumn,'span 2');bell.remove();await tick();assert.equal(w.getComputedStyle(torrent).gridColumn,'1/-1');assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('release dates keep leap days valid and leave missing or invalid dates absent',()=>{
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports',code)(module,module.exports);const {releaseDate}=module.exports;
 assert.equal(releaseDate({release_date:'2024-02-29'}),'29 февраля 2024');assert.equal(releaseDate({release_date:'2026-02-29'}),'');assert.equal(releaseDate({}),'');assert.equal(releaseDate({first_air_date:'2026-10-07'}),'7 октября 2026');
});
