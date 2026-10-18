// Show visible cards first; original files are bounded, low-priority upgrades.
export default function posterPreview(L,enabled){
 if(!L.Maker || !L.Utils)return;
 const Card=L.Maker.get('Card',{}),create=L.Utils.createInstance,queue=[];
 let running=0,timer;
 const maximum=()=>enabled() && L.Storage.get('minimal_banner_quality','maximum')==='maximum';
 function drain(){
  timer=null;
  while(running<2 && queue.length){
   const job=queue.shift();if(!job.alive())continue;
   running++;const loader=new Image();loader.fetchPriority='low';job.loader=loader;
   let done=false;
   const finish=ok=>{if(done)return;done=true;clearTimeout(job.timeout);loader.onload=loader.onerror=null;job.cancel=null;running--;if(ok && job.alive())job.image.src=job.url;schedule();};
   job.cancel=()=>{finish(false);loader.src='';};
   loader.onload=()=>finish(true);loader.onerror=()=>finish(false);
   job.timeout=setTimeout(()=>job.cancel && job.cancel(),12000);loader.src=job.url;
  }
 }
 function schedule(){if(!timer && queue.length)timer=setTimeout(drain,300);}
 L.Utils.createInstance=function(Base,data){
  const item=create.apply(this,arguments);if(Base!==Card || !item || !item.use)return item;
  let image,original,disposed=false,generation=0,job;
  const cancel=()=>{generation++;if(job && job.cancel)job.cancel();job=null;};
  function loaded(){
   if(!maximum() || !original || !image.src.includes('/w300/'))return;
   const current=generation;
   job={image,url:original,alive:()=>!disposed && current===generation && maximum() && image.isConnected};
   if(queue.length>=60)queue.shift();queue.push(job);schedule();
  }
  item.use({onCreate(){
   image=item.img;const getPoster=item.getPosterPath;
   if(!image || !getPoster)return;
   item.getPosterPath=function(){
    const url=getPoster.apply(this,arguments);
    if(!maximum() || !/\/t\/p\/original\//.test(url))return url;
    original=url;return url.replace('/t/p/original/','/t/p/w300/');
   };
   image.addEventListener('load',loaded);
   document.addEventListener('minimal:artwork-quality',cancel);
  },onDestroy(){disposed=true;cancel();if(image)image.removeEventListener('load',loaded);document.removeEventListener('minimal:artwork-quality',cancel);}});
  return item;
 };
}
