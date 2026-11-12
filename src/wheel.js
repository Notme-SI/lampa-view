import {settleRail} from './rail-fit.js';
// Pointer scrolling must not enter row controllers (their boundary opens the menu).
// Native Scroll owns the committed position and lazy loading.
export default function installWheel(L,enabled){
  let lastStandard=-Infinity;
  const states=new Map();
  function notify(state,ended=true){
    const scroll=state.node.Scroll;
    if(!scroll)return;
    if(scroll.onScroll)scroll.onScroll(Math.abs(scroll.position?scroll.position():0));
    else if(L.Layer && L.Layer.visible)L.Layer.visible(state.node);
    if(scroll.onEnd && scroll.isEnd && scroll.isEnd())scroll.onEnd();
    if(ended && scroll.onAnimateEnd)scroll.onAnimateEnd();
  }
  const desktopRail=node=>node.classList.contains('scroll--horizontal') &&
    document.body.classList.contains('pt-desktop') && L.Platform?.screen?.('tv');
  function measure(rail,node){
    const padding=parseInt(getComputedStyle(rail.content).paddingLeft,10)||0;
    rail.limit=Math.max(0,rail.body.scrollWidth+padding*2-node.offsetWidth);
  }
  function preview(node){
    const scroll=node.Scroll,body=scroll.body?.(true),content=body?.parentElement;
    if(!body?.classList.contains('scroll__body') || !content?.classList.contains('scroll__content') || content.parentElement!==node || !scroll.position)return null;
    const position=scroll.position(),rail={body,content,position,committed:position,limit:0};
    measure(rail,node);
    return rail;
  }
  function advance(state,delta){
    const scroll=state.node.Scroll,rail=state.rail;
    if(!rail){const before=scroll.position?.();scroll.shift(delta);return !scroll.position || scroll.position()!==before;}
    const native=scroll.position();
    if(native!==rail.committed){
      rail.position=rail.committed=native;
      rail.body.style.removeProperty('--pt-rail-preview');
      measure(rail,state.node);
    }
    const next=Math.max(-rail.limit,Math.min(0,rail.position-delta));
    if(next===rail.position)return false;
    rail.position=next;
    rail.body.style.setProperty('--pt-rail-preview',Math.round(next)+'px');
    return true;
  }
  function commit(state){
    const rail=state.rail,scroll=state.node.Scroll;
    if(!rail)return;
    if(scroll.position()===rail.committed && rail.committed!==rail.position)scroll.shift(rail.committed-rail.position);
    rail.position=rail.committed=scroll.position();
  }
  function checkpoint(state){
    commit(state);
    if(state.rail && state.forward)state.node.Scroll.minimalPointerFill?.();
    notify(state,!state.rail);
    if(state.rail)measure(state.rail,state.node);
  }
  function release(state){
    if(state.node.isConnected){
      commit(state);
      if(enabled())settleRail(state.node);
    }
    state.rail?.body.style.removeProperty('--pt-rail-preview');
  }
  function finish(state){
    if(state.frame && window.cancelAnimationFrame)window.cancelAnimationFrame(state.frame);
    release(state);
    states.delete(state.node);state.node.classList.remove('pt-wheel-moving');
    document.body.classList.toggle('pt-wheel-active',states.size>0);
    if(state.node.isConnected)notify(state);
    if(!states.size)document.dispatchEvent(new Event('minimal:wheel-idle'));
  }
  function animate(state,time){
    state.frame=0;
    if(!enabled() || !state.node.isConnected)return finish(state);
    const dt=state.time?Math.max(1,Math.min(40,time-state.time)):16.67;state.time=time;
    const step=Math.abs(state.remaining)<.4?state.remaining:state.remaining*(1-Math.exp(-dt/90));
    const moved=advance(state,step);state.remaining-=step;
    if(!state.lastNotify || time-state.lastNotify>=120 || (!moved && state.rail && state.forward)){
      state.lastNotify=time;checkpoint(state);
    }
    if(!moved && (!state.rail || state.rail.position<=-state.rail.limit || !state.forward))state.remaining=0;
    if(Math.abs(state.remaining)<.01)return finish(state);
    state.frame=window.requestAnimationFrame(t=>animate(state,t));
  }
  function rowOverflows(node){
    const body=node.Scroll.body?.(true),inset=node.Scroll.minimalPosterFit?.inset || 0;
    return !!body && body.scrollWidth+inset*2>node.clientWidth;
  }
  function move(node,delta,fastRail){
    const scroll=node.Scroll;
    if(typeof scroll.shift!=='function'){
      const params=scroll.params && scroll.params(),byItem=params && params.scroll_by_item;
      try{if(params)params.scroll_by_item=false;scroll.wheel(delta);}
      finally{if(params)params.scroll_by_item=byItem;}
      return;
    }
    const reduced=document.body.classList.contains('pt-reduce-motion') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(!window.requestAnimationFrame || reduced){
      if(states.has(node))finish(states.get(node));
      if(fastRail && delta>0)scroll.minimalPointerFill?.();
      scroll.shift(delta);notify({node});return;
    }
    let state=states.get(node);
    if(!state){
      if(fastRail){
        if(delta>0)scroll.minimalPointerFill?.();
        if(!rowOverflows(node))notify({node});
      }
      state={node,rail:fastRail?preview(node):null,remaining:0,time:0,frame:0,lastNotify:0};
      states.set(node,state);node.classList.add('pt-wheel-moving');document.body.classList.add('pt-wheel-active');
    }
    state.forward=delta>0;
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
    const fastRail=horizontal && desktopRail(node);
    if(horizontal && !fastRail){
      if(delta>0)node.Scroll.minimalPointerFill?.();
      if(!rowOverflows(node))notify({node});
    }
    move(node,delta,fastRail);
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
      if(window.requestAnimationFrame && desktopRail(drag.node))drag.rail=preview(drag.node);
    }
    event.preventDefault();
    drag.x=event.clientX;
    if(!drag.rail){
      if(delta>0)drag.node.Scroll.minimalPointerFill?.();
      drag.node.Scroll.shift(delta);
      return;
    }
    drag.forward=delta>0;
    drag.pending=(drag.pending||0)+delta;
    if(!drag.frame){
      const state=drag;
      state.frame=window.requestAnimationFrame(time=>{
        state.frame=0;
        const moved=advance(state,state.pending);state.pending=0;
        if(!state.lastNotify || time-state.lastNotify>=120 || (!moved && state.forward)){
          state.lastNotify=time;checkpoint(state);
        }
      });
    }
  },{passive:false});
  function finishDrag(event){
    if(!drag || (event && event.pointerId!==drag.id))return;
    const state=drag;drag=null;
    if(!state.moved)return;
    if(state.frame){
      window.cancelAnimationFrame(state.frame);
      if(state.node.isConnected)advance(state,state.pending);
    }
    release(state);state.node.classList.remove('pt-row-dragging');
    suppressClick=state.node;
    if(state.node.isConnected)notify(state);
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
