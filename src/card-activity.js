export function activeCard(node){
 return node?.isConnected && !node.closest('.activity:not(.activity--active)');
}

// Visibility observation keeps background queues from reading poster geometry
// on each animation frame while a catalogue moves.
const near=new WeakSet(),onscreen=new WeakSet(),observed=new WeakSet();
const supported=typeof window!=='undefined' && typeof window.IntersectionObserver==='function';
const observe=(set,options)=>supported?new window.IntersectionObserver(entries=>{
 for(const entry of entries){if(entry.isIntersecting)set.add(entry.target);else set.delete(entry.target);}
},options):null;
const viewport=observe(onscreen),ahead=observe(near,{rootMargin:'1200px'});
export function observeCard(node){
 if(!viewport || observed.has(node))return;
 observed.add(node);viewport.observe(node);ahead.observe(node);
}
export function forgetCard(node){
 if(!viewport)return;
 observed.delete(node);near.delete(node);onscreen.delete(node);
 viewport.unobserve(node);ahead.unobserve(node);
}
export function preparingCard(node){
 if(viewport)return near.has(node) && !onscreen.has(node);
 const rect=node.getBoundingClientRect();
 return rect.width>0 && (rect.top>=window.innerHeight && rect.top<window.innerHeight+1200 ||
  rect.bottom<=0 && rect.bottom>-1200 || rect.left>=window.innerWidth && rect.left<window.innerWidth+1200);
}

export function scrollingCard(node){
 return !!node.closest('.pt-catalogue-moving');
}
