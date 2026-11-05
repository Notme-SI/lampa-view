const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/catalogue.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
const moduleValue={exports:{}};new Function('module','exports',code)(moduleValue,moduleValue.exports);
const {cataloguePlan,uniquePreviews,default:catalogue}=moduleValue.exports;

test('watching rows use category-filtered weekly trends and merge both cartoon formats',()=>{
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/discovery-model.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,m={exports:{}};new Function('module','exports',code)(m,m.exports);
 for(const kind of ['movie','tv','cartoon']){
  const plan=cataloguePlan(kind),rows=plan.filter(row=>row.title==='Сейчас смотрят');
  assert.equal(rows.length,1);assert.equal(plan[0],rows[0]);
  const spec=rows[0].discovery;assert.equal(spec.feed,'trending');
  assert.deepEqual(m.exports.discoverySpecs(spec).map(row=>row.path),kind==='cartoon'?['trending/movie/week','trending/tv/week']:['trending/'+kind+'/week']);
  const accepts=card=>m.exports.discoveryAccepts(card,{...spec,type:kind==='movie'?'movie':'tv'});
  if(kind==='tv')assert.equal(accepts({genre_ids:[10764],origin_country:['RU']}),false);
  assert.equal(accepts({genre_ids:[16],original_language:'ja'}),false);
  if(kind==='cartoon')assert.equal(accepts({genre_ids:[16],original_language:'en'}),true);
 }
});

test('watching More pages apply filters through the actual discovery source and retain cartoon movie/TV identities',()=>{
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/discovery-source.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,m={exports:{}};new Function('module','exports',code)(m,m.exports);
 const L={Api:{sources:{tmdb:{get(path,p,ok){ok({page:p.page,total_pages:2,results:[
  {id:1,title:'Игровой проект',name:'Игровой проект',genre_ids:[18],first_air_date:'2026-01-01',poster_path:'/p.jpg',backdrop_path:'/b.jpg'},
  {id:2,title:'Аниме',name:'Аниме',genre_ids:[16],original_language:'ja',poster_path:'/p.jpg'},
  {id:4,title:'Мультфильм',name:'Мультсериал',genre_ids:[16],original_language:'en',poster_path:'/p.jpg'}
 ]});}}}}},api=m.exports.default(L);
 for(const kind of ['movie','tv','cartoon']){
  const row=cataloguePlan(kind).find(row=>row.key==='now-watching');let first,second;
  api.list({url:JSON.stringify(row.discovery),page:1},result=>first=result,assert.fail);
  assert.deepEqual(first.results.map(card=>card.id),kind==='cartoon'?[4,4]:[1]);
  if(kind==='cartoon')assert.deepEqual(first.results.map(card=>card.media_type),['movie','tv']);
  api.list({url:JSON.stringify(row.discovery),page:2},result=>second=result,assert.fail);
  assert.ok(second.results.every(card=>kind==='cartoon'?card.id===4:card.id===1));
 }
});

test('discovery separates recent airings, rating, popularity and years while preserving old row aliases',()=>{
 for(const kind of ['movie']){
  const plan=cataloguePlan(kind,'standard',new Date(2026,9,29)),by=key=>plan.find(row=>row.key===key),query=key=>new URLSearchParams(by(key).tmdb.split('?')[1]);
  assert.equal(query('new').get('primary_release_date.lte'),'2026-10-29');assert.equal(query('rated').get('sort_by'),'vote_average.desc');assert.equal(by('rated').title,'Высокий рейтинг');
  assert.equal(query('new').get('sort_by'),(kind==='movie'?'primary_release_date':'first_air_date')+'.desc');assert.equal(query('popular').get('sort_by'),'popularity.desc');
  assert.ok(by('rated').minimal_row_aliases.includes('minimal:tmdb:'+kind+':uhd'));assert.ok(by('new').minimal_row_aliases.includes('minimal:tmdb:'+kind+':year'));
  assert.ok(plan.every(row=>row.discovery));assert.equal(new Set(plan.map(row=>row.tmdb)).size,plan.length);
 }
 const lead=['Новинки','Высокий рейтинг','Популярные','Много голосов'];
 for(const kind of ['movie','tv','cartoon'])assert.deepEqual(cataloguePlan(kind).slice(1,5).map(row=>row.title),lead);
 const tv=cataloguePlan('tv');
 assert.ok(tv.every(row=>!row.discovery.network && (!row.discovery.period || row.key==='new')));
 assert.deepEqual(tv.slice(6,10).map(row=>row.title),['Российские сериалы','Корейские дорамы','Турецкие сериалы','Китайские дорамы']);
 assert.deepEqual(tv.slice(1,5).map(row=>row.discovery.sort),['new','rated','popular','votes']);
});

