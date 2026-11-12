import rowNavigation from './row-navigation.js';
import fitRail,{settleRail} from './rail-fit.js';
export default function fillRows(L,enabled){
  const lines=new Map();
  const desktop=()=>document.body.classList.contains('pt-desktop');
  const roots=new WeakMap();
  const tracked=new WeakSet(),navigated=new WeakSet(),ahead=Math.min(800,Math.max(360,window.innerHeight || 540));
  const observer=window.IntersectionObserver?new window.IntersectionObserver(entries=>entries.forEach(entry=>{
    const line=roots.get(entry.target),state=line && lines.get(line);
    if(entry.isIntersecting && state)schedule(line,state.data);
  }),{rootMargin:ahead+'px 0px'}):null;
  const sizes=window.ResizeObserver?new window.ResizeObserver(entries=>entries.forEach(entry=>{const line=roots.get(entry.target),state=line && lines.get(line);if(state)schedule(line,state.data);})):null;
  function schedule(line,data){
    if(!line || !line.emit || !line.render || !data || !Array.isArray(data.results) || !enabled())return;
    if(!navigated.has(line) && line.use){navigated.add(line);rowNavigation(L,line,enabled);}
    let state=lines.get(line);
    if(!state){if(lines.size>=96)return;state={data,timer:null,root:null};lines.set(line,state);}
    if(state.timer!==null)return;
    state.timer=setTimeout(()=>{
      state.timer=null;
      if(!enabled())return;
      const render=line.render(true),root=render && (render.nodeType?render:render[0]);
      if(!root || !root.isConnected)return;
      if(!state.root){state.root=root;roots.set(root,line);if(observer)observer.observe(root);if(sizes)sizes.observe(root);root.addEventListener('touchend',()=>{if(enabled())settleRail(line.scroll && line.scroll.render(true));},{passive:true});}
      if(document.body.classList.contains('pt-tv-busy') || document.body.classList.contains('pt-wheel-active') && (!desktop() || state.posterFitKey)){state.deferred=true;return;}
      state.deferred=false;
      const box=root.getBoundingClientRect();
      const first=!document.body.classList.contains('pt-tv') && root.previousElementSibling && root.previousElementSibling.matches('.pt-hero');
      if(!box.width)return;
      const nearby=first || box.bottom>=0 && box.top<=window.innerHeight+ahead;
      const card=root.querySelector('.card,.full-person');if(!card)return;
      if(!nearby)return;
      if(document.body.classList.contains('pt-tv') && root.classList.contains('minimal-cast-native')){
        const viewport=line.scroll && line.scroll.render(true),content=viewport && viewport.querySelector('.scroll__content');
        if(content){
          const padding=window.getComputedStyle(content),style=window.getComputedStyle(card),second=root.querySelectorAll('.full-person')[1];
          const gap=second?(parseFloat(window.getComputedStyle(second).marginLeft)||0):0;
          const available=viewport.getBoundingClientRect().width-(parseFloat(padding.paddingLeft)||0)-(parseFloat(padding.paddingRight)||0),base=(parseFloat(style.fontSize)||14)*7;
          if(available>0){const count=Math.max(1,Math.floor((available+gap)/(base+gap))),width=(available-(count-1)*gap)/count;root.style.setProperty('--minimal-person-width',width.toFixed(3)+'px');}
        }
      }
      fitRail(line,root,card,state,enabled);
      line.minimalMoreRefresh?.();
      const size=card.getBoundingClientRect().width;if(!size)return;
      const style=window.getComputedStyle(card),gap=(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0);
      // TV prepares a complete viewport plus one card in every nearby row.
      // Pointer layouts retain an extra half viewport for faster wheel input.
      const extra=card.matches('.card') && !document.body.classList.contains('pt-tv')?1.5:1;
      const desired=Math.min(state.data.results.length,30,Math.ceil(box.width/(size+gap)*extra)+1);
      const count=root.querySelectorAll('.card,.full-person').length;
      if(desired<=Number(line.view || 0) && count>=Math.min(desired,state.data.results.length))return;
      // Lampa builds seven cards by default. Match its lazy batch to actual CSS size.
      line.view=Math.max(line.view || 0,desired);
      if(line.params && line.params.items)line.params.items.view=line.view;
      line.emit('scroll');
    },0);
  }
  function event(event){
    if(!event)return;
    if(event.type==='destroy'){
      const state=lines.get(event.line);if(state){clearTimeout(state.timer);if(observer && state.root)observer.unobserve(state.root);if(sizes && state.root)sizes.unobserve(state.root);}lines.delete(event.line);return;
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
  document.addEventListener('minimal:wheel-idle',()=>lines.forEach((state,line)=>{if(state.deferred || !desktop())schedule(line,state.data);}));
  document.addEventListener('minimal:tv-idle',()=>lines.forEach((state,line)=>{if(state.deferred)schedule(line,state.data);}));
  let scrolling;
  document.addEventListener('scroll',()=>{if(observer && desktop())return;clearTimeout(scrolling);scrolling=setTimeout(()=>lines.forEach((state,line)=>schedule(line,state.data)),100);},true);
  return event;
}
