const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,m={exports:{}};new Function('module','exports',code)(m,m.exports);return m.exports;}
const model=mod('discovery-model'),{default:install,discoverySpec,DISCOVERY_SOURCE}=mod('discovery-source');
const {sectionPage}=mod('sections');
const show=(id,origin=['US'],genres=[10764])=>({id,name:'Название '+id,origin_country:origin,genre_ids:genres,poster_path:'/poster.jpg',original_language:'ru'});
const read=(api,spec,page=1)=>new Promise((resolve,reject)=>api.list({url:JSON.stringify(spec),page},resolve,reject));

test('SURS families are accessible with verified networks, corrected NTV and Disney Junior, studios and every child collection',()=>{
 const options=model.discoveryOptions('cartoon',new Date(2026,10,4));assert.equal(options.networks.length,40);assert.equal(options.heroes.length,51);assert.equal(options.studios.length,10);
 for(const id of [49,77,2552,453,1024,213,3186,2076,4330,3353,2739,2,6,16,318,174,19,64,493,88,67,2493,2859,4085,3923,412,558,3871,3827,5806,806,1191,1199,3031,3882,44,281,56,2686,13])assert.ok(options.networks.some(n=>n.id===id),String(id));
 assert.ok(!options.networks.some(n=>[1778,1119].includes(n.id)));assert.equal(options.networks.find(n=>n.id===174).name,'AMC');assert.equal(options.networks.find(n=>n.id===281).name,'Disney Junior');assert.ok(options.heroes.find(h=>h.id==='1').queries.includes('SpongeBob'));
 for(const kind of model.DISCOVERY_KINDS){const sections=model.discoveryOptions(kind).sections.map(v=>v[0]);for(const section of ['overview','trending','new','rated','votes','genres','countries','periods'])assert.ok(sections.includes(section));}
 assert.equal(sectionPage('kids/heroes').items.length,51);assert.equal(sectionPage('kids/studios').items.length,10);assert.equal(sectionPage('streams/global').items.length+sectionPage('streams/russian').items.length,40);assert.ok(sectionPage('series').items.some(i=>i.path==='series/dorama'));assert.ok(sectionPage('series').items.some(i=>i.state && i.state.country==='TR'));
});

test('movie and TV queries use supported type-specific genres, sorts, country filters and dates; romance is a verified keyword',()=>{
 const date=new Date(2026,10,4),tvGenres=new Set([10759,16,35,80,99,18,10751,10762,9648,10763,10764,10765,10766,10767,10768,37]);
 for(const kind of model.DISCOVERY_KINDS)for(const section of model.discoveryOptions(kind,date).sections.map(v=>v[0]))for(const row of model.discoveryPlan(kind,{section},date)){
  assert.ok(row.minimal_row_id);assert.ok(row.discovery);const specs=model.discoverySpecs(row.discovery,date);assert.ok(specs.length>=1 && specs.length<=4);
  for(const spec of specs){const q=new URLSearchParams(spec.path.split('?')[1]);assert.equal(q.has('api_key'),false);assert.ok(!q.has('certification') || spec.type==='movie');if(spec.type==='tv'){assert.notEqual(q.get('sort_by'),'revenue.desc');for(const id of (q.get('with_genres') || '').split(/[|,]/).filter(Boolean))assert.ok(tvGenres.has(Number(id)),spec.path);}if(q.has('first_air_date.lte'))assert.ok(q.get('first_air_date.lte')<='2026-11-04');}
 }
 const romance=model.discoveryPlan('dorama',{genre:'k9840'},date)[0],q=new URLSearchParams(romance.tmdb.split('?')[1]);assert.equal(q.get('with_keywords'),'9840');assert.equal(q.get('with_genres'),null);assert.match(q.get('without_genres'),/16/);
 const russian=model.discoveryPlan('tv',{country:'RU'},date)[0];assert.equal(new URLSearchParams(russian.tmdb.split('?')[1]).get('with_origin_country'),'RU');assert.equal(discoverySpec({...russian.discovery,type:'tv',sort:'revenue'}),null);
 const watch=model.discoveryPlan('tv',{},date)[0];assert.equal(new URLSearchParams(watch.tmdb.split('?')[1]).get('air_date.gte'),'2026-10-28');
 const shows=model.discoveryPlan('tvshow',{},date);assert.ok(shows.every(row=>row.discovery.country==='RU'));for(const key of ['watch','new-talk','new-reality']){const q=new URLSearchParams(shows.find(r=>r.key===key).tmdb.split('?')[1]);assert.equal(q.get('vote_count.gte'),'0');assert.equal(q.get('with_origin_country'),'RU');assert.ok(q.get('first_air_date.gte')>='2018-01-01');}assert.ok(model.discoveryPlan('tv',{},date).some(r=>r.discovery.kind==='dorama'));
 for(const [type,field,id] of [['movie','with_companies','2348'],['tv','with_networks','13']]){const path=model.discoveryQuery({kind:'cartoon',type,company:2348},date);assert.equal(new URLSearchParams(path.split('?')[1]).get(field),id);}
 assert.deepEqual(model.discoverySpecs({kind:'cartoon',type:'tv',genre:'28'}),[]);assert.equal(model.discoveryState('cartoon',{network:213,genre:'28'}).genre,'');assert.equal(model.discoveryState('cartoon',{format:'tv',sort:'revenue'}).sort,'');
});

