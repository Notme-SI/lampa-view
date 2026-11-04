const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;const module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}
test('unified anime search interleaves movie and TV identities and More delivers every remaining card exactly once',async()=>{
 const dom=new JSDOM('<body><ul class="menu__list"></ul></body>',{runScripts:'outside-only'}),w=dom.window;try{w.eval(require('fs').readFileSync(path.join(__dirname,'fixtures/jquery.js'),'utf8'));w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/filters.js')],bundle:true,write:false,format:'iife',globalName:'Filters'}).outputFiles[0].text);const routes=[],L={Storage:{get:(k,d)=>d},Select:{show(){}},SettingsApi:{addParam(){}},Api:{sources:{tmdb:{get(url,p,ok){routes.push(url);ok({page:1,total_pages:1,results:Array.from({length:20},(_,i)=>({id:i+1,title:'Аниме '+i,name:'Аниме '+i,original_language:'ja',genre_ids:[16],first_air_date:'2024-01-01'}))});}}}},Noty:{show:assert.fail}};w.Filters.default(L);const api=L.Api.sources.minimal_search,url=JSON.stringify({kind:'anime_tmdb',query:'anime'}),read=page=>new Promise((ok,fail)=>api.list({url,page},ok,fail)),a=await read(1),b=await read(2),again=await read(2);assert.equal(routes.length,2);assert.ok(routes.some(r=>r.startsWith('search/movie?')) && routes.some(r=>r.startsWith('search/tv?')));assert.equal(a.results.length,20);assert.equal(b.results.length,20);assert.equal(new Set([...a.results,...b.results].map(c=>c.media_type+':'+c.id)).size,40);assert.equal(a.results[0].media_type,'movie');assert.equal(a.results[1].media_type,'tv');assert.equal(b,again);
 }finally{w.close();}
});
test('country filters verify sparse title results through bounded detail requests instead of substituting the language',async()=>{
 const dom=new JSDOM('<body><ul class="menu__list"></ul></body>',{runScripts:'outside-only'}),w=dom.window;try{w.eval(require('fs').readFileSync(path.join(__dirname,'fixtures/jquery.js'),'utf8'));w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/filters.js')],bundle:true,write:false,format:'iife',globalName:'Filters'}).outputFiles[0].text);let active=0,max=0;const L={Storage:{get:(k,d)=>d},Select:{show(){}},SettingsApi:{addParam(){}},Api:{sources:{tmdb:{get(url,p,ok){if(url.startsWith('search/'))return ok({total_pages:1,results:Array.from({length:6},(_,i)=>({id:i+1,title:'Фильм',original_language:'en',origin_country:[],genre_ids:[18]}))});active++;max=Math.max(max,active);w.setTimeout(()=>{active--;const id=Number(url.split('/')[1]);ok({id,production_countries:[{iso_3166_1:id%2?'JP':'US'}]});},5);}}}},Noty:{show:assert.fail}};w.Filters.default(L);const answer=await new Promise((ok,fail)=>L.Api.sources.minimal_search.list({url:JSON.stringify({kind:'movie',query:'film',country:'JP'}),page:1},ok,fail));assert.deepEqual(Array.from(answer.results,c=>c.id),[1,3,5]);assert.ok(max<=3);assert.equal(answer.total_pages,1);
 }finally{w.close();}
});
test('settings retain late adapter options and callbacks inside one visible folder',()=>{
 const params={lampa_view:[{param:{name:'theme'}}]},components={lampa_view:{name:'Lampa Minimal'}};
 const api={getParam:k=>params[k],allComponents:()=>components};mod('settings').default(api);
 let called=0;params.mpv_plus=[{param:{name:'parser'},onChange:()=>called++}];params.snack=[{param:{name:'auto'}}];components.mpv_plus={};components.snack={};
 assert.deepEqual(Object.keys(api.allComponents()),['lampa_view']);const list=api.getParam('lampa_view');assert.equal(list.filter(p=>p.param.type==='button').length,1);assert.equal(list.at(-1).param.type,'static');api.getParam('minimal_settings_playback').find(p=>p.param.name==='parser').onChange();assert.equal(called,1);assert.equal(api.getParam('snack'),params.snack);
});
test('grid cards get quality and type through native visibility lifecycle',async()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/quality.js')],bundle:true,write:false,format:'iife',globalName:'Quality'}).outputFiles[0].text);
 function Card(){}let item;
 const L={Listener:{follow(){}},Maker:{get:()=>Card},Utils:{createInstance(Base,data){const node=w.document.createElement('div');node.className='card';node.innerHTML='<div class="card__view"></div>';node.getBoundingClientRect=()=>({width:100,top:0,bottom:150,left:0});w.document.body.appendChild(node);return item={data,render:()=>node,use(hooks){this.hooks=hooks;}};}}};
 w.Quality.default(L);L.Utils.createInstance(Card,{name:'Series',original_name:'Series',quality:'1080p'});await new Promise(r=>setTimeout(r,20));
 assert.equal(item.render().querySelector('.pt-kind').textContent,'Сериал');assert.equal(item.render().querySelector('.pt-quality').textContent,'1080p');item.hooks.onVisible();await new Promise(r=>setTimeout(r,20));assert.equal(item.render().querySelectorAll('.pt-quality').length,1);dom.window.close();
});
test('collection preferences reorder and hide without losing unconfigured rows',()=>{
 const {arrange}=mod('collections'),rows=[{title:'A'},{title:'B'},{title:'C'},{title:'D'}];
 assert.deepEqual(arrange(rows,{order:['C','A'],hidden:['B']}).map(r=>r.title),['C','A','D']);assert.equal(rows.length,4);
});
test('home stays compact even with a saved disabled flag and never requests Shikimori',()=>{
 const data={minimal_home_compact:false,minimal_anime_home:true,minimal_collections:{'main:':{hidden:['Hidden']}}},L={Storage:{get:(k,d)=>data[k]===undefined?d:data[k],set:(k,v)=>data[k]=v},SettingsApi:{addParam(){}},Api:{main(o,ok){ok([{title:'Hidden',results:[1]},{title:'Visible',results:[2]}]);return resolve=>resolve([{title:'Hidden'},{title:'Later'}]);}},Utils:{createInstance(){}},Maker:{get(){}}};
 mod('collections').default(L,{list:()=>assert.fail('Shikimori must not be requested from main')});let result;
 const next=L.Api.main({component:'main',url:''},rows=>result=rows,()=>{});
 assert.deepEqual(result.map(r=>r.title),['Visible']);assert.equal(next,undefined);
});
test('discovery filters use the correct year field and anime adapter preserves series identity',()=>{
 const {discoverUrl}=mod('filters');assert.match(discoverUrl({kind:'tv',year:'2024',genre:'16',score:'8'}),/first_air_date.gte=2024-01-01/);assert.match(discoverUrl({kind:'movie',year:'2020'}),/primary_release_date.lte=2020-12-31/);
 const card=mod('shikimori').shikiCard({id:1,kind:'tv',name:'Example',russian:'Пример',aired_on:'2020-01-01',image:{original:'/poster.jpg'},score:'8.5'});assert.equal(card.media_type,'tv');assert.equal(card.original_name,'Example');assert.equal(card.img,'https://shikimori.io/poster.jpg');
});

