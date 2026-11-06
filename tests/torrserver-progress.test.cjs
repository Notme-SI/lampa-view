const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
test('server checkpoints survive restart, map next episode and reject stale/profile responses',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;
 try{const state={},events={},records={},requests=[];let scope='p1';
 const L={Storage:{get:(k,v)=>state[k]??v,set:(k,v)=>state[k]=v,field:()=>true},Torserver:{url:()=> 'http://server:8090'},Timeline:{filename:()=>scope,view:h=>records[h]||{},update:r=>records[r.hash]=r},Player:{listener:{follow:(n,f)=>events[n]=f}},Reguest:function(){this.timeout=()=>{};this.clear=()=>{};this.silent=(url,ok,fail,body)=>requests.push({url,ok,body});}};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/torrserver-progress.js')],bundle:true,write:false,format:'iife',globalName:'Mod'}).outputFiles[0].text);
 let api=w.Mod.default(L,()=>true);const make=n=>({torrent_hash:'abc',url:'http://server:8090/stream?link=abc&index='+n,card:{id:1,name:'Series',source:'tmdb'},season:1,episode:n,timeline:{hash:'ep'+n,duration:3000}});
 events.create({data:{...make(7),playlist:[make(7),make(8)]}});api.stop();api=w.Mod.default(L,()=>true);api.refresh();assert.equal(requests.length,1);assert.equal(JSON.parse(requests[0].body).hash,'abc');requests[0].ok([{file_index:8,timecode:1500},{file_index:7,timecode:2900}]);assert.equal(records.ep8.episode,8);assert.equal(records.ep8.time,1500);assert.equal(records.ep8.percent,50);api.stop();
 api=w.Mod.default(L,()=>true);api.refresh();requests.at(-1).ok([{file_index:8,timecode:100}]);assert.equal(records.ep8.time,1500);api.stop();
 api=w.Mod.default(L,()=>true);api.refresh();scope='p2';requests.at(-1).ok([{file_index:8,timecode:1800}]);assert.equal(records.ep8.time,1500);api.stop();
 }finally{w.close();}
});
