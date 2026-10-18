const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
test('real native Lampa launches mpv once through unmodified Desktop APIs and keeps Android untouched',async()=>{
 const launches=[];
 const f=await native({prepare(w,L){
   L.Platform.desktop=()=>true;
   L.Platform.is=name=>false;
   L.Storage.set('player','other');L.Storage.set('player_nw_path','C:\\Players\\mpv.exe');
   w.require=name=>name==='fs'?{existsSync:()=>true}:{spawn:(...args)=>{launches.push(args);return {on(){}};}};
 }});
 try{
   const video={url:'https://host/Breaking.Bad.S03E02.mkv',title:'Breaking Bad S03E02',season:3,episode:2,
     card:{id:1396,name:'Во все тяжкие',original_name:'Breaking Bad',first_air_date:'2008-01-20',source:'tmdb'}};
   f.L.Player.play(video);await new Promise(r=>setTimeout(r,20));
   assert.equal(launches.length,1);const [exe,args,opts]=launches[0];assert.equal(exe,'C:\\Players\\mpv.exe');assert.equal(opts,undefined);
   assert.equal(args[1],video.url);const ctx=JSON.parse(Buffer.from(args[0].split('=')[2],'hex').toString('utf8'));
   assert.equal(ctx.entries[0].identity.tmdb_id,1396);assert.equal(ctx.entries[0].identity.season,3);assert.equal(ctx.entries[0].identity.episode,2);
   assert.equal(f.w.electronAPI,undefined,'No patched Desktop API is present');
   assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