test('TV show format and origin distinguish Russian and foreign programmes without treating Russian language or comedy as proof',()=>{
 const ru={kind:'tvshow',type:'tv',country:'RU',genre:'10764'},foreign={...ru,country:'foreign'};
 assert.equal(model.discoveryAccepts(show(1,['RU']),ru),true);assert.equal(model.discoveryAccepts(show(2,['US']),ru),false);assert.equal(model.discoveryAccepts(show(3,['US']),foreign),true);assert.equal(model.discoveryAccepts(show(4,[]),foreign),false);assert.equal(model.discoveryAccepts(show(5,['RU','US']),foreign),false);assert.equal(model.discoveryAccepts(show(6,['RU'],[35]),ru),false);
 assert.equal(model.discoveryAccepts(show(7,['JP'],[16]),{kind:'dorama',type:'tv',country:'JP'}),false);assert.equal(model.discoveryAccepts(show(8,['KR'],[18]),{kind:'dorama',type:'tv',country:'KR'}),true);
});

test('partial filtered pages preserve every accepted card across More without inventing a full page or skipping offsets',async()=>{
 const calls=[],spec={kind:'tvshow',type:'tv',country:'foreign',genre:'10764',sort:'popular'},L={Api:{sources:{tmdb:{get(url,p,ok){calls.push(p.page);const page=p.page;ok({page,total_pages:5,results:page<5?[show(page,['RU']),show(100+page)]:Array.from({length:20},(_,i)=>show(200+i))});}}}}},api=install(L);
 const first=await read(api,spec);assert.equal(first.results.length,4);assert.equal(first.total_pages,2);assert.deepEqual(first.results.map(c=>c.id),[101,102,103,104]);assert.equal(calls.length,4,'Sparse feeds have a fixed scan budget');
 const second=await read(api,spec,2);assert.deepEqual(second.results.map(c=>c.id),Array.from({length:20},(_,i)=>200+i));assert.equal(second.total_pages,2);assert.deepEqual(calls,[1,2,3,4,5]);assert.equal(L.Api.sources[DISCOVERY_SOURCE],api);
 const cached=await read(api,spec);assert.deepEqual(cached,first);assert.equal(calls.length,5);
});

test('hero collections combine movie and TV search, deduplicate aliases by media identity and delegate exact detail coordinates',async()=>{
 const routes=[],details=[],L={Api:{sources:{tmdb:{get(url,p,ok){routes.push(url);ok({page:1,total_pages:1,results:[{id:55,title:'Губка Боб',name:'Губка Боб',genre_ids:[16],poster_path:'/poster.jpg',original_language:'en'}]});},full:(p,ok)=>{details.push(p);ok({movie:p.card});}}}}},api=install(L),spec={kind:'cartoon',type:'',hero:'1',sort:'popular'};
 const page=await read(api,spec);assert.equal(routes.length,4);assert.deepEqual(page.results.map(c=>[c.id,c.media_type]),[[55,'movie'],[55,'tv']]);assert.ok(routes.some(p=>p.includes('search/movie')) && routes.some(p=>p.includes('search/tv')));assert.equal(page.total_pages,1);
 api.full({source:DISCOVERY_SOURCE,id:55,card:page.results[0]},()=>{});assert.equal(details[0].source,'tmdb');assert.equal(details[0].method,'movie');assert.equal(details[0].id,55);
});

