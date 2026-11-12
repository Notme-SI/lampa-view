import {text as t} from './i18n.js';
// Lampa scrolls by transforms on many desktop hosts. Keep that native Scroll
// and its lazy-loading callbacks; expose only a thumb for its current range.
export default function pageScrollbar(L,enabled){
 if(typeof window.requestAnimationFrame!=='function')return;
 const track=document.createElement('div'),thumb=document.createElement('div');
 track.className='pt-page-scrollbar';track.tabIndex=0;track.hidden=true;track.setAttribute('role','scrollbar');track.setAttribute('aria-label',t('Прокрутка страницы'));track.setAttribute('aria-orientation','vertical');track.setAttribute('aria-valuemin','0');thumb.className='pt-page-scrollbar__thumb';thumb.setAttribute('aria-hidden','true');track.appendChild(thumb);document.body.appendChild(track);
 let root,scroll,resize,mutation,frame=0,range=0,travel=0,drag=null;
 function draw(){
  frame=0;const active=enabled() && document.body.classList.contains('pt-desktop'),next=active && [...document.querySelectorAll('.activity--active .scroll:not(.scroll--horizontal)')].find(node=>node.clientWidth>0 && node.clientHeight>0 && node.Scroll);
  if(next!==root){
   if(resize)resize.disconnect();if(mutation)mutation.disconnect();if(root){root.removeEventListener('scroll',schedule);root.removeEventListener('minimal:viewport-scroll',schedule);}
   root=next;scroll=root && root.Scroll;
   if(root && scroll){
    const body=root.querySelector('.scroll__body');root.addEventListener('scroll',schedule,{passive:true});root.addEventListener('minimal:viewport-scroll',schedule);
    if(window.ResizeObserver){resize=new ResizeObserver(schedule);resize.observe(root);if(body)resize.observe(body);}
    if(window.MutationObserver && body){mutation=new MutationObserver(schedule);mutation.observe(body,{attributes:true,attributeFilter:['style']});}
   }
  }
  scroll=root && root.Scroll;
  if(!scroll || !scroll.vieport){track.hidden=true;return;}
  const view=scroll.vieport(),content=root.querySelector('.scroll__content'),padding=content?parseInt(getComputedStyle(content).paddingTop,10)||0:0;
  range=Math.max(0,view.body+(root.classList.contains('pt-browser-catalogue')?0:padding*2)-view.content);track.hidden=!active || range<2;if(track.hidden)return;
  const height=track.clientHeight,size=Math.min(height,Math.max(32,height*view.content/(view.content+range))),position=Math.max(0,Math.min(range,Math.abs(scroll.position())));
  travel=Math.max(1,height-size);thumb.style.height=size+'px';thumb.style.transform='translateY('+(position/range*travel)+'px)';track.setAttribute('aria-valuemax',String(Math.round(range)));track.setAttribute('aria-valuenow',String(Math.round(position)));
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
 function to(amount){
  if(!scroll)return;amount=Math.max(0,Math.min(range,amount));scroll.shift(scroll.position()+amount);
  if(root.classList.contains('pt-browser-catalogue')){schedule();return;}
  if(scroll.onScroll)scroll.onScroll(Math.abs(scroll.position()));else if(L.Layer?.visible)L.Layer.visible(root);
  if(scroll.onEnd && scroll.isEnd?.())scroll.onEnd();schedule();
 }
 track.addEventListener('pointerdown',event=>{
  if(track.hidden || event.button!==0)return;event.preventDefault();event.stopPropagation();
  if(event.target!==thumb){to(Math.abs(scroll.position())+(event.clientY<thumb.getBoundingClientRect().top?-1:1)*scroll.vieport().content*.9);return;}
  drag={y:event.clientY,position:Math.abs(scroll.position()),range,travel};track.classList.add('pt-dragging');track.setPointerCapture(event.pointerId);
 });
 track.addEventListener('pointermove',event=>{if(drag)to(drag.position+(event.clientY-drag.y)/drag.travel*drag.range);});
 function finish(){drag=null;track.classList.remove('pt-dragging');if(scroll?.onAnimateEnd)scroll.onAnimateEnd();schedule();}
 track.addEventListener('pointerup',finish);track.addEventListener('pointercancel',finish);
 track.addEventListener('keydown',event=>{
  const step={ArrowDown:60,ArrowUp:-60,PageDown:scroll?.vieport().content*.9,PageUp:-scroll?.vieport().content*.9,Home:-Infinity,End:Infinity}[event.key];
  if(step===undefined)return;event.preventDefault();event.stopImmediatePropagation();to(Math.abs(scroll.position())+step);
 });
 for(const name of ['activity','line'])L.Listener.follow(name,schedule);
 L.Storage?.listener?.follow('change',event=>{if(['lampa_view_enabled','lampa_view_layout'].includes(event.name))schedule();});
 for(const name of ['minimal:interface-size','minimal:detail-layout','minimal:wheel-idle'])document.addEventListener(name,schedule);
 window.addEventListener('resize',schedule);schedule();
}
