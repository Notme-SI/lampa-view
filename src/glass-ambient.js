// Ambient color uses an already decoded image. It never downloads or replaces artwork.
export default function glassAmbient(active){
 const selector='.pt-hero__image,.full-start__background,.nova-hero__bg img,.minimal-torrent-banner__image',cache=new Map();
 let pending,timer,canvas;
 const moving=()=>document.hidden || document.body.matches('.pt-tv-busy,.pt-wheel-active');
 function current(image){const activity=image.closest('.activity');return image.isConnected && (!activity || activity.classList.contains('activity--active'));}
 function apply(colors){colors.forEach((color,index)=>document.body.style.setProperty('--pt-glass-tone-'+(index?'b':'a'),color.join(',')));}
 function sample(){
  timer=null;if(!active() || moving() || !pending || !current(pending) || !pending.complete || !pending.naturalWidth)return;
  const image=pending,url=image.currentSrc || image.src;pending=null;
  if(cache.has(url)){const colors=cache.get(url);cache.delete(url);cache.set(url,colors);apply(colors);return;}
  try{
   if(!canvas){canvas=document.createElement('canvas');canvas.width=6;canvas.height=6;}
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
   ctx.clearRect(0,0,6,6);ctx.drawImage(image,0,0,6,6);const pixels=ctx.getImageData(0,0,6,6).data,colors=[];
   for(let half=0;half<2;half++){
    const sum=[0,0,0];let count=0;
    for(let y=0;y<6;y++)for(let x=half*3;x<half*3+3;x++){const i=(y*6+x)*4;if(pixels[i+3]<128)continue;count++;for(let k=0;k<3;k++)sum[k]+=pixels[i+k];}
    if(!count)return;const average=sum.map(value=>value/count),level=average.reduce((a,b)=>a+b,0)/3,gain=Math.min(2.4,Math.max(.7,90/Math.max(1,level)));
    colors.push(average.map(value=>Math.round(Math.max(24,Math.min(150,value*gain)))));
   }
   cache.set(url,colors);if(cache.size>32)cache.delete(cache.keys().next().value);apply(colors);
  }catch(_){/* Cross-origin native fallbacks keep the neutral ambient colors. */}
 }
 function queue(image){if(!active() || !image || !current(image))return;pending=image;if(!moving() && !timer)timer=setTimeout(sample,0);}
 function refresh(){if(!active())return;const images=Array.from(document.querySelectorAll(selector)).filter(current);queue(images[images.length-1]);}
 document.addEventListener('load',event=>{if(event.target.matches && event.target.matches(selector))queue(event.target);},true);
 document.addEventListener('minimal:tv-idle',()=>{if(pending && !timer)timer=setTimeout(sample,0);});
 document.addEventListener('minimal:wheel-idle',()=>{if(pending && !timer)timer=setTimeout(sample,0);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 return {refresh};
}
