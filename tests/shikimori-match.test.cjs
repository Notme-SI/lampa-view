const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/shikimori-match.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,moduleBox={exports:{}};new Function('module','exports',code)(moduleBox,moduleBox.exports);const resolver=moduleBox.exports.default;
test('unmapped sequels fall back to Russian and confirm the shared series without mixing release and TMDB IDs',()=>{
 for(const [id,original,title,tmdb] of [[90064534,'Koori no Jouheki 2nd Season','Ледяная стена 2',283428],[90061987,'Kusuriya no Hitorigoto 3rd Season','Монолог фармацевта 3',220542]]){
  let menu,opened;const queries=[],L={Select:{show:o=>menu=o,hide(){}},Api:{sources:{tmdb:{get(p,args,ok){const q=new URLSearchParams(p.split('?')[1]).get('query');queries.push(q);ok({results:q===title?[{id:tmdb,name:moduleBox.exports.seriesName(title),genre_ids:[16],first_air_date:'2023-01-01'}]:[]});},full(p,ok){opened=p;ok({movie:p.card});}}}}},full=resolver(L,()=>assert.fail('Russian hit should not fetch more metadata')),params={card:{id,shikimori_id:id,source:'minimal_shiki',name:title,original_name:original,media_type:'tv'}};
  full(params,()=>{},()=>assert.fail('unexpected failure'));assert.deepEqual(queries,[original,title]);assert.equal(opened,undefined);assert.match(menu.title,/общую карточку/);assert.match(menu.items[0].subtitle,/общего сезона/);menu.onSelect(menu.items[0]);assert.equal(opened.id,tmdb);assert.equal(opened.card.id,tmdb);assert.equal(opened.source,'tmdb');assert.equal(opened.method,'tv');assert.equal(params.card.id,id);full(params,()=>{},()=>{});assert.equal(queries.length,2,'confirmed mapping is cached');
 }
});
test('alternate metadata names and seasonless titles resolve, while unresolved and offline searches offer recovery',()=>{
 let menu,opened,queryCount=0,back=0,failed=0,input;const L={Select:{show:o=>menu=o,hide(){}},Input:{edit:(o,cb)=>input=cb},Activity:{backward:()=>back++},Api:{sources:{tmdb:{get(p,args,ok){queryCount++;const q=new URLSearchParams(p.split('?')[1]).get('query');ok({results:q==='English Series'?[{id:41,name:'Series',genre_ids:[16]}]:[]});},full:p=>opened=p}}}};
 const full=resolver(L,(id,ok)=>ok({english:['English Series Season 3']}));full({card:{id:90000001,name:'Пример 3',original_name:'Example 3rd Season',media_type:'tv'}},()=>{},()=>{});assert.ok(queryCount<=8);assert.equal(menu.items[0].card.id,41);menu.onSelect(menu.items[0]);assert.equal(opened.id,41);
 const missing=resolver(L,(id,ok)=>ok({}));missing({card:{id:90000002,name:'Нет карточки',original_name:'Missing',media_type:'tv'}},()=>{},()=>failed++);assert.equal(menu.items[0].id,'search');menu.onSelect(menu.items[0]);input('English Series');assert.equal(opened.id,41);
 L.Api.sources.tmdb.get=(p,args,ok,fail)=>fail();queryCount=0;const offline=resolver(L,()=>assert.fail('two transport errors should stop further requests'));offline({card:{id:90000003,name:'Русское',original_name:'English',media_type:'tv'}},()=>{},()=>failed++);assert.match(menu.title,/выполнить поиск/);menu.onBack();assert.equal(back,1);assert.equal(failed,1);
});

test('KinoAPI exact IDs resolve directly; mismatched identity falls back to native search',()=>{
 for(const valid of [true,false]){
  let opened,searches=0;const m={exports:{}};new Function('module','exports','window',code)(m,m.exports,{LampaView:{kinoapi:{enabled:()=>true,title:(c,done)=>done({id:{shikimori:valid?90044511:99,tmdb:114410},type:'tv'})}}});
  const L={Api:{sources:{tmdb:{full:p=>opened=p,get:(p,args,ok)=>{searches++;ok({results:[{id:77,name:'Fixture anime',genre_ids:[16]}]});}}}},Select:{hide(){}}};m.exports.default(L,()=>{})({card:{id:90044511,shikimori_id:90044511,source:'minimal_shiki',name:'Fixture anime',media_type:'tv'}},()=>{},()=>{});assert.equal(opened.id,valid?114410:77);assert.equal(searches,valid?0:1);
 }
});

test('a single same-franchise search hit with a different title never opens automatically',()=>{
 let menu,opened;
 const L={Select:{show:o=>menu=o,hide(){}},Api:{sources:{tmdb:{get(p,args,ok){ok({results:[{id:195675,name:'Снег Хисуи',original_name:'Pokémon: Hisuian Snow',first_air_date:'2022-05-18',genre_ids:[16]}]});},full:p=>opened=p}}}};
 resolver(L,(id,ok)=>ok({}))({card:{id:90053874,name:'Покемон: Стремление стать мастером покемонов',original_name:'Pokemon: Mezase Pokemon Master',first_air_date:'2023-01-13',media_type:'tv',source:'minimal_shiki'}},()=>{},()=>{});
 assert.equal(opened,undefined);assert.ok(menu,'An ambiguous hit remains an explicit user choice');
});
