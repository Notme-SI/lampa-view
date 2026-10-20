const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
function bundle(w,name,global){w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'iife',globalName:global}).outputFiles[0].text);}
test('CUB logos resolve a verified TMDB match instead of using a foreign catalogue ID',()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;bundle(w,'logos','Logos');const requests=[];
 const L={Storage:{get:()=> 'ru'},TMDB:{},Api:{sources:{tmdb:{get:(url,p,ok)=>requests.push({url,ok})}}}};const load=w.Logos.default(L);let result;
 load({id:999,source:'cub',name:'Кэрри',original_name:'Carrie',first_air_date:'2026-10-07',poster_path:'/poster.jpg'},value=>result=value);
 assert.ok(requests[0].url.startsWith('search/tv?query=Carrie'));requests[0].ok({results:[{id:288673,name:'Кэрри',original_name:'Carrie',first_air_date:'2026-10-07',poster_path:'/poster.jpg'},{id:1,name:'Кэрри',first_air_date:'1976-01-01'}]});
 assert.ok(requests[1].url.startsWith('tv/288673?append_to_response=images'));requests[1].ok({images:{logos:[{file_path:'/ru.png',iso_639_1:'ru'},{file_path:'/ru.svg',iso_639_1:'ru',width:5000,vote_count:100}]}});assert.equal(result,'/ru.png');dom.window.close();
});
test('neighbour covers and logos are decoded once and reused when selected',async()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,images=[];w.Image=class{constructor(){images.push(this);}set src(v){this.url=v;}get src(){return this.url;}decode(){return Promise.resolve();}};
 bundle(w,'hero-assets','Assets');let logoRequests=0;const cards=Array.from({length:8},(_,i)=>({id:i,title:'Film '+i,backdrop_path:'/cover'+i+'.jpg'}));const assets=w.Assets.default({TMDB:{image:p=>'https://images.test'+p}},cards,(c,ok)=>{logoRequests++;ok('/logo'+c.id+'.png');});
 assets.warm(0);assert.equal(images.length,0,'Neighbours must not compete with visible covers');
 await new Promise(resolve=>setTimeout(resolve,1250));assert.equal(images.filter(i=>i.url.includes('w780')).length,2);assert.equal(logoRequests,2);
 let url;assets.cover(1,'w780',v=>url=v);const selected=images.find(i=>i.url.includes('w780/cover1.jpg'));selected.onload();await new Promise(resolve=>setTimeout(resolve,0));assert.ok(url.endsWith('/cover1.jpg'));const count=images.length;assets.cover(1,'w780',v=>url=v);assert.equal(images.length,count);assert.equal(images.filter(i=>i.url.includes('/original/cover')).length,0,'prefetch must not download original-size backdrops');assets.dispose();dom.window.close();
});
test('rating sorting uses a vote threshold, with an explicit opt-out',()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;bundle(w,'filters','Filters');assert.ok(w.Filters.discoverUrl({kind:'movie',sort:'vote_average.desc',score:'8'}).includes('vote_count.gte=500'));assert.ok(!w.Filters.discoverUrl({kind:'movie',sort:'vote_average.desc',votes:'0'}).includes('vote_count.gte'));assert.equal(w.Filters.minimumVotes({kind:'tv',sort:'vote_average.desc'}),200);dom.window.close();
});

test('choosing or cancelling an ambiguous anime match does not reenter Select.close',()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;bundle(w,'shikimori','Shiki');let select,failures=0,opened=0,hidden=0;
 const L={Activity:{backward(){}},Api:{sources:{tmdb:{get:(p,params,ok)=>ok({results:[{id:1,title:'Example',release_date:'2001-01-01'},{id:2,title:'Example',release_date:'2010-01-01'}]}),full:()=>opened++}}},Select:{show:o=>select=o,hide:()=>hidden++,close:()=>{throw Error('close invokes onBack recursively');}},Noty:{show(){}}};
 w.Shiki.default(L);const params={card:{id:1,title:'Example',original_title:'Example',media_type:'movie'}};
 L.Api.sources.minimal_shiki.full(params,()=>{},()=>failures++);select.onSelect(select.items[0]);assert.equal(opened,1);assert.equal(failures,0);
 L.Api.sources.minimal_shiki.full({...params,card:{...params.card,id:2}},()=>{},()=>failures++);select.onBack();assert.equal(failures,1);assert.equal(hidden,2);dom.window.close();
});
