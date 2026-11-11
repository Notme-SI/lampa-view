// The Home Screen canvas and its controls must share one coordinate system.
// A translucent status bar can leave VisualViewport shorter than the CSS
// canvas. That smaller rectangle is useful for a keyboard, not for page height.
export default function iosFrame(enabled){
 let probe,saved;
 const properties=['--pt-mobile-viewport','--pt-mobile-frame-width','--pt-mobile-dock-top'];
 function clear(){
  const body=document.body;
  body.classList.remove('pt-ios-frame','pt-ios-dock-positioned');
  if(saved){for(const [name,value,priority] of saved){if(value)body.style.setProperty(name,value,priority);else body.style.removeProperty(name);}saved=null;}
  if(probe){probe.remove();probe=null;}
 }
 function update(dockHeight){
  const body=document.body;
  if(!enabled() || !body.classList.contains('pt-mobile') || !document.documentElement.classList.contains('pt-ios-standalone'))return clear();
  if(!saved)saved=properties.map(name=>[name,body.style.getPropertyValue(name),body.style.getPropertyPriority(name)]);
  if(!probe){probe=document.createElement('div');probe.className='pt-ios-frame-probe';probe.setAttribute('aria-hidden','true');body.appendChild(probe);}
  const canvas=Math.max(probe.getBoundingClientRect().height,window.innerHeight || 0);
  if(!(canvas>0))return;
  const viewport=window.visualViewport,scale=viewport?.scale || 1;
  const focused=document.activeElement?.matches('input,textarea,[contenteditable="true"]');
  const keyboard=focused && viewport && scale===1 && viewport.height<canvas*.75;
  const height=keyboard?Math.min(canvas,viewport.offsetTop+viewport.height):canvas;
  body.style.setProperty('--pt-mobile-frame-width',window.innerWidth+'px');
  body.style.setProperty('--pt-mobile-viewport',height.toFixed(3)+'px');
  body.classList.add('pt-ios-frame');
  const positioned=dockHeight>0 && Math.abs(scale-1)<.01;
  body.classList.toggle('pt-ios-dock-positioned',positioned);
  if(positioned)body.style.setProperty('--pt-mobile-dock-top',Math.max(0,height-dockHeight).toFixed(3)+'px');
  else body.style.removeProperty('--pt-mobile-dock-top');
 }
 return {update};
}
