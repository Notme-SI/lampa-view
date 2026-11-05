import {identity} from './identity.cjs';
import {linkFor,profileScope} from './timeline-meta.cjs';

// Save the native player's measured position while it is still playing. Its
// two-minute save interval can leave another screen/device on the last manual
// mark. Never create progress merely because a file was opened.
export default function playbackProgress(L,enabled){
 const bindings=new Map(),wrapped=new WeakSet();
 let current=null,stopped=false;
 const active=()=>!stopped && enabled();
 function track(video){
  if(!active() || !video || !video.timeline || !video.timeline.hash)return null;
  const activity=L.Activity && L.Activity.active && L.Activity.active() || {};
  const card=video.card || activity.movie || activity.card;
  const coordinates=identity(card || {},video),meta=linkFor(L,card,coordinates.season,coordinates.episode);
  const timeline=video.timeline,scope=profileScope(L);
  if(meta){
   bindings.set(String(timeline.hash),{scope,meta});
   if(bindings.size>100)bindings.delete(bindings.keys().next().value);
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
   if(active() && binding && binding.scope===profileScope(L) && !params.received)params={...params,...binding.meta};
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
  listener.follow('create',event=>track(event && event.data));
  listener.follow('start',video=>{save();current=track(video);});
  listener.follow('external',()=>{save();current=null;});
  for(const event of ['close','destroy'])listener.follow(event,()=>{save();current=null;});
 }
 if(L.Player && typeof L.Player.playlist==='function'){
  const playlist=L.Player.playlist;
  L.Player.playlist=function(items){
   if(Array.isArray(items))items.slice(0,100).forEach(track);
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
