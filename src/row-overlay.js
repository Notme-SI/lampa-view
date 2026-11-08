// Position controls over the visible artwork, independently of captions below.
export default function rowOverlay(root,viewport){
 root.classList.add('pt-overlay-row');let frame=0,disposed=false;
 function measure(){
  frame=0;if(disposed || !root.isConnected)return;
  const view=typeof viewport==='function'?viewport():viewport;if(!view)return;
  const r=root.getBoundingClientRect(),v=view.getBoundingClientRect(),scale=r.width/(root.offsetWidth || r.width) || 1;
  const visual=Array.from(view.querySelectorAll('.card__view,.full-person__photo,.full-episode__img,.full-review,.full-review-add')).find(item=>item.offsetHeight>0);
  const box=visual?visual.getBoundingClientRect():v;
  const card=visual?.closest('.card');
  // The TV preview animates poster transforms. The More tile must use layout dimensions.
  const values={'--pt-row-center':(box.top+box.height/2-r.top)/scale+'px','--pt-row-left':Math.max(4,(v.left-r.left)/scale+4)+'px','--pt-row-right':Math.max(4,(r.right-v.right)/scale+4)+'px','--pt-more-width':(card?.offsetWidth || visual?.offsetWidth || view.offsetWidth)+'px','--pt-more-height':(visual?.offsetHeight || view.offsetHeight)+'px'};
  for(const [key,value]of Object.entries(values))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
 }
 function refresh(){if(!disposed && !frame)frame=requestAnimationFrame(measure);}
 const resize=window.ResizeObserver?new ResizeObserver(refresh):null;if(resize)resize.observe(root);else window.addEventListener('resize',refresh);
 refresh();return {refresh,destroy(){disposed=true;if(frame)cancelAnimationFrame(frame);if(resize)resize.disconnect();else window.removeEventListener('resize',refresh);}};
}
