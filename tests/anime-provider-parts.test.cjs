
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
function mod(name){const m={exports:{}};new Function('module','exports',esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text)(m,m.exports);return m.exports;}
const {providerPartPlan,matchProviderParts,mappedPartFiles,default:install}=mod('anime-provider-parts'),index=mod('anime-index');
const card={id:1429,source:'tmdb',name:'Атака титанов',original_name:'Shingeki no Kyojin',minimal_anime:true,seasons:[{season_number:0,episode_count:37},{season_number:1,episode_count:25},{season_number:2,episode_count:12},{season_number:3,episode_count:22},{season_number:4,episode_count:28}]};
const releases=[[16498,25,2013,'Shingeki no Kyojin'],[25777,12,2017,'Shingeki no Kyojin Season 2'],[35760,12,2018,'Shingeki no Kyojin Season 3'],[38524,10,2019,'Shingeki no Kyojin Season 3 Part 2'],[40028,16,2020,'Shingeki no Kyojin: The Final Season'],[48583,12,2022,'Shingeki no Kyojin: The Final Season Part 2'],[51535,2,2023,'Shingeki no Kyojin: The Final Season - Kanketsu-hen']];
const model={complete:true,rows:[{key:'story',results:releases.map(r=>({id:r[0]}))}],nodes:releases.map(([id,episodes,year,original])=>({id,episodes,year:String(year),original,name:original,kind:id===51535?'tv_special':'tv',aired:year+'-01-01',status:'released',record:index.animeRecords({source:'minimal_shiki',id})[0]}))};
const files=(season,count)=>Array.from({length:count},(_,i)=>({method:'call',season,episode:i+1,url:'http://lampac.example/lite/kodik/video?local='+(i+1)}));
test('native broadcast seasons join consecutive mapped cours and a TV finale without adding fake seasons',()=>{
 const third=providerPartPlan(card,model,files(3,12),3,[0,1,2,3,4]),fourth=providerPartPlan(card,model,files(4,16),4,[0,1,2,3,4]);
 assert.deepEqual(third.map(p=>[p.season,p.offset,p.count]),[[3,0,12],[3,12,10]]);
 assert.deepEqual(fourth.map(p=>[p.season,p.offset,p.count]),[[4,0,16],[4,16,12],[4,28,2]]);
 assert.deepEqual(providerPartPlan(card,model,files(4,28),4,[0,1,2,3,4]),[],'A complete list stays intact');
 assert.equal(providerPartPlan(card,model,files(4,12),4,[0,1,2,3,4]).length,3,'Discovery still requires video identity before committing');
 const gap={...model,nodes:model.nodes.map(n=>n.id===48583?{...n,record:{...n.record,offset:17}}:n)};
 assert.deepEqual(providerPartPlan(card,gap,files(4,16),4,[1,2,3,4]),[]);
 const future={...model,nodes:model.nodes.map(n=>n.id===51535?{...n,status:'anons'}:n)};
 assert.equal(providerPartPlan(card,future,files(4,16),4,[1,2,3,4]).length,2);
 const part=fourth[1],video={method:'call',season:1,episode:1,url:'http://lampac.example/lite/kodik/video?actual=1',stream:'unchanged-stream'};
 const mapped=mappedPartFiles(part,[video])[0];assert.equal(mapped.episode,17);assert.equal(mapped.season,4);assert.equal(mapped.url,video.url);assert.equal(mapped.stream,video.stream);
 assert.equal(mappedPartFiles(part,[{...video,episode:2}])[0].episode,18,'A missing first file does not renumber the remaining dub');
 assert.deepEqual(mappedPartFiles(part,[{...video,episode:2},{...video,episode:2}]),[]);
 assert.deepEqual(mappedPartFiles(part,[{...video,episode:13}]),[]);
});
test('release search uses year and unambiguous identity and rejects recaps and foreign hosts',()=>{
 const plan=providerPartPlan(card,model,files(4,16),4,[1,2,3,4]).slice(1),base='http://lampac.example/lite/kodik?s=4';
 const rows=plan.map((p,i)=>({method:'link',similar:true,title:'Атака титанов [ТВ-4, часть '+(i+2)+'] / Shingeki no Kyojin: The Final Season ('+p.year+')',year:p.year,url:'http://lampac.example/lite/kodik?pick=part'+i}));
 assert.equal(matchProviderParts(plan,rows,base).length,2);
 assert.equal(matchProviderParts(plan,[{...rows[0],url:'http://foreign.example/lite/kodik?pick=x'}],base).length,0);
 assert.equal(matchProviderParts(plan,[{...rows[0],title:rows[0].title+' Recap'}],base).length,0);
 assert.equal(matchProviderParts(plan,[rows[0],{...rows[0],url:'http://lampac.example/lite/kodik?pick=ambiguous'}],base).length,0);
});
test('joining actual Lampac HTML keeps the selected dub, video links and canonical episode hashes',async()=>{
 const dom=new JSDOM(),previous=global.document,previousLocation=global.location;global.document=dom.window.document;global.location={href:'http://lampac.example/'};
 const online=mod('online-state'),routes=new Map(),called=[];
 const html=(season,count,prefix,voice='AniDUB')=>'<div class="videos__line">'+files(season,count).map((file,i)=>'<div class="videos__item videos__movie" s="'+season+'" e="'+(i+1)+'" data-json=\''+JSON.stringify({...file,url:'http://lampac.example/lite/kodik/video?part='+prefix+'&local='+(i+1),season:undefined,episode:undefined})+'\'>Серия '+(i+1)+'</div>').join('')+'</div><div class="videos__button active" data-json=\'{"method":"link","url":"http://lampac.example/lite/kodik?voice='+voice+'"}\'>'+voice+'</div>';
 const plan=providerPartPlan(card,model,files(4,16),4,[1,2,3,4]);
 const search=plan.map((p,i)=>'<div class="videos__item similar" data-json=\''+JSON.stringify({method:'link',similar:true,title:p.original,year:p.year,url:'http://lampac.example/lite/kodik?pick=p'+i})+'\'></div>').join('');
 routes.set('p0',html(1,16,'first'));routes.set('p1',html(1,12,'second'));routes.set('p2',html(1,2,'final'));
 function Request(){this.timeout=()=>{};this.native=(url,ok)=>{called.push(url);setTimeout(()=>ok(new URL(url).searchParams.has('pick')?routes.get(new URL(url).searchParams.get('pick')):search),0);};}
 try{
  const api=install({Reguest:Request,Storage:{get:(k,d)=>d}},{canonical:(c,done)=>done(card),collection:(c,done)=>done(model)},online),base='http://lampac.example/lite/kodik?imdb_id=tt2560140&s=4';
  const result=await new Promise(resolve=>api(card,base,html(4,16,'first'),4,[0,1,2,3,4],(body,parts)=>resolve({body,parts})));
  const joined=online.catalogueRows(result.body).filter(r=>r.method==='call');assert.equal(joined.length,30);assert.deepEqual(joined.map(r=>r.episode),Array.from({length:30},(_,i)=>i+1));assert.ok(joined.every(r=>r.season===4));assert.match(joined[16].url,/part=second&local=1$/);assert.match(joined[28].url,/part=final&local=1$/);assert.equal(result.parts.length,3);assert.ok(called.every(url=>!url.includes('/video')));
  const tail=await new Promise(resolve=>api(card,base,html(4,2,'final'),4,[1,2,3,4],(body,parts)=>resolve({body,parts})));
  assert.equal(online.catalogueRows(tail.body).filter(r=>r.method==='call').length,30);
  routes.set('p1',html(1,12,'different-dub','Another voice'));
  const isolated=install({Reguest:Request,Storage:{get:(k,d)=>d}},{canonical:(c,done)=>done(card),collection:(c,done)=>done(model)},online);
  const rejected=await new Promise(resolve=>isolated(card,base,html(4,16,'first'),4,[1,2,3,4],body=>resolve(online.catalogueRows(body).length)));
  assert.equal(rejected,18,'Keep the same dub and its actual finale files without filling the missing middle part');
 }finally{global.document=previous;global.location=previousLocation;dom.window.close();}
});


