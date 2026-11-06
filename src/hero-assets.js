import {logoSize} from './artwork.js';
import imageFiles from './image-files.js';
// Keep a bounded working set across carousel mounts. Successful images survive
// navigation; pending requests and callbacks still belong to their screen.
const pools=new WeakMap();
export default function heroAssets(L,cards,loadLogo,element){
 let pool=pools.get(L);if(!pool){pool={images:new Map(),active:new Map()};pools.set(L,pool);}
 const files=imageFiles(L),images=pool.images,owner={},branding=new Map();let disposed=false,current=0,warmTimer,warmWanted=false,upgradeTimer,upgradeWanted,onscreen=true;
 const wrap=i=>(i+cards.length)%cards.length;
 const pin=(kind,url)=>{const active=pool.active.get(owner) || {};active[kind]=url;pool.active.set(owner,active);};
 const paused=()=>!onscreen || document.hidden || document.body.matches('.pt-wheel-active,.pt-tv-busy');
 const coverUrl=(i,size)=>L.TMDB.image('/t/p/'+size+cards[wrap(i)].backdrop_path);
 function remove(url,entry){
  images.delete(url);clearTimeout(entry.timeout);entry.image.onload=entry.image.onerror=null;
  if(!entry.done)entry.callbacks=[];
  if(entry.release)entry.release();entry.image.src='';
 }
 function trim(){
  let bytes=0;images.forEach(e=>bytes+=e.bytes || 0);
  const tv=document.body.classList.contains('pt-tv'),budget=(tv?40:48)*1048576,maximumOriginals=tv?4:2;
  let originals=[...images.values()].filter(e=>e.original && e.done).length;
  for(const [url,entry] of images){
   const crowded=images.size>24 || bytes>budget;
   if(!crowded && originals<=maximumOriginals)break;
   if(!crowded && !entry.original)continue;
   if(![...pool.active.values()].some(active=>Object.values(active).includes(url)) && entry.done){bytes-=entry.bytes || 0;if(entry.original)originals--;remove(url,entry);}
  }
 }
 function fetchImage(url,callback,type,priority,coverPath){
  if(disposed)return;
  const notify=callback;callback=value=>{if(!disposed)notify(value);};callback.owner=owner;
  const existing=images.get(url);
  if(existing){
   images.delete(url);images.set(url,existing);
   if(priority!=='low' && existing.cover){existing.background=false;existing.image.fetchPriority=priority || 'auto';}
   if(existing.done)callback(existing.url);else existing.callbacks.push(callback);
   return;
  }
  const entry={image:new Image(),callbacks:[callback],url,owner,done:false,original:type==='original',cover:type==='cover' || type==='original',coverPath,background:priority==='low'};images.set(url,entry);
  entry.image.decoding='async';entry.image.fetchPriority=priority || 'auto';
  function finish(value){
   if(images.get(url)!==entry || entry.done)return;
   clearTimeout(entry.timeout);entry.image.onload=entry.image.onerror=null;entry.done=true;entry.url=value;
   entry.bytes=(entry.image.naturalWidth || 1)*(entry.image.naturalHeight || 1)*4;
   // A transient proxy error is not a reusable cached image. Selecting the
   // slide again must be able to retry rather than retain a permanent blank.
   if(!value){images.delete(url);if(entry.release)entry.release();}
   const callbacks=entry.callbacks;entry.callbacks=[];callbacks.forEach(fn=>fn(value));trim();
   if(entry.cover && !entry.background)scheduleWarm(1200);
  }
  entry.image.onload=()=>{if(entry.image.decode)entry.image.decode().catch(()=>{}).then(()=>finish(entry.image.src));else finish(entry.image.src);};
  entry.image.onerror=()=>{files.invalidate(url);finish('');};entry.timeout=setTimeout(()=>{finish('');entry.image.src='';},12000);entry.release=files.load(url,src=>{entry.image.src=src;});trim();
 }
 function select(i){
  if(current!==wrap(i)){clearTimeout(upgradeTimer);upgradeWanted=null;pin('logo','');pin('studio','');}current=wrap(i);
  const path=cards[current].backdrop_path;
  // Proxy URLs may encode the path or append account/uid parameters. Keep
  // selection identity separately; URL suffixes cannot identify a backdrop.
  for(const [url,entry] of images)if(entry.owner===owner && entry.cover && !entry.background && !entry.done && entry.coverPath!==path && entry.callbacks.every(fn=>fn.owner===owner))remove(url,entry);
 }
 function cover(i,size,callback,background){
  i=wrap(i);const url=coverUrl(i,size);
  if(!background){select(i);pin('cover',url);}
  fetchImage(url,callback,size==='original'?'original':'cover',background?'low':'high',cards[i].backdrop_path);
 }
 // Cache canonical metadata, never rendered blob URLs: decoded eviction can
 // release/revoke those URLs while this carousel remains mounted.
 function metadata(i,callback){
  const saved=branding.get(i);if(saved){if(saved.callbacks)saved.callbacks.push(callback);else callback(saved);return;}
  const pending={callbacks:[callback]};branding.set(i,pending);
  loadLogo(cards[i],(path,studio,language)=>{
   if(disposed)return;
   const value={path,studio,language};if(path || studio)branding.set(i,value);else branding.delete(i);pending.callbacks.forEach(fn=>fn(value));
  });
 }
 function logo(i,callback){
  i=wrap(i);metadata(i,value=>{
   if(!value.path)return callback('',value.language);
   const url=L.TMDB.image('/t/p/'+(/\.svg$/i.test(value.path)?'original':logoSize())+value.path,{preserveSize:true});if(i===current)pin('logo',url);
   fetchImage(url,src=>callback(src,value.language),'logo');
  });
 }
 function studio(i,callback){
  i=wrap(i);metadata(i,value=>{
   const studio=value.studio;if(!studio || !studio.path)return callback(null);
   const url=L.TMDB.image('/t/p/w300'+studio.path,{preserveSize:true});if(i===current)pin('studio',url);
   fetchImage(url,src=>callback(src?{url:src,name:studio.name,id:studio.id,kind:studio.kind,path:studio.path}:null),'studio');
  });
 }
 function scheduleWarm(delay){
  clearTimeout(warmTimer);warmTimer=null;
  if(!warmWanted || disposed || paused())return;
  // Neighbours must not compete with an unfinished selected banner.
  if([...images.values()].some(entry=>entry.cover && !entry.background && !entry.done))return;
  warmTimer=setTimeout(()=>{
   warmTimer=null;if(paused())return;
   if([...images.values()].some(entry=>entry.cover && !entry.background && !entry.done))return;
   warmWanted=false;
   const tv=document.body.classList.contains('pt-tv');
   [...new Set(tv?[wrap(current+1)]:[wrap(current+1),wrap(current-1)])].filter(n=>n!==current).forEach(n=>{
    // A lightweight neighbour must not allocate another decoded 4K original.
    if(tv)cover(n,'w1280',()=>{},true);
    else{cover(n,'w780',()=>{},true);logo(n,()=>{});}
   });
  },delay);
 }
 function warm(i){select(i);warmWanted=true;scheduleWarm(1200);}
 function scheduleUpgrade(){
  clearTimeout(upgradeTimer);if(!upgradeWanted || disposed || paused())return;
  upgradeTimer=setTimeout(()=>{if(paused() || !upgradeWanted)return;const task=upgradeWanted;upgradeWanted=null;cover(task.i,task.size,task.callback);},700);
 }
 function cancelUpgrade(cancelPendingOriginal=false){
  clearTimeout(upgradeTimer);upgradeWanted=null;
  if(cancelPendingOriginal)for(const [url,entry] of images)if(entry.owner===owner && entry.original && !entry.done && entry.callbacks.every(fn=>fn.owner===owner))remove(url,entry);
 }
 function upgrade(i,size,callback){upgradeWanted={i:wrap(i),size,callback};scheduleUpgrade();}
 function resume(){scheduleUpgrade();scheduleWarm(document.body.classList.contains('pt-tv')?1200:300);}
 const observer=element && typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{onscreen=entries.some(entry=>entry.isIntersecting);if(onscreen)resume();else{clearTimeout(upgradeTimer);clearTimeout(warmTimer);}}):null;
 if(observer)observer.observe(element);
 document.addEventListener('minimal:wheel-idle',resume);
 document.addEventListener('minimal:tv-idle',resume);
 document.addEventListener('visibilitychange',resume);
 function ready(i,size){
  const url=coverUrl(i,size),saved=images.get(url);
  if(!saved || !saved.done || !saved.url){const source=files.peek(url);if(source){pin('cover',url);}return source;}
  images.delete(url);images.set(url,saved);pin('cover',url);
  return saved.url;
 }
 function dispose(){
  disposed=true;clearTimeout(warmTimer);clearTimeout(upgradeTimer);upgradeWanted=null;if(observer)observer.disconnect();
  document.removeEventListener('minimal:wheel-idle',resume);document.removeEventListener('minimal:tv-idle',resume);document.removeEventListener('visibilitychange',resume);
  pool.active.delete(owner);
  for(const [url,entry] of images)if(!entry.done){entry.callbacks=entry.callbacks.filter(fn=>fn.owner!==owner);if(!entry.callbacks.length)remove(url,entry);}
  trim();
  branding.clear();
 }
 return {cover,logo,studio,warm,ready,select,upgrade,cancelUpgrade,dispose};
}
