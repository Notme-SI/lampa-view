const test=require('node:test'),assert=require('node:assert/strict');
const update=require('../desktop/plugin-settings.cjs');
test('legacy plugin status is disabled before its cached script can load and rollback restores it',()=>{
 const store=new Map([['plugins',JSON.stringify([{url:'http://lampa.example.invalid/plugins/pars.js',status:1},{url:'https://unrelated/plugin.js',status:1},{url:'http://lampa.example.invalid/online.js',status:1}])]]);
 const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 update(storage,false);update(storage,false);
 let list=JSON.parse(store.get('plugins'));assert.equal(list[0].status,0);assert.equal(list[1].status,1);assert.equal(list[2].status,1);
 update(storage,true);list=JSON.parse(store.get('plugins'));assert.equal(list[0].status,1);assert.equal(store.has('lampa_view_legacy_status_v1'),false);
});
test('player selection is applied once and restored on rollback',()=>{
 const store=new Map([['plugins','[]'],['player','inner'],['player_nw_path','C:\\VLC\\vlc.exe']]);
 const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 update(storage,false,'C:\\MPV\\mpv.exe');assert.equal(store.get('player'),'other');
 store.set('player','inner');update(storage,false,'C:\\MPV\\mpv.exe');assert.equal(store.get('player'),'inner');
 update(storage,true);assert.equal(store.get('player_nw_path'),'C:\\VLC\\vlc.exe');assert.equal(store.has('player_torrent'),false);
});
