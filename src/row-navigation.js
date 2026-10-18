// Native row indices remain stable when spatial navigation loses offscreen neighbours.
export default function rowNavigation(L,line,enabled){
 if(!line.use || !line.scroll || !L.Controller)return;
 const render=line.render(true),root=render && (render.nodeType?render:render[0]);
 if(!root || root.querySelector('.full-review,.full-review-add'))return;
 let previous,next;
 const node=item=>{const r=item && item.render(true);return r && (r.nodeType?r:r[0]);};
 function update(){if(!previous)return;previous.disabled=!line.active && Math.abs(line.scroll.position?line.scroll.position():0)<1;next.disabled=line.active>=line.items.length-1 && line.items.length>=(line.data.results || []).length;}
 function move(direction,fallback){
  if(!enabled()){if(fallback)fallback();return;}
  const old=line.active || 0,index=old+direction;
  if(index<0){if(fallback)fallback();return;}
  line.active=index;line.emit('scroll');
  const target=node(line.items[index]);
  if(!target){line.active=old;if(fallback)fallback();update();return;}
  line.last=target;line.scroll.update(target,false);
  const viewport=line.scroll.render(true);L.Controller.collectionSet(viewport);L.Controller.collectionFocus(target,viewport);update();
 }
 line.use({onController(controller){const left=controller.left,right=controller.right;controller.left=()=>move(-1,left);controller.right=()=>move(1,right);},onActive:update,onScroll:update,onAppend:update});
 const head=root.querySelector('.items-line__head');if(!head)return;
 const more=head.querySelector('.items-line__more');if(more){more.classList.remove('selector');more.hidden=true;more.setAttribute('aria-hidden','true');}
 const nav=document.createElement('div');nav.className='minimal-row-nav';
 function button(direction,label){const b=document.createElement('button');b.type='button';b.className='minimal-row-arrow';b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="'+(direction<0?'m14 6-6 6 6 6':'m10 6 6 6-6 6')+'"/></svg>';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const viewport=line.scroll.render(true).getBoundingClientRect(),active=node(line.items[line.active || 0]),box=active && active.getBoundingClientRect();if(viewport.width && box && (box.right<=viewport.left || box.left>=viewport.right)){const first=line.items.findIndex(item=>{const r=node(item).getBoundingClientRect();return r.width && r.left>=viewport.left-2 && r.left<viewport.right;});if(first>=0){line.active=first;line.last=node(line.items[first]);}}if(!L.Controller.own(line))line.toggle();move(direction);});nav.appendChild(b);return b;}
 previous=button(-1,'Листать влево');next=button(1,'Листать вправо');head.appendChild(nav);update();
}
