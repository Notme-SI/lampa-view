// Position controls over the visible artwork, independently of captions below.
export default function rowOverlay(root,viewport,arrows,pending){
 root.classList.add('pt-overlay-row');let frame=0,disposed=false;
 const request=window.requestAnimationFrame?.bind(window) || window.setTimeout.bind(window);
 const cancel=window.cancelAnimationFrame?.bind(window) || window.clearTimeout.bind(window);
 const view=typeof viewport==='function'?viewport():viewport;
 const body=view?.querySelector('.scroll__body');
 let edgeFrame=0;
 function edges(){
  edgeFrame=0;if(disposed || !arrows || !body || !root.isConnected)return;
  const [previous,next]=arrows,bounds=view.getBoundingClientRect();
  let first=body.firstElementChild,last=body.lastElementChild;
  while(first && !first.offsetWidth)first=first.nextElementSibling;
  while(last && !last.offsetWidth)last=last.previousElementSibling;
  previous.hidden=!bounds.width || !first || first.getBoundingClientRect().left>=bounds.left-2;
  next.hidden=!bounds.width || !last || (last.getBoundingClientRect().right<=bounds.right+2 && !pending?.());
 }
 function refreshEdges(){if(!disposed && !edgeFrame)edgeFrame=request(edges);}
 function measure(){
  frame=0;if(disposed || !root.isConnected)return;
  if(!view)return;
  const r=root.getBoundingClientRect(),v=view.getBoundingClientRect(),scale=r.width/(root.offsetWidth || r.width) || 1;
  const visual=Array.from(view.querySelectorAll('.card__view,.full-person__photo,.full-episode__img,.full-review,.full-review-add')).find(item=>item.offsetHeight>0);
  const box=visual?visual.getBoundingClientRect():v;
  const card=visual?.closest('.card');
  // The TV preview animates poster transforms. The More tile must use layout dimensions.
  const values={'--pt-row-center':(box.top+box.height/2-r.top)/scale+'px','--pt-row-left':Math.max(4,(v.left-r.left)/scale+4)+'px','--pt-row-right':Math.max(4,(r.right-v.right)/scale+4)+'px','--pt-more-width':(card?.offsetWidth || visual?.offsetWidth || view.offsetWidth)+'px','--pt-more-height':(visual?.offsetHeight || view.offsetHeight)+'px'};
  for(const [key,value]of Object.entries(values))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
 }
 function refresh(){if(!disposed && !frame)frame=request(measure);if(arrows)refreshEdges();}
 const resize=window.ResizeObserver?new ResizeObserver(refresh):null;
 if(resize){resize.observe(root);if(body && arrows)resize.observe(body);}else window.addEventListener('resize',refresh);
 const mutation=arrows && body && window.MutationObserver?new MutationObserver(refreshEdges):null;
 if(mutation)mutation.observe(body,{childList:true,attributes:true,attributeFilter:['style']});
 if(arrows){
  arrows.forEach(button=>{button.hidden=true;});
  view?.addEventListener('scroll',refreshEdges,{passive:true});
  body?.addEventListener('transitionend',refreshEdges);
 }
 refresh();
 return {refresh,destroy(){
  disposed=true;if(frame)cancel(frame);if(edgeFrame)cancel(edgeFrame);
  if(resize)resize.disconnect();else window.removeEventListener('resize',refresh);
  mutation?.disconnect();
  view?.removeEventListener('scroll',refreshEdges);body?.removeEventListener('transitionend',refreshEdges);
 }};
}