test('a missing native season is recovered only after the first and last releases verify its numbering',async()=>{
 const dom=new JSDOM(),previous=global.document,previousLocation=global.location;global.document=dom.window.document;global.location={href:'http://lampac.example/'};
 const online=mod('online-state'),base='http://lampac.example/lite/kodik?title=Kimetsu',releaseIds=[38000,47778,51019,55701],names=['Kimetsu no Yaiba','Kimetsu no Yaiba: Yuukaku-hen','Kimetsu no Yaiba: Katanakaji no Sato-hen','Kimetsu no Yaiba: Hashira Geiko-hen'];
 const c={id:85937,name:'Истребитель демонов',original_name:'Kimetsu no Yaiba',minimal_anime:true,seasons:[26,7,11,11,8].map((episode_count,i)=>({season_number:i+1,episode_count}))},m={complete:true,rows:[{key:'story',results:releaseIds.map(id=>({id}))}],nodes:releaseIds.map((id,i)=>({id,name:names[i],original:names[i],year:String(2019+i),aired:(2019+i)+'-01-01',episodes:[26,11,11,8][i],kind:'tv',status:'released',record:index.animeRecords({source:'minimal_shiki',id})[0]}))};
 const folder=(number,url)=>'<div class="videos__item videos__season" data-json=\''+JSON.stringify({method:'link',title:number+' сезон',url})+'\'>'+number+' сезон</div>',root=[1,2,4].map(n=>folder(n,base+'&s='+n)).join('');
 const payload=(number,count)=>files(number,count).map(row=>'<div class="videos__item" s="'+number+'" e="'+row.episode+'" data-json=\''+JSON.stringify(row)+'\'></div>').join('');
 let wrong=false;function Request(){this.timeout=()=>{};this.native=(url,ok)=>setTimeout(()=>{const u=new URL(url);if(u.searchParams.get('pick'))return ok(folder(1,base+'&pick=sword&s=1'));if(u.searchParams.has('s'))return ok(payload(Number(u.searchParams.get('s')),u.searchParams.get('s')==='1'?(wrong?25:26):8));ok('<div class="videos__item similar" data-json=\''+JSON.stringify({similar:true,method:'link',title:names[2],year:m.nodes[2].year,url:base+'&pick=sword'})+'\'></div>');},0);}
 try{const make=()=>install({Reguest:Request,Storage:{get:(k,d)=>d}},{canonical:(card,done)=>done(c),collection:(card,done)=>done(m)},online),api=make();const filled=await new Promise(done=>api.folders(c,base,root,done));assert.equal(online.folderRows(filled).length,4);const restored=online.folderRows(filled).find(r=>r.season===3);assert.ok(restored);assert.equal(online.catalogueRows(api.rewrite(restored.url,payload(1,11)))[0].season,3);wrong=true;const bad=make();assert.equal(await new Promise(done=>bad.folders(c,base,root,done)),root);
 }finally{global.document=previous;global.location=previousLocation;dom.window.close();}
});


