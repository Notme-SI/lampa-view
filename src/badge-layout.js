// Corner-aware placement and batched measurements, adapted from card_overlay.js.
export function placeBadges(width,height,badges,padding=4,gap=3){
 const placed=[];
 for(const badge of badges){
  const w=Math.min(badge.width,Math.max(0,width-2*(badge.inset ?? padding))),h=badge.height;
  if(w<=0 || h<=0)continue;
  const bottom=badge.corner[0]==='b',right=badge.corner[1]==='r';
  const inset=badge.inset ?? padding;
  const left=badge.flushLeft?0:inset;
  let x=right?width-inset-w:left,y=bottom?height-inset-h:inset;
  for(let i=0;i<=placed.length*2;i++){
   const conflict=placed.find(p=>x<p.x+p.width+gap && x+w+gap>p.x && y<p.y+p.height+gap && y+h+gap>p.y);
   if(!conflict)break;
   if(badge.flow==='row' && bottom && !right){
    const next=conflict.x+conflict.width+gap;
    if(next+w<=width-padding){x=next;continue;}
    x=padding;
   }
   y=bottom?conflict.y-gap-h:conflict.y+conflict.height+gap;
  }
  // Very short thumbnails keep their scores/quality; secondary markers can wait.
  if(y<padding || y+h>height-padding)continue;
  placed.push({...badge,x,y,width:w,height:h});
 }
 return placed;
}
export default function badgeLayout(status){
 const pending=new Set();let frame=0;
 const paused=()=>document.body.matches('.pt-wheel-active,.pt-tv-busy') || document.hidden;
 function flush(){
  frame=0;if(paused())return;
  const reads=[];let count=0;
  for(const node of pending){
   if(document.body.classList.contains('pt-tv') && count++>=6)break;
   pending.delete(node);if(!node.isConnected)continue;
   if(status)status.paint(node);
   const view=node.querySelector('.card__view');if(!view)continue;const rect=view.getBoundingClientRect();
   if(!rect.width || !rect.height || rect.bottom<0 || rect.top>window.innerHeight || rect.right<0 || rect.left>window.innerWidth)continue;
   const width=view.clientWidth || rect.width,height=view.clientHeight || rect.height,scale=rect.width/width || 1,entries=[];
   for(const [selector,corner] of [['.card__vote','br'],['.pt-quality,.card__quality','tr'],['.pt-kind','tl'],['.pt-series-status','tl'],['.card__marker','bl'],['.card__icon:not(.icon--history)','bl'],['.card__new-episode','bl']])for(const el of view.querySelectorAll(selector)){
    if(el.hidden || el.classList.contains('hide') || getComputedStyle(el).display==='none')continue;
    if(el.classList.contains('pt-series-status')){
     el.style.fontSize='';el.style.transform='none';
     const style=getComputedStyle(el),border=(parseFloat(style.borderLeftWidth)||0)+(parseFloat(style.borderRightWidth)||0);
     const range=document.createRange();range.selectNodeContents(el);
     const natural=range.getBoundingClientRect().width/scale+(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
     const available=Math.max(1,Math.min(width-8,parseFloat(style.maxWidth)||width)-border);
     if(natural>available)el.style.fontSize=(parseFloat(style.fontSize)*Math.max(1,available-1)/natural).toFixed(2)+'px';
    }
    const r=el.getBoundingClientRect();if(r.width && r.height)entries.push({el,corner,inset:corner[1]==='r' || el.classList.contains('pt-kind')?8:undefined,flushLeft:el.classList.contains('pt-kind'),flow:el.classList.contains('card__icon')?'row':undefined,width:r.width/scale,height:r.height/scale});
   }
   reads.push({view,width,height,entries,places:placeBadges(width,height,entries)});
  }
  // Read every card before writing styles; held remote navigation never enters here.
  for(const {view,width,height,entries,places} of reads){view.classList.add('minimal-badge-layout');for(const entry of entries){
   const p=places.find(p=>p.el===entry.el);entry.el.style.visibility=p?'':'hidden';if(!p)continue;
   // Corners follow their poster immediately, even while remote navigation
   // pauses measurements. Never freeze a right/bottom badge at old left/top.
   const right=p.corner[1]==='r',bottom=p.corner[0]==='b';
   Object.assign(entry.el.style,{top:bottom?'auto':Math.round(p.y)+'px',left:right?'auto':Math.round(p.x)+'px',right:right?Math.round(width-p.x-p.width)+'px':'auto',bottom:bottom?Math.round(height-p.y-p.height)+'px':'auto'});
  }}
  if(pending.size)frame=requestAnimationFrame(flush);
 }
 function schedule(node){if(!node)return;pending.add(node);if(!frame && !paused())frame=requestAnimationFrame(flush);}
 for(const event of ['minimal:tv-idle','minimal:wheel-idle','visibilitychange'])document.addEventListener(event,()=>{if(pending.size && !frame)frame=requestAnimationFrame(flush);});
 const resize=window.ResizeObserver?new ResizeObserver(entries=>entries.forEach(entry=>schedule(entry.target))):null;
 return {track(node){if(resize)resize.observe(node);schedule(node);},schedule,forget(node){pending.delete(node);if(resize)resize.unobserve(node);}};
}
