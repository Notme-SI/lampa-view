// Shared originals are decoded before display; no low-resolution intermediate.
// Decoded memory is bounded. The browser also retains its native HTTP cache.
export default function posterCache(L,enabled){
 if(!L.Maker || !L.Utils)return;
 const Card=L.Maker.get('Card',{}),create=L.Utils.createInstance,queue=[],cache=new Map(),callbacks=new WeakMap();
 const blank='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
 let running=0,timer;
 const maximum=()=>enabled() && L.Storage.get('minimal_banner_quality','maximum')==='maximum';
 const tv=()=>document.body.classList.contains('pt-tv');
 const paused=()=>tv() && (document.hidden || document.body.matches('.pt-tv-busy,.pt-wheel-active'));
 const observer=typeof window.IntersectionObserver==='function'?new window.IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){const callback=callbacks.get(entry.target);if(callback)callback();}
 })):null;
 function visible(image){
  if(!tv())return true;
  const box=(image.closest('.card') || image).getBoundingClientRect();
  return box.width>0 && box.bottom>0 && box.top<window.innerHeight && box.right>0 && box.left<window.innerWidth;
 }
 function trim(){
  let bytes=0;cache.forEach(entry=>bytes+=entry.bytes || 0);
  for(const [url,entry] of cache){
   if(cache.size<=40 && bytes<=(tv()?32:64)*1048576)break;
   if(entry.done){cache.delete(url);bytes-=entry.bytes || 0;}
  }
 }
 function schedule(delay){if(!timer && queue.length && !paused())timer=setTimeout(drain,typeof delay==='number'?delay:tv()?360:0);}
 function paint(job){
  job.finished=true;if(!job.alive() || !visible(job.image))return;
  if(paused()){job.finished=false;queue.unshift(job);return;}
  job.image.src=job.url;
 }
 function drain(){
  timer=null;if(paused())return;
  while(running<(tv()?1:3) && queue.length){
   const job=queue.shift();if(!job.alive())continue;
   if(!visible(job.image)){job.finished=true;continue;}
   let entry=cache.get(job.url);
   if(entry){
    cache.delete(job.url);cache.set(job.url,entry);
    if(entry.done){paint(job);continue;}
    entry.jobs.add(job);job.entry=entry;continue;
   }
   const loader=new Image();loader.fetchPriority='low';loader.decoding='async';
   entry={loader,jobs:new Set([job]),done:false};job.entry=entry;cache.set(job.url,entry);running++;
   let finished=false;
   const finish=ok=>{
    if(finished)return;finished=true;clearTimeout(entry.timeout);loader.onload=loader.onerror=null;running--;entry.abort=null;
    if(ok){entry.done=true;entry.bytes=(loader.naturalWidth || 1)*(loader.naturalHeight || 1)*4;trim();}else cache.delete(job.url);
    entry.jobs.forEach(waiting=>{waiting.entry=null;if(ok)paint(waiting);else{waiting.finished=true;if(waiting.alive())waiting.image.src='./img/img_broken.svg';}});entry.jobs.clear();
    schedule(tv()?80:0);
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
  let image,original,getPoster,observed,disposed=false,generation=0,job;
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
   job={image,url:original,alive:()=>!disposed && current===generation && maximum() && image.isConnected};
   if(queue.length>=80)queue.shift().finished=true;queue.push(job);schedule();
  }
  item.use({onCreate(){
   image=item.img;getPoster=item.getPosterPath;if(!image || !getPoster)return;
   image.decoding='async';
   if(observer){observed=image.closest('.card');if(observed){callbacks.set(observed,enqueue);observer.observe(observed);}}
   item.getPosterPath=function(){
    const url=getPoster.apply(this,arguments);
    if(!maximum() || !/\/t\/p\/original\//.test(url))return url;
    original=url;enqueue();return image.src===url?url:blank;
   };
   image._minimalArtwork=()=>{
    cancel();const next=getPoster.call(item);
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
