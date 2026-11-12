// A bounded, viewport-first decode queue. IO supplies geometry in one browser
// batch; request handlers never force a poster-by-poster synchronous layout.
import {reducedMotion} from './scroll-motion.js';
export default function catalogueImages(blank){
 const states=new WeakMap(),waiting=new Set(),entries=new Map();let running=0,frame=0;
 const active=state=>state.node.isConnected && !!state.node.closest('.activity--active');
 function schedule(){if(!frame)frame=requestAnimationFrame(drain);}
 function reveal(state){
  if(!active(state))return;
  state.image.src=state.url;
  const done=()=>{if(!state.painted && active(state) && state.image.getAttribute('src')===state.url){
   state.painted=true;state.image.classList.remove('pt-catalogue-image-pending');
   if(typeof state.image.animate==='function' && !reducedMotion())state.animation=state.image.animate([{opacity:0},{opacity:1}],{duration:120,easing:'ease-out'});
  }};
  if(state.image.decode)state.image.decode().then(done,done);else done();
 }
 function trim(){
  let bytes=0;for(const entry of entries.values())bytes+=entry.bytes||0;
  for(const [url,entry] of entries){if(entries.size<=48 && bytes<=64*1048576)break;if(entry.done){entries.delete(url);bytes-=entry.bytes||0;entry.loader.src='';}}
 }
 function load(state){
  let entry=entries.get(state.url);
  if(entry){if(entry.done)reveal(state);else entry.listeners.add(state);return;}
  const loader=new Image();entry={loader,listeners:new Set([state]),done:false};entries.set(state.url,entry);running++;
  loader.decoding='async';loader.fetchPriority=state.rank===0?'high':'auto';
  let finished=false;
  const finish=ok=>{
   if(finished)return;finished=true;clearTimeout(entry.timer);loader.onload=loader.onerror=null;running--;
   entry.done=ok;entry.bytes=ok?(loader.naturalWidth||1)*(loader.naturalHeight||1)*4:0;
   if(!ok)entries.delete(state.url);
   for(const target of entry.listeners)if(target.url===state.url && active(target)){
    if(ok)reveal(target);else{target.image.classList.remove('pt-catalogue-image-pending');target.image.src='./img/img_broken.svg';}
   }
   entry.listeners.clear();trim();schedule();
  };
  entry.abort=()=>{entry.listeners.clear();finish(false);loader.src='';};
  entry.timer=setTimeout(()=>finish(false),12000);
  loader.onload=()=>{if(loader.decode)loader.decode().then(()=>finish(true),()=>finish(false));else finish(true);};
  loader.onerror=()=>finish(false);loader.src=state.url;
 }
 function drain(){
  frame=0;if(document.hidden)return;
  const ready=[...waiting].filter(state=>active(state) && Number.isFinite(state.rank)).sort((a,b)=>a.rank-b.rank || (a.node.compareDocumentPosition(b.node)&2?1:-1));
  for(const state of ready){
   const saved=entries.get(state.url);
   if(saved?.done){waiting.delete(state);reveal(state);continue;}
   if(running>=4 || state.rank>0 && running>=2)break;
   waiting.delete(state);load(state);
  }
 }
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(batch=>{
  for(const entry of batch){const image=entry.target.querySelector('.card__img'),state=image&&states.get(image);if(!state)continue;
   const box=entry.boundingClientRect;
   state.rank=entry.isIntersecting?(box.bottom>0 && box.top<innerHeight?0:Math.max(1,box.top>=innerHeight?box.top-innerHeight:-box.bottom)):Infinity;
   if(!state.painted)waiting.add(state);
  }schedule();
 },{rootMargin:Math.max(900,window.innerHeight||900)+'px 0px',threshold:[0,.01,1]}):null;
 const viewport=typeof IntersectionObserver==='function'?new IntersectionObserver(batch=>{
  for(const entry of batch){const state=states.get(entry.target.querySelector('.card__img'));if(!state)continue;const box=entry.boundingClientRect;state.rank=entry.isIntersecting?0:Math.max(1,box.top>=innerHeight?box.top-innerHeight:-box.bottom);if(!state.painted)waiting.add(state);}schedule();
 },{threshold:0}):null;
 function request(image,url){
  let state=states.get(image);
  if(state && state.url!==url)suspend(image);
  if(!state || state.url!==url){state={image,node:image.closest('.card'),url,rank:observer?Infinity:0,painted:false};states.set(image,state);}
  if(!state.node)return url;
  const cached=entries.get(url);
  if(state.painted)return url;
  image.classList.add('pt-catalogue-image-pending');image.loading='eager';image.decoding='async';
  observer?.observe(state.node);viewport?.observe(state.node);waiting.add(state);schedule();
  if(cached?.done){reveal(state);return url;}
  return blank;
 }
 function suspend(image){const state=states.get(image);if(!state)return;state.animation?.cancel();state.animation=null;waiting.delete(state);observer?.unobserve(state.node);viewport?.unobserve(state.node);const entry=entries.get(state.url);if(entry && !entry.done){entry.listeners.delete(state);if(![...entry.listeners].some(active))entry.abort();}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 return {request,suspend,forget(image){suspend(image);states.delete(image);}};
}