test('discovery transport coalesces readers, bounds parallelism and recovers after malformed responses without caching failure',async()=>{
 let active=0,max=0,calls=0,broken=true;const L={Api:{sources:{tmdb:{get(url,p,ok){calls++;active++;max=Math.max(max,active);setTimeout(()=>{active--;ok(broken?{error:true}:{page:p.page,total_pages:1,results:Array.from({length:20},(_,i)=>show(i+1))});},3);}}}}},api=install(L),spec={kind:'tvshow',type:'tv',sort:'popular'};
 await assert.rejects(read(api,spec));broken=false;const pages=await Promise.all(Array.from({length:8},()=>read(api,spec)));assert.ok(pages.every(p=>p.results.length===20));assert.equal(calls,2);
 await Promise.all([213,49,2552,2739,453].map(network=>read(api,{...spec,network})));assert.ok(max<=3);
 for(const value of [{...spec,network:1778},{...spec,country:'XX'},{...spec,sort:'revenue'},{...spec,url:'https://other.invalid'}]){if(value.url)delete value.kind;assert.equal(discoverySpec(value),null);}
});

test('clearing discovery releases old slots immediately and late results cannot replace a new filter or poison its cache',async()=>{
 const pending=[],L={Api:{sources:{tmdb:{get(url,p,ok){pending.push(ok);}}}}},api=install(L),spec={kind:'tvshow',type:'tv',sort:'popular'};let old=0;
 api.list({url:JSON.stringify(spec),page:1},()=>old++);api.clear();const next=read(api,spec);assert.equal(pending.length,2);
 pending[0]({page:1,total_pages:1,results:[show(1)]});pending[1]({page:1,total_pages:1,results:[show(2)]});assert.equal(old,0);assert.deepEqual((await next).results.map(c=>c.id),[2]);assert.deepEqual((await read(api,spec)).results.map(c=>c.id),[2]);assert.equal(pending.length,2);
});

test('section navigation exposes SURS hierarchy, integrates dorama with series and keeps native pagination without a filter toolbar',async()=>{
 const native=require('./fixtures/native-lampa.cjs'),response=require('./fixtures/discovery-response.cjs'),wait=ms=>new Promise(r=>setTimeout(r,ms));const n=await native({built:true}),{w,L}=n;try{
 const requests=[];L.Api.sources.tmdb.get=(url,p,ok)=>{requests.push(url);w.setTimeout(()=>ok(response(url,p.page)),0);};const globalSource=L.Storage.get('source');L.Activity.push({component:'minimal_sections',url:'',title:'Разделы',source:'tmdb'});await wait(40);let root=L.Activity.active().activity.render(true);assert.deepEqual(Array.from(root.querySelectorAll('[data-section-id]'),n=>n.dataset.sectionId),['films','series','streams','kids']);assert.equal(requests.length,0,'A section index makes no catalogue requests');
 root.querySelector('[data-section-id=series]').click();await wait(40);root=L.Activity.active().activity.render(true);assert.ok(root.querySelector('[data-section-id=turkish]'));root.querySelector('[data-section-id=dorama]').click();await wait(40);assert.equal(L.Activity.active().url,'series/dorama');root=L.Activity.active().activity.render(true);root.querySelector('[data-section-id=JP]').click();await wait(280);assert.equal(L.Activity.active().component,'category');assert.equal(L.Activity.active().url,'dorama');const component=L.Activity.active().activity.component;assert.ok(!component.render(true).querySelector('.minimal-discovery-controls'));const row=component.items[0],spec=JSON.parse(row.data.url);assert.equal(spec.country,'JP');assert.equal(row.data.results[0].source,'tmdb');row.render(true).querySelector('.minimal-row-more').dispatchEvent(new w.Event('hover:enter'));await wait(100);assert.equal(L.Activity.active().source,DISCOVERY_SOURCE);assert.equal(JSON.parse(L.Activity.active().url).country,'JP');assert.equal(L.Storage.get('source'),globalSource);
 L.Activity.push({component:'minimal_sections',url:'streams/global',source:'tmdb'});await wait(30);root=L.Activity.active().activity.render(true);assert.ok(root.querySelector('[data-section-id=network-213]'));root.querySelector('[data-section-id=network-213]').click();await wait(250);assert.equal(JSON.parse(L.Activity.active().activity.component.items[0].data.url).network,213);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
