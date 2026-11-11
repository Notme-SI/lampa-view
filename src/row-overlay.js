// Measure the native poster so the final More tile shares its dimensions.
export default function rowOverlay(root,viewport,update){
 root.classList.add('pt-overlay-row');
 let frame=0,disposed=false;
 const request=window.requestAnimationFrame?.bind(window) || window.setTimeout.bind(window);
 const cancel=window.cancelAnimationFrame?.bind(window) || window.clearTimeout.bind(window);
 function measure(){
  frame=0;
  if(disposed || !root.isConnected)return;
  const view=viewport(),poster=view?.querySelector('.card__view'),card=poster?.closest('.card');
  if(!poster || !card)return;
  const width=card.offsetWidth+'px',height=poster.offsetHeight+'px';
  if(root.style.getPropertyValue('--pt-more-width')!==width)root.style.setProperty('--pt-more-width',width);
  if(root.style.getPropertyValue('--pt-more-height')!==height)root.style.setProperty('--pt-more-height',height);
  update(view,card);
 }
 function refresh(){if(!disposed && !frame)frame=request(measure);}
 const resize=window.ResizeObserver?new ResizeObserver(refresh):null;
 if(resize)resize.observe(root);else window.addEventListener('resize',refresh);
 refresh();
 return {refresh,destroy(){
  disposed=true;if(frame)cancel(frame);
  if(resize)resize.disconnect();else window.removeEventListener('resize',refresh);
 }};
}
