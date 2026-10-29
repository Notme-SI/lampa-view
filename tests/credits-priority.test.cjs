const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,mod={exports:{}};new Function('module','exports','window',code)(mod,mod.exports,{});
test('lead billing precedes popular cameos, popularity ranks supporting actors and directors while excluding minor credits',()=>{
 const cast=Array.from({length:40},(_,i)=>({id:i+1,name:'Actor '+i,order:i,profile_path:'/person.jpg',character:'Role '+i,popularity:i===35?999:i===15?50:1})).reverse();
 const crew=Array.from({length:10},(_,i)=>({id:i+100,name:'Director '+i,profile_path:'/person.jpg',job:'Director',popularity:i===9?100:1,episode_count:i}));crew.unshift({...crew[8],episode_count:0});
 const data={persons:{cast,crew}};mod.exports.prepareDetail(data);
 const people=data.persons.cast,directors=people.filter(p=>p.minimal_director),actors=people.filter(p=>!p.minimal_director);
 assert.equal(directors.length,3);assert.equal(actors.length,13);assert.equal(directors[0].id,109);assert.equal(directors[1].id,108,'Duplicate basic director credit lost aggregate episode count');
 assert.deepEqual(actors.slice(0,6).map(p=>p.id),[1,2,3,4,5,6]);assert.ok(actors.some(p=>p.id===16));assert.ok(!actors.some(p=>p.id===36),'Famous cameo displaced the principal cast');assert.equal(cast[0].id,40,'Input order was mutated');
});
