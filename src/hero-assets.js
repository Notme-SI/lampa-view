// Share artwork by URL, retain a small decoded working set, and cancel obsolete
// full-size requests as soon as selection changes.
export default function heroAssets(L,cards,loadLogo){
 const images=new Map(),logos=new Map(),studios=new Map();let disposed=false,current=0,warmTimer,warmWanted=false,activeCover='';
 const wrap=i=>(i+cards.length)%cards.length;
 const paused=()=>document.hidden || document.body.matches('.pt-wheel-active,.pt-tv-busy');
 const coverUrl=(i,size)=>L.TMDB.image('/t/p/'+size+cards[wrap(i)].backdrop_path);
 function remove(url,entry){
  images.delete(url);clearTimeout(entry.timeout);entry.image.onload=entry.image.onerror=null;
  if(!entry.done)entry.callbacks=[];
  entry.image.src='';
 }
 function trim(){
  let bytes=0;images.forEach(e=>bytes+=e.bytes || 0);
  const budget=(document.body.classList.contains('pt-tv')?24:48)*1048576;
  let originals=[...images.values()].filter(e=>e.original && e.done).length;
  for(const [url,entry] of images){
   const crowded=images.size>24 || bytes>budget;
   if(!crowded && originals<=2)break;
   if(!crowded && !entry.original)continue;
   if(url!==activeCover && entry.done){bytes-=entry.bytes || 0;if(entry.original)originals--;remove(url,entry);}
  }
 }
 function fetchImage(url,callback,type,priority){
  if(disposed)return;
  const existing=images.get(url);
  if(existing){images.delete(url);images.set(url,existing);if(existing.done)callback(existing.url);else existing.callbacks.push(callback);return;}
  const entry={image:new Image(),callbacks:[callback],url,done:false,original:type==='original'};images.set(url,entry);
  entry.image.decoding='async';entry.image.fetchPriority=priority || 'auto';
  function finish(value){
   if(disposed || images.get(url)!==entry || entry.done)return;
   clearTimeout(entry.timeout);entry.image.onload=entry.image.onerror=null;entry.done=true;entry.url=value;
   entry.bytes=(entry.image.naturalWidth || 1)*(entry.image.naturalHeight || 1)*4;
   const callbacks=entry.callbacks;entry.callbacks=[];callbacks.forEach(fn=>fn(value));trim();
  }
  entry.image.onload=()=>{if(entry.image.decode)entry.image.decode().catch(()=>{}).then(()=>finish(url));else finish(url);};
  entry.image.onerror=()=>finish('');entry.timeout=setTimeout(()=>{finish('');entry.image.src='';},12000);entry.image.src=url;trim();
 }
 function select(i){
  current=wrap(i);
  const selected=coverUrl(current,'original');
  for(const [url,entry] of images)if(entry.original && !entry.done && url!==selected)remove(url,entry);
 }
 function cover(i,size,callback,background){
  i=wrap(i);const url=coverUrl(i,size);
  if(!background){select(i);activeCover=url;}
  fetchImage(url,callback,size==='original'?'original':'cover',background?'low':'high');
 }
 function logo(i,callback){
  i=wrap(i);const saved=logos.get(i);if(saved){if(saved.callbacks)saved.callbacks.push(callback);else callback(saved.url,saved.language);return;}
  const pending={callbacks:[callback]};logos.set(i,pending);
  loadLogo(cards[i],(path,studio,language)=>{
   if(disposed)return;
   const waiting=studios.get(i) || {callbacks:[]};studios.set(i,waiting);
   function finishStudio(url){const value=url?{url,name:studio.name}:null;studios.set(i,{value});if(waiting)waiting.callbacks.forEach(fn=>fn(value));}
   if(studio && studio.path)fetchImage(L.TMDB.image('/t/p/w300'+studio.path),finishStudio,'studio');else finishStudio('');
   function finish(url){logos.set(i,{url,language});pending.callbacks.forEach(fn=>fn(url,language));}
   if(!path)return finish('');
   fetchImage(L.TMDB.image('/t/p/original'+path),finish,'logo');
  });
 }
 function studio(i,callback){
  i=wrap(i);const saved=studios.get(i);
  if(saved){if(saved.callbacks)saved.callbacks.push(callback);else callback(saved.value);return;}
  studios.set(i,{callbacks:[callback]});logo(i,()=>{});
 }
 function scheduleWarm(delay){
  clearTimeout(warmTimer);warmTimer=null;
  if(!warmWanted || disposed || paused())return;
  warmTimer=setTimeout(()=>{
   warmTimer=null;if(paused())return;
   warmWanted=false;
   [...new Set([wrap(current+1),wrap(current-1)])].filter(n=>n!==current).forEach(n=>{cover(n,'w780',()=>{},true);logo(n,()=>{});});
  },delay);
 }
 function warm(i){select(i);warmWanted=true;scheduleWarm(1200);}
 function resume(){scheduleWarm(300);}
 document.addEventListener('minimal:wheel-idle',resume);
 document.addEventListener('minimal:tv-idle',resume);
 document.addEventListener('visibilitychange',resume);
 function ready(i,size){
  const url=coverUrl(i,size),saved=images.get(url);
  if(!saved || !saved.done || !saved.url)return '';
  images.delete(url);images.set(url,saved);activeCover=url;
  return saved.url;
 }
 function dispose(){
  disposed=true;clearTimeout(warmTimer);
  document.removeEventListener('minimal:wheel-idle',resume);document.removeEventListener('minimal:tv-idle',resume);document.removeEventListener('visibilitychange',resume);
  for(const [url,entry] of images)remove(url,entry);
  logos.clear();studios.clear();
 }
 return {cover,logo,studio,warm,ready,select,dispose};
}
