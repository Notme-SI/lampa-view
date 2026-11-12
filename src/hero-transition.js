import {reducedMotion} from './scroll-motion.js';

// Keep the decoded outgoing artwork above the new image until its load event.
// Only this short-lived layer fades; the banner's layout and text stay stable.
export default function heroTransition(image){
 let overlay=null,animation=null,load=null,error=null,disposed=false,revision=0;
 function clear(keepOverlay=false){
  if(load)image.removeEventListener('load',load);
  if(error)image.removeEventListener('error',error);
  load=error=null;
  if(animation){const old=animation;animation=null;old.onfinish=null;old.cancel();}
  if(overlay && !keepOverlay){overlay.remove();overlay=null;}
 }
 return {
  show(url){
   if(disposed || !url || image.getAttribute('src')===url)return;
   const token=++revision;
   const previous=image.complete && image.naturalWidth?image.currentSrc || image.src:overlay?.getAttribute('src') || '';
   const fading=Boolean(overlay),opacity=overlay?getComputedStyle(overlay).opacity:'1';
   const animate=previous && !reducedMotion() && typeof image.animate==='function';
   clear(Boolean(animate && fading));
   if(animate){
    const style=getComputedStyle(image);
    if(!overlay){
     overlay=document.createElement('img');overlay.className='pt-hero__previous';
     overlay.alt='';overlay.setAttribute('aria-hidden','true');overlay.src=previous;
    }
    // Copy the actual theme's sizing and mask without making scene/color
    // observers treat the outgoing layer as the selected hero image.
    for(const property of ['top','left','right','bottom','width','height','maxWidth','objectFit','objectPosition','transform','transformOrigin','maskImage','webkitMaskImage','borderRadius','zIndex'])overlay.style[property]=style[property];
    Object.assign(overlay.style,{position:'absolute',pointerEvents:'none',margin:'0',opacity});
    image.parentElement.appendChild(overlay);
    load=()=>{
     if(!overlay)return;
     animation=overlay.animate([{opacity:Number(opacity)},{opacity:0}],{duration:240,easing:'ease-out',fill:'forwards'});
     // onfinish also works in WebViews that expose animate() without the
     // newer Animation.finished promise.
     animation.onfinish=()=>{if(token===revision)clear();};
    };
    error=()=>{const fallback=previous;clear();image.src=fallback;};
    image.addEventListener('load',load,{once:true});image.addEventListener('error',error,{once:true});
   }
   image.src=url;
  },
  dispose(){disposed=true;revision++;clear();}
 };
}
