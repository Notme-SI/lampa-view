export function reducedMotion(){
 return document.body.classList.contains('pt-reduce-motion') || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// A new focus replaces the destination, never queues another animation.
// Native wheel/touch input and screen lifecycle can take ownership at once.
export default function scrollMotion(read,write,duration=160){
 let frame=0,start=0,from=0,target=0;
 function stop(finish=false){
  if(frame)window.cancelAnimationFrame(frame);
  const moving=Boolean(frame);frame=0;
  if(finish && moving)write(target);
 }
 function tick(time){
  frame=0;
  const progress=Math.max(0,Math.min(1,(time-start)/duration));
  const remaining=(target-from)*Math.pow(1-progress,3);
  if(progress<1 && Math.abs(remaining)>.5){
   write(target-remaining);
   frame=window.requestAnimationFrame(tick);
  }else write(target);
 }
 return {
  to(value){
   if(frame && Math.abs(target-value)<.5)return;
   stop();target=value;from=read();
   if(!window.requestAnimationFrame || reducedMotion() || Math.abs(target-from)<1){write(target);return;}
   start=window.performance.now();frame=window.requestAnimationFrame(tick);
  },
  stop,
  active:()=>Boolean(frame)
 };
}
