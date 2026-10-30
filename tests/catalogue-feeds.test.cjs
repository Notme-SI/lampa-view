const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/catalogue.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
const moduleValue={exports:{}};new Function('module','exports',code)(moduleValue,moduleValue.exports);
const {cataloguePlan,uniquePreviews,default:catalogue}=moduleValue.exports;

test('TMDB feeds separate recent releases, rating, popularity and years; CUB routes remain compatible',()=>{
 for(const kind of ['movie','tv']){
  const plan=cataloguePlan(kind,'standard',new Date(2026,9,29)),by=key=>plan.find(row=>row.key===key),query=key=>new URLSearchParams(by(key).tmdb.split('?')[1]);
  assert.equal(query('watch').get(kind==='movie'?'primary_release_date.lte':'air_date.lte'),'2026-10-29');
  assert.equal(query('uhd').get('sort_by'),'vote_average.desc');assert.equal(by('uhd').tmdb_title,'С высоким рейтингом');assert.equal(by('uhd').title,'В высоком качестве');
  assert.equal(query('year').get('sort_by'),(kind==='movie'?'primary_release_date':'first_air_date')+'.desc');
  assert.equal(query('last-year').get('sort_by'),'vote_average.desc');
  assert.equal(query('popular').get('sort_by'),'popularity.desc');assert.equal(query('popular').has('vote_count.gte'),false);
  assert.ok(by('uhd').cub.includes('sort=latest&uhd=true'));assert.ok(by('uhd').minimal_row_aliases[0].includes('sort_by=popularity.desc'));
  assert.equal(new Set(plan.map(row=>row.tmdb)).size,plan.length);
 }
});

test('preview deduplication keeps media identities, rank, full-feed URLs and native pagination without mutating cached data',()=>{
 const a={id:1,title:'A'},b={id:2,title:'B'},c={id:3,title:'C'},show={id:1,name:'Different series'};
 const rows=[{source:'tmdb',url:'discover/movie?sort_by=popularity.desc',results:[a,a,b],total_pages:50},{source:'tmdb',url:'discover/movie?sort_by=vote_average.desc',results:[b,c],total_pages:80},{source:'tmdb',url:'discover/tv?sort_by=popularity.desc',results:[show],total_pages:5}];
 const result=uniquePreviews(rows);assert.deepEqual(result.map(row=>row.results.map(card=>card.id)),[[1,2],[3],[1]]);
 assert.deepEqual(result.map(row=>row.total_pages),[50,80,5]);assert.deepEqual(result.map(row=>row.url),rows.map(row=>row.url));assert.equal(rows[1].results.length,2);
 assert.equal(uniquePreviews([{...rows[0],minimal_hidden:true},rows[1]])[1].results.length,2,'Hidden rows must not consume preview titles');
});

test('TMDB preview deduplication follows plan order despite out-of-order replies and hidden legacy aliases avoid requests',()=>{
 const pending=[],object={source:'tmdb',url:'movie'},L={Storage:{get:(k,d)=>d},Api:{sources:{tmdb:{get(url,params,ok){pending.push({url,ok});}}}}};
 let output;catalogue(L,{},object,[],rows=>output=rows);assert.equal(pending.length,3);
 const reply=index=>pending[index].ok({page:1,total_pages:12,results:[{id:1,title:'Shared'},{id:100+index,title:'Unique '+index}]});
 reply(2);reply(1);reply(0);for(let i=3;i<pending.length;i++)reply(i);
 assert.equal(output.length,10);assert.equal(output[0].results[0].id,1);assert.ok(output.slice(1).every(row=>row.results.every(card=>card.id!==1)));assert.equal(pending.length,10,'No extra requests to fill previews');
 const legacy=cataloguePlan('movie').find(row=>row.key==='uhd').minimal_row_aliases[0];pending.length=0;
 catalogue(L,{}, {source:'tmdb',url:'movie'},[legacy],rows=>output=rows);for(let i=0;i<pending.length;i++)reply(i);
 assert.equal(pending.length,9);assert.ok(output.some(row=>row.minimal_hidden && row.title==='С высоким рейтингом'));
 pending.length=0;catalogue(L,{}, {source:'tmdb',url:'movie'},['minimal:tmdb:movie:watch'],rows=>output=rows);for(let i=0;i<pending.length;i++)reply(i);
 assert.equal(pending.length,9);assert.ok(output.some(row=>row.minimal_hidden && row.minimal_row_id==='minimal:tmdb:movie:watch'),'Daily date windows must not change a saved row identity');
});


test('dorama and TV show feeds start with recent airings and keep stable identities for existing collections',()=>{
 const date=new Date(2026,9,30),dorama=cataloguePlan('dorama','standard',date),shows=cataloguePlan('tvshow','standard',date);
 for(const plan of [dorama,shows]){
  assert.equal(plan[0].key,'watch');assert.equal(plan[0].title,'Сейчас смотрят');const q=new URLSearchParams(plan[0].tmdb.split('?')[1]);
  assert.equal(q.get('air_date.gte'),'2026-10-23');assert.equal(q.get('air_date.lte'),'2026-10-30');assert.equal(new Set(plan.map(row=>row.tmdb)).size,plan.length);assert.ok(plan.every(row=>row.media_type==='tv'));
 }
 assert.equal(dorama[1].key,'dorama-0');assert.equal(dorama[1].title,'Популярное');assert.equal(dorama.length,11);assert.equal(shows.length,8);
 assert.ok(shows.every(row=>/with_genres=10764(?:\|10767)?&|with_genres=10767&/.test(row.tmdb)));
});
