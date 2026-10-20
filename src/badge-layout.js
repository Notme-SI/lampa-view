// Corner-aware placement and batched measurements, adapted from card_overlay.js.
export function placeBadges(width,height,badges,padding=4,gap=3){
 const placed=[];
 for(const badge of badges){
  const w=Math.min(badge.width,Math.max(0,width-padding*2)),h=badge.height;
  if(w<=0 || h<=0)continue;
  const bottom=badge.corner[0]==='b',right=badge.corner[1]==='r';
  const x=right?width-padding-w:padding;let y=bottom?height-padding-h:padding;
  for(let i=0;i<=placed.length;i++){
   const conflict=placed.find(p=>x<p.x+p.width+gap && x+w+gap>p.x && y<p.y+p.height+gap && y+h+gap>p.y);
   if(!conflict)break;
   y=bottom?conflict.y-gap-h:conflict.y+conflict.height+gap;
  }
  // Very short thumbnails keep their scores/quality; secondary markers can wait.
  if(y<padding || y+h>height-padding)continue;
  placed.push({...badge,x,y,width:w,height:h});
 }
 return placed;
}
export default function badgeLayout(){
 const pending=new Set();let frame=0;
 const paused=()=>document.body.matches('.pt-wheel-active,.pt-tv-busy') || document.hidden;
 function flush(){
  frame=0;if(paused())return;
  const reads=[];
  for(const node of pending){
   pending.delete(node);if(!node.isConnected)continue;
   const view=node.querySelector('.card__view');if(!view)continue;const rect=view.getBoundingClientRect();
   if(!rect.width || !rect.height || rect.bottom<0 || rect.top>window.innerHeight || rect.right<0 || rect.left>window.innerWidth)continue;
   const width=view.clientWidth || rect.width,height=view.clientHeight || rect.height,scale=rect.width/width || 1,entries=[];
   for(const [selector,corner] of [['.card__vote','br'],['.pt-quality,.card__quality','tl'],['.pt-kind','tr'],['.card__marker','bl'],['.card__icons','tl'],['.card__new-episode','bl']])for(const el of view.querySelectorAll(selector)){
    if(el.hidden || el.classList.contains('hide') || getComputedStyle(el).display==='none')continue;
    const r=el.getBoundingClientRect();if(r.width && r.height)entries.push({el,corner,width:r.width/scale,height:r.height/scale});
   }
   reads.push({view,entries,places:placeBadges(width,height,entries)});
  }
  // Read every card before writing styles; held remote navigation never enters here.
  for(const {view,entries,places} of reads){view.classList.add('minimal-badge-layout');for(const entry of entries){const p=places.find(p=>p.el===entry.el);entry.el.style.visibility=p?'':'hidden';if(!p)continue;Object.assign(entry.el.style,{top:Math.round(p.y)+'px',left:Math.round(p.x)+'px',right:'auto',bottom:'auto'});}}
 }
 function schedule(node){if(!node)return;pending.add(node);if(!frame && !paused())frame=requestAnimationFrame(flush);}
 for(const event of ['minimal:tv-idle','minimal:wheel-idle','visibilitychange'])document.addEventListener(event,()=>{if(pending.size && !frame)frame=requestAnimationFrame(flush);});
 const resize=window.ResizeObserver?new ResizeObserver(entries=>entries.forEach(entry=>schedule(entry.target))):null;
 return {track(node){if(resize)resize.observe(node);schedule(node);},schedule,forget(node){pending.delete(node);if(resize)resize.unobserve(node);}};
}