test('row ordering updates both the DOM and remote navigation after append',()=>{
 const dom=new JSDOM('<div id="rows"></div>'),root=dom.window.document.querySelector('#rows');
 const a={title:'A'},b={title:'B'},c={title:'C'},data={minimal_collections:{'main:':{order:['C','A'],hidden:['B']}}};let hooks;let destroyed=0;
 const rows=[a,b,c].map(d=>{const node=dom.window.document.createElement('section');node.textContent=d.title;root.appendChild(node);return {data:d,render:()=>node,destroy(){destroyed++;node.remove();}};});
 function Main(){}const item={items:rows,active:0,use:h=>hooks=h};
 const L={Storage:{get:(k,d)=>data[k]===undefined?d:data[k],set:(k,v)=>data[k]=v},Api:{main(){}},SettingsApi:{addParam(){}},Utils:{createInstance:()=>item},Maker:{get:()=>Main}};
 mod('collections').default(L,{});L.Utils.createInstance(Main,{component:'main',url:''});hooks.onBuild();
 assert.deepEqual(item.items.map(i=>i.data.title),['C','A']);assert.equal(root.textContent,'CA');assert.equal(item.active,1);assert.equal(destroyed,1);dom.window.close();
});

test('TMDB requests use Lampa catalogue API when public TMDB only exposes URL helpers',()=>{
 const calls=[],L={TMDB:{key:()=> 'key',api:p=>'http://lampa.example.invalid/tmdb/api/3/'+p},Api:{sources:{tmdb:{get:(path,params,ok)=>{calls.push(path);ok({genres:[{id:1,name:'Drama'}]});}}}}};
 let answer;mod('tmdb').default(L,'genre/movie/list?language=ru',{},j=>answer=j,()=>assert.fail('unexpected failure'));assert.equal(answer.genres[0].name,'Drama');assert.equal(calls.length,1);
});
test('TMDB legacy fallback adds a key through the configured server proxy',()=>{
 let url;const L={TMDB:{key:()=> 'key',api:p=>'http://lampa.example.invalid/tmdb/api/3/'+p},Reguest:function(){this.timeout=()=>{};this.silent=(u,ok)=>{url=u;ok({results:[]});};}};
 mod('tmdb').default(L,'movie/1/images?language=ru',{},()=>{});assert.equal(url,'http://lampa.example.invalid/tmdb/api/3/movie/1/images?language=ru&api_key=key');
});
test('year bounds support open ranges, reject inversions, and map to movie/TV date fields',()=>{
 const {yearBounds,discoverUrl}=mod('filters');assert.deepEqual(yearBounds({year_from:'1990',year_to:'2020'}),{from:'1990',to:'2020'});assert.throws(()=>yearBounds({year_from:'2020',year_to:'1990'}));assert.throws(()=>yearBounds({year_from:'20xx'}));
 assert.match(discoverUrl({kind:'movie',year_from:'1990',year_to:'2020'}),/primary_release_date.gte=1990-01-01&primary_release_date.lte=2020-12-31/);
 assert.match(discoverUrl({kind:'tv',year_to:'2010'}),/first_air_date.lte=2010-12-31/);assert.ok(!discoverUrl({kind:'tv',year_to:'2010'}).includes('.gte='));
});
test('settings groups hide promotion and preserve option keys, callbacks and clean text',()=>{
 const params={lampa_view:[{param:{name:'lampa_view_enabled',type:'trigger'},field:{name:'Тема'}}],mpv_plus:[{param:{name:'mpv_plus_search',type:'trigger'},field:{name:'Названия раздач'}}],snack:[{param:{name:'alc_auto_community',type:'static'},field:{name:'Telegram',description:'https://t.me/example'}},{param:{name:'snack_open_watch',type:'button'}},{param:{name:'alc_auto_langs',type:'input'},snack_g:'langs',field:{name:'Языки',description:'Настройки Закуси'}},{param:{name:'alc_auto_server',type:'input'},snack_g:'server',field:{name:'Сервер'}}]};
 const components={lampa_view:{name:'L A M P A'},snack:{},mpv_plus:{}},opened=[];const api={getParam:k=>params[k],allComponents:()=>components,addComponent:d=>components[d.component]=d};
 mod('settings').default(api,{Settings:{create:name=>opened.push(name)}});
 assert.deepEqual(Object.keys(api.allComponents()),['lampa_view']);assert.equal(api.getParam('lampa_view').filter(p=>p.param.type==='button').length,4);assert.equal(api.getParam('minimal_settings_languages')[0].param.name,'alc_auto_langs');
 for(const group of api.getParam('lampa_view').filter(p=>p.param.type==='button'))group.onChange();assert.equal(opened.length,4);
 const visible=opened.flatMap(name=>api.getParam(name));assert.equal(visible.length,4);assert.ok(!JSON.stringify(visible).match(/t\.me|Telegram|Закус/i));
});

