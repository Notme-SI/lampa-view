// Show visible cards first; original files are bounded, low-priority upgrades.
export default function posterPreview(L,enabled){
 if(!L.Maker || !L.Utils)return;
 const Card=L.Maker.get('Card',{}),create=L.Utils.createInstance,queue=[];
 let running=0,timer;
 const maximum=()=>enabled() && L.Storage.get('minimal_banner_quality','maximum')==='maximum';
 const tv=()=>document.body.classList.contains('pt-tv');
 const paused=()=>tv() && (document.hidden || document.body.matches('.pt-tv-busy,.pt-wheel-active'));
 const callbacks=new WeakMap();
 const observer=typeof window.IntersectionObserver==='function'?new window.IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){const callback=callbacks.get(entry.target);if(callback)callback();}
 })):null;
 function visible(image){
  if(!tv())return true;
  const node=image.closest('.card') || image,box=node.getBoundingClientRect();
  return box.width>0 && box.bottom>0 && box.top<window.innerHeight && box.right>0 && box.left<window.innerWidth;
 }
 function drain(){
  timer=null;
  if(paused())return;
  while(running<(tv()?1:2) && queue.length){
   const job=queue.shift();if(!job.alive())continue;
   if(!visible(job.image)){job.finished=true;continue;}
   if(job.loaded){job.finished=true;job.image.src=job.url;continue;}
   running++;const loader=new Image();loader.fetchPriority='low';loader.decoding='async';job.loader=loader;
   let done=false;
   const finish=ok=>{
    if(done)return;done=true;clearTimeout(job.timeout);loader.onload=loader.onerror=null;job.cancel=null;job.loader=null;job.finished=true;running--;
    if(ok && job.alive()){
     if(paused()){job.loaded=true;job.finished=false;queue.unshift(job);}
     else if(visible(job.image))job.image.src=job.url;
    }
    schedule(tv()?80:300);
   };
   job.cancel=()=>{finish(false);loader.src='';};
   loader.onload=()=>finish(true);loader.onerror=()=>finish(false);
   job.timeout=setTimeout(()=>job.cancel && job.cancel(),12000);loader.src=job.url;
  }
 }
 function schedule(delay){if(!timer && queue.length && !paused())timer=setTimeout(drain,typeof delay==='number'?delay:tv()?600:300);}
 document.addEventListener('minimal:tv-idle',schedule);
 document.addEventListener('minimal:wheel-idle',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 L.Utils.createInstance=function(Base,data){
  const item=create.apply(this,arguments);if(Base!==Card || !item || !item.use)return item;
  let image,original,disposed=false,generation=0,job,observed;
  const cancel=()=>{generation++;if(job && job.cancel)job.cancel();job=null;};
  function loaded(){
   if(!maximum() || !original || !image.src.includes('/w300/') || job && !job.finished && job.alive())return;
   const current=generation;
   job={image,url:original,alive:()=>!disposed && current===generation && maximum() && image.isConnected};
   if(queue.length>=60)queue.shift().finished=true;queue.push(job);schedule();
  }
  item.use({onCreate(){
   image=item.img;const getPoster=item.getPosterPath;
   if(!image || !getPoster)return;
   image.decoding='async';
   if(tv() && observer){observed=image.closest('.card');if(observed){callbacks.set(observed,loaded);observer.observe(observed);}}
   item.getPosterPath=function(){
    const url=getPoster.apply(this,arguments);
    if(!maximum() || !/\/t\/p\/original\//.test(url))return url;
    original=url;return url.replace('/t/p/original/','/t/p/w300/');
   };
   image.addEventListener('load',loaded);
   document.addEventListener('minimal:artwork-quality',cancel);
  },onVisible(){if(image && image.complete && image.naturalWidth)loaded();},onDestroy(){disposed=true;cancel();if(observed){observer.unobserve(observed);callbacks.delete(observed);}if(image)image.removeEventListener('load',loaded);document.removeEventListener('minimal:artwork-quality',cancel);}});
  return item;
 };
}
