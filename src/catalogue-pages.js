// Keep display pages independent of source pages: the native grid stops at
// the first empty display page and keeps its initial pagination boundary.
export default function cataloguePages(load,filter,language,pageSize=20,pack=true){
 const feeds=new Map();
 function list(params,ok,fail=()=>{}){
  const page=Math.max(1,Number(params.page)||1),key=language()+'|'+params.url;
  let state=feeds.get(key);
  if(!state || page===1 && !state.running && Date.now()-state.at>300000){
   state={pages:[],buffer:[],seen:new Set(),waiters:[],next:1,last:1,at:Date.now(),running:false};
   feeds.set(key,state);
   if(feeds.size>32)feeds.delete(feeds.keys().next().value);
  }
  const deliver=json=>{
   const active=typeof window!=='undefined' && window.Lampa?.Activity?.active?.(),grid=active?.activity?.component;
   if(grid && grid.object===active && active.url===params.url && Number(active.page || 1)===page)grid.total_pages=json.total_pages;
   ok(json);
  };
  if(state.pages[page-1])return deliver(state.pages[page-1]);
  state.waiters.push({page,deliver,fail});
  if(state.running)return;
  state.running=true;
  let requests=0;
  function advance(){
   if(!state.waiters.length){state.running=false;return;}
   if(state.buffer.length>=pageSize || !pack && state.buffer.length || state.next>state.last){
    const results=state.buffer.splice(0,pageSize),number=state.pages.length+1;
    const more=state.buffer.length>0 || state.next<=state.last;
    const json={results,page:number,total_pages:number+(more?1:0)};
    state.pages.push(json);
    const ready=state.waiters.filter(waiter=>waiter.page<=number || !more);
    state.waiters=state.waiters.filter(waiter=>!ready.includes(waiter));
    ready.forEach(waiter=>waiter.deliver(state.pages[waiter.page-1] || {...json,page:waiter.page,results:[]}));
    return advance();
   }
   function error(reason){state.running=false;state.waiters.splice(0).forEach(waiter=>waiter.fail(reason));}
   const fetch=()=>load({...params,page:state.next},json=>{
    if(!Array.isArray(json?.results))return error();
    state.last=Math.min(500,Math.max(state.next,Number(json.total_pages)||state.next));state.next++;
    for(const card of filter(json.results,params)){
     const id=card.id==null?null:(card.media_type || (card.name?'tv':'movie'))+':'+card.id;
     if(id!==null && state.seen.has(id))continue;
     if(id!==null)state.seen.add(id);
     state.buffer.push(card);
    }
    advance();
   },error);
   if(++requests%4===0)setTimeout(fetch,0);else fetch();
  }
  advance();
 }
 list.clear=()=>feeds.clear();
 return list;
}
