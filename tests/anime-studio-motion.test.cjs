const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}
test('bounded categories run only the selected anime catalogue, use a fixed number of jobs and keep main unchanged',()=>{
 for(const kind of ['movie','tv','anime'])for(const source of ['cub','tmdb'])for(const mode of ['standard','shikimori']){
  const data={minimal_home_compact:false,minimal_anime_home:true,minimal_anime_shikimori:true,minimal_anime_catalogue:mode},pending=[],requests=[];let active=0,max=0,nativeCalls=0,answer,calls=0;
  function request(url,ok){requests.push(url);const start=requests.length*100;active++;max=Math.max(max,active);pending.push(()=>{active--;ok({results:Array.from({length:30},(_,id)=>({id:start+id,title:'Title'}))});});}
  const rows=[{title:'Сейчас смотрят',url:'watch',results:[{id:1}]},{title:'Другое',url:'other',results:[{id:2}]}],L={Storage:{get:(k,d)=>data[k]===undefined?d:data[k],set:(k,v)=>data[k]=v},Lang:{translate:()=> 'Сейчас смотрят'},SettingsApi:{addParam(){}},Api:{main:(p,ok)=>ok(rows),category(){nativeCalls++;},sources:{cub:{list:(p,ok)=>request(p.url,ok)},tmdb:{get:(url,p,ok)=>request(url,ok)}}},Utils:{createInstance(){}},Maker:{get(){}}};
  mod('collections').default(L,{list:(p,ok)=>request(p.url,ok)});L.Api.main({component:'main'},r=>answer=r);assert.deepEqual(answer,rows);assert.equal(requests.length,0);
  const expected=kind==='anime' && mode==='shikimori'?11:10;const next=L.Api.category({component:'category',url:kind,source},r=>{answer=r;calls++;});assert.equal(next,undefined);assert.equal(pending.length,3);while(pending.length)pending.shift()();assert.equal(calls,1);assert.equal(nativeCalls,0);assert.equal(requests.length,expected);assert.ok(max<=3);assert.equal(answer.length,expected);assert.ok(answer.every(row=>row.results.length===20));assert.equal(data.minimal_collection_rows_v2['category:'+kind+(kind==='anime'?':'+mode:'')].length,expected);
  assert.ok(answer.every(row=>(row.source==='minimal_shiki')===(kind==='anime' && mode==='shikimori')));
  if(kind==='anime'){if(mode==='standard')assert.equal(answer[0].title,'Сейчас смотрят');assert.ok(answer.every(row=>row.results.every(card=>card.minimal_anime)));}
 }
 const {cataloguePlan}=mod('catalogue');assert.deepEqual(cataloguePlan('anime','shikimori').slice(-4).map(r=>r.title),['Боевики','Приключения','Детективы','Все']);for(const row of cataloguePlan('anime'))if(row.tmdb)assert.equal(new URLSearchParams(row.tmdb.split('?')[1]).getAll('with_genres').length,1);
});
test('poster transitions override native no-animation without changing global settings',async()=>{
 const n=await native(),{w,L}=n;
 try{
  L.Storage.set('animation',false);w.document.body.classList.add('no--animation','advanced--animation');const card=w.document.createElement('div');card.className='card';card.innerHTML='<div class="card__view"></div>';w.document.body.appendChild(card);
  const before=w.getComputedStyle(card.firstChild);assert.ok(before.transition.includes('.24s'));card.classList.add('focus');const after=w.getComputedStyle(card.firstChild);assert.ok(after.transition.includes('.24s'));assert.ok(after.transform.includes('scale(1.045)'));assert.match(after.boxShadow,/rgba\(173,\s*217,\s*229,\s*(?:0)?\.4\)/);assert.equal(L.Storage.value('animation'),'false');assert.ok(w.document.body.classList.contains('no--animation'));assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('full detail shows studio before the year with a supplied title logo, hides broken studios and accepts studio-only loader results',async()=>{
 const n=await native(),{w,L}=n;
 try{
  const card={id:1301,title:'Фильм',original_title:'Film',release_date:'2026-01-01',source:'tmdb',production_companies:[{name:'Studio',logo_path:'/studio.png'}],production_countries:[],spoken_languages:[],genres:[]};L.Api.full=(p,ok)=>w.setTimeout(()=>ok({movie:card,persons:{cast:[],crew:[]},discuss:{result:[]},images:{logos:[{file_path:'/title.png',iso_639_1:'ru'}]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}}),0);L.Activity.push({component:'full',id:1301,method:'movie',source:'tmdb',card});await new Promise(r=>setTimeout(r,150));
  const body=L.Activity.active().activity.render(true),head=body.querySelector('.full-start-new__head'),studio=head.querySelector('.minimal-detail-studio');assert.equal(head.firstElementChild,studio);assert.equal(studio.alt,'Studio');assert.ok(studio.src.endsWith('/w780/studio.png'));assert.ok(studio.hidden);studio.onload();assert.ok(!studio.hidden);assert.ok(head.textContent.includes('2026'));studio.onerror();assert.equal(head.querySelector('.minimal-detail-studio'),null);assert.ok(head.textContent.includes('2026'));
  // Exercise the source result independently: a studio can exist when no title logo exists.
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<body class="lampa_view"><div id="full"><div class="full-start-new__right"><h1 class="full-start-new__title">Film</h1><div class="full-start-new__head"><span>2026</span></div></div></div></body>'),node=dom.window.document.querySelector('#full');const detail=mod('detail').default;
  // detail uses the host document; its elements are imported safely into the supplied body.
  const oldDocument=global.document,oldWindow=global.window;global.document=dom.window.document;global.window=dom.window;
  try{detail({Storage:{get:()=> 'ru'},TMDB:{image:p=>p}},{type:'complite',body:node,data:{movie:{id:1302,title:'Film'}}},(c,ok)=>ok('',{path:'/studio-only.png',name:'Only studio'}));assert.equal(node.querySelectorAll('.minimal-detail-logo').length,0);assert.equal(node.querySelector('.minimal-detail-studio').alt,'Only studio');}finally{global.document=oldDocument;global.window=oldWindow;dom.window.close();}
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('main settings replace stale historical rows with the actual current feed',()=>{
 const rows=Array.from({length:4},(_,i)=>({title:'Актуальная '+i,url:'row'+i,results:[{id:i}]})),data={minimal_collection_names:{'main:':Array.from({length:40},(_,i)=>({id:'old'+i,title:'TV Series I Have Seen '+i}))}},L={Storage:{get:(k,d)=>data[k]===undefined?d:data[k],set:(k,v)=>data[k]=v},SettingsApi:{addParam(){}},Api:{main(p,ok){ok(rows);}},Utils:{createInstance(){}},Maker:{get(){}}};let selected;L.Select={show:o=>selected=o};const api=mod('collections').default(L,{});let answer;L.Api.main({component:'main'},r=>answer=r);assert.equal(answer.length,4);api.menu();selected.onSelect(selected.items.find(i=>i.id==='main:'));assert.equal(selected.items.length,6);assert.deepEqual(selected.items.filter(i=>i.id!=='minimal:continue').slice(0,4).map(i=>i.title),rows.map(r=>'● '+r.title));
 rows.pop();rows.push({title:'Shots',url:'shots',results:[{id:90}]},{title:'Пустая',url:'empty',results:[]});L.Api.main({component:'main'},r=>answer=r);assert.equal(answer.length,5);api.menu();selected.onSelect(selected.items.find(i=>i.id==='main:'));assert.equal(selected.items.length,5);assert.ok(selected.items.every(i=>!i.title.includes('TV Series')));
});

test('disabled category rows make no request and stay available to reenable; failed and empty rows are omitted',()=>{
 const {cataloguePlan,default:catalogue}=mod('catalogue'),plan=cataloguePlan('movie'),hidden=[plan[1].cub],requests=[];let answer,calls=0;
 const L={Storage:{get:(k,d)=>d},Api:{sources:{cub:{list:(p,ok,fail)=>{requests.push(p.url);if(p.url===plan[2].cub)return fail();ok({results:p.url===plan[3].cub?[]:[{id:1}]});}}}}};
 catalogue(L,{}, {url:'movie',source:'cub'},hidden,r=>{answer=r;calls++;});assert.equal(calls,1);assert.equal(requests.length,9);assert.ok(!requests.includes(hidden[0]));assert.equal(answer.length,8);const skipped=answer.find(row=>row.url===hidden[0]);assert.equal(skipped.minimal_hidden,true);assert.deepEqual(skipped.results,[]);assert.ok(!answer.some(row=>[plan[2].cub,plan[3].cub].includes(row.url)));
});

test('leaving an anime catalogue stops scheduling the remaining rows and discards its late result',()=>{
 const catalogue=mod('catalogue').default,pending=[],object={url:'anime',source:'cub',minimal_anime_catalogue:'shikimori',activity:{component:{}}};let requests=0,answers=0;
 catalogue({Storage:{get:(k,d)=>d},Api:{sources:{cub:{list(){assert.fail('inactive standard catalogue requested');}}}}},{list:(p,ok)=>{requests++;pending.push(ok);}},object,[],()=>answers++);assert.equal(requests,3);object.activity.component.destroyed=true;pending.forEach(ok=>ok({results:[{id:1}]}));assert.equal(requests,3);assert.equal(answers,0);
});

test('native anime screen stays within ten rows and does not invoke the unbounded category factory',async()=>{
 const n=await native(),{w,L}=n;
 try{
  const calls=[];L.Api.sources.cub.category=()=>assert.fail('unbounded category factory called');L.Api.sources.cub.list=(p,ok)=>{calls.push(p.url);w.setTimeout(()=>ok({results:Array.from({length:24},(_,id)=>({id:id+1,name:'Аниме '+id,original_name:'Anime '+id,first_air_date:'2025-01-01',source:'cub',genre_ids:[16]}))}),0);};
  const network=w.testNetwork;w.testNetwork=(url,ok,fail)=>{if(url.includes('shikimori.one/api/animes')){calls.push(url);w.setTimeout(()=>ok(Array.from({length:24},(_,id)=>({id:id+100,kind:'tv',name:'Anime '+id,russian:'Аниме '+id,aired_on:'2025-01-01',score:'8',image:{original:'/poster.jpg'}}))),0);}else network(url,ok,fail);};
  L.Activity.push({component:'category',url:'anime',source:'cub',title:'Аниме'});await new Promise(r=>setTimeout(r,220));const link=L.Activity.active().activity.component;
  assert.equal(calls.length,10);assert.equal(link.loaded.length+link.items.length>=10,true);for(let i=0;i<25;i++){link.emit('scroll',1000*i);link.emit('next',()=>{},()=>{});}await new Promise(r=>setTimeout(r,100));assert.equal(calls.length,10);assert.ok(link.items.length<=10);const known=L.Storage.get('minimal_collection_rows_v2',{})['category:anime:standard'];assert.equal(known.length,10);assert.equal(known[0].title,'Сейчас смотрят');assert.equal(known[1].title,'В топе');assert.equal(known[2].title,'Сейчас выходит');assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
