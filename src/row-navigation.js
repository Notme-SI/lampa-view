import {text as lampaViewText} from './i18n.js';
import rowOverlay from './row-overlay.js';
// Remote navigation keeps one-card steps and can reach the trailing More tile.
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
 const people=root.matches('.minimal-cast-native,.items-line--type-persons,.items-line--type-person') || !!root.querySelector('.full-person');root.classList.toggle('minimal-person-row',people);root.classList.add('minimal-paged-row');
 const tv=()=>document.body.classList.contains('pt-tv');
 if(people && tv() && line.params && line.params.items)line.params.items.align_left=true;
 const node=item=>{const r=item && item.render(true);return r && (r.nodeType?r:r[0]);};
 const total=()=>(line.data.results || []).length || line.items.length;
 let more,disposed=false;
 const viewport=()=>line.scroll.render(true);
 function idle(){if(!disposed && enabled() && tv() && root.isConnected && L.Controller.own(line) && line.minimalPosterRefresh)line.minimalPosterRefresh();}
 function focus(target){
  L.Controller.collectionSet(viewport());
  if(tv() && more && !people)L.Controller.collectionAppend(more);
  L.Controller.collectionFocus(target,viewport());
 }
 function move(direction,fallback){
  if(!enabled()){if(fallback)fallback();return;}
  if(more && !people){
   if(line.last===more && direction<0){focus(node(line.items[Math.min(line.active,total()-1)]));return;}
   if(direction>0 && line.active>=total()-1){line.last=more;line.scroll.update(more,false);L.Controller.collectionAppend(more);L.Controller.collectionFocus(more,root);return;}
  }
  const old=line.active || 0,index=old+direction;
  if(index<0 || index>=total()){if(fallback)fallback();return;}
  line.active=index;if(!line.items[index])line.emit('scroll');const target=node(line.items[index]);
  if(!target){line.active=old;if(fallback)fallback();return;}
  // Native hover:focus scrolls once and updates the row index. Preserve the
  // previous index until that event, including the step back to card zero.
  line.active=old;line.last=target;focus(target);line.active=index;
 }
 function button(className,label,svg,action){
  const b=document.createElement('button');b.type='button';b.className=className;b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+svg+'</svg>';
  const activate=event=>{event.preventDefault();event.stopImmediatePropagation();action();};
  b.addEventListener('click',activate);b.addEventListener('hover:enter',activate);b.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' ')activate(event);});return b;
 }
 const canMore=!people && (head.querySelector('.items-line__more') || line.data.url || line.data.onMore || line.params && line.params.emit && line.params.emit.onMore);
 if(canMore)more=button('minimal-row-more selector',lampaViewText("Показать ещё"),'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',()=>{if(!enabled())return;line.emit('more',line.data);});
 if(more){const label=document.createElement('span');label.textContent=lampaViewText('Ещё');more.appendChild(label);}
 const overlay=more?rowOverlay(root,viewport):null;
 function mountMore(){const body=viewport().querySelector('.scroll__body');if(more && body && body.lastElementChild!==more)body.appendChild(more);overlay?.refresh();}
 mountMore();line.use({onAppend:mountMore,onVisible:mountMore,onDestroy:()=>overlay?.destroy()});
 line.use({onController(controller){const left=controller.left,right=controller.right,toggle=controller.toggle;controller.left=()=>move(-1,left);controller.right=()=>move(1,right);controller.toggle=function(){const result=toggle && toggle.apply(this,arguments);if(tv() && more && !people)L.Controller.collectionAppend(more);return result;};},onDestroy(){disposed=true;document.removeEventListener('minimal:tv-idle',idle);}});
 document.addEventListener('minimal:tv-idle',idle);
}