test('filter menu works without TMDB.get, submits a year range, and skips empty search pages',()=>{
 const dom=new JSDOM('<body><ul class="menu__list"></ul></body>',{runScripts:'outside-only'}),w=dom.window;w.eval(require('fs').readFileSync(path.join(__dirname,'fixtures/jquery.js'),'utf8'));
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/filters.js')],bundle:true,write:false,format:'iife',globalName:'Filters'}).outputFiles[0].text);
 let selected,input,route,requests=[];const store={};
 const L={Storage:{get:(k,d)=>store[k] || d,set:(k,v)=>store[k]=v},TMDB:{api:p=>p,key:()=>''},Api:{sources:{tmdb:{get(url,p,ok){requests.push(url);if(url.startsWith('genre/'))ok({genres:[{id:18,name:'Драма'}]});else if(url.includes('page=1'))ok({total_pages:2,results:[{title:'Example',release_date:'1980-01-01'}]});else ok({total_pages:2,results:[{title:'Example',release_date:'2015-01-01',genre_ids:[18],vote_average:8}]});}}}},Select:{show:o=>selected=o,close(){}},Input:{edit:(o,fn)=>input=fn},SettingsApi:{addParam(){}},Controller:{toggle(){}},Activity:{push:o=>route=o},Noty:{show:s=>assert.fail(s)}};
 w.Filters.default(L);w.jQuery('[data-action=minimal_filters]').trigger('hover:enter');assert.equal(selected.title,'Поиск и фильтры');
 selected.onSelect({id:'genre'});selected.onSelect({id:'18',title:'Драма'});selected.onSelect({id:'year_from'});input('2010');selected.onSelect({id:'year_to'});input('2020');selected.onSelect({id:'run'});
 assert.match(route.url,/primary_release_date.gte=2010-01-01/);assert.match(route.url,/primary_release_date.lte=2020-12-31/);
 let result;L.Api.sources.minimal_search.list({url:JSON.stringify({kind:'movie',query:'Example',year_from:'2010',year_to:'2020',genre:18}),page:1},r=>result=r,()=>assert.fail('request failed'));
 assert.equal(result.results.length,1);assert.equal(result.results[0].release_date,'2015-01-01');assert.equal(result.total_pages,1);assert.equal(requests.filter(p=>p.startsWith('search/')).length,2);dom.window.close();
});

