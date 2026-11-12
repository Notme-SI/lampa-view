// Use a browser scroll container for catalogues. Lampa still owns the grid,
// selected item, page requests and the native controller.
import scrollMotion from './scroll-motion.js';
import catalogueWindow from './catalogue-window.js';
export default function catalogueScroll(L,enabled,preparePoster){
 const create=L.Component?.create,visible=L.Layer?.visible,grids=new WeakMap();
 if(typeof create!=='function')return;
 if(typeof visible==='function')L.Layer.visible=function(where){
  const node=where?.nodeType?where:where?.[0];
  const grid=grids.get(node);
  if(grid?.active())return grid.schedule();
  return visible.apply(this,arguments);
 };
 L.Component.create=function(object){
  const item=create.apply(this,arguments);
  if(!item?.use || !item.scroll || !['main','category','category_full','minimal_filtered','actor','company'].includes(object?.component))return item;
  let navigation;
  item.use({
   onCreate(){
    const rows=!item.body && ['main','category'].includes(object?.component);
    if(!rows && !item.body?.classList.contains('mapping--grid'))return;
    navigation=mount(L,item,enabled,visible,preparePoster,rows);
    if(navigation)grids.set(item.scroll.render(true),navigation);
   },
   onAppend(card){navigation?.append(card);},
   onController(controller){
    if(!navigation)return;
    for(const direction of ['left','right','up','down']){
     const original=controller[direction];if(typeof original!=='function')continue;
     controller[direction]=function(){
      return navigation.direction(direction,()=>original.apply(this,arguments));
     };
    }
   },
   onStart(){navigation?.start();},
   onPause(){navigation?.pause();},
   onDestroy(){navigation?.destroy();}
  });
  return item;
 };
}

