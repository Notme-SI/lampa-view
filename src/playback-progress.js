import {identity} from './identity.cjs';
import {linkFor,profileScope,torrentHash} from './timeline-meta.cjs';

// Save the native player's measured position while it is still playing. Its
// two-minute save interval can leave another screen/device on the last manual
// mark. Never create progress merely because a file was opened.
export default function playbackProgress(L,enabled){
 const bindings=new Map(),wrapped=new WeakSet(),bindingKey='minimal_playback_links_v1',limit=2000;
 let current=null,stopped=false,media=null,timelineUpdate=null,skipPressed=false,creditNext=null;
 const active=()=>!stopped && enabled();
 const cached=L.Storage && L.Storage.get?L.Storage.get(bindingKey,[]):[];
 if(Array.isArray(cached))for(const row of cached.slice(-limit)){
  if(row && /^[a-zA-Z0-9_.:-]{1,128}$/.test(String(row.hash)) && typeof row.scope==='string' && row.meta && /^[a-z0-9_]{1,64}$/.test(row.meta.card || '') && Date.now()-row.at<7*86400000)bindings.set(String(row.hash),row);
 }
 function persist(){
  if(L.Storage && L.Storage.set)L.Storage.set(bindingKey,Array.from(bindings,([hash,row])=>({hash,...row})));
 }
 function bindingFor(hash){const row=bindings.get(String(hash));return row && row.scope===profileScope(L)?row:null;}
 // Older host builds drop card/episode fields inside Timeline.update(). Enrich
 // the actual persisted road before sync/UI listeners read the native event.
 if(L.Timeline && L.Timeline.listener && L.Timeline.listener.follow)L.Timeline.listener.follow('update',event=>{
  if(!active() || !event || !event.data)return;
  const {hash,road}=event.data,binding=bindingFor(hash);
  const meta=timelineUpdate && String(timelineUpdate.hash)===String(hash)?timelineUpdate.meta:binding?.meta;
  if(!meta || !road || Object.keys(meta).every(key=>road[key]===meta[key]))return;
  Object.assign(road,meta);
  const file=L.Timeline.filename && L.Timeline.filename(),records=file && L.Storage && L.Storage.get?L.Storage.get(file,{}):null;
  if(records && records[hash] && L.Storage.set){Object.assign(records[hash],meta);L.Storage.set(file,records);}
 });
 function track(video){
  if(!active() || !video || !video.timeline || !video.timeline.hash)return null;
  const activity=L.Activity && L.Activity.active && L.Activity.active() || {};
  const card=video.card || activity.movie || activity.card;
  const coordinates=identity(card || {},video),meta=linkFor(L,card,coordinates.season,coordinates.episode);
  const release=torrentHash(video.torrent_hash);
  if(meta && release)meta.torrentHash=release;
  const timeline=video.timeline,scope=profileScope(L);
  if(meta){
   // The native handler captures its linkage when Timeline.view() creates it.
   // Make file-based torrent checkpoints reach CUB with their card identity.
   if(release && !wrapped.has(timeline) && typeof L.Timeline?.link==='function' &&
      (timeline.card!==meta.card || timeline.season!==meta.season || timeline.episode!==meta.episode)){
    const linked=L.Timeline.view?.(timeline.hash,meta);
    if(linked?.card===meta.card && typeof linked.handler==='function')timeline.handler=linked.handler;
   }
   Object.assign(timeline,meta);
   bindings.delete(String(timeline.hash));bindings.set(String(timeline.hash),{scope,meta,at:Date.now()});
   if(bindings.size>limit)bindings.delete(bindings.keys().next().value);
  }
  if(!wrapped.has(timeline) && typeof timeline.handler==='function'){
   const handler=timeline.handler;
   timeline.handler=function(percent,time,duration){
    if(scope!==profileScope(L))return;
    const result=handler.apply(this,arguments);
    if(active() && meta && L.Timeline && L.Timeline.update){
     const file=L.Timeline.filename && L.Timeline.filename();
     const records=file && L.Storage && L.Storage.get?L.Storage.get(file,{}) || {}:{};
     const saved=records[timeline.hash];
     if(!saved || Object.keys(meta).some(key=>saved[key]!==meta[key])){
      L.Timeline.update({hash:timeline.hash,percent,time,duration,profile:timeline.profile,...meta});
     }
    }
    return result;
   };
   wrapped.add(timeline);
  }
  return {video,scope,savedAt:0,sample:null};
 }
 if(L.Timeline && L.Timeline.update){
  const update=L.Timeline.update;
  L.Timeline.update=function(params){
   if(!params)return update.apply(this,arguments);
   const binding=params && bindings.get(String(params.hash));
   let meta=typeof params.card==='string' && params.card?{card:params.card,...(params.episode!==undefined?{season:params.season,episode:params.episode}:{})}:null;
   if(active() && binding && !params.received){
    if(binding.scope!==profileScope(L))return;
    meta={...binding.meta,...meta};
   }
   const release=torrentHash(params.torrentHash);
   if(release)meta={...meta,torrentHash:release};
   const previous=timelineUpdate;
   timelineUpdate={hash:params.hash,meta};
   try{return update.apply(this,[meta?{...params,...meta}:params,...Array.prototype.slice.call(arguments,1)]);}
   finally{timelineUpdate=previous;}
  };
 }
 function save(state=current){
  if(!active() || !state?.sample || state.scope!==profileScope(L))return;
  const timeline=state.video.timeline;
  if(!timeline || timeline.stop_recording || timeline.waiting_for_user || typeof timeline.handler!=='function')return;
  // The host may have completed the file after our last periodic sample.
  // Closing or auto-next must not replace that result with an older checkpoint.
  const sample=Number(timeline.percent)===100 && Number(timeline.duration)>0 && Number(timeline.time)>=Number(timeline.duration)?{percent:100,time:Number(timeline.time),duration:Number(timeline.duration)}:state.sample;
  Object.assign(timeline,sample);
  timeline.handler(sample.percent,sample.time,sample.duration);
  state.savedAt=Date.now();
  return true;
 }
 function complete(state,duration){
  if(!Number.isFinite(duration) || duration<=0)return;
  state.sample={percent:100,time:duration,duration};return save(state);
 }
 const playlistControl=L.PlayerPlaylist;
 function creditAction(event){
  if(!current || !active() || !event.target?.closest?.('.player .player-skip:not(.hide):not(.player-skip--preview)'))return;
  skipPressed=true;Promise.resolve().then(()=>{skipPressed=false;});
 }
 if(typeof playlistControl?.next==='function' && typeof playlistControl.position==='function'){
  const next=playlistControl.next;
  document.addEventListener('hover:enter',creditAction,true);
  playlistControl.next=function(){
   // The native skip button invokes next() only for the closing segment.
   // An intro skip seeks inside the current file instead.
   if(skipPressed && current && playlistControl.canNext?.()){
    const video=playlistControl.get?.()[playlistControl.position()+1];
    if(video && video!==current.video){
     creditNext={video,state:current,duration:Number(media?.duration || current.sample?.duration)};
    }
   }
   return next.apply(this,arguments);
  };
 }
 const listener=L.Player && L.Player.listener;
 L.Listener?.follow?.('torrent_file',event=>{
  if(!active() || event.type!=='render')return;
  const video=event.element,timeline=video?.timeline;
  const release=torrentHash(video?.torrent_hash),meta=linkFor(L,video?.card);
  if(!release || !meta || !timeline?.hash || !(timeline.time>0))return;
  const file=L.Timeline.filename?.(),saved=file && L.Storage?.get?.(file,{})?.[timeline.hash];
  // The actual file row identifies older positions that were saved without a card.
  if(saved && !saved.card && Number(saved.time)>0){
   L.Timeline.update({...saved,hash:timeline.hash,...meta,torrentHash:release,received:true});
  }
 });
 if(listener && listener.follow){
  listener.follow('create',event=>{
   const data=event && event.data;if(!data)return;
   // Android serializes the complete playlist inside play(), before the host
   // calls Player.playlist(). Bind auto-next files before that serialization.
   if(Array.isArray(data.playlist))data.playlist.slice(0,limit).forEach(track);
   track(data);if(active())persist();
  });
  listener.follow('start',video=>{
   save();
   const previous=creditNext;creditNext=null;
   if(previous?.video===video && complete(previous.state,previous.duration)){
    previous.state.video.viewed?.(Math.round(previous.duration));
   }
   current=track(video);
  });
  listener.follow('external',()=>{save();current=null;});
  listener.follow('close',()=>{save();current=null;creditNext=null;});
  listener.follow('destroy',()=>{save();current=null;});
 }
 if(L.Player && typeof L.Player.playlist==='function'){
  const playlist=L.Player.playlist;
  L.Player.playlist=function(items){
   if(Array.isArray(items)){items.slice(0,limit).forEach(track);if(active())persist();}
   return playlist.apply(this,arguments);
  };
 }
 const video=L.PlayerVideo && L.PlayerVideo.listener;
 function ended(){
  if(!active() || !current || current.scope!==profileScope(L) || L.Player.playdata?.()!==current.video)return;
  complete(current,Number(media?.duration));
 }
 function bindMedia(){
  const next=L.PlayerVideo?.video?.();if(next===media)return;
  media?.removeEventListener?.('ended',ended,true);media=next;
  // Capture EOF before the native playlist handler switches to the next file.
  media?.addEventListener?.('ended',ended,true);
 }
 if(video && video.follow)video.follow('loadeddata',bindMedia);
 if(video && video.follow)video.follow('timeupdate',event=>{
  if(!active() || !current || !event || !L.Player.playdata || L.Player.playdata()!==current.video)return;
  const time=Number(event.current),duration=Number(event.duration);
  if(!Number.isFinite(time) || time<=0 || !Number.isFinite(duration) || duration<=0 || time>duration+2)return;
  const timeline=current.video.timeline;
  const resumeMode=L.Storage && L.Storage.field && L.Storage.field('player_timecode');
  // The first frame can arrive before the native resume seek completes.
  if(!current.sample && resumeMode!=='again' && Number(timeline.time)>time+2 && Number(timeline.time)<duration)return;
  current.sample={time:Math.min(time,duration),duration,percent:Math.min(100,Math.round(time/duration*100))};
  if(!current.savedAt || Date.now()-current.savedAt>=10000)save();
 });
 const hide=()=>save();
 window.addEventListener('pagehide',hide);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
 return {save(){save();},stop(){save();stopped=true;current=null;creditNext=null;media?.removeEventListener?.('ended',ended,true);media=null;bindings.clear();window.removeEventListener('pagehide',hide);document.removeEventListener('hover:enter',creditAction,true);}};
}
