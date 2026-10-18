'use strict';
const C=require('./identity.cjs');
// The native Desktop preload already supports child_process.spawn. Pass a small
// opaque script option through it; no app patch, server or altered video URL.
function option(context, encode) {
  const data={...context};
  if(Array.isArray(data.entries))data.entries=data.entries.slice();
  let value=encode(JSON.stringify(data));
  while(value.length>11000 && data.entries && data.entries.length>1){data.entries.pop();value=encode(JSON.stringify(data));}
  if(value.length>11000)return '';
  return '--script-opts-append=mpv_plus_lampa_context='+Array.from(value,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
}
function install(L,root,cardFor,enabled) {
  if(!L.Platform || typeof L.Platform.desktop!=='function' || !L.Platform.desktop() || typeof root.require!=='function')return;
  let playlist=[],pending=null,bypass=false;
  const originalPlaylist=L.Player.playlist;
  L.Player.playlist=function(items){
    playlist=Array.isArray(items)?items.slice(0,40):[];
    return originalPlaylist.apply(this,arguments);
  };
  function target(video) {
    if(!enabled() || !L.Platform.desktop() || L.Platform.is('android') || typeof root.require!=='function')return '';
    if(video.iptv || video.iptv_player || ['lampa','inner'].includes(video.launch_player))return '';
    if(L.Storage.field(video.torrent_hash?'player_torrent':'player')!=='other')return '';
    const path=L.Storage.field('player_nw_path');
    return typeof path==='string' && /(?:^|[\\/])mpv\.exe$/i.test(path)?path:'';
  }
  function create(event){
    const video=event.data,path=target(video);
    if(bypass || !path || !event.abort)return;
    const card=cardFor(video);
    if(!card)return;
    let spawn;
    try {
      if(!root.require('fs').existsSync(path))return;
      spawn=root.require('child_process').spawn;
      if(typeof spawn!=='function')return;
    }catch(error){return;}
    // Let other synchronous create listeners finish correcting season/episode.
    // A playlist supplied immediately after Player.play is included too.
    const previous=pending;pending={video,path,spawn,card};
    if(previous)previous.cancelled=true;
    playlist=Array.isArray(video.playlist)?video.playlist.slice(0,40):[];
    event.abort();
    const launch=pending;
    root.setTimeout(()=>{
      if(launch.cancelled)return;
      pending=null;
      let started=false,retried=false;
      function fallback(){if(retried)return;retried=true;bypass=true;try{L.Player.play(video);}finally{bypass=false;}}
      try {
        const prepare=item=>{
          const result={...item};
          if(result.quality && L.Player.getUrlQuality)result.url=L.Player.getUrlQuality(result.quality,false)||result.url;
          if(L.Torserver && L.Torserver.toPlayUrl)result.url=L.Torserver.toPlayUrl(result.url);
          return result;
        };
        const selected=prepare(video);
        if(!C.mediaURL(selected.url)){fallback();return;}
        const context=C.context(launch.card,selected,playlist.map(prepare));
        const encode=value=>root.unescape(root.encodeURIComponent(value));
        let metadata=option(context,encode);
        const url=encodeURI(selected.url);
        if(path.length+url.length+metadata.length>28000)metadata='';
        const args=metadata?[metadata,url]:[url];
        const child=spawn(path,args);
        started=true;
        if(child && typeof child.on==='function')child.on('error',fallback);
        L.Player.listener.send('external',video);
      }catch(error){if(!started)fallback();}
    },0);
  }
  const notify=L.Player.listener.send;
  L.Player.listener.send=function(name,event){
    if(name!=='create' || !event || typeof event.abort!=='function')return notify.apply(this,arguments);
    const abort=event.abort;let cancelled=false,result;
    event.abort=function(){cancelled=true;return abort.apply(this,arguments);};
    try{result=notify.apply(this,arguments);}finally{event.abort=abort;}
    // Respect another extension cancelling the launch; do not run around it.
    if(!cancelled)create(event);
    return result;
  };
}
module.exports={install,option};
