import sharedTimeline from './shared-timeline.js';
import watchHistory from './watch-history.js';
import playbackProgress from './playback-progress.js';
// CUB owns bookmarks and history. Lampac shares the actual native Timeline.
export default function progressSync(L,enabled){
 const playback=playbackProgress(L,enabled),shared=sharedTimeline(L,enabled),history=watchHistory(L);
 let refreshed=0,timer;
 function refresh(){
  if(!enabled() || document.hidden || document.body.matches('.pt-tv-busy,.pt-wheel-active') || !L.Account || !L.Account.Permit || !L.Account.Permit.sync)return;
  const controller=L.Controller && L.Controller.enabled && L.Controller.enabled();
  if(/player/.test(controller && controller.name || ''))return;
  shared.refresh();
  if(Date.now()-refreshed<5000)return;
  refreshed=Date.now();
  history.refresh();
  if(L.Account.Timeline && L.Account.Timeline.update)L.Account.Timeline.update();
  // Bookmark writes and refreshes belong to the host queue. An independent
  // refresh can race its pending save/cache update and repaint stale marks.
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,350);};
 window.addEventListener('focus',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 if(L.Listener && L.Listener.follow)L.Listener.follow('activity',event=>{if(event.type==='start')schedule();});
 if(L.Account && L.Account.listener && L.Account.listener.follow)L.Account.listener.follow('profile_select',()=>{refreshed=0;schedule();});
 // Long-open TV home screens need updates even when no focus/visibility changes.
 const interval=setInterval(refresh,30000);
 schedule();
 return {refresh,status:shared.status,stop(){playback.stop();clearInterval(interval);clearTimeout(timer);shared.stop();}};
}
