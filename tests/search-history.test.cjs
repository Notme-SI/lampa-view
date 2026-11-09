const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const m={exports:{}};new Function('module','exports',esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/search-history.js')],bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text)(m,m.exports);
function fixture(store=new Map()){let profile='one',removed=[],cleaned=[];const storage={get:(k,d)=>store.has(k)?store.get(k):d,set:(k,v)=>store.set(k,v),remove:(k,v)=>removed.push([k,v]),clean:k=>cleaned.push(k)},L={Storage:storage,Timeline:{filename:()=>profile}};const api=m.exports.default(L);return {store,storage,api,removed,cleaned,profile:v=>profile=v};}
test('explicit search deletion survives reload and a late CUB merge, isolated from watches and profiles',()=>{
 const f=fixture();f.storage.set('search_history',['A','B']);f.storage.set('file_view',{watch:90});f.storage.remove('search_history','A');assert.deepEqual(f.removed,[['search_history','A']]);assert.deepEqual(f.storage.get('search_history'),['B']);
 const reload=fixture(f.store);reload.storage.set('search_history',['A','B','C'],true);assert.deepEqual(reload.storage.get('search_history'),['B','C']);assert.deepEqual(reload.storage.get('file_view'),{watch:90});reload.profile('two');assert.deepEqual(reload.storage.get('search_history'),['B','C'],'Filtered local cache has no artificial restored queries');reload.storage.set('search_history',['A','D'],true);assert.deepEqual(reload.storage.get('search_history'),['A','D']);
 reload.profile('one');reload.api.allow('A');reload.storage.set('search_history',['A','B']);assert.deepEqual(reload.storage.get('search_history'),['A','B'],'A deliberate new search can add the deleted query again');
});
test('clear affects only search history and uses its native synchronization clean operation',()=>{
 const f=fixture();f.storage.set('search_history',['A','B']);f.storage.set('favorite',{history:[1]});f.storage.set('file_view',{id:50});f.api.clear();assert.deepEqual(f.cleaned,['search_history']);assert.deepEqual(f.storage.get('search_history'),[]);f.storage.set('search_history',['A','B','C'],true);assert.deepEqual(f.storage.get('search_history'),['C']);assert.deepEqual(f.storage.get('favorite'),{history:[1]});assert.deepEqual(f.storage.get('file_view'),{id:50});
});
test('clearing over an open search does not re-add the unchanged input after synchronization',()=>{
 const f=fixture();f.storage.set('search_history',['A','B']);const before=global.document;
 try{global.document={querySelector:()=>({textContent:'A'}),body:{classList:{contains:()=>true}}};f.api.clear();f.storage.set('search_history',['A','B'],true);assert.deepEqual(f.storage.get('search_history'),[]);}
 finally{if(before===undefined)delete global.document;else global.document=before;}
});
