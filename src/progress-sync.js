// Keep native CUB profiles, account permissions and transport authoritative.
export default function progressSync(L,enabled){
 let refreshed=0,timer;
 function refresh(){
  if(!enabled() || document.hidden || !L.Account || !L.Account.Permit || !L.Account.Permit.sync || Date.now()-refreshed<60000)return;
  refreshed=Date.now();
  if(L.Account.Timeline && L.Account.Timeline.update)L.Account.Timeline.update();
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,350);};
 window.addEventListener('focus',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 if(L.Listener && L.Listener.follow)L.Listener.follow('activity',event=>{if(event.type==='start')schedule();});
 // Native dump/remote updates call Timeline.read/update. Consumers must invalidate
 // snapshots on both events, rather than retaining a record from another device.
 schedule();
}
