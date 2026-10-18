// Runs in preload before Lampa reads Storage, so cached legacy scripts cannot reapply their themes.
function update(storage, restore, playerPath) {
  const key='lampa_view_legacy_status_v1';
  const paths=[
    'https://hub.alcopa.cc/dl/torrent_button/v1.0.0/plugin.js',
    'https://hub.alcopa.cc/dl/alc_auto/v2.1.34/plugin.js',
    'https://hub.alcopa.cc/dl/snack_tv/v0.8.10/plugin.js'
  ];
  try {
    const playerKey='lampa_view_player_backup_v1';
    if(restore) {
      const playerBackup=JSON.parse(storage.getItem(playerKey) || 'null');
      if(playerBackup) for(const [name,value] of Object.entries(playerBackup)) {
        if(value===null) storage.removeItem(name); else storage.setItem(name,value);
      }
      storage.removeItem(playerKey);
    } else if(playerPath && !storage.getItem(playerKey)) {
      const names=['player_nw_path','player','player_torrent'];
      storage.setItem(playerKey,JSON.stringify(Object.fromEntries(names.map(name=>[name,storage.getItem(name) ?? null]))));
      storage.setItem('player_nw_path',playerPath);storage.setItem('player','other');storage.setItem('player_torrent','other');
    }
    const list=JSON.parse(storage.getItem('plugins') || '[]');
    if(!Array.isArray(list)) return;
    const backup=JSON.parse(storage.getItem(key) || '[]');
    if(!Array.isArray(backup)) return;
    let changed=false;
    for(const item of list) {
      if(!item)continue;
      const address=String(item.url || '').split(/[?#]/)[0];
      const local=/^https?:\/\/[^/]+\/plugins\/(?:torrent-catalogue|pars|obsiview)\.js$/.test(address);
      if(!local && !paths.includes(address))continue;
      const previous=backup.find(v=>v.url===item.url);
      if(restore) {
        if(previous) {item.status=previous.status;changed=true;}
      } else {
        if(!previous) backup.push({url:item.url,status:item.status});
        if(item.status!==0) {item.status=0;changed=true;}
      }
    }
    if(!restore && backup.length) storage.setItem(key,JSON.stringify(backup));
    if(changed) storage.setItem('plugins',JSON.stringify(list));
    if(restore) storage.removeItem(key);
  } catch { /* Recovery/non-web pages may not have a usable localStorage. */ }
}
module.exports=update;
