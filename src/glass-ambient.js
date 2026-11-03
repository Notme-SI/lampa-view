// Ambient color uses an already decoded image. It never downloads or replaces artwork.
export default function glassAmbient(active,onPalette){
 const selector='.pt-hero__image,.full-start__background,.nova-hero__bg img,.minimal-torrent-banner__image',cache=new Map();
 let pending,timer,canvas;
 const moving=()=>document.hidden || document.body.matches('.pt-tv-busy,.pt-wheel-active');
 function current(image){const activity=image.closest('.activity');return image.isConnected && (!activity || activity.classList.contains('activity--active'));}
 function apply(colors,scene){if(scene)document.body.style.setProperty("--pt-glass-scene",'url("'+scene+'")');colors.forEach((color,index)=>document.body.style.setProperty('--pt-glass-tone-'+(index?'b':'a'),color.join(',')));if(onPalette)onPalette(colors);}
 function sample(){
  timer=null;if(!active() || moving() || !pending || !current(pending) || !pending.complete || !pending.naturalWidth)return;
  const image=pending,url=image.currentSrc || image.src;pending=null;
  if(cache.has(url)){const value=cache.get(url);cache.delete(url);cache.set(url,value);apply(value.colors,value.scene);return;}
  try{
   if(!canvas){canvas=document.createElement('canvas');canvas.width=6;canvas.height=6;}
   canvas.width=6;canvas.height=6;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
   ctx.clearRect(0,0,6,6);ctx.drawImage(image,0,0,6,6);const pixels=ctx.getImageData(0,0,6,6).data,colors=[];
   for(let half=0;half<2;half++){
    const sum=[0,0,0];let count=0;
    for(let y=0;y<6;y++)for(let x=half*3;x<half*3+3;x++){const i=(y*6+x)*4;if(pixels[i+3]<128)continue;count++;for(let k=0;k<3;k++)sum[k]+=pixels[i+k];}
    if(!count)return;const average=sum.map(value=>value/count),level=average.reduce((a,b)=>a+b,0)/3,gain=Math.min(2.4,Math.max(.7,90/Math.max(1,level)));
    colors.push(average.map(value=>Math.round(Math.max(24,Math.min(150,value*gain)))));
   }
   // A tiny, preblurred scene lets glass reveal real artwork rather than a
   // flat tint. Work is once per decoded source, never on scroll or per chip.
   canvas.width=64;canvas.height=36;ctx.drawImage(image,0,0,64,36);
   const frame=ctx.getImageData(0,0,64,36),tmp=new Uint8ClampedArray(frame.data.length),out=new Uint8ClampedArray(frame.data.length);
   for(let axis=0;axis<2;axis++){
    const input=axis?tmp:frame.data,target=axis?out:tmp;
    for(let y=0;y<36;y++)for(let x=0;x<64;x++)for(let c=0;c<4;c++){
     let sum=0;for(let k=-4;k<=4;k++){const xx=axis?x:Math.max(0,Math.min(63,x+k)),yy=axis?Math.max(0,Math.min(35,y+k)):y;sum+=input[(yy*64+xx)*4+c];}
     target[(y*64+x)*4+c]=sum/9;
    }
   }
   let light=0;for(let i=0;i<out.length;i+=4)light+=out[i]+out[i+1]+out[i+2];
   const gain=Math.min(2.4,Math.max(.7,110/Math.max(1,light/(64*36*3))));
   for(let i=0;i<out.length;i++)if(i%4!==3)out[i]=Math.min(255,out[i]*gain);
   frame.data.set(out);ctx.putImageData(frame,0,0);
   const scene=canvas.toDataURL('image/png'),value={colors,scene};
   cache.set(url,value);if(cache.size>16)cache.delete(cache.keys().next().value);apply(colors,scene);
  }catch(_){document.body.style.removeProperty('--pt-glass-scene');/* Cross-origin fallbacks retain the color ambience. */}
 }
 function queue(image){if(!active() || !image || !current(image))return;pending=image;if(!moving() && !timer)timer=setTimeout(sample,0);}
 function refresh(){if(!active())return;const images=Array.from(document.querySelectorAll(selector)).filter(current);queue(images[images.length-1]);}
 document.addEventListener('load',event=>{if(event.target.matches && event.target.matches(selector))queue(event.target);},true);
 document.addEventListener('minimal:tv-idle',()=>{if(pending && !timer)timer=setTimeout(sample,0);});
 document.addEventListener('minimal:wheel-idle',()=>{if(pending && !timer)timer=setTimeout(sample,0);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 return {refresh};
}
