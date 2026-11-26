import rowNavigation from './row-navigation.js';
import fitRail,{railLayout,settleRail} from './rail-fit.js';
export default function fillRows(L,enabled){
  const lines=new Map();
  const deferred=new Set();
  const pending=new Set();
  let frame=0;
  const request=callback=>window.requestAnimationFrame?window.requestAnimationFrame(callback):setTimeout(callback,0);
  const desktop=()=>document.body.classList.contains('pt-desktop');
  const roots=new WeakMap();
  const tracked=new WeakSet(),navigated=new WeakSet(),ahead=Math.min(1500,Math.max(700,(window.innerHeight || 540)*1.5));
  const observers=new WeakMap();
  const onIntersection=entries=>entries.forEach(entry=>{
    const line=roots.get(entry.target),state=line && lines.get(line);
    if(state && entry.isIntersecting)schedule(line,state.data);
  });
  const observe=window.IntersectionObserver && (row=>{
    // A window observer clips the expanded margin at the scroll container.
    // Observe the rail against that container to prepare upcoming rows.
    const viewport=row.closest('.scroll');
    let observer=observers.get(viewport || document);
    if(!observer){
      observer=new window.IntersectionObserver(onIntersection,{root:viewport,rootMargin:ahead+'px 0px'});
      observers.set(viewport || document,observer);
    }
    observer.observe(row);
    return observer;
  });
  const sizes=window.ResizeObserver?new window.ResizeObserver(entries=>entries.forEach(entry=>{const line=roots.get(entry.target),state=line && lines.get(line);if(state)schedule(line,state.data);})):null;
  function schedule(line,data){
    if(!line || !line.emit || !line.render || !data || !Array.isArray(data.results) || !enabled())return;
    if(!navigated.has(line) && line.use){navigated.add(line);rowNavigation(L,line,enabled);}
    let state=lines.get(line);
    if(!state){if(lines.size>=96)return;state={data,root:null};lines.set(line,state);}
    state.data=data;
    pending.add(line);
    if(!frame)frame=request(flush);
  }
  function flush(){
    frame=0;
    const limit=document.body.classList.contains('pt-tv')?1:8;
    let metrics;
    const layout=()=>metrics || (metrics=railLayout());
    let count=0;
    for(const line of pending){
      pending.delete(line);
      const state=lines.get(line);
      if(state)prepare(line,state,layout);
      if(++count>=limit)break;
    }
    if(pending.size && !frame)frame=request(flush);
  }
  function prepare(line,state,layout){
      if(!enabled())return;
      deferred.delete(line);
      const render=line.render(true),root=render && (render.nodeType?render:render[0]);
      if(!root || !root.isConnected)return;
      if(!state.root){
        state.root=root;roots.set(root,line);state.observer=observe?.(root);if(sizes)sizes.observe(root);
        root.addEventListener('touchend',event=>{
          // Safari determines the click target after touchend. Keep the end
          // button under the finger until the browser dispatches that click.
          if(enabled() && !event.target.closest?.('.minimal-row-more'))settleRail(line.scroll && line.scroll.render(true));
        },{passive:true});
      }
      // Saved screens receive global idle/hero events too. Their geometry
      // becomes relevant again on the native visible/IntersectionObserver event.
      if(root.closest('.activity:not(.activity--active)'))return;
      // A fitted row has no urgent sizing work during a remote gesture.
      // Check this before reading geometry after the focus styles changed.
      if(state.posterFitKey && document.body.classList.contains('pt-tv-busy')){deferred.add(line);return;}
      const box=root.getBoundingClientRect();
      const onScreen=box.bottom>0 && box.top<window.innerHeight;
      if(onScreen && (document.body.classList.contains('pt-tv-busy') || document.body.classList.contains('pt-wheel-active') && (!desktop() || state.posterFitKey))){deferred.add(line);return;}
      const first=!document.body.classList.contains('pt-tv') && root.previousElementSibling && root.previousElementSibling.matches('.pt-hero');
      if(!box.width)return;
      const nearby=first || box.bottom>=0 && box.top<=window.innerHeight+ahead;
      if(!nearby)return;
      const card=root.querySelector('.card,.full-person');if(!card)return;
      if(document.body.classList.contains('pt-tv') && root.classList.contains('minimal-cast-native')){
        const viewport=line.scroll && line.scroll.render(true),content=viewport && viewport.querySelector('.scroll__content');
        if(content){
          const padding=window.getComputedStyle(content),style=window.getComputedStyle(card),second=root.querySelectorAll('.full-person')[1];
          const gap=second?(parseFloat(window.getComputedStyle(second).marginLeft)||0):0;
          const available=viewport.getBoundingClientRect().width-(parseFloat(padding.paddingLeft)||0)-(parseFloat(padding.paddingRight)||0),base=(parseFloat(style.fontSize)||14)*7;
          if(available>0){const count=Math.max(1,Math.floor((available+gap)/(base+gap))),width=(available-(count-1)*gap)/count;root.style.setProperty('--minimal-person-width',width.toFixed(3)+'px');}
        }
      }
      const fit=fitRail(line,root,card,state,enabled,layout);
      line.minimalMoreRefresh?.();
      // TV prepares a complete viewport plus one card in every nearby row.
      // Pointer layouts retain an extra half viewport for faster wheel input.
      const tv=document.body.classList.contains('pt-tv');
      let slots=tv && fit?fit.count:0;
      if(!slots){
        const size=card.getBoundingClientRect().width;if(!size)return;
        const style=window.getComputedStyle(card);
        const gap=(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0);
        const extra=card.matches('.card') && !tv?1.5:1;
        slots=Math.ceil(box.width/(size+gap)*extra);
      }
      const desired=Math.min(state.data.results.length,30,slots+1);
      const count=root.querySelectorAll('.card,.full-person').length;
      if(desired<=Number(line.view || 0) && count>=Math.min(desired,state.data.results.length))return;
      // Lampa builds seven cards by default. Match its lazy batch to actual CSS size.
      line.view=Math.max(line.view || 0,desired);
      if(line.params && line.params.items)line.params.items.view=line.view;
      line.emit('scroll');
  }
  function event(event){
    if(!event)return;
    if(event.type==='destroy'){
      const state=lines.get(event.line);if(state?.root){state.observer?.unobserve(state.root);sizes?.unobserve(state.root);}pending.delete(event.line);deferred.delete(event.line);lines.delete(event.line);return;
    }
    if(['create','append','visible'].includes(event.type))schedule(event.line,event.data);
  }
  // Persons uses only Items/Create, without Lampa's global Line Event module.
  // Register its real lifecycle directly instead of waiting for a line event.
  event.track=(line,data)=>{
    if(!line || !data)return;
    if(!tracked.has(line) && line.use){tracked.add(line);line.use({onAppend:()=>schedule(line,data),onVisible:()=>schedule(line,data),onDestroy:()=>event({type:'destroy',line})});}
    schedule(line,data);
  };
  // Actor filmography disables native Line/Event and More modules. Attach
  // the same bounded row navigation after each real line has been created.
  if(L.Component && typeof L.Component.create==='function'){
    const create=L.Component.create;
    L.Component.create=function(object){
      const component=create.apply(this,arguments);
      if(object && object.component==='actor' && component && component.use)component.use({onAppend(line,data){
        if(data && Array.isArray(data.results) && data.results.length)event.track(line,data);
      }});
      return component;
    };
  }
  let resize;
  window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>lines.forEach((state,line)=>schedule(line,state.data)),150);});
  document.addEventListener('minimal:hero-layout',()=>lines.forEach((state,line)=>schedule(line,state.data)));
  function resumeDeferred(){
    for(const line of deferred){const state=lines.get(line);if(state)schedule(line,state.data);}
  }
  document.addEventListener('minimal:wheel-idle',resumeDeferred);
  document.addEventListener('minimal:tv-idle',resumeDeferred);
  if(!observe){
    let scrolling;
    document.addEventListener('scroll',()=>{clearTimeout(scrolling);scrolling=setTimeout(()=>lines.forEach((state,line)=>schedule(line,state.data)),100);},true);
  }
  return event;
}