test('preview deduplication keeps media identities, rank, full-feed URLs and native pagination without mutating cached data',()=>{
 const a={id:1,title:'A'},b={id:2,title:'B'},c={id:3,title:'C'},show={id:1,name:'Different series'};
 const rows=[{source:'tmdb',url:'discover/movie?sort_by=popularity.desc',results:[a,a,b],total_pages:50},{source:'tmdb',url:'discover/movie?sort_by=vote_average.desc',results:[b,c],total_pages:80},{source:'tmdb',url:'discover/tv?sort_by=popularity.desc',results:[show],total_pages:5}];
 const result=uniquePreviews(rows);assert.deepEqual(result.map(row=>row.results.map(card=>card.id)),[[1,2],[3],[1]]);
 assert.deepEqual(result.map(row=>row.total_pages),[50,80,5]);assert.deepEqual(result.map(row=>row.url),rows.map(row=>row.url));assert.equal(rows[1].results.length,2);
 assert.equal(uniquePreviews([{...rows[0],minimal_hidden:true},rows[1]])[1].results.length,2,'Hidden rows must not consume preview titles');
});

test('discovery plans keep deterministic row order and skip saved legacy IDs before requesting a feed',()=>{
 const pending=[],object={source:'tmdb',url:'movie'},L={Storage:{get:(k,d)=>d},Api:{sources:{minimal_discovery:{list(p,ok){pending.push({url:p.url,ok});}}}}};
 let output;const plan=cataloguePlan('movie');catalogue(L,{},object,[],rows=>output=rows);assert.equal(pending.length,3);
 const reply=index=>pending[index].ok({page:1,total_pages:12,results:[{id:1,title:'Общий'},{id:100+index,title:'Свой '+index}]});reply(2);reply(1);reply(0);for(let i=3;i<pending.length;i++)reply(i);
 assert.deepEqual(output.map(r=>r.title),plan.map(r=>r.title));assert.ok(output.every(r=>r.results.length===2),'Narrow named discovery rows retain their own full previews');
 pending.length=0;catalogue(L,{}, {source:'tmdb',url:'movie'},['minimal:tmdb:movie:uhd'],rows=>output=rows);for(let i=0;i<pending.length;i++)reply(i);
 assert.equal(pending.length,plan.length-1);assert.ok(output.some(row=>row.minimal_hidden && row.title==='Высокий рейтинг'));
 pending.length=0;catalogue(L,{}, {source:'tmdb',url:'movie'},['minimal:tmdb:movie:watch'],rows=>output=rows);for(let i=0;i<pending.length;i++)reply(i);assert.ok(output.some(row=>row.minimal_hidden && row.minimal_row_aliases.includes('minimal:tmdb:movie:watch')));
});

