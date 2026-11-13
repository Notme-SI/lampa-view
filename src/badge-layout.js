import {activeCard,scrollingCard,preparingCard} from './card-activity.js';

// Corner-aware placement and batched measurements, adapted from card_overlay.js.
export function placeBadges(width,height,badges,occupied=[],padding=4,gap=3){
 const placed=occupied.slice();
 for(const badge of badges){
  const w=Math.min(badge.width,Math.max(0,width-2*(badge.inset ?? padding))),h=badge.height;
  if(w<=0 || h<=0)continue;
  const bottom=badge.corner[0]==='b',right=badge.corner[1]==='r';
  const inset=badge.inset ?? padding;
  const verticalInset=badge.verticalInset ?? inset;
  let x=right?width-inset-w:inset,y=bottom?height-verticalInset-h:verticalInset;
  for(let i=0;i<=placed.length*2;i++){
   const conflict=placed.find(p=>x<p.x+p.width+gap && x+w+gap>p.x && y<p.y+p.height+gap && y+h+gap>p.y);
   if(!conflict)break;
   y=bottom?conflict.y-gap-h:conflict.y+conflict.height+gap;
  }
  // Very short thumbnails keep their scores/quality; secondary markers can wait.
  if(y<padding || y+h>height-padding)continue;
  placed.push({...badge,x,y,width:w,height:h});
 }
 return placed.slice(occupied.length);
}
export default function badgeLayout(status){
 const pending=new Set(),measured=new WeakMap();let frame=0;
 const paused=()=>document.body.matches('.pt-wheel-active,.pt-tv-busy') || document.hidden;
 function flush(){
  frame=0;if(document.hidden)return;
  const reads=[],batch=[],tv=document.body.classList.contains('pt-tv');
  for(const node of pending){
   if(batch.length>=(tv?6:8))break;
   if(activeCard(node) && (paused() || scrollingCard(node)) && !preparingCard(node))continue;
   pending.delete(node);
   if(activeCard(node))batch.push(node);
  }
  // Metadata can update text and visibility. Finish those writes before
  // measuring the layout of any badge in the current frame.
  if(status)batch.forEach(node=>status.paint(node));
  const insetScale=tv?window.innerWidth/1920:1;
  for(const node of batch){
   const view=node.querySelector('.card__view');if(!view)continue;
   // Focus changes only the composited poster position. Re-measuring all its
   // unchanged corner labels forces layout after every remote pause. Include
   // content, native markers, viewport and scale so late data still invalidates.
   const labels=[...view.querySelectorAll('.card__vote,.pt-quality,.card__quality,.pt-kind,.pt-series-status,.card__marker,.card__new-episode,.card__icon,.pt-card-watch__time')];
   const key=[view.clientWidth,view.clientHeight,innerWidth,innerHeight,
    document.body.className.replace(/\b(?:pt-tv-busy|pt-wheel-active|pt-arrow-navigation)\b/g,'').trim().replace(/\s+/g,' '),document.body.style.cssText,
    node.matches('.focus,.hover,.pt-card-pointer,.pt-card-touch'),
    ...labels.map(el=>el.className+':'+el.textContent+':'+el.hidden)].join('|');
   if(measured.get(node)===key)continue;
   const rect=view.getBoundingClientRect();
   if(!rect.width || !rect.height || rect.bottom< -1200 || rect.top>window.innerHeight+1200 || rect.right< -1200 || rect.left>window.innerWidth+1200)continue;
   const width=view.clientWidth || rect.width,height=view.clientHeight || rect.height,scale=rect.width/width || 1,entries=[];
   for(const [selector,corner] of [['.card__vote','br'],['.pt-quality,.card__quality','tr'],['.pt-kind','tl'],['.pt-series-status','tl'],['.card__marker','bl'],['.card__new-episode','bl']])for(const el of view.querySelectorAll(selector)){
    if(el.hidden || el.classList.contains('hide') || getComputedStyle(el).display==='none')continue;
    if(el.classList.contains('pt-series-status')){
     el.style.fontSize='';el.style.transform='';
     const paint=document.body.classList.contains('pt-tv')?parseFloat(getComputedStyle(document.body).getPropertyValue('--pt-tv-badge-paint')) || .5:1;
     const style=getComputedStyle(el),border=(parseFloat(style.borderLeftWidth)||0)+(parseFloat(style.borderRightWidth)||0);
     const range=document.createRange();range.selectNodeContents(el);
     const natural=range.getBoundingClientRect().width/scale+((parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0))*paint;
     const available=Math.max(1,Math.min(width-8*insetScale,(parseFloat(style.maxWidth)||width/paint)*paint)-border*paint);
     if(natural>available)el.style.fontSize=(parseFloat(style.fontSize)*Math.max(1,available-1)/natural).toFixed(2)+'px';
    }
    const topTag=el.matches('.pt-kind,.pt-quality,.card__quality'),r=el.getBoundingClientRect();if(r.width && r.height)entries.push({el,corner,inset:(topTag || corner[1]!=='r'?4:8)*insetScale,verticalInset:topTag?6*insetScale:undefined,width:r.width/scale,height:r.height/scale});
   }
   // Reserve space for the elapsed time as well as the native favorite icons.
   const occupied=[...view.querySelectorAll('.card__icon:not(.icon--history),.pt-card-watch__time')].map(el=>el.getBoundingClientRect())
    .filter(box=>box.width && box.height).map(box=>({x:(box.left-rect.left)/scale,y:(box.top-rect.top)/scale,width:box.width/scale,height:box.height/scale}));
   reads.push({node,key,view,width,height,entries,places:placeBadges(width,height,entries,occupied,4*insetScale,3*insetScale)});
  }
  // Read every card before writing styles; held remote navigation never enters here.
  for(const {node,key,view,width,height,entries,places} of reads){view.classList.add('minimal-badge-layout');for(const entry of entries){
   const p=places.find(p=>p.el===entry.el);entry.el.style.visibility=p?'':'hidden';if(!p)continue;
   // Corners follow their poster immediately, even while remote navigation
   // pauses measurements. Never freeze a right/bottom badge at old left/top.
   const right=p.corner[1]==='r',bottom=p.corner[0]==='b';
   Object.assign(entry.el.style,{top:bottom?'auto':Math.round(p.y)+'px',left:right?'auto':Math.round(p.x)+'px',right:right?Math.round(width-p.x-p.width)+'px':'auto',bottom:bottom?Math.round(height-p.y-p.height)+'px':'auto'});
  }if(key!==null)measured.set(node,key);}
  if(batch.length && pending.size)frame=requestAnimationFrame(flush);
 }
 function schedule(node){if(!node)return;pending.add(node);if(!frame && !document.hidden)frame=requestAnimationFrame(flush);}
 for(const event of ['minimal:tv-idle','minimal:wheel-idle','minimal:catalogue-idle','visibilitychange'])document.addEventListener(event,()=>{if(pending.size && !frame)frame=requestAnimationFrame(flush);});
 const resize=window.ResizeObserver?new ResizeObserver(entries=>entries.forEach(entry=>schedule(entry.target))):null;
 return {track(node){if(resize)resize.observe(node);schedule(node);},schedule,forget(node){pending.delete(node);measured.delete(node);if(resize)resize.unobserve(node);}};
}
