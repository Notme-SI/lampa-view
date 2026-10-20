// Page the existing Lampa row: native cards, reading, touch and remote focus stay intact.
export default function comments(item,node){
 if(!node || node.dataset.minimalComments)return;
 node.dataset.minimalComments='1';node.classList.add('minimal-comments-native');
 const add=node.querySelector('.full-review-add');if(add){add.setAttribute('aria-label','Написать комментарий');add.title='Написать комментарий';}
 const head=node.querySelector('.items-line__head'),viewport=node.querySelector('.scroll--horizontal');
 if(!head || !viewport || !viewport.Scroll)return;
 const scroll=viewport.Scroll,body=scroll.body(true),nav=document.createElement('div');nav.className='minimal-comments-nav';nav.setAttribute('role','group');nav.setAttribute('aria-label','Листать комментарии');
 let disposed=false,frame=0;
 function cards(){return Array.from(body.children);}
 function update(){
  if(disposed)return;
  // An empty list has only the native "write" card.
  nav.hidden=cards().length<2;
 }
 function schedule(){if(!disposed && !frame)frame=window.requestAnimationFrame(()=>{frame=0;update();});}
 function move(direction){
  if(disposed)return;
  const available=cards(),position=Math.abs(scroll.position?scroll.position():viewport.scrollLeft),origin=body.getBoundingClientRect().left;
  let first=available.findIndex(card=>card.getBoundingClientRect().left-origin>=position-2);if(first<0)first=available.length-1;
  const index=Math.max(0,Math.min(available.length-1,first+direction)),card=available[index];if(!card)return;
  const nativeIndex=item.items && item.items.findIndex(entry=>{const r=entry.render(true);return (r.nodeType?r:r[0])===card;});
  if(nativeIndex>=0){item.active=nativeIndex;item.last=card;}
  scroll.update(card,false);
  // Advancing the native index also advances its lazy rendering batch.
  if(item.emit)item.emit('scroll');update();schedule();
 }
 function button(direction,label){
  const control=document.createElement('button');control.type='button';control.className='minimal-comments-arrow';control.title=label;control.setAttribute('aria-label',label);
  control.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="'+(direction<0?'m14 6-6 6 6 6':'m10 6 6 6-6 6')+'"/></svg>';
  control.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();move(direction);});
  control.addEventListener('hover:enter',()=>move(direction));nav.appendChild(control);return control;
 }
 const previous=button(-1,'Предыдущий комментарий'),next=button(1,'Следующий комментарий');head.appendChild(nav);
 const observer=window.ResizeObserver?new ResizeObserver(schedule):null;if(observer){observer.observe(viewport);observer.observe(body);}
 viewport.addEventListener('scroll',schedule,{passive:true});viewport.addEventListener('touchend',schedule,{passive:true});window.addEventListener('resize',schedule);
 function dispose(){disposed=true;if(frame)window.cancelAnimationFrame(frame);if(observer)observer.disconnect();viewport.removeEventListener('scroll',schedule);viewport.removeEventListener('touchend',schedule);window.removeEventListener('resize',schedule);}
 if(item.use)item.use({onScroll:schedule,onVisible:schedule,onAppend:schedule,onDestroy:dispose});
 update();schedule();
}