test('rebuilt dorama and TV shows separate countries, genres and programmes with stable migration aliases',()=>{
 const date=new Date(2026,9,30),dorama=cataloguePlan('dorama','standard',date),shows=cataloguePlan('tvshow','standard',date);
 const watching=shows[0],watchQuery=new URLSearchParams(watching.tmdb.split('?')[1]);
 assert.equal(watching.title,'Сейчас смотрят');assert.equal(watching.key,'now-watching');
 assert.equal(watchQuery.get('with_origin_country'),'RU');assert.equal(watchQuery.get('with_genres'),'10764|10767');
 assert.equal(watchQuery.get('sort_by'),'popularity.desc');assert.equal(watchQuery.get('air_date.gte'),'2025-10-30');assert.equal(watchQuery.get('air_date.lte'),'2026-10-30');
 for(const plan of [dorama,shows]){const first=plan===shows?plan[1]:plan[0];assert.equal(first.key,'watch');assert.equal(first.title,plan===shows?'Популярное':'Сейчас выходит');const q=new URLSearchParams(first.tmdb.split('?')[1]);assert.equal(q.get('air_date.gte'),plan===shows?null:'2026-10-23');assert.equal(q.get('air_date.lte'),plan===shows?null:'2026-10-30');assert.equal(new Set(plan.map(row=>row.tmdb)).size,plan.length);assert.ok(plan.every(row=>row.media_type==='tv'));}
 assert.equal(dorama.length,15);assert.equal(shows.length,6);assert.ok(dorama.find(r=>r.key==='country-KR').minimal_row_aliases.includes('minimal:kino:dorama:korea'));
 assert.ok(shows.every(row=>row.discovery.country==='RU')); assert.ok(shows.some(row=>row.discovery.country==='RU'));assert.ok(shows.every(row=>new URLSearchParams(row.tmdb.split('?')[1]).get('with_original_language')===null));
});

test('CUB-selected regional sections use the same complete discovery source and keep exact IDs for details and More',()=>{
 const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/discovery-source.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,m={exports:{}};new Function('module','exports',code)(m,m.exports);
 const response=require('./fixtures/discovery-response.cjs'),calls=[],L={Storage:{get:(k,d)=>d},Api:{sources:{cub:{list(){assert.fail('Global CUB list cannot implement discovery');}},tmdb:{get(url,p,ok){calls.push(url);ok(response(url,p.page));}}}}};m.exports.default(L);
 for(const kind of ['tvshow','dorama']){let output;catalogue(L,{}, {url:kind,source:'cub'},[],rows=>output=rows);assert.equal(output.length,cataloguePlan(kind).length);assert.ok(output.every(row=>row.source==='minimal_discovery' && row.total_pages===2 && row.results.length===20));assert.ok(output.every(row=>JSON.parse(row.url).kind===kind));assert.ok(output.every(row=>row.results.every(c=>c.source==='tmdb' && c.media_type==='tv')));}
 assert.ok(calls.length<=28);
});

test('catalogue previews hide explicitly missing posters and untranslated regional titles without inventing a dub',()=>{
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/tmdb.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,m={exports:{}};new Function('module','exports',bundle)(m,m.exports);
 const {catalogueResults,presentableCards}=m.exports,cards=[{id:1,name:'Есть обложка',poster_path:'/poster.jpg'},{id:2,name:'Нет обложки',poster_path:null},{id:3,name:'Unknown metadata'},{id:4,name:'日本語',poster_path:'/jp.jpg'},{id:5,name:'Club Friday',poster_path:'/club.jpg'},{id:6,name:'Название',poster_path:null,img:'https://media.trakt.tv/poster.jpg'}];
 assert.deepEqual(presentableCards(cards).map(c=>c.id),[1,3,4,5,6]);
 for(const url of ['discover/tv?with_origin_country=KR|JP','discover/tv?with_original_language=ru&with_genres=10764|10767'])assert.deepEqual(catalogueResults(url,{results:cards,page:3,total_pages:40}).results.map(c=>c.id),[1,6]);
 assert.equal(cards.length,6);assert.equal(catalogueResults('tv/popular',{results:cards,page:3}).page,3);
});
