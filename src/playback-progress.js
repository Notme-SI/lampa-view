import {identity} from './identity.cjs';
import {linkFor,profileScope} from './timeline-meta.cjs';

// Save the native player's measured position while it is still playing. Its
// two-minute save interval can leave another screen/device on the last manual
// mark. Never create progress merely because a file was opened.
export default function playbackProgress(L,enabled){
 const bindings=new Map(),wrapped=new WeakSet(),bindingKey='minimal_playback_links_v1',limit=2000;
 let current=null,stopped=false;
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
  if(!binding || !road || road.card===binding.meta.card && road.season===binding.meta.season && road.episode===binding.meta.episode)return;
  Object.assign(road,binding.meta);
  const file=L.Timeline.filename && L.Timeline.filename(),records=file && L.Storage && L.Storage.get?L.Storage.get(file,{}):null;
  if(records && records[hash] && L.Storage.set){Object.assign(records[hash],binding.meta);L.Storage.set(file,records);}
 });
 function track(video){
  if(!active() || !video || !video.timeline || !video.timeline.hash)return null;
  const activity=L.Activity && L.Activity.active && L.Activity.active() || {};
  const card=video.card || activity.movie || activity.card;
  const coordinates=identity(card || {},video),meta=linkFor(L,card,coordinates.season,coordinates.episode);
  const timeline=video.timeline,scope=profileScope(L);
  if(meta){
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
     if(!saved || saved.card!==meta.card || saved.season!==meta.season || saved.episode!==meta.episode){
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
   const binding=params && bindings.get(String(params.hash));
   if(active() && binding && !params.received){
    if(binding.scope!==profileScope(L))return;
    params={...params,...binding.meta};
   }
   return update.apply(this,[params,...Array.prototype.slice.call(arguments,1)]);
  };
 }
 function save(){
  if(!active() || !current || !current.sample || current.scope!==profileScope(L))return;
  const timeline=current.video.timeline;
  if(!timeline || timeline.stop_recording || timeline.waiting_for_user || typeof timeline.handler!=='function')return;
  const sample=current.sample;
  Object.assign(timeline,sample);
  timeline.handler(sample.percent,sample.time,sample.duration);
  current.savedAt=Date.now();
 }
 const listener=L.Player && L.Player.listener;
 if(listener && listener.follow){
  listener.follow('create',event=>{
   const data=event && event.data;if(!data)return;
   // Android serializes the complete playlist inside play(), before the host
   // calls Player.playlist(). Bind auto-next files before that serialization.
   if(Array.isArray(data.playlist))data.playlist.slice(0,limit).forEach(track);
   track(data);if(active())persist();
  });
  listener.follow('start',video=>{save();current=track(video);});
  listener.follow('external',()=>{save();current=null;});
  for(const event of ['close','destroy'])listener.follow(event,()=>{save();current=null;});
 }
 if(L.Player && typeof L.Player.playlist==='function'){
  const playlist=L.Player.playlist;
  L.Player.playlist=function(items){
   if(Array.isArray(items)){items.slice(0,limit).forEach(track);if(active())persist();}
   return playlist.apply(this,arguments);
  };
 }
 const video=L.PlayerVideo && L.PlayerVideo.listener;
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
 return {save,stop(){save();stopped=true;current=null;bindings.clear();window.removeEventListener('pagehide',hide);}};
}
