const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
fs.copyFileSync(path.join(__dirname,'../src/identity.cjs'),path.join(__dirname,'../desktop/lampaIdentity.cjs'));
const B=require('../desktop/lampaBridge.cjs');
const context={version:1,source:'lampa',entries:[{url:'http://localhost:8090/stream?link=abcdef&index=1&play',identity:{title:'Дандадан',original_title:'Dandadan',kind:'tv',tmdb_id:240411,year:2024,season:1,episode:4,anime:true}}]};
test('context reaches only the matching MPV launch in the same renderer',()=>{
  assert.ok(B.accept(1,context,1000));
  const args=[context.entries[0].url];
  assert.ok(B.environment(1,'C:\\Player\\mpv.exe',args,1500).MPV_PLUS_LAMPA_CONTEXT);
  const received=JSON.parse(B.environment(1,'C:\\Player\\mpv.exe',args,1500).MPV_PLUS_LAMPA_CONTEXT).entries[0].identity;
  assert.equal(received.kind,'tv');assert.equal(received.episode,4);assert.equal(received.season,1);assert.equal(received.year,2024);
  assert.deepEqual(B.environment(2,'C:\\Player\\mpv.exe',args,1500),{});
  assert.deepEqual(B.environment(1,'C:\\Player\\vlc.exe',args,1500),{});
  assert.deepEqual(B.environment(1,'C:\\Player\\mpv.exe',['http://different/stream'],1500),{});
});
test('expired launch context is ignored',()=>assert.deepEqual(B.environment(1,'mpv+.exe',[context.entries[0].url],122000),{}));
test('mpv fallback receives URL encoded exactly as by native Lampa',()=>{
  const ctx={...context,entries:[{...context.entries[0],url:'http://host/video/%D0%90.mkv'}]};
  B.accept(4,ctx,1000);assert.ok(B.environment(4,'mpv+.exe',[encodeURI(ctx.entries[0].url)],1001).MPV_PLUS_LAMPA_CONTEXT);
});
test('malformed and oversized payloads do not cross the process boundary',()=>{
  assert.equal(B.accept(1,{...context,version:2}),false);
  assert.equal(B.accept(1,{...context,entries:[{url:'file:///bad',identity:{title:'x'}}]}),false);
  assert.equal(B.accept(1,{...context,entries:[{url:'http://host',identity:{title:'x'.repeat(30000)}}]}),false);
});
