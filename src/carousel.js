// One timer for a visible hero. No polling or background image rotation.
export default function carousel(element,next,enabled,delay=10000){
 let timer,disposed=false,hover=false,touch=false,visible=true;
 function stop(){if(timer!==undefined){clearTimeout(timer);timer=undefined;}}
 function refresh(){
  stop();
  if(disposed || document.hidden || !visible || hover || touch || !element.isConnected || !enabled())return;
  timer=setTimeout(()=>{timer=undefined;if(!disposed && !document.hidden && visible && element.isConnected && enabled()){next();refresh();}},delay);
 }
 const enter=event=>{if(event.pointerType==='mouse'){hover=true;stop();}};
 const leave=()=>{hover=false;refresh();};
 const down=()=>{touch=true;stop();};
 const up=()=>{touch=false;refresh();};
 element.addEventListener('pointerenter',enter);element.addEventListener('pointerleave',leave);
 element.addEventListener('touchstart',down,{passive:true});element.addEventListener('touchend',up,{passive:true});element.addEventListener('touchcancel',up,{passive:true});
 document.addEventListener('visibilitychange',refresh);
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);refresh();}):null;
 if(observer)observer.observe(element);
 function dispose(){
  disposed=true;stop();if(observer)observer.disconnect();document.removeEventListener('visibilitychange',refresh);
  element.removeEventListener('pointerenter',enter);element.removeEventListener('pointerleave',leave);
  element.removeEventListener('touchstart',down);element.removeEventListener('touchend',up);element.removeEventListener('touchcancel',up);
 }
 refresh();return {refresh,dispose};
}