test('a confirmed future schedule remains visible while missing aired files and another part do not',()=>{
 const {availableMetadata}=mod('episode-metadata'),rows=[{season_number:1,episode_number:1,air_date:'2020-01-01'},{season_number:1,episode_number:2,air_date:'2020-01-08'},{season_number:1,episode_number:3,air_date:'2099-01-01'},{season_number:2,episode_number:4,air_date:'2099-01-01'},{season_number:1,episode_number:5,air_date:'invalid'}];
 assert.deepEqual(availableMetadata(rows,[1],1).map(r=>r.episode_number),[1,3]);
 assert.deepEqual(availableMetadata(rows,[1],1,false).map(r=>r.episode_number),[1]);
});

test('a partial first dub discovers exact later releases only after video identity matches',async()=>{
 const dom=new JSDOM(),previous=global.document,previousLocation=global.location;global.document=dom.window.document;global.location={href:'http://lampac.example/'};
 const online=mod('online-state'),base='http://lampac.example/lite/kodik',card={id:777,name:'Series',original_name:'Series',minimal_anime:true,seasons:[{season_number:1,episode_count:2}]};
 const nodes=[{id:1001,name:'Series',original:'Series',year:'2020',aired:'2020-01-01',episodes:5,kind:'tv',status:'released',record:{tv:777,season:1,offset:0}},{id:1002,name:'Series 2',original:'Series 2nd Season',year:'2021',aired:'2021-01-01',episodes:3,kind:'tv',status:'released',record:{tv:777,season:2,offset:0}}],model={complete:true,nodes,edges:[],rows:[{key:'story',results:nodes.map(n=>({id:n.id}))}]};
 const tag=(row,cls='videos__item')=>'<div class="'+cls+'" data-json=\''+JSON.stringify(row)+'\'></div>',folder=n=>tag({method:'link',name:n+' сезон',url:base+'?pick='+n+'&s='+n},'videos__item videos__season');
 let wrong=false,active=0,max=0;const requested=[];
 const files=foreign=>[1,3].map(episode=>tag({method:'call',season:1,episode,url:base+'/video?link='+(foreign?'foreign':'real')+episode})).join('')+tag({method:'link',url:base+'?s=1&t=1'},'videos__button active').replace('></div>','>AniDUB</div>');
 function Request(){this.timeout=()=>{};this.native=(url,ok)=>{requested.push(url);active++;max=Math.max(max,active);setTimeout(()=>{active--;const u=new URL(url);if(u.searchParams.has('s'))return ok(files(wrong && u.searchParams.has('pick')));if(u.searchParams.has('pick'))return ok(folder(Number(u.searchParams.get('pick'))));ok(nodes.map((n,i)=>tag({method:'link',similar:true,title:n.original,year:n.year,url:base+'?pick='+(i+1)},'videos__item similar')).join(''));},0);};}
 try{const make=()=>install({Reguest:Request,Storage:{get:(k,d)=>d}},{canonical:(c,done)=>done(card),collection:(c,done)=>done(model)},online),root=folder(1).replace('?pick=1&s=1','?s=1');
 const result=await new Promise(done=>make().folders(card,base,root,(body,layout)=>done({body,layout})));assert.equal(online.folderRows(result.body).length,2);assert.equal(result.layout[2].mal,1002);assert.ok(max<=2);assert.ok(requested.every(url=>!url.includes('/video')));
 wrong=true;assert.equal(await new Promise(done=>make().folders(card,base,root,done)),root,'Different files cannot establish a release identity');
 }finally{global.document=previous;global.location=previousLocation;dom.window.close();}
});
