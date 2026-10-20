// Remote navigation keeps one-card steps; pointer arrows page the viewport.
export default function rowNavigation(L,line,enabled){
 if(!line.use || !line.scroll || !L.Controller)return;
 const render=line.render(true),root=render && (render.nodeType?render:render[0]);
 if(!root || root.querySelector('.full-review,.full-review-add'))return;
 const head=root.querySelector('.items-line__head');if(!head)return;
 const people=root.matches('.minimal-cast-native,.items-line--type-persons,.items-line--type-person') || !!root.querySelector('.full-person');root.classList.toggle('minimal-person-row',people);root.classList.add('minimal-paged-row');
 const tv=()=>document.body.classList.contains('pt-tv');
 const node=item=>{const r=item && item.render(true);return r && (r.nodeType?r:r[0]);};
 const total=()=>(line.data.results || []).length || line.items.length;
 let more,frame=0,pageStart=null,disposed=false;
 const viewport=()=>line.scroll.render(true);
 function geometry(){
  const view=viewport().getBoundingClientRect(),first=node(line.items[0]),a=first && first.getBoundingClientRect(),second=node(line.items[1]),b=second && second.getBoundingClientRect();
  const style=first && window.getComputedStyle(first),pitch=a && (b && b.left-a.left || a.width+(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0));
  const inset=(parseFloat(window.getComputedStyle(root).fontSize)||16)*1.5,gap=pitch && a?Math.max(0,pitch-a.width):0;
  const count=Math.max(1,Math.floor(((view.width || root.getBoundingClientRect().width || pitch || 1)-2*inset+gap)/(pitch || 1)));
  let start=line.items.findIndex(item=>{const box=node(item).getBoundingClientRect();return box.width && box.right>view.left+inset+2 && box.left<view.right-inset;});
  if(start<0)start=Math.max(0,line.active || 0);
  return {view,count,start,inset};
 }
 function stop(){if(frame)window.cancelAnimationFrame(frame);frame=0;pageStart=null;viewport().classList.remove('pt-row-paging');}
 function focus(target,alignLeft=false){
  const params=line.params && line.params.items,align=params && params.align_left;
  if(params && alignLeft)params.align_left=true;
  try{L.Controller.collectionSet(viewport());if(tv() && more && !people)L.Controller.collectionAppend(more);L.Controller.collectionFocus(target,viewport());}
  finally{if(params)params.align_left=align;}
 }
 function move(direction,fallback){
  stop();if(!enabled()){if(fallback)fallback();return;}
  if(more && !people){
   if(line.last===more && direction<0){focus(node(line.items[Math.min(line.active,total()-1)]));return;}
   if(direction>0 && line.active>=total()-1){line.last=more;L.Controller.collectionAppend(more);L.Controller.collectionFocus(more,root);return;}
  }
  const old=line.active || 0,index=old+direction;
  if(index<0 || index>=total()){if(fallback)fallback();return;}
  line.active=index;if(!line.items[index])line.emit('scroll');const target=node(line.items[index]);
  if(!target){line.active=old;if(fallback)fallback();return;}
  // Native hover:focus scrolls once and updates the row index. Preserve the
  // previous index until that event, including the step back to card zero.
  line.active=old;line.last=target;focus(target);line.active=index;
 }
 function page(direction){
  if(!enabled() || tv())return;
  const g=geometry(),start=pageStart===null?g.start:pageStart,index=Math.max(0,Math.min(Math.max(0,total()-g.count),start+direction*g.count));
  stop();line.active=index;line.emit('scroll');const target=node(line.items[index]);if(!target)return;
  line.last=target;
  const position=line.scroll.position?line.scroll.position():0;
  let to=index===0?0:position-(target.getBoundingClientRect().left-(g.view.left+g.inset));
  if(index>0 && index+g.count>=total()){
   const last=node(line.items[total()-1]);
   if(last)to=Math.min(to,position-(last.getBoundingClientRect().right-(g.view.right-g.inset)));
  }
  const finish=()=>{frame=0;pageStart=null;viewport().classList.remove('pt-row-paging');if(disposed || !root.isConnected)return;if(L.Controller.own(line))focus(target,true);if(line.scroll.shift)line.scroll.shift((line.scroll.position?line.scroll.position():0)-to);if(line.scroll.onScroll)line.scroll.onScroll(Math.abs(line.scroll.position?line.scroll.position():0));};
  const reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!line.scroll.shift || !window.requestAnimationFrame || reduced){if(line.scroll.shift)line.scroll.shift(position-to);else line.scroll.update(target,false);finish();return;}
  pageStart=index;viewport().classList.add('pt-row-paging');let began;
  const animate=time=>{if(disposed || !root.isConnected || !enabled())return stop();if(began===undefined)began=time;const progress=Math.min(1,(time-began)/320),desired=position+(to-position)*(1-Math.pow(1-progress,3));line.scroll.shift((line.scroll.position?line.scroll.position():position)-desired);if(progress<1)frame=window.requestAnimationFrame(animate);else finish();};
  frame=window.requestAnimationFrame(animate);
 }
 const nav=document.createElement('div');nav.className='minimal-row-nav';
 function button(className,label,svg,action){
  const b=document.createElement('button');b.type='button';b.className=className;b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+svg+'</svg>';
  const activate=event=>{event.preventDefault();event.stopImmediatePropagation();action();};
  b.addEventListener('click',activate);b.addEventListener('hover:enter',activate);b.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' ')activate(event);});nav.appendChild(b);return b;
 }
 button('minimal-row-arrow','Предыдущая страница','<path d="m14 6-6 6 6 6"/>',()=>page(-1));
 const canMore=!people && (head.querySelector('.items-line__more') || line.data.url || line.data.onMore || line.params && line.params.emit && line.params.emit.onMore);
 if(canMore)more=button('minimal-row-more selector','Показать ещё','<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',()=>{if(!enabled())return;line.emit('more',line.data);});
 button('minimal-row-arrow','Следующая страница','<path d="m10 6 6 6-6 6"/>',()=>page(1));head.appendChild(nav);
 line.use({onController(controller){const left=controller.left,right=controller.right,toggle=controller.toggle;controller.left=()=>move(-1,left);controller.right=()=>move(1,right);controller.toggle=function(){const result=toggle && toggle.apply(this,arguments);if(tv() && more && !people)L.Controller.collectionAppend(more);return result;};},onDestroy(){disposed=true;stop();root.removeEventListener('wheel',stop,true);root.removeEventListener('keydown',stop,true);}});
 root.addEventListener('wheel',stop,true);root.addEventListener('keydown',stop,true);
}
