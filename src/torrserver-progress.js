import {linkFor,profileScope,torrentHash} from './timeline-meta.cjs';

// The server stores client-reported seconds, not playback inferred from bytes.
export default function torrserverProgress(L,enabled){
 const key='minimal_torrserver_progress_v1',network=L.Reguest?new L.Reguest():null;
 let rows=L.Storage.get(key,[]),busy=false,last=0,timer,stopped=false;
 if(!Array.isArray(rows))rows=[];
 rows=rows.filter(r=>r && r.meta && r.hash && r.timeline && Date.now()-r.at<7*86400000).slice(-400);
 function server(){
  const url=L.Torserver && typeof L.Torserver.url==='function' && L.Torserver.url();
  return typeof url==='string'?url.trim().replace(/\/+$/,''):'';
 }
 const active=()=>!stopped && enabled() && (L.Storage.field?L.Storage.field('torrserver_tracktimecode'):L.Storage.get('torrserver_tracktimecode',false)) && network;
 function fileIndex(video){
  try{
   const indexes=new URL(video.url,window.location.href).searchParams.getAll('index');
   const index=indexes.length===1?Number(indexes[0]):0;
   return Number.isSafeInteger(index) && index>0?index:0;
  }catch(error){return 0;}
 }
 function remember(video){
  if(!video || !video.torrent_hash || !video.timeline || !video.timeline.hash)return;
  const index=fileIndex(video);
  const card=video.card,meta=linkFor(L,card,video.season,video.episode);
  if(!meta || !index)return;
  const scope=profileScope(L),url=server();if(!url)return;
  rows=rows.filter(r=>!(r.scope===scope && r.server===url && r.hash===video.torrent_hash && r.index===index));
  rows.push({scope,server:url,hash:video.torrent_hash,index,timeline:String(video.timeline.hash),duration:Number(video.timeline.duration)||0,meta,at:Date.now()});rows=rows.slice(-400);
 }
 const android=L.Android;
 if(typeof android?.openPlayer==='function' && typeof android.timeCall==='function' && L.Platform?.is?.('android')){
  const open=android.openPlayer,timeCall=android.timeCall;
  let session=null;
  android.openPlayer=function(url,video){
   session=null;
   if(!stopped && enabled() && video?.torrent_hash){
    const files=new Map(), scope=profileScope(L), endpoint=server();
    for(const item of [video,...(Array.isArray(video.playlist)?video.playlist:[])]){
     if(item?.torrent_hash!==video.torrent_hash || !item.timeline?.hash)continue;
     const index=fileIndex(item),hash=String(item.timeline.hash);
     const meta=linkFor(L,item.card || video.card,item.season,item.episode);
     if(!meta)continue;
     // One native hash shared by different files is ambiguous.
     if(!files.has(hash))files.set(hash,{index,url:item.url,meta});
     else if(files.get(hash)?.url!==item.url)files.set(hash,null);
    }
    if(files.size)session={files,scope,endpoint,torrent:video.torrent_hash};
   }
   return open.apply(this,arguments);
  };
  android.timeCall=function(progress){
   const current=session,hash=String(progress?.hash || '');
   if(current?.files.has(hash) && current.scope!==profileScope(L))return;
   const file=current?.files.get(hash);
   if(stopped || !enabled() || !file)return timeCall.apply(this,arguments);
   const measured=Number(progress.time),known=L.Timeline.view(hash);
   const duration=Math.round(Number(progress.duration) || Number(known.duration) || 0);
   if(!Number.isFinite(measured) || measured<=0 || !Number.isFinite(duration) || duration<0 || duration>0 && measured>duration+2)return;
   const reportedPercent=Math.min(100,Math.max(0,Number(progress.percent)||0));
   const time=Math.round(duration>0?reportedPercent===100?duration:Math.min(measured,duration):measured);
   const percent=duration>0?Math.round(time/duration*100):reportedPercent;
   const result=timeCall.call(this,{...progress,time,duration,percent});
   const saved=L.Timeline.view(hash);
   const release=torrentHash(current.torrent);
   // The native host consumes its callback after the first report for a file.
   // Save later measured positions for the same launch through the normal Timeline.
   if(saved.time!==time || saved.duration!==duration || saved.percent!==percent){
    L.Timeline.update({hash,time,duration,percent,profile:saved.profile,...file.meta,...(release?{torrentHash:release}:{})});
   }
   if(file.index && active() && current.endpoint && current.endpoint===server()){
    L.Torserver.viewedSet?.(current.torrent,file.index,time);
   }
   return result;
  };
 }
 function launched(video){
  if(stopped || !enabled() || !video)return;remember(video);
  if(Array.isArray(video.playlist))video.playlist.forEach(remember);
  L.Storage.set(key,rows);schedule();
 }
 function refresh(){
  if(!active() || busy || Date.now()-last<10000)return;
  const scope=profileScope(L),url=server();if(!url)return;
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
    if(time<=Number(local.time||0) || local.percent>=100 || duration>0 && time>duration+2)continue;
    const release=torrentHash(row.hash);
    const position=duration>0?Math.min(time,duration):time;
    const percent=duration>0?Math.round(position/duration*100):Number(local.percent)||0;
    L.Timeline.update({hash:row.timeline,...row.meta,...(release?{torrentHash:release}:{}),time:position,duration,percent});
   }
  },()=>{busy=false;},JSON.stringify({action:'list',hash:recent.hash}));
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(refresh,350);}
 if(L.Player && L.Player.listener)L.Player.listener.follow('create',e=>launched(e && e.data));
 if(L.Listener)L.Listener.follow('torrent_file',e=>{
  if(e.type==='onenter')launched(e.element);
  if(e.type!=='list_open')return;
  const {params,items}=e;
  if(active() && params?.movie && Array.isArray(params.viewed) && params.viewed.length && typeof L.Torserver.parse==='function'){
   // The native file list imports TorrServer positions without timestamps.
   // An older server position must not reopen a completed episode or rewind it.
   const byId=new Map((items || []).map(item=>[String(item.id),item]));
   params.viewed=params.viewed.filter(row=>{
    const item=byId.get(String(row.file_index));
    if(!item?.path)return true;
    const info=L.Torserver.parse({movie:params.movie,files:items,filename:item.path_human || item.path,path:item.path,is_file:/\.(?:vob|m2ts)$/i.test(item.path)});
    const local=L.Timeline.view(info.hash);
    return !(Number(local.percent)>=100) && Number(local.time || 0)<Number(row.timecode);
   });
  }
  schedule();
 });
 window.addEventListener('focus',schedule);
 const visible=()=>{if(!document.hidden)schedule();};document.addEventListener('visibilitychange',visible);
 const interval=setInterval(refresh,15000);schedule();
 return {refresh,stop(){stopped=true;clearInterval(interval);clearTimeout(timer);if(network)network.clear();window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',visible);}};
}
