// Pointer scrolling must not enter row controllers (their boundary opens the menu).
// Scroll.wheel still owns position, bounds, rendering and lazy-loading callbacks.
export default function installWheel(L,enabled){
  let lastStandard=-Infinity;
  const states=new Map();
  function notify(state,final){
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
    if(state.node.isConnected)notify(state,true);
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
    if(!state.lastNotify || time-state.lastNotify>=120){state.lastNotify=time;notify(state,false);}
    if(Math.abs(state.remaining)<.01)return finish(state);
    state.frame=window.requestAnimationFrame(t=>animate(state,t));
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
    if(!window.requestAnimationFrame || reduced){if(states.has(node))finish(states.get(node));scroll.shift(delta);notify({node},true);return;}
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
    let delta=horizontal?(event.shiftKey && !x?y:x):y;
    delta=Math.max(-360,Math.min(360,delta));
    move(node,delta);
  }
  document.addEventListener('wheel',handle,{capture:true,passive:false});
  document.addEventListener('mousewheel',handle,{capture:true,passive:false});
}
