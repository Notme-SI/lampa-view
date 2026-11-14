import {text as lampaViewText} from './i18n.js';
import {isAnime} from './metadata.js';
import {canFocusOrdered,focusOrdered} from './ordered-focus.js';
// Remote navigation keeps one-card steps and can reach the collection button.
export default function rowNavigation(L,line,enabled){
 if(!line.use || !line.scroll || !L.Controller)return;
 const render=line.render(true),root=render && (render.nodeType?render:render[0]);
 if(!root)return;
 // Native lazy batches are keyed to remote focus. Load ahead for a pointer
 // at the end of the mounted items, then restore the actual focus index.
 line.scroll.minimalPointerFill=()=>{
  if(!line.tv || line.items.length>=(line.data.results || []).length)return;
  const view=line.scroll.vieport(),width=line.scroll.body(true).scrollWidth;
  if(Math.abs(view.position)+view.content*1.25<width)return;
  const active=line.active;
  try{line.active=Math.max(active || 0,line.items.length-1);line.emit('scroll');}
  finally{line.active=active;}
 };
 if(root.querySelector('.full-review,.full-review-add'))return;
 const head=root.querySelector('.items-line__head');if(!head)return;
 if(line.data.minimal_catalogue_fallback && !(line.data.results || []).every(isAnime)){
  const label=document.createElement('span');label.className='minimal-catalogue-source';
  label.textContent='TMDB';label.title=lampaViewText('Источник подборки')+' · TMDB';head.appendChild(label);
 }
 const people=root.matches('.minimal-cast-native,.items-line--type-persons,.items-line--type-person') || !!root.querySelector('.full-person');root.classList.toggle('minimal-person-row',people);root.classList.add('minimal-paged-row');
 const tv=()=>document.body.classList.contains('pt-tv');
 if(people && tv() && line.params && line.params.items)line.params.items.align_left=true;
 const node=item=>{const r=item && item.render(true);return r && (r.nodeType?r:r[0]);};
 const total=()=>(line.data.results || []).length || line.items.length;
 let more,moreSlot,moreFrame=0,moreDisposed=false;
 const viewport=()=>line.scroll.render(true);
 const visibleMore=()=>more && !more.hidden;
 const hasNext=()=>Number(line.data.total_pages)>Number(line.data.page || 1) || line.data.minimal_has_more===true;
 function canFocusKnown(target){
  // Row movement already chose a concrete item. Hand it to the host's focus
  // handler without running spatial navigation's size and visibility reads.
  return enabled() && root.classList.contains('minimal-posters-sized') && L.Controller.own(line) &&
   target?.matches('.card,.minimal-row-more') && canFocusOrdered(L,target,root);
 }
 function focus(target){
  // The active row already owns its native collection. Keep its current focus
  // until native hover:focus positions the next poster, including lazy appends.
  if(L.Controller.own(line))L.Controller.collectionAppend(target);
  else L.Controller.collectionSet(viewport());
  if(canFocusKnown(target))focusOrdered(L,target);
  else L.Controller.collectionFocus(target,viewport());
 }
 function move(direction,fallback){
  if(!enabled()){fallback?.();return;}
  if(visibleMore()){
   if(line.last===more && direction<0){focus(node(line.items[Math.min(line.active,total()-1)]));return;}
   if(direction>0 && line.active>=total()-1){
    if(line.last!==more){line.last=more;line.scroll.update(moreSlot,false);focus(more);}
    return;
   }
  }
  const old=line.active || 0,index=old+direction;
  if(index<0 || index>=total()){if(fallback)fallback();return;}
  line.active=index;if(!line.items[index])line.emit('scroll');const target=node(line.items[index]);
  if(!target){line.active=old;if(fallback)fallback();return;}
  // Native hover:focus scrolls once and updates the row index. Preserve the
  // previous index until that event, including the step back to card zero.
  line.active=old;line.last=target;focus(target);line.active=index;
 }
 const canMore=!people && (head.querySelector('.items-line__more') || line.data.url || line.data.onMore || line.params && line.params.emit && line.params.emit.onMore);
 if(canMore){
  more=document.createElement('button');
  more.type='button';more.className='minimal-row-more selector';
  more.title=lampaViewText('Показать ещё');more.setAttribute('aria-label',more.title);
  more.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
  const activate=event=>{
   event.preventDefault();event.stopImmediatePropagation();
   if(enabled() && visibleMore())line.emit('more',line.data);
  };
  more.addEventListener('click',activate);
  more.addEventListener('hover:enter',activate);
  more.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' ')activate(event);});
  const label=document.createElement('span');label.textContent=lampaViewText('Ещё');more.appendChild(label);
  moreSlot=document.createElement('div');moreSlot.className='minimal-row-tail';moreSlot.appendChild(more);
  root.classList.add('pt-overlay-row');
  moreSlot.hidden=more.hidden=!hasNext();more.classList.toggle('selector',!more.hidden);
  more.addEventListener('hover:focus',()=>{if(visibleMore())line.last=more;});
 }
 function refreshMore(){
  if(!more || moreDisposed || !root.isConnected)return;
  const view=viewport(),fit=line.scroll.minimalPosterFit,paged=hasNext();
  let overflow=false;
  if(!paged){
   if(fit && root.classList.contains('minimal-posters-sized'))overflow=total()>fit.count;
   else{
    const body=moreSlot.parentElement,card=body?.querySelector('.card');
    if(!card)return;
    const width=card.offsetWidth;if(!width)return;
    const padding=getComputedStyle(body.parentElement),style=getComputedStyle(card);
    const room=view.clientWidth-(parseFloat(padding.paddingLeft)||0)-(parseFloat(padding.paddingRight)||0);
    const gap=(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0);
    overflow=width+Math.max(0,total()-1)*(width+gap)>room+1;
   }
  }
  const hide=!paged && !overflow;
  if(more.hidden===hide)return;
  const restore=hide && line.last===more;
  moreSlot.hidden=more.hidden=hide;
  more.classList.toggle('selector',!hide);
  if(restore){const target=node(line.items[Math.min(line.active,total()-1)]);if(target){line.last=target;if(L.Controller.own(line))focus(target);}}
  else if(hide && L.Controller.own(line))L.Controller.collectionSet(view);
 }
 const request=window.requestAnimationFrame?.bind(window) || window.setTimeout.bind(window);
 const cancel=window.cancelAnimationFrame?.bind(window) || window.clearTimeout.bind(window);
 function scheduleMore(){
  if(!more || moreDisposed || moreFrame)return;
  moreFrame=request(()=>{moreFrame=0;refreshMore();});
 }
 const moreResize=more && window.ResizeObserver?new ResizeObserver(scheduleMore):null;
 if(more){line.minimalMoreRefresh=refreshMore;moreResize?.observe(root);}
 // Watching the two edges avoids :has(.focus) invalidating a rail's styles
 // whenever the remote moves between two cards in the middle of the row.
 const clip=root.querySelector('.items-line__body');
 let firstEdge,lastEdge;
 const selected=card=>!!card?.matches('.focus,.hover,.pt-card-pointer');
 function updateEdges(){
  const start=!tv() && selected(firstEdge),end=!tv() && selected(lastEdge);
  if(clip.classList.contains('pt-poster-edge-start')!==start)clip.classList.toggle('pt-poster-edge-start',start);
  if(clip.classList.contains('pt-poster-edge-end')!==end)clip.classList.toggle('pt-poster-edge-end',end);
 }
 const edgeObserver=clip && window.MutationObserver?new MutationObserver(updateEdges):null;
 function watchEdges(body){
  if(!edgeObserver)return;
  const first=body?.firstElementChild,last=moreSlot?.parentElement===body?moreSlot.previousElementSibling:body?.lastElementChild;
  const start=first?.matches('.card')?first:null,end=last?.matches('.card')?last:null;
  if(start===firstEdge && end===lastEdge)return;
  edgeObserver.disconnect();
  firstEdge=start;lastEdge=end;
  for(const edge of new Set([start,end]))if(edge)edgeObserver.observe(edge,{attributes:true,attributeFilter:['class']});
  updateEdges();
 }
 function mountMore(){
  const body=viewport().querySelector('.scroll__body');
  if(moreSlot && body && body.lastElementChild!==moreSlot)body.appendChild(moreSlot);
  watchEdges(body);
  scheduleMore();
 }
 mountMore();
 line.use({onAppend:mountMore,onVisible:mountMore,onDestroy(){
  moreDisposed=true;
  if(moreFrame)cancel(moreFrame);
  moreResize?.disconnect();
  edgeObserver?.disconnect();
 }});
 line.use({onController(controller){
  const {left,right,toggle}=controller;
  controller.left=()=>move(-1,left);
  controller.right=()=>move(1,right);
  controller.toggle=function(){
   // Native entry creates the collection. A fitted TV row can reuse its
   // saved item (or the first poster) instead of searching that collection.
   const target=line.last || node(line.items[0]);
   if(canFocusKnown(target)){
    L.Controller.collectionSet(viewport());
    focusOrdered(L,target);
    return line.emit('toggle');
   }
   return toggle?.apply(this,arguments);
  };
 }});
}
