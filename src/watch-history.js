import cardInfo from './card-info.js';
const instances=new WeakMap();

// Current CUB viewing history is separate from the old 'history' bookmark.
// Read it through the host API, preserving server order and native pagination.
export default function watchHistory(L){
 if(instances.has(L))return instances.get(L);
 const info=cardInfo(L),favorite=L.Favorite,get=favorite && favorite.get;
 let scope='',cloud=null,busy=false,generation=0,settled=false,waiters=[];
 const enabled=()=>!L.Storage || ![false,'false',0,'0'].includes(L.Storage.get('lampa_view_enabled',true));
 function context(){
  const p=L.Account && L.Account.Permit,a=p && p.account;
  return p && p.sync && a && a.profile?String(a.email || L.Storage.get('account_email',''))+'|'+a.profile.id:'';
 }
 function ensure(){const next=context();if(scope!==next){scope=next;cloud=null;busy=false;settled=false;waiters=[];generation++;}return next;}
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
 function page(number,ok,fail,stale){
  if(!enabled() || !ensure() || !nativeHistory())return false;
  const version=generation,requested=scope;
  nativeHistory().call(L.Account.Api,{page:number,group:'card'},result=>{
   if(requested!==context() || version!==generation){if(stale)stale();return;}
   ok({...result,results:normalize(result.results || [])});
  },error=>{if(requested!==context() || version!==generation){if(stale)stale();}else if(fail)fail(error);});
  return true;
 }
 function finish(){settled=true;const callbacks=waiters;waiters=[];callbacks.forEach(callback=>callback());}
 function ready(callback){
  ensure();if(settled || !enabled() || !scope || !nativeHistory())return callback();
  let delivered=false;const done=()=>{if(delivered)return;delivered=true;clearTimeout(timer);callback();};
  const timer=setTimeout(done,5000);waiters.push(done);refresh();
 }
 function refresh(){
  ensure();if(busy || !enabled() || !scope || !nativeHistory())return;
  busy=true;
  page(1,result=>{
   busy=false;
   const signature=cards=>JSON.stringify((cards || []).map(card=>[card.id,card.media_type || (card.name?'tv':'movie'),card.watch_history && card.watch_history.watched_at]));
   const changed=signature(cloud && cloud.results)!==signature(result.results);cloud=result;finish();
   if(changed && L.Listener && L.Listener.send)L.Listener.send('state:changed',{target:'favorite',reason:'sync'});
  },()=>{busy=false;finish();});
 }
 function filteredPage(number,size,include,ok,fail){
  const requested=ensure(),version=generation;
  if(!enabled() || !requested || !nativeHistory())return false;
  const cards=[],seen=new Set(),end=number*size;
  let finished=false,timer;
  const current=()=>requested===context() && version===generation;
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
   if(cloud)read(cloud,1);
   else finish(null,{offline:true});
  });
  return true;
 }
 if(get)favorite.get=function(params){
  const records=get.apply(this,arguments);
  return enabled() && params && params.type==='history'?normalize(records):records;
 };
 const api={cards(){ensure();return cloud?cloud.results:favorite && favorite.get?favorite.get({type:'history'}) || []:[];},refresh,page,ready,filteredPage,profile:ensure};
 instances.set(L,api);return api;
}
