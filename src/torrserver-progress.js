import {linkFor,profileScope} from './timeline-meta.cjs';

// The server stores client-reported seconds, not playback inferred from bytes.
export default function torrserverProgress(L,enabled){
 const key='minimal_torrserver_progress_v1',network=L.Reguest?new L.Reguest():null;
 let rows=L.Storage.get(key,[]),busy=false,last=0,timer,stopped=false;
 if(!Array.isArray(rows))rows=[];
 rows=rows.filter(r=>r && r.meta && r.hash && r.timeline && Date.now()-r.at<7*86400000).slice(-400);
 const server=()=>L.Torserver && L.Torserver.url?L.Torserver.url().replace(/\/$/,''):'';
 const active=()=>!stopped && enabled() && L.Storage.field('torrserver_tracktimecode') && network;
 function remember(video){
  if(!video || !video.torrent_hash || !video.timeline || !video.timeline.hash)return;
  let index;try{index=Number(new URL(video.url).searchParams.get('index'));}catch(e){return;}
  const card=video.card,meta=linkFor(L,card,video.season,video.episode);
  if(!meta || !Number.isInteger(index) || index<1)return;
  const scope=profileScope(L),url=server();if(!url)return;
  rows=rows.filter(r=>!(r.scope===scope && r.server===url && r.hash===video.torrent_hash && r.index===index));
  rows.push({scope,server:url,hash:video.torrent_hash,index,timeline:String(video.timeline.hash),duration:Number(video.timeline.duration)||0,meta,at:Date.now()});rows=rows.slice(-400);
 }
 function launched(video){
  if(stopped || !enabled() || !video)return;remember(video);
  if(Array.isArray(video.playlist))video.playlist.forEach(remember);
  L.Storage.set(key,rows);schedule();
 }
 function refresh(){
  if(!active() || busy || Date.now()-last<10000)return;
  const scope=profileScope(L),url=server();
  // Only the most recently launched torrent in this profile/server is polled.
  const recent=rows.filter(r=>r.scope===scope && r.server===url && Date.now()-r.at<7*86400000).sort((a,b)=>b.at-a.at)[0];
  if(!recent)return;
  const files=rows.filter(r=>r.scope===scope && r.server===url && r.hash===recent.hash);
  busy=true;last=Date.now();network.timeout(5000);
  network.silent(url+'/viewed',data=>{
   busy=false;if(!active() || scope!==profileScope(L) || url!==server() || !Array.isArray(data))return;
   for(const row of files){
    const saved=data.find(v=>Number(v.file_index)===row.index && (!v.hash || v.hash===row.hash));
    const time=Number(saved && saved.timecode);if(!Number.isFinite(time) || time<=0)continue;
    const local=L.Timeline.view(row.timeline),duration=Number(local.duration)||row.duration;
    // Without server timestamps a smaller value may be stale; retain newer local progress.
    if(time<=Number(local.time||0) || local.percent>=100 || !duration || time>duration+2)continue;
    L.Timeline.update({hash:row.timeline,...row.meta,time:Math.min(time,duration),duration,percent:Math.min(100,Math.round(time/duration*100))});
   }
  },()=>{busy=false;},JSON.stringify({action:'list',hash:recent.hash}));
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(refresh,350);}
 if(L.Player && L.Player.listener)L.Player.listener.follow('create',e=>launched(e && e.data));
 if(L.Listener)L.Listener.follow('torrent_file',e=>{if(e.type==='onenter')launched(e.element);if(e.type==='list_open')schedule();});
 window.addEventListener('focus',schedule);
 const visible=()=>{if(!document.hidden)schedule();};document.addEventListener('visibilitychange',visible);
 const interval=setInterval(refresh,15000);schedule();
 return {refresh,stop(){stopped=true;clearInterval(interval);clearTimeout(timer);if(network)network.clear();window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',visible);}};
}
