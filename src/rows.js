import rowNavigation from './row-navigation.js';
export default function fillRows(L,enabled){
  const lines=new Map();
  const roots=new WeakMap();
  const tracked=new WeakSet(),navigated=new WeakSet();
  const observer=window.IntersectionObserver?new window.IntersectionObserver(entries=>entries.forEach(entry=>{
    const line=roots.get(entry.target),state=line && lines.get(line);
    if(entry.isIntersecting && state)schedule(line,state.data);
  }),{rootMargin:'150px 0px'}):null;
  const sizes=window.ResizeObserver?new window.ResizeObserver(entries=>entries.forEach(entry=>{const line=roots.get(entry.target),state=line && lines.get(line);if(state)schedule(line,state.data);})):null;
  function schedule(line,data){
    if(!line || !line.emit || !line.render || !data || !Array.isArray(data.results) || !enabled())return;
    if(!navigated.has(line) && line.use){navigated.add(line);rowNavigation(L,line,enabled);}
    let state=lines.get(line);
    if(!state){if(lines.size>=96)return;state={data,timer:null,root:null};lines.set(line,state);}
    if(state.timer!==null)return;
    state.timer=setTimeout(()=>{
      state.timer=null;
      if(!enabled() || document.body.matches('.pt-wheel-active,.pt-tv-busy'))return;
      const render=line.render(true),root=render && (render.nodeType?render:render[0]);
      if(!root || !root.isConnected)return;
      if(!state.root){state.root=root;roots.set(root,line);if(observer)observer.observe(root);if(sizes)sizes.observe(root);}
      const box=root.getBoundingClientRect();
      if(!box.width || box.bottom<0 || box.top>window.innerHeight+200)return;
      const card=root.querySelector('.card,.full-person');if(!card)return;
      const size=card.getBoundingClientRect().width;if(!size)return;
      const style=window.getComputedStyle(card),gap=(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0);
      const desired=Math.min(state.data.results.length,24,Math.ceil(box.width/(size+gap))+1);
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
  let resize;
  window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>lines.forEach((state,line)=>schedule(line,state.data)),150);});
  document.addEventListener('minimal:wheel-idle',()=>lines.forEach((state,line)=>schedule(line,state.data)));
  document.addEventListener('minimal:tv-idle',()=>lines.forEach((state,line)=>schedule(line,state.data)));
  let scrolling;
  document.addEventListener('scroll',()=>{clearTimeout(scrolling);scrolling=setTimeout(()=>lines.forEach((state,line)=>schedule(line,state.data)),100);},true);
  return event;
}