test('detail uses supplied title artwork and keeps a text fallback on image failure',()=>{
 const dom=new JSDOM('<body class="lampa_view"><section id="full"><div class="full-start-new__right"><h1 class="full-start-new__title">Movie</h1><div class="full-start-new__buttons"></div></div></section></body>',{runScripts:'outside-only'}),w=dom.window;
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'iife',globalName:'Detail'}).outputFiles[0].text);
 const body=w.document.querySelector('#full'),event={type:'complite',body,data:{movie:{id:1,title:'Movie',overview:'Description'},images:{logos:[{file_path:'/logo.png',iso_639_1:'ru'}]}}};
 w.Detail.default({Storage:{get:()=> 'ru'},TMDB:{image:p=>'http://images.test'+p}},event,()=>assert.fail('unnecessary logo request'));
 const image=body.querySelector('.minimal-detail-logo'),title=body.querySelector('h1');assert.ok(image.src.endsWith('/original/logo.png'));assert.equal(body.querySelector('.minimal-detail-overview').textContent,'Description');
 image.onload();assert.ok(title.classList.contains('pt-hidden'));image.onerror();assert.ok(!title.classList.contains('pt-hidden'));assert.equal(body.querySelector('.minimal-detail-logo'),null);dom.window.close();
});
test('detail keeps the Russian title below foreign artwork',()=>{
 const dom=new JSDOM('<body class="lampa_view"><section id="full"><div class="full-start-new__right"><h1 class="full-start-new__title">Русское название</h1></div></section></body>',{runScripts:'outside-only'}),w=dom.window;
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'iife',globalName:'Detail'}).outputFiles[0].text);
 const body=w.document.querySelector('#full');w.Detail.default({Storage:{get:()=> 'ru'},TMDB:{image:p=>'http://images.test'+p}},{type:'complite',body,data:{movie:{id:1,title:'Русское название'},images:{logos:[{file_path:'/en.png',iso_639_1:'en'}]}}},()=>assert.fail('unnecessary request'));
 const image=body.querySelector('.minimal-detail-logo'),title=body.querySelector('h1');image.onload();assert.equal(image.nextElementSibling,title);assert.equal(title.textContent,'Русское название');assert.equal(title.classList.contains('pt-hidden'),false);assert.ok(title.classList.contains('minimal-detail-translation'));image.onerror();assert.equal(title.classList.contains('minimal-detail-translation'),false);dom.window.close();
});
test('movie and series headings use localized titles while facts retain the original',()=>{
 for(const card of [{id:1,title:'Человек-паук: Новый день',original_title:'Spider-Man: Brand New Day'},{id:2,name:'Кэрри',original_name:'Carrie'}]){
  const dom=new JSDOM('<body class="lampa_view"><section id="full"><div class="full-start-new"><div class="full-start-new__body"><div class="full-start-new__left"></div><div class="full-start-new__right"><h1 class="full-start-new__title">Название</h1><div class="full-start-new__buttons"></div></div></div></div></section></body>',{runScripts:'outside-only'}),w=dom.window;
  w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'iife',globalName:'Detail'}).outputFiles[0].text);
  const body=w.document.querySelector('#full');w.Detail.default({Storage:{get:()=> 'ru'},TMDB:{image:p=>p}},{type:'complite',body,data:{movie:card,images:{logos:[{file_path:'/english.png',iso_639_1:'en'}]}}},(card,ok)=>ok(''));
  body.querySelector('.minimal-detail-logo').onload();assert.ok(body.querySelector('h1').classList.contains('pt-hidden'));
  assert.equal(body.querySelector('.minimal-detail-heading').textContent,card.name || card.title);assert.ok(body.querySelector('.minimal-detail-facts').textContent.includes(card.original_name || card.original_title));dom.window.close();
 }
});


