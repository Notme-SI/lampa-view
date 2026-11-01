import sharedTimeline from './shared-timeline.js';
import watchHistory from './watch-history.js';
// CUB owns bookmarks and history. Lampac shares the actual native Timeline.
export default function progressSync(L,enabled){
 const shared=sharedTimeline(L,enabled),history=watchHistory(L);
 let refreshed=0,timer,bookmarkBusy=false;
 function refresh(){
  if(!enabled() || document.hidden || document.body.matches('.pt-tv-busy,.pt-wheel-active') || !L.Account || !L.Account.Permit || !L.Account.Permit.sync)return;
  const controller=L.Controller && L.Controller.enabled && L.Controller.enabled();
  if(/player/.test(controller && controller.name || ''))return;
  shared.refresh();
  if(Date.now()-refreshed<5000)return;
  refreshed=Date.now();
  history.refresh();
  if(L.Account.Timeline && L.Account.Timeline.update)L.Account.Timeline.update();
  if(!bookmarkBusy && L.Account.Bookmarks && L.Account.Bookmarks.update){
   bookmarkBusy=true;
   const profile=L.Account.Permit.account && L.Account.Permit.account.profile && L.Account.Permit.account.profile.id;
   // Native callbacks include failed requests. Release the guard in either case.
   L.Account.Bookmarks.update(()=>{
    bookmarkBusy=false;
    const now=L.Account.Permit.account && L.Account.Permit.account.profile && L.Account.Permit.account.profile.id;
    if(now===profile && L.Listener && L.Listener.send)L.Listener.send('state:changed',{target:'favorite',reason:'sync'});
   });
  }
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,350);};
 window.addEventListener('focus',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 if(L.Listener && L.Listener.follow)L.Listener.follow('activity',event=>{if(event.type==='start')schedule();});
 if(L.Account && L.Account.listener && L.Account.listener.follow)L.Account.listener.follow('profile_select',()=>{refreshed=0;schedule();});
 // Long-open TV home screens need updates even when no focus/visibility changes.
 const interval=setInterval(refresh,30000);
 schedule();
 return {refresh,status:shared.status,stop(){clearInterval(interval);clearTimeout(timer);shared.stop();}};
}