function mount(L,item,enabled,visible,preparePoster,rows){
 const scroll=item.scroll,node=scroll.render(true),body=scroll.body(true),content=body?.parentElement;
 if(!node?.classList.contains('scroll') || node.classList.contains('scroll--horizontal') ||
    !body?.matches('.scroll__body') || body.parentElement?.parentElement!==node)return;
 const methods=['position','vieport','update','immediate','shift','reset','restorePosition','animated'];
 const original=Object.fromEntries(methods.map(key=>[key,scroll[key]]));
 let frame=0,manualFocus=false,requested=false,pausedAt=null,paused=false,idleTimer;
 let originalEnd,notifyEnd,returnFocus=false,returnFrame=0;
 const motion=scrollMotion(()=>node.scrollTop,value=>{node.scrollTop=value;});
 const active=()=>enabled() && node.classList.contains('pt-browser-catalogue');
 const native=(key,args)=>original[key]?.apply(scroll,args);
 const unwrap=target=>target?.nodeType?target:target?.[0];
 const children=()=>rows?body:item.body;
 const margin=Math.min(850,window.innerHeight || 540);
 const observer=typeof IntersectionObserver==='function' && typeof visible==='function'?new IntersectionObserver(entries=>{
  if(!active() || paused)return;
  for(const {target,isIntersecting} of entries)if(isIntersecting && children().contains(target)){
   show(target);
   if(target.called_visible && target.style.visibility!=='hidden')observer.unobserve(target);
  }
 },{root:node,rootMargin:margin+'px 0px'}):null;
 const windowed=rows?null:catalogueWindow(item,node,item.body,{
  attach(card){preparePoster?.(card,card.card_data,item.body);if(!paused && card.matches('.layer--visible') && (!card.called_visible || card.style.visibility==='hidden'))observer?.observe(card);},
  detach(card){observer?.unobserve(card);card.querySelector('.card__img')?._minimalCatalogueSuspend?.();}
 });

 function show(card){
  // IO already resolved visibility for these leaf cards. Layer.visible would
  // synchronously measure again after each previous card's visible handlers
  // modified the DOM, forcing one layout per poster.
  if(observer && !rows && typeof L.Utils?.trigger==='function' && card.matches('.card') && !card.querySelector('.layer--visible')){
   card.visible=true;
   if(!card.called_visible){card.called_visible=true;L.Utils.trigger(card,'visible');}
   if(card.style.visibility==='hidden' || card.visibility==='hidden'){
    card.visibility='visible';card.style.visibility='visible';L.Utils.trigger(card,'visible:change');
   }
   return;
  }
  if(!card.called_visible || card.style.visibility==='hidden')visible?.call(L.Layer,card);
 }
 function observeCards(){
  if(!observer)return;
  for(const card of children().children)if(card.matches('.layer--visible') && (!card.called_visible || card.style.visibility==='hidden'))observer.observe(card);
 }
 function append(card){
  if(!active())return;
  const element=unwrap(card.render?.(true));
  if(rows && card.use)card.use({onController(controller){
   for(const direction of ['up','down']){
    const original=controller[direction];if(typeof original!=='function')continue;
    controller[direction]=function(){return navigationDirection(direction,()=>original.apply(this,arguments));};
   }
  }});
  if(!element?.matches('.card:not(.card--wide):not(.card--collection)')){
   if(!paused && element?.matches('.layer--visible'))observer?.observe(element);
   return;
  }
  // Reserve every caption slot before the native fragment reaches the grid.
  for(const name of ['card__age','pt-card-watch'])if(!element.querySelector('.'+name)){
   const slot=document.createElement('div');slot.className=name;element.appendChild(slot);
  }
  preparePoster?.(element,card.data,children());
  if(!paused && element.matches('.layer--visible'))observer?.observe(element);
 }

 function schedule(requestPage=false){
  requested ||= requestPage;
  if(!frame && !paused)frame=requestAnimationFrame(flush);
 }
 function flush(){
  frame=0;
  const requestPage=requested;requested=false;
  if(!active() || paused || !node.isConnected || !node.clientHeight)return;
  const queued=item.loaded?.length || 0;
  if(queued){
   if(rows)item.emit('pushLoaded');else scroll.onScroll?.(node.scrollTop);
  }
  windowed?.update();
  if(!observer)nearby(node.clientHeight).forEach(show);
  if(requestPage && scroll.onEnd &&
    node.scrollHeight-node.clientHeight-node.scrollTop<=Math.max(850,node.clientHeight*1.6))scroll.onEnd();
  node.dispatchEvent(new Event('minimal:viewport-scroll'));
  // Lampac/Lampa can deliver the next page as several native batches.
  if(item.loaded?.length && item.loaded.length<queued)schedule();
 }

 // Grid children follow row order, so seek the first nearby row without
 // measuring the cards above it after a drag, resize or deep history restore.
 function nearby(ahead){
  const cards=children().children,viewport=node.getBoundingClientRect();
  const top=viewport.top-ahead,bottom=viewport.bottom+ahead;
  let low=0,high=cards.length;
  while(low<high){
   const middle=(low+high)>>>1;
   if(cards[middle].getBoundingClientRect().top<top)low=middle+1;
   else high=middle;
  }
  // The row immediately above may still overlap the viewport.
  if(low>0){
   const row=cards[--low].getBoundingClientRect().top;
   while(low>0 && cards[low-1].getBoundingClientRect().top>=row-1)low--;
  }
  const result=[];
  for(let index=low;index<cards.length;index++){
   const card=cards[index],rect=card.getBoundingClientRect();
   if(rect.top>=bottom)break;
   if(rect.height && rect.bottom>top && card.matches('.layer--visible'))result.push(card);
  }
  return result;
 }
 function scrollEvent(event){
  if(!active() || event.target!==node)return;
  event.stopImmediatePropagation();
  if(paused)return;
  node.classList.add('pt-catalogue-moving');
  clearTimeout(idleTimer);idleTimer=setTimeout(settle,120);
  schedule(true);
 }
 function settle(){
  if(node.classList.contains('pt-catalogue-moving')){
   node.classList.remove('pt-catalogue-moving');
   setTimeout(()=>document.dispatchEvent(new Event('minimal:catalogue-idle')),0);
  }
 }
 function touch(event){
  if(active() && event.target.closest?.('.scroll')===node)event.stopPropagation();
 }
 function touchViewport(event){
  if(active() && event.target===node)event.stopImmediatePropagation();
 }
 function scrollTo(offset,smooth=false){
  const target=Math.max(0,Math.min(node.scrollHeight-node.clientHeight,offset));
  if(smooth)motion.to(target);
  else{motion.stop();node.scrollTop=target;}
 }
 function reveal(target){
  const el=unwrap(target);
  if(el && windowed?.contains(el))windowed.ensure(el);
  if(!el || !body.contains(el))return;
  const box=node.getBoundingClientRect(),rect=el.getBoundingClientRect(),gap=8;
  const top=rect.top-box.top-gap,bottom=rect.bottom-box.bottom+gap;
  if(top<0)scrollTo(node.scrollTop+top,true);
  else if(bottom>0)scrollTo(node.scrollTop+bottom,true);
  else motion.stop();
 }
 function rebase(){
  if(motion.active())return;
  if(rows){
   const current=unwrap(item.items[item.active]?.render(true)),bounds=node.getBoundingClientRect();
   if(!current)return;
   const rect=current.getBoundingClientRect();
   if(rect.bottom>bounds.top && rect.top<bounds.bottom)return;
   const next=item.items.find(line=>{const r=unwrap(line.render(true)).getBoundingClientRect();return r.bottom>bounds.top && r.top<bounds.bottom;});
   if(next)next.toggle();
   return;
  }
  const last=unwrap(item.last);
  if(!last)return;
  const viewport=node.getBoundingClientRect(),selected=last.getBoundingClientRect();
  if(selected.bottom>viewport.top && selected.top<viewport.bottom)return;
  let nearest,distance=Infinity;
  for(const card of nearby(0)){
   if(!card.matches('.card.selector'))continue;
   const box=card.getBoundingClientRect();
   if(!box.height || box.bottom<=viewport.top || box.top>=viewport.bottom)continue;
   const dx=Math.abs(box.left-selected.left);
   if(dx<distance){nearest=card;distance=dx;if(dx<1)break;}
  }
  if(nearest){
   // Pointer scrolling can leave the native ±36 collection on a detached
   // page. Rebuild it from the mounted window before asking it to focus.
   const index=item.items.findIndex(card=>unwrap(card.render(true))===nearest);
   if(index>=0){item.active=index;item.last=nearest;}
   last.classList.remove('focus');
   L.Controller.collectionSet(node);
   L.Controller.collectionFocus(nearest,node);
   scroll.onScroll?.(node.scrollTop);
  }
 }
 function navigationDirection(direction,move){
  if(!active())return move();
  manualFocus=true;
  try{
   rebase();
   const lastActive=item.active,result=move();
   if(direction==='down')schedule(true);
   // Recenter the native navigation collection before reaching its edge.
   if(item.active>=item.limit_collection && item.active!==lastActive)scroll.onScroll?.(node.scrollTop);
   return result;
  }finally{manualFocus=false;}
 }
 function setEnabled(){
  const enabledNow=enabled();
  if(enabledNow===node.classList.contains('pt-browser-catalogue'))return;
  if(enabledNow){
   const offset=Math.abs(native('position',[]) || 0);
   node.classList.add('pt-browser-catalogue');
   if(rows)node.classList.add('pt-browser-rows');
   scrollTo(offset);
   originalEnd=scroll.onAnimateEnd;
   notifyEnd=function(){if(active())schedule();else originalEnd?.apply(this,arguments);};
   scroll.onAnimateEnd=notifyEnd;
   if(!paused)observeCards();
  }else{
   motion.stop();
   windowed?.restore();
   observer?.disconnect();
   clearTimeout(idleTimer);settle();
   const offset=node.scrollTop;node.classList.remove('pt-browser-catalogue','pt-browser-rows');
   node.scrollTop=0;native('reset',[]);if(offset)native('shift',[offset]);
   if(scroll.onAnimateEnd===notifyEnd)scroll.onAnimateEnd=originalEnd;
  }
 }
 // Native mouse/touch listeners and page restoration are instance-local.
 node.addEventListener('scroll',scrollEvent,true);
 const stopMotion=()=>motion.stop();
 const stopHidden=()=>{if(document.hidden)stopMotion();};
 for(const event of ['wheel','pointerdown','touchstart'])node.addEventListener(event,stopMotion,{capture:true,passive:true});
 window.addEventListener('blur',stopMotion);
 document.addEventListener('visibilitychange',stopHidden);
 const resized=()=>{if(active() && !paused)schedule();};
 window.addEventListener('resize',resized);
 document.addEventListener('minimal:interface-size',resized);
 const touchEvents=L.Platform?.screen?.('tv')?['touchstart','touchmove','touchend']:[];
 for(const event of touchEvents){
  content.addEventListener(event,touch,{passive:true});
  node.addEventListener(event,touchViewport,{capture:true,passive:true});
 }
 scroll.position=function(){return active()?-node.scrollTop:native('position',arguments);};
 scroll.vieport=function(){return active()?{position:-node.scrollTop,body:node.scrollHeight,content:node.clientHeight}:native('vieport',arguments);};
 scroll.update=function(target){if(!active())return native('update',arguments);if(manualFocus)reveal(target);};
 scroll.immediate=function(target){if(!active())return native('immediate',arguments);if(manualFocus)reveal(target);};
 scroll.shift=function(delta){if(!active())return native('shift',arguments);scrollTo(node.scrollTop+delta);};
 scroll.reset=function(){if(!active())return native('reset',arguments);scrollTo(0);};
 function resume(){
  windowed?.update();
  if(active() && !paused && pausedAt!==null && node.clientHeight){scrollTo(pausedAt);pausedAt=null;}
  if(active())schedule();
 }
 scroll.restorePosition=function(){if(active())resume();else return native('restorePosition',arguments);};
 scroll.animated=function(){return active()?false:native('animated',arguments);};
 scroll.minimalBrowserScroll={requestMore(){schedule(true);}};
 const changed=event=>{if(event.name==='lampa_view_enabled')setEnabled();};
 L.Storage?.listener?.follow('change',changed);
 setEnabled();
 (item.items || []).forEach(append);
 return {active,schedule,direction:navigationDirection,append,start(){
  if(paused && active())observeCards();
  paused=false;resume();
  if(returnFocus){
   returnFocus=false;
   returnFrame=requestAnimationFrame(()=>{
    returnFrame=0;const last=unwrap(item.last);
    if(active() && !paused && last?.isConnected && L.Controller.own(item)){
     L.Controller.collectionSet(node);L.Controller.collectionFocus(last,node);
    }
   });
  }
 },pause(){
  motion.stop();
  returnFocus=Boolean(unwrap(item.last)?.classList.contains('focus'));
  paused=true;requested=false;observer?.disconnect();
  if(frame){cancelAnimationFrame(frame);frame=0;}
  clearTimeout(idleTimer);settle();
  if(active())pausedAt=node.scrollTop;
 },destroy(){
  motion.stop();
  if(returnFrame)cancelAnimationFrame(returnFrame);
  for(const event of ['wheel','pointerdown','touchstart'])node.removeEventListener(event,stopMotion,true);
  window.removeEventListener('blur',stopMotion);
  document.removeEventListener('visibilitychange',stopHidden);
  window.removeEventListener('resize',resized);
  document.removeEventListener('minimal:interface-size',resized);
  observer?.disconnect();
  if(frame)cancelAnimationFrame(frame);
  clearTimeout(idleTimer);settle();
  L.Storage?.listener?.remove?.('change',changed);
  node.removeEventListener('scroll',scrollEvent,true);
  for(const event of touchEvents){content.removeEventListener(event,touch);node.removeEventListener(event,touchViewport,true);}
  if(scroll.onAnimateEnd===notifyEnd)scroll.onAnimateEnd=originalEnd;
  for(const key of methods)scroll[key]=original[key];
  delete scroll.minimalBrowserScroll;
  windowed?.destroy();
 }};
}