test('filtered title search applies every restriction across sparse pages and preserves cached quality',()=>{
 const d=new JSDOM('<body><ul class="menu__list"></ul></body>',{runScripts:'outside-only'}),w=d.window;
 try{w.eval(require('fs').readFileSync(path.join(__dirname,'fixtures/jquery.js'),'utf8'));w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/filters.js')],bundle:true,write:false,format:'iife',globalName:'Filters'}).outputFiles[0].text);let selected,route;const requests=[],cache=[['tv:matched:2021:anime3:tmdb:100',{q:'4K',time:Date.now()}]],good={id:100,name:'Matched',first_air_date:'2021-04-01',original_language:'ja',genre_ids:[16,18],vote_average:8.5,vote_count:250};
 const L={Storage:{get:(key,def)=>key==='minimal_quality_v2'?cache:def,set(){}},Api:{sources:{tmdb:{get:(url,p,ok)=>{requests.push(url);const page=Number(new URL(url,'https://tmdb.test').searchParams.get('page'));ok({page,total_pages:2,results:page===1?[{...good,id:1,first_air_date:'1990-01-01'},{...good,id:2,original_language:'en'},{...good,id:3,genre_ids:[18]},{...good,id:4,vote_average:4},{...good,id:5,vote_count:2}]:[good]});}}}},Select:{show:options=>selected=options,hide(){}},SettingsApi:{addParam(){}},Controller:{toggle(){}},Activity:{push:object=>route=object},Noty:{show:message=>assert.fail(message)}};
 w.Filters.default(L);w.jQuery('[data-action=minimal_filters]').trigger('hover:enter');selected.onSelect({id:'kind'});assert.ok(selected.items.some(item=>item.id==='anime'));assert.deepEqual(Array.from(selected.items,item=>item.title),['Фильмы','Сериалы','Мультфильмы','ТВ-шоу','Аниме','Аниме Shikimori']);selected.onSelect({id:'anime_tmdb'});selected.onSelect({id:'run'});assert.equal(route.source,'minimal_search');assert.equal(JSON.parse(route.url).kind,'anime_tmdb');
 let answer;L.Api.sources.minimal_search.list({url:JSON.stringify({kind:'anime_tv',query:'Matched',year_from:'2020',year_to:'2024',genre:18,score:8,votes:100,sort:'quality.desc'}),page:1},json=>answer=json,()=>assert.fail('Failed search'));assert.equal(requests.length,2);assert.ok(requests.every(url=>url.startsWith('search/tv?')));assert.deepEqual(Array.from(answer.results,c=>c.id),[100]);assert.equal(answer.results[0].quality,'4K');assert.equal(answer.results[0].source,'tmdb');assert.equal(answer.total_pages,1);
 }finally{w.close();}
});
