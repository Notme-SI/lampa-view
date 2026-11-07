// Shared final-size covers are decoded before display; no low-resolution intermediate.
// Decoded memory is bounded. The browser also retains its native HTTP cache.
import imageFiles from './image-files.js';
export default function posterCache(L,enabled,highQuality){
 if(!L.Maker || !L.Utils)return;
 const files=imageFiles(L);
 const Card=L.Maker.get('Card',{}),create=L.Utils.createInstance,queue=[],cache=new Map(),callbacks=new WeakMap();
 // Complete GIF89a, including its palette and pixel data. Apple's image
 // decoder can reject the old truncated placeholder as a broken cover.
 const blank='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
 let running=0,timer;
 const maximum=()=>enabled() && highQuality();
 const tv=()=>document.body.classList.contains('pt-tv');
 const aheadY=Math.min(1600,Math.max(540,(window.innerHeight || 540)*(tv()?1.5:2))),aheadX=Math.min(720,Math.max(360,(window.innerWidth || 960)/2));
 const paused=()=>document.hidden;
 const observer=typeof window.IntersectionObserver==='function'?new window.IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){const callback=callbacks.get(entry.target);if(callback)callback();}
 }),{rootMargin:aheadY+'px '+aheadX+'px'}):null;
 function nearby(image){
  const box=(image.closest('.card') || image).getBoundingClientRect();
  return box.width>0 && box.bottom> -aheadY && box.top<window.innerHeight+aheadY && box.right> -aheadX && box.left<window.innerWidth+aheadX;
 }
 function visible(image){
  const box=(image.closest('.card') || image).getBoundingClientRect();
  if(!tv() && !box.width && !box.height)return true; // Native visibility remains authoritative before layout.
  return box.width>0 && box.bottom>0 && box.top<window.innerHeight && box.right>0 && box.left<window.innerWidth;
 }
 // The artwork API already chose the source resolution. Preserve it through decoding.
 function fit(image,url){
  // High on a TV must not be downgraded from its CSS viewport dimensions.
  if(tv())return url.replace(/(\/t\/p\/)w(\d+)(\/)/,(all,prefix,size,suffix)=>Number(size)<780?prefix+'w780'+suffix:all);
  return url;
 }
 function trim(){
  let bytes=0;cache.forEach(entry=>bytes+=entry.bytes || 0);
  for(const [url,entry] of cache){
   if(cache.size<=40 && bytes<=64*1048576)break;
   if(entry.done){cache.delete(url);bytes-=entry.bytes || 0;if(entry.release)entry.release();entry.loader.src='';}
  }
 }
 function schedule(delay){if(!timer && queue.length)timer=setTimeout(drain,typeof delay==='number'?delay:0);}
 function paint(job){
  job.finished=true;if(!job.alive() || !nearby(job.image) && !visible(job.image))return;
  job.paint();
 }
 function drain(){
  timer=null;
  // Cached covers paint immediately. Visible requests take priority over a
  // bounded look-ahead. Movement must not serialize the next row behind one
  // slow cover; visible work still owns the remaining network slots.
  const visibleJobs=new Map(queue.map(job=>[job,visible(job.image)]));
  queue.sort((a,b)=>Number(visibleJobs.get(b))-Number(visibleJobs.get(a)));
  // Cached and shared in-flight images do not consume another network slot.
  for(let remaining=queue.length;remaining>0;remaining--){
   const job=queue.shift();if(!job.alive()){job.finished=true;continue;}
   if(!visibleJobs.get(job) && !nearby(job.image)){job.finished=true;continue;}
   job.url=job.resolve();
   let entry=cache.get(job.url);
   if(entry){
    cache.delete(job.url);cache.set(job.url,entry);
    if(entry.done){paint(job);continue;}
    entry.jobs.add(job);job.entry=entry;continue;
   }
   if(!visibleJobs.get(job) && paused() || running>=(tv()?4:document.body.classList.contains('pt-mobile')?6:8) || !visibleJobs.get(job) && running>=(tv() || document.body.classList.contains('pt-mobile')?2:4)){queue.push(job);continue;}
   const loader=new Image();loader.fetchPriority=visibleJobs.get(job)?'high':'low';loader.decoding='async';
   entry={loader,jobs:new Set([job]),done:false};job.entry=entry;cache.set(job.url,entry);running++;
   let finished=false;
   const finish=ok=>{
    if(finished)return;finished=true;clearTimeout(entry.timeout);loader.onload=loader.onerror=null;running--;entry.abort=null;
    if(ok){entry.done=true;entry.bytes=(loader.naturalWidth || 1)*(loader.naturalHeight || 1)*4;trim();}else{cache.delete(job.url);if(entry.release)entry.release();}
    entry.jobs.forEach(waiting=>{waiting.entry=null;if(ok)paint(waiting);else{waiting.finished=true;if(waiting.alive())waiting.image.src='./img/img_broken.svg';}});entry.jobs.clear();
    schedule(0);
   };
   entry.abort=()=>{finish(false);if(entry.release)entry.release();loader.src='';};
   loader.onload=()=>{if(loader.decode)loader.decode().then(()=>finish(true),()=>finish(true));else finish(true);};
   loader.onerror=()=>{files.invalidate(job.url);finish(false);};
   entry.timeout=setTimeout(()=>entry.abort && entry.abort(),12000);entry.release=files.load(job.url,src=>{loader.src=src;});
  }
 }
 // Native rows scroll both with scroll offsets and translated content. Re-rank
 // waiting covers during navigation, instead of waiting for another download.
 window.addEventListener('scroll',()=>schedule(16),{capture:true,passive:true});
 document.addEventListener('wheel',()=>schedule(16),{passive:true});
 document.addEventListener('keydown',event=>{if(/^(Arrow|Page)/.test(event.key || ''))schedule(16);});
 document.addEventListener('minimal:tv-idle',schedule);
 document.addEventListener('minimal:wheel-idle',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 L.Utils.createInstance=function(Base,data){
  const item=create.apply(this,arguments);if(Base!==Card || !item || !item.use)return item;
  let image,source,original,getPoster,observed,disposed=false,generation=0,job,painted,release;
  function cancel(){
   generation++;painted=null;if(release){release();release=null;}
   if(job){
    const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);
    const entry=job.entry;if(entry){entry.jobs.delete(job);if(!entry.done && !entry.jobs.size && entry.abort)entry.abort();}
   }
   job=null;
  }
  function paintSource(url){
   if(release)release();release=files.load(url,src=>{if(!disposed){painted=url;image.src=src;}});
  }
  function enqueue(){
   if(!maximum() || !original || painted===original || image.src===original || job && !job.finished && job.alive())return;
   original=fit(image,source);
   const saved=cache.get(original);
   if(saved && saved.done || files.has(original)){paintSource(original);return;}
   const current=generation;
   job={image,url:original,paint:()=>paintSource(original),resolve:()=>{original=fit(image,source);return original;},alive:()=>!disposed && current===generation && maximum() && image.isConnected};
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
   if(observer){observed=image.closest('.card');if(observed){callbacks.set(observed,()=>{if(!original && maximum())item.getPosterPath();enqueue();});observer.observe(observed);}}
   item.getPosterPath=function(){
    const url=getPoster.apply(this,arguments);
    if(!maximum() || !/\/t\/p\/(?:w\d+|original)\//.test(url))return url;
    if(source!==url){cancel();source=url;original=url;}
    enqueue();return painted===original || image.src===original?image.src:blank;
   };
   image._minimalArtwork=()=>{
    const next=getPoster.call(item);
    if(image.src===next || source===next && (painted===original || image.src===original || job && !job.finished && job.alive()))return true;
    cancel();source=next;
    if(!/\/t\/p\/(?:w\d+|original)\//.test(next))return false;
    if(maximum()){original=next;enqueue();}else image.src=next;
    return true;
   };
  },onVisible(){if(maximum() && original){clearTimeout(item.img_timer);enqueue();}},onDestroy(){
   disposed=true;cancel();if(release)release();if(observed){observer.unobserve(observed);callbacks.delete(observed);}if(image)delete image._minimalArtwork;
  }});
  return item;
 };
}
