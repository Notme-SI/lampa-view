const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,m={exports:{}};new Function('module','exports',code)(m,m.exports);return m.exports;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const cards=(offset=0)=>Array.from({length:20},(_,i)=>({id:offset+i+1,title:'Проект '+i,name:'Проект '+i,genre_ids:[18],poster_path:'/p.jpg',backdrop_path:'/b.jpg',first_air_date:'2026-01-01'}));
const list=(api,spec,page=1)=>new Promise((ok,fail)=>api.list({url:JSON.stringify(spec),page},ok,fail));

test('recent and upcoming windows cross New Year, current shows retain older premieres and completed excludes canceled',()=>{
 const m=mod('discovery-model'),date=new Date(2027,0,5),query=spec=>new URLSearchParams(m.discoveryQuery(spec,date).split('?')[1]);
 const fresh=query({kind:'movie',type:'movie',feed:'recent',sort:'new'});assert.equal(fresh.get('primary_release_date.gte'),'2026-07-09');assert.equal(fresh.get('primary_release_date.lte'),'2027-01-05');
 const upcoming=query({kind:'tv',type:'tv',feed:'upcoming'});assert.equal(upcoming.get('first_air_date.gte'),'2027-01-06');assert.equal(upcoming.get('first_air_date.lte'),'2028-01-05');
 for(const kind of ['tv','dorama','tvshow']){const spec={kind,type:'tv',feed:'active',country:kind==='dorama'?'KR':'RU'},q=query(spec);assert.equal(q.has('first_air_date.gte'),false);assert.equal(q.get('air_date.gte'),'2026-01-05');assert.equal(m.discoveryAccepts({first_air_date:'2000-01-01',origin_country:[spec.country],genre_ids:kind==='tvshow'?[10767]:[18]},spec),true);}
 const ended={kind:'tv',type:'tv',feed:'completed'};assert.equal(query(ended).get('with_status'),'3');assert.equal(m.discoveryAccepts({status:'Canceled',genre_ids:[18]},ended),false);assert.equal(m.discoveryAccepts({status:'Ended',first_air_date:'2000-01-01',genre_ids:[18]},ended),true);
});

test('saved public first pages paint immediately after restart, refresh in background and isolate endpoints without persisting secrets',async()=>{
 const session=new Map();global.window={sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v)},localStorage:{removeItem(){}}};
 const data={},store={get:(k,d)=>data[k] ?? d,set:(k,v)=>data[k]=JSON.parse(JSON.stringify(v))},spec={kind:'tv',type:'tv',sort:'popular'},install=mod('discovery-source').default;let requests=0,refresh;
 const L={Storage:store,TMDB:{api:()=> 'https://first.example/tmdb/'},Api:{sources:{tmdb:{get(url,p,ok){requests++;ok({page:1,total_pages:1,results:cards().map(c=>({...c,api_key:'NEVER-SAVE',watch_history:'PRIVATE'}))});}}}}};
 await list(install(L),spec);await wait(230);const serialized=JSON.stringify([...session.values()]);assert.ok(!serialized.includes('NEVER-SAVE') && !serialized.includes('PRIVATE'));assert.ok(serialized.length<384*1024);
 const saved=JSON.parse(session.get('minimal_catalogue_cache_v1'));saved.forEach(entry=>entry.at-=3600000);session.set('minimal_catalogue_cache_v1',JSON.stringify(saved));L.Api.sources.tmdb.get=(url,p,ok)=>{requests++;refresh=ok;};const restarted=install(L),page=await list(restarted,spec);assert.equal(page.results[0].id,1);assert.equal(requests,2);assert.equal(typeof refresh,'function');
 refresh({page:1,total_pages:1,results:cards(100)});assert.equal((await list(restarted,spec)).results[0].id,1,'A refresh never changes an open cursor');
 const again=install(L);L.Api.sources.tmdb.get=(url,p,ok)=>ok({page:1,total_pages:1,results:cards(200)});L.TMDB.api=()=> 'https://second.example/tmdb/';assert.equal((await list(again,spec)).results[0].id,201);delete global.window;
});

test('leaving a sparse feed stops additional page scans and a later reader can resume accepted cards',async()=>{
 const callbacks=[],L={Api:{sources:{tmdb:{get(url,p,ok){callbacks.push(ok);}}}}},api=mod('discovery-source').default(L),spec={kind:'movie',type:'movie',sort:'popular'};let cancelled=false,delivered=0;
 api.list({url:JSON.stringify(spec),minimal_cancelled:()=>cancelled},()=>delivered++);cancelled=true;callbacks.shift()({page:1,total_pages:3,results:cards().slice(0,2)});assert.equal(callbacks.length,0);assert.equal(delivered,0);
 const pending=list(api,spec);assert.equal(callbacks.length,1);callbacks.shift()({page:2,total_pages:2,results:cards(20)});const result=await pending;assert.equal(result.results.length,20);assert.deepEqual(result.results.slice(0,2).map(c=>c.id),[1,2]);
});

test('default-hidden collections remain configurable and home priorities preserve explicit user order',()=>{
 const {arrange,homeOrder,removedHomeRow}=mod('collections'),optional={minimal_row_id:'votes',minimal_default_hidden:true,results:[]},regular={minimal_row_id:'new',results:[]};
 assert.equal(removedHomeRow({id:'?sort=latest',title:'Последнее добавление'}),true);assert.equal(removedHomeRow({url:'?sort=latest&uhd=true',title:'В высоком качестве'}),false);assert.equal(removedHomeRow({url:'?cat=movie&sort=latest'}),false);
 assert.deepEqual(arrange([regular,optional],{}),[regular]);assert.deepEqual(arrange([regular,optional],{shown:['votes']}),[regular,optional]);assert.deepEqual(arrange([regular,optional],{order:['votes','new']}),[optional,regular]);assert.deepEqual(arrange([regular,optional],{order:['votes','new'],hidden:['votes']}),[regular]);
 const rows=[{url:'other'},{minimal_row_id:'minimal:annual:current_anime'},{url:'minimal:continue'},{title:'Сейчас смотрят'},{minimal_row_id:'minimal:annual:popular_series'},{minimal_row_id:'minimal:annual:new_movies'}];assert.deepEqual(homeOrder(rows).map(r=>rows.indexOf(r)),[3,2,5,4,0]);assert.equal(arrange(homeOrder(rows),{order:['other']})[0],rows[0]);
});

test('key acquisition links are visible before either integration has a key',async()=>{
 const native=require('./fixtures/native-lampa.cjs'),n=await native({built:true});try{const {L}=n;L.Params.init();const rows=L.SettingsApi.getParam('minimal_settings_services');assert.match(rows.find(r=>r.param.name==='minimal_kinoapi').field.description,/https:\/\/kinoapi\.lampac\.dev/);assert.match(rows.find(r=>r.param.name==='minimal_trakt_client_id').field.description,/https:\/\/trakt\.tv\/oauth\/applications/);assert.equal(L.Storage.get('minimal_trakt_client_id',''),'');assert.equal(L.Storage.get('minimal_kinoapi_key',''),'');}finally{n.close();}
});
