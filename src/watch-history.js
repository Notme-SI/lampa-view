import cardInfo from './card-info.js';
const instances=new WeakMap();
const PAGE_TTL=30000;

// Current CUB viewing history is separate from the old 'history' bookmark.
// Read it through the host API, preserving server order and native pagination.
export default function watchHistory(L){
 if(instances.has(L))return instances.get(L);
 const info=cardInfo(L),favorite=L.Favorite,get=favorite && favorite.get;
 const pages=new Map(),requests=new Map(),listeners=new Set();
 let scope='',cloud=null,busy=false,generation=0,revision=0,settled=false,waiters=[];
 let lastSuccess=0,failed=false;
 const notify=()=>listeners.forEach(listener=>listener());
 const enabled=()=>!L.Storage || ![false,'false',0,'0'].includes(L.Storage.get('lampa_view_enabled',true));
 function context(){
  const p=L.Account && L.Account.Permit,a=p && p.account;
  return p && p.sync && a && a.profile?String(a.email || L.Storage.get('account',{})?.email || L.Storage.get('account_email','')).trim().toLowerCase()+'|'+a.profile.id:'';
 }
 function ensure(){
  const next=context();
  if(scope!==next){
   const pending=waiters;
   scope=next;cloud=null;busy=false;settled=false;waiters=[];lastSuccess=0;failed=false;
   pages.clear();requests.clear();generation++;revision++;
   pending.forEach(done=>done());
  }
  return next;
 }
 function cardKey(card){
  const tv=card.media_type==='movie'?false:card.media_type==='tv' || card.name || card.original_name || card.first_air_date || card.number_of_seasons;
  const source=card.source || L.Storage.get('source','cub'),space=['cub','tmdb','trakt','minimal_search','minimal_continue'].includes(source)?'tmdb':source;
  return space+':'+(tv?'tv':'movie')+':'+card.id;
 }
 function normalize(records){
  const seen=new Set();
  (records || []).forEach(card=>info.remember(card));
  return (records || []).filter(card=>{
   const key=cardKey(card);
   if(seen.has(key))return false;seen.add(key);return true;
  }).map(card=>info.read({...card,source:card.source || L.Storage.get('source','cub')}));
 }
 const nativeHistory=()=>L.Account && L.Account.Api && L.Account.Api.watchHistory;
 function page(number,ok,fail,stale,fresh=false){
  if(!enabled() || !ensure() || !nativeHistory())return false;
  const saved=pages.get(number);
  if(!fresh && saved && Date.now()-saved.at<PAGE_TTL){ok(saved.result);return true;}
  const version=generation,requested=scope,pageRevision=revision;
  const existing=requests.get(number),waiter={ok,fail,stale};
  if(existing && existing.revision===pageRevision){existing.waiters.push(waiter);return true;}
  const request={revision:pageRevision,waiters:[waiter]};
  requests.set(number,request);
  let completed=false;
  const timer=setTimeout(()=>finish(null,{timeout:true}),5000);
  function finish(result,error){
   if(completed)return;
   completed=true;clearTimeout(timer);
   if(requests.get(number)===request)requests.delete(number);
   const expired=requested!==ensure() || version!==generation || number!==1 && pageRevision!==revision;
   if(!expired && result){
    result={...result,results:normalize(result.results || [])};
    pages.set(number,{result,at:Date.now()});
    if(pages.size>64)for(const key of pages.keys()){if(key!==1){pages.delete(key);break;}}
   }
   for(const entry of request.waiters){
    if(expired){if(entry.stale)entry.stale();}
    else if(result)entry.ok(result);
    else if(entry.fail)entry.fail(error);
   }
  }
  nativeHistory().call(L.Account.Api,{page:number,group:'card'},result=>finish(result),error=>finish(null,error));
  return true;
 }
 function finish(){settled=true;const callbacks=waiters;waiters=[];callbacks.forEach(callback=>callback());}
 function ready(callback){
  ensure();if(settled || !enabled() || !scope || !nativeHistory())return callback();
  let delivered=false;const done=()=>{if(delivered)return;delivered=true;clearTimeout(timer);callback();};
  const timer=setTimeout(done,5000);waiters.push(done);refresh();
 }
 function refresh(force=false){
  ensure();if(busy || !enabled() || !scope || !nativeHistory())return;
  busy=true;
  page(1,result=>{
   busy=false;
   const signature=value=>JSON.stringify([value?.total_pages,value?.total,(value?.results || []).map(card=>[cardKey(card),card.watch_history])]);
   const changed=signature(cloud)!==signature(result);
   if(changed || force){
    revision++;
    for(const key of pages.keys())if(key!==1)pages.delete(key);
   }
   cloud=result;lastSuccess=Date.now();failed=false;finish();
   if(changed)L.Listener?.send?.('state:changed',{target:'favorite',reason:'sync'});
   notify();
  },()=>{busy=false;failed=true;finish();notify();},null,true);
 }
 function filteredPage(number,size,include,ok,fail){
  const requested=ensure(),version=generation;
  if(!enabled() || !requested || !nativeHistory())return false;
  const cards=[],seen=new Set(),end=number*size;
  let finished=false,timer,pageRevision;
  const current=()=>requested===ensure() && version===generation && (pageRevision===undefined || pageRevision===revision);
  function finish(result,error){
   if(finished)return;
   finished=true;clearTimeout(timer);
   if(!current()){
    if(!filteredPage(number,size,include,ok,fail))fail({stale:true});
   }else if(result)ok(result);
   else fail(error);
  }
  function read(result,index){
   if(finished)return;
   if(!current())return finish();
   for(const card of result.results){
    const key=cardKey(card);
    if(include(card) && !seen.has(key)){seen.add(key);cards.push(card);}
   }
   // Filter before slicing. The extra match tells the native grid whether
   // it can load another page without exposing gaps in the server pages.
   if(cards.length>end || index>=(Number(result.total_pages)||1)){
    return finish({results:cards.slice(end-size,end),page:number,total_pages:Math.max(1,Math.ceil(cards.length/size))});
   }
   clearTimeout(timer);timer=setTimeout(()=>finish(null,{timeout:true}),5000);
   if(!page(index+1,next=>read(next,index+1),error=>finish(null,error),()=>finish()))finish(null,{offline:true});
  }
  if(settled && !cloud)settled=false;
  ready(()=>{
   if(!current())return finish();
   pageRevision=revision;
   if(cloud)read(cloud,1);
   else finish(null,{offline:true});
  });
  return true;
 }
 if(get)favorite.get=function(params){
  const records=get.apply(this,arguments);
  return enabled() && params && params.type==='history'?normalize(records):records;
 };
 L.Account?.listener?.follow?.('profile_select',()=>{ensure();notify();});
 const api={
  cards(){ensure();return cloud?cloud.results:favorite?.get?.({type:'history'}) || [];},
  entry(card){
   ensure();
   if(!cloud)return null;
   const key=cardKey(card);
   for(const {result} of pages.values()){
    const entry=result.results.find(row=>cardKey(row)===key);
    if(entry)return entry.watch_history || null;
   }
   return null;
  },
  status(){ensure();return {lastSuccess,failed,busy,cloud:!!scope && !!nativeHistory()};},
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  refresh,page,ready,filteredPage,profile:ensure
 };
 instances.set(L,api);return api;
}
