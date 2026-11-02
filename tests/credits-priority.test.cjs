const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,mod={exports:{}};new Function('module','exports','window',code)(mod,mod.exports,{});
test('native credit order wins over popularity and episode counts without mutating source arrays',()=>{
 const cast=Array.from({length:40},(_,i)=>({id:i+1,name:'Actor '+i,order:i,profile_path:'/person.jpg',character:'Role '+i,popularity:i===35?999:i===15?50:1})).reverse();
 const crew=Array.from({length:10},(_,i)=>({id:i+100,name:'Director '+i,profile_path:'/person.jpg',job:'Director',popularity:i===9?100:1,episode_count:i}));crew.unshift({...crew[8],episode_count:0});
 const data={persons:{cast,crew}};mod.exports.prepareDetail(data);
 const people=data.persons.cast,directors=people.filter(p=>p.minimal_director),actors=people.filter(p=>!p.minimal_director);
 assert.equal(directors.length,3);assert.equal(actors.length,20);assert.deepEqual(directors.map(p=>p.id),[108,100,101]);assert.equal(directors[0].episode_count,8,'Duplicate credits retain aggregate facts without moving the person');
 assert.deepEqual(actors.map(p=>p.id),cast.slice(0,20).map(p=>p.id),'Do not replace the source billing with a popularity ranking');assert.equal(cast[0].id,40,'Input order was mutated');
});
