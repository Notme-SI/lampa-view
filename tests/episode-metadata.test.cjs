const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),vm=require('node:vm');
const source=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/episode-metadata.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text;
function fixture(){const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,setTimeout});return module.exports;}
const card={id:96677,number_of_seasons:3,number_of_episodes:25,networks:[{id:213}],seasons:[{season_number:1,name:'Сезон 1'},{season_number:2,name:'Часть 3'},{season_number:3,name:'Часть 4'}]};
const groups=[5,5,7,8].map((count,i)=>({order:i+1,episodes:Array.from({length:count},(_,j)=>({order:j,season_number:i<2?1:i,episode_number:i===1?j+6:j+1}))}));
test('Netflix parts map through explicit episode groups without changing source season or timeline coordinates',async()=>{
 const api=fixture(),requests=[];let active=0,max=0;
 const L={Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){requests.push(url);active++;max=Math.max(max,active);setTimeout(()=>{active--;if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25,network:{id:213}},{id:'other',group_count:4,episode_count:25}]});if(url.includes('episode_group/'))return ok({groups});const season=Number(url.match(/season\/(\d+)/)[1]);ok({episodes:Array.from({length:[0,10,7,8][season]},(_,i)=>({episode_number:i+1,season_number:season,name:'Canonical '+season+':'+(i+1),overview:'Description',still_path:'/s'+season+'e'+(i+1)+'.jpg'}))});},0);}}}}};
 const service=api.default(L),read=(season,count)=>new Promise(resolve=>assert.equal(service.book(card,season,[1,2,3,4],count,(book,grouped)=>resolve({book,grouped})),true));
 const results=await Promise.all([read(1,5),read(2,5),read(3,7),read(4,8)]);
 assert.deepEqual(results.map(r=>Object.keys(r.book).length),[5,5,7,8]);assert.equal(results[1].book[1].name,'Canonical 1:6');assert.equal(results[2].book[1].name,'Canonical 2:1');assert.equal(results[3].book[1].name,'Canonical 3:1');assert.ok(results.every(r=>r.grouped));assert.ok(max<=2);assert.equal(requests.length,5);assert.equal(card.number_of_seasons,3);
 const saved=requests.length;await read(4,8);assert.equal(requests.length,saved);assert.equal((await read(3,8)).book,null,'A conflicting provider count cannot receive another episode group');
 assert.equal(service.book(card,3,[1,2,3],8,()=>assert.fail()),false,'Native three-season providers keep their own coordinates');assert.equal(api.namedSeason(card,3),'Часть 4');assert.equal(api.namedPartCount(card),4);
});
test('ambiguous or incomplete episode groups leave provider metadata intact',async()=>{
 const api=fixture();let count=0;const service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){count++;ok({results:[{id:'a',group_count:4,episode_count:25},{id:'b',group_count:4,episode_count:25}]});}}}}});let answer;
 service.book(card,4,[1,2,3,4],8,book=>answer=book);assert.equal(answer,null);assert.equal(count,1);assert.equal(api.alternativeNumbering(card,[1,3,4]),false);assert.equal(api.namedSeason(card,1),'');
});


test('metadata transport failures retry once, share pending readers and never poison the cache',async()=>{
 const api=fixture(),calls={};let active=0,max=0;
 const service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok,fail){
  calls[url]=(calls[url]||0)+1;active++;max=Math.max(max,active);setTimeout(()=>{active--;
   if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25,network:{id:213}}]});
   if(url.includes('episode_group/'))return ok({groups});
   if(calls[url]===1)return fail();
   ok({episodes:Array.from({length:10},(_,i)=>({episode_number:i+1,season_number:1,overview:'Описание '+(i+1)}))});
  },5);
 }}}}});
 const read=()=>new Promise(resolve=>service.book(card,2,[1,2,3,4],5,resolve));
 const result=await Promise.all([read(),read(),read()]);
 assert.ok(result.every(book=>book[1].overview==='Описание 6'));
 assert.equal(Object.values(calls).reduce((a,b)=>a+b,0),4,'three readers share the original request and one retry');assert.ok(max<=2);
 await read();assert.equal(Object.values(calls).reduce((a,b)=>a+b,0),4,'successful retry is cached');
});

test('malformed responses stop after one retry and can recover on a later visit',async()=>{
 const api=fixture();let calls=0,broken=true;
 const service=api.default({Storage:{get:()=> 'ru'},Api:{sources:{tmdb:{get(url,p,ok){calls++;
  if(broken)return ok({error:'temporary'});
  if(url.includes('episode_groups'))return ok({results:[{id:'parts',group_count:4,episode_count:25}]});
  if(url.includes('episode_group/'))return ok({groups});
  ok({episodes:Array.from({length:10},(_,i)=>({episode_number:i+1,season_number:1,overview:'Описание'}))});
 }}}}});
 const read=()=>new Promise(resolve=>service.book(card,2,[1,2,3,4],5,resolve));
 assert.equal(await read(),null);assert.equal(calls,2,'no endless polling');
 broken=false;assert.equal((await read())[1].overview,'Описание');assert.equal(calls,5,'a later visit does not reuse the failed result');
});
