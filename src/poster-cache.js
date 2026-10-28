// Shared final-size covers are decoded before display; no low-resolution intermediate.
// Decoded memory is bounded. The browser also retains its native HTTP cache.
export default function posterCache(L,enabled,highQuality){
 if(!L.Maker || !L.Utils)return;
 const Card=L.Maker.get('Card',{}),create=L.Utils.createInstance,queue=[],cache=new Map(),callbacks=new WeakMap();
 // Complete GIF89a, including its palette and pixel data. Apple's image
 // decoder can reject the old truncated placeholder as a broken cover.
 const blank='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
 let running=0,timer;
 const maximum=()=>enabled() && highQuality();
 const tv=()=>document.body.classList.contains('pt-tv');
 const paused=()=>document.hidden || document.body.classList.contains('pt-wheel-active') || tv() && document.body.classList.contains('pt-tv-busy');
 const observer=typeof window.IntersectionObserver==='function'?new window.IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){const callback=callbacks.get(entry.target);if(callback)callback();}
 })):null;
 function visible(image){
  const box=(image.closest('.card') || image).getBoundingClientRect();
  if(!tv() && !box.width && !box.height)return true; // Native visibility remains authoritative before layout.
  return box.width>0 && box.bottom>0 && box.top<window.innerHeight && box.right>0 && box.left<window.innerWidth;
 }
 // Measure only after navigation has settled. Keep at least two source
 // pixels per displayed pixel for cards; large cards retain their prior size.
 function fit(image,url){
  const card=image.closest('.card'),view=card && card.querySelector('.card__view');
  const box=(view || image).getBoundingClientRect();
  const width=(box.width || card && card.getBoundingClientRect().width || 0)*(window.devicePixelRatio || 1);
  if(!width || !Number.isFinite(width))return url;
  const match=url.match(/\/t\/p\/(w500|w780|w1280|original)\//);if(!match)return url;
  const wide=card && card.matches('.card--wide,.card--collection');
  let size=match[1];
  if(wide){if(width<=390 && ['w1280','original'].includes(size))size='w780';else if(width<=640 && size==='original')size='w1280';}
  else if(width<=250 && ['w780','original'].includes(size))size='w500';
  return url.replace(/(\/t\/p\/)(w500|w780|w1280|original)(\/)/,'$1'+size+'$3');
 }
 function trim(){
  let bytes=0;cache.forEach(entry=>bytes+=entry.bytes || 0);
  for(const [url,entry] of cache){
   if(cache.size<=40 && bytes<=(tv()?32:64)*1048576)break;
   if(entry.done){cache.delete(url);bytes-=entry.bytes || 0;}
  }
 }
 function schedule(delay){if(!timer && queue.length && !paused())timer=setTimeout(drain,typeof delay==='number'?delay:0);}
 function paint(job){
  job.finished=true;if(!job.alive() || !visible(job.image))return;
  if(paused()){job.finished=false;queue.unshift(job);return;}
  job.image.src=job.url;
 }
 function drain(){
  timer=null;if(paused())return;
  // Cached and shared in-flight images do not consume another network slot.
  for(let remaining=queue.length;remaining>0;remaining--){
   const job=queue.shift();if(!job.alive())continue;
   if(!visible(job.image)){job.finished=true;continue;}
   job.url=job.resolve();
   let entry=cache.get(job.url);
   if(entry){
    cache.delete(job.url);cache.set(job.url,entry);
    if(entry.done){paint(job);continue;}
    entry.jobs.add(job);job.entry=entry;continue;
   }
   if(running>=(tv()?2:3)){queue.push(job);continue;}
   const loader=new Image();loader.fetchPriority=tv()?'auto':'low';loader.decoding='async';
   entry={loader,jobs:new Set([job]),done:false};job.entry=entry;cache.set(job.url,entry);running++;
   let finished=false;
   const finish=ok=>{
    if(finished)return;finished=true;clearTimeout(entry.timeout);loader.onload=loader.onerror=null;running--;entry.abort=null;
    if(ok){entry.done=true;entry.bytes=(loader.naturalWidth || 1)*(loader.naturalHeight || 1)*4;trim();}else cache.delete(job.url);
    entry.jobs.forEach(waiting=>{waiting.entry=null;if(ok)paint(waiting);else{waiting.finished=true;if(waiting.alive())waiting.image.src='./img/img_broken.svg';}});entry.jobs.clear();
    schedule(0);
   };
   entry.abort=()=>{finish(false);loader.src='';};
   loader.onload=()=>{if(loader.decode)loader.decode().then(()=>finish(true),()=>finish(true));else finish(true);};
   loader.onerror=()=>finish(false);
   entry.timeout=setTimeout(()=>entry.abort && entry.abort(),12000);loader.src=job.url;
  }
 }
 document.addEventListener('minimal:tv-idle',schedule);
 document.addEventListener('minimal:wheel-idle',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 L.Utils.createInstance=function(Base,data){
  const item=create.apply(this,arguments);if(Base!==Card || !item || !item.use)return item;
  let image,source,original,getPoster,observed,disposed=false,generation=0,job;
  function cancel(){
   generation++;
   if(job){
    const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);
    const entry=job.entry;if(entry){entry.jobs.delete(job);if(!entry.done && !entry.jobs.size && entry.abort)entry.abort();}
   }
   job=null;
  }
  function enqueue(){
   if(!maximum() || !original || image.src===original || job && !job.finished && job.alive())return;
   const current=generation;
   job={image,url:original,resolve:()=>{original=fit(image,source);return original;},alive:()=>!disposed && current===generation && maximum() && image.isConnected};
   if(queue.length>=80)queue.shift().finished=true;queue.push(job);schedule();
  }
  item.use({onCreate(){
   image=item.img;getPoster=item.getPosterPath;if(!image || !getPoster)return;
   image.decoding='async';
   const nativeError=image.onerror;
   image.onerror=function(event){
    // A placeholder is not a TMDB mirror failure. Do not let the native
    // retry path put a data URI diagnostic over a successfully loaded poster.
    if(!disposed && maximum() && source && image.getAttribute('src')===blank){enqueue();return;}
    if(nativeError)return nativeError.call(this,event);
   };
   if(observer){observed=image.closest('.card');if(observed){callbacks.set(observed,enqueue);observer.observe(observed);}}
   item.getPosterPath=function(){
    const url=getPoster.apply(this,arguments);
    if(!maximum() || !/\/t\/p\/(?:w780|w1280|original)\//.test(url))return url;
    if(source!==url){cancel();source=url;original=url;}
    enqueue();return image.src===original?original:blank;
   };
   image._minimalArtwork=()=>{
    const next=getPoster.call(item);
    if(image.src===next || source===next && (image.src===original || job && !job.finished && job.alive()))return true;
    cancel();source=next;
    if(!/\/t\/p\/(?:w\d+|original)\//.test(next))return false;
    if(maximum()){original=next;image.src=blank;enqueue();}else image.src=next;
    return true;
   };
  },onVisible(){if(maximum() && original){clearTimeout(item.img_timer);enqueue();}},onDestroy(){
   disposed=true;cancel();if(observed){observer.unobserve(observed);callbacks.delete(observed);}if(image)delete image._minimalArtwork;
  }});
  return item;
 };
}
