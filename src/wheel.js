import {settleRail} from './rail-fit.js';
// Pointer scrolling must not enter row controllers (their boundary opens the menu).
// Scroll.wheel still owns position, bounds, rendering and lazy-loading callbacks.
export default function installWheel(L,enabled){
  let lastStandard=-Infinity;
  const states=new Map();
  function notify(state){
    const scroll=state.node.Scroll;
    if(!scroll)return;
    if(scroll.onScroll)scroll.onScroll(Math.abs(scroll.position?scroll.position():0));
    else if(L.Layer && L.Layer.visible)L.Layer.visible(state.node);
    if(scroll.onEnd && scroll.isEnd && scroll.isEnd())scroll.onEnd();
    if(scroll.onAnimateEnd)scroll.onAnimateEnd();
  }
  function finish(state){
    if(state.frame && window.cancelAnimationFrame)window.cancelAnimationFrame(state.frame);
    states.delete(state.node);state.node.classList.remove('pt-wheel-moving');
    document.body.classList.toggle('pt-wheel-active',states.size>0);
    if(state.node.isConnected){if(enabled())settleRail(state.node);notify(state);}
    if(!states.size)document.dispatchEvent(new Event('minimal:wheel-idle'));
  }
  function animate(state,time){
    state.frame=0;
    if(!enabled() || !state.node.isConnected)return finish(state);
    const dt=state.time?Math.max(1,Math.min(40,time-state.time)):16.67;state.time=time;
    const step=Math.abs(state.remaining)<.4?state.remaining:state.remaining*(1-Math.exp(-dt/90));
    const scroll=state.node.Scroll,before=scroll.position && scroll.position();
    scroll.shift(step);state.remaining-=step;
    if(scroll.position && scroll.position()===before)state.remaining=0;
    if(!state.lastNotify || time-state.lastNotify>=120){state.lastNotify=time;notify(state);}
    if(Math.abs(state.remaining)<.01)return finish(state);
    state.frame=window.requestAnimationFrame(t=>animate(state,t));
  }
  function rowOverflows(node){
    const body=node.Scroll.body?.(true),inset=node.Scroll.minimalPosterFit?.inset || 0;
    return !!body && body.scrollWidth+inset*2>node.clientWidth;
  }
  function move(node,delta){
    const scroll=node.Scroll;
    if(typeof scroll.shift!=='function'){
      const params=scroll.params && scroll.params(),byItem=params && params.scroll_by_item;
      try{if(params)params.scroll_by_item=false;scroll.wheel(delta);}
      finally{if(params)params.scroll_by_item=byItem;}
      return;
    }
    const reduced=document.body.classList.contains('pt-reduce-motion') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(!window.requestAnimationFrame || reduced){if(states.has(node))finish(states.get(node));scroll.shift(delta);notify({node});return;}
    let state=states.get(node);
    if(!state){state={node,remaining:0,time:0,frame:0,lastNotify:0};states.set(node,state);node.classList.add('pt-wheel-moving');document.body.classList.add('pt-wheel-active');}
    if(state.remaining*delta<0)state.remaining=0;
    state.remaining=Math.max(-900,Math.min(900,state.remaining+delta));
    if(!state.frame)state.frame=window.requestAnimationFrame(t=>animate(state,t));
  }
  // Return control immediately to the remote/keyboard or an explicit click.
  function cancel(){Array.from(states.values()).forEach(finish);}
  document.addEventListener('keydown',cancel,true);
  document.addEventListener('pointerdown',cancel,true);
  window.addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});

  function handle(event){
    if(!enabled() || event.ctrlKey || event.metaKey)return;
    const target=event.target;
    if(!target || !target.closest || target.closest('.player,input,textarea,[contenteditable="true"]'))return;
    const standard=event.type==='wheel';
    let x=standard?Number(event.deltaX)||0:-(Number(event.wheelDeltaX)||0);
    let y=standard?Number(event.deltaY)||0:-(Number(event.wheelDeltaY)||Number(event.wheelDelta)||0);
    if(!x && !y)return;
    if(standard){
      const unit=event.deltaMode===1?18:event.deltaMode===2?window.innerHeight:1;
      x*=unit;y*=unit;
    }
    const horizontal=event.shiftKey || Math.abs(x)>Math.abs(y);
    let node=target.closest('.scroll');
    while(node && (node.classList.contains('scroll--horizontal')!==horizontal || !node.Scroll || typeof node.Scroll.wheel!=='function')){
      node=node.parentElement && node.parentElement.closest('.scroll');
    }
    if(!node)return;
    event.preventDefault();event.stopImmediatePropagation();
    // Chromium can deliver both names for one physical wheel movement.
    if(!standard && Date.now()-lastStandard<80)return;
    if(standard)lastStandard=Date.now();
    if(!horizontal && document.body.classList.contains('pt-tv'))document.dispatchEvent(new CustomEvent('minimal:tv-pointer-scroll',{detail:node}));
    let delta=horizontal?(event.shiftKey && !x?y:x):y;
    delta=Math.max(-360,Math.min(360,delta));
    if(horizontal && delta>0)node.Scroll.minimalPointerFill?.();
    if(horizontal && !rowOverflows(node))notify({node});
    move(node,delta);
  }
  let drag=null,suppressClick=null;
  document.addEventListener('pointerdown',event=>{
    suppressClick=null;
    if(!enabled() || !event.isPrimary)return;
    const node=event.target.closest?.('.scroll--horizontal');
    const extensions=document.body.classList.contains('pt-desktop') && node?.closest('.extensions__block');
    if((!node?.closest('.items-line') && !extensions) || !node.Scroll?.shift)return;
    if(extensions && event.target.closest('button,a,input,textarea,select,[contenteditable="true"]'))return;
    if(event.pointerType==='touch'){
      node.Scroll.minimalPointerFill?.();
      if(!rowOverflows(node))notify({node});
    }
    if(event.pointerType!=='mouse' || event.button!==0)return;
    drag={node,id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  });
  document.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.id)return;
    if(!enabled() || !drag.node.isConnected){finishDrag(event);return;}
    const delta=drag.x-event.clientX;
    if(!drag.moved){
      if(Math.abs(delta)<7)return;
      if(Math.abs(event.clientY-drag.y)>Math.abs(delta)){drag=null;return;}
      if(delta>0)drag.node.Scroll.minimalPointerFill?.();
      if(!rowOverflows(drag.node))notify(drag);
      if(!rowOverflows(drag.node))return;
      drag.moved=true;
      drag.node.setPointerCapture?.(event.pointerId);
      drag.node.classList.add('pt-row-dragging');
    }
    event.preventDefault();
    drag.x=event.clientX;
    if(delta>0)drag.node.Scroll.minimalPointerFill?.();
    drag.node.Scroll.shift(delta);
  },{passive:false});
  function finishDrag(event){
    if(!drag || (event && event.pointerId!==drag.id))return;
    const state=drag;drag=null;
    if(!state.moved)return;
    state.node.classList.remove('pt-row-dragging');
    suppressClick=state.node;
    if(state.node.isConnected){settleRail(state.node);notify(state);}
  }
  document.addEventListener('pointerup',finishDrag,true);
  document.addEventListener('pointercancel',finishDrag,true);
  window.addEventListener('blur',()=>finishDrag());
  document.addEventListener('click',event=>{
    if(!suppressClick?.contains(event.target))return;
    suppressClick=null;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
  document.addEventListener('dragstart',event=>{
    if(drag?.node.contains(event.target))event.preventDefault();
  });
  document.addEventListener('wheel',handle,{capture:true,passive:false});
  document.addEventListener('mousewheel',handle,{capture:true,passive:false});
}
