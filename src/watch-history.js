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
 function normalize(records){
  const seen=new Set();
  (records || []).forEach(card=>info.remember(card));
  return (records || []).filter(card=>{
   const tv=card.media_type==='movie'?false:card.media_type==='tv' || card.name || card.original_name || card.first_air_date || card.number_of_seasons;
   const source=card.source || L.Storage.get('source','cub'),space=['cub','tmdb','trakt','minimal_search','minimal_continue'].includes(source)?'tmdb':source;
   const key=space+':'+(tv?'tv':'movie')+':'+card.id;
   if(seen.has(key))return false;seen.add(key);return true;
  }).map(card=>info.read({...card,source:card.source || L.Storage.get('source','cub')}));
 }
 const nativeHistory=()=>L.Account && L.Account.Api && L.Account.Api.watchHistory;
 function page(number,ok,fail){
  if(!enabled() || !ensure() || !nativeHistory())return false;
  const version=generation,requested=scope;
  nativeHistory().call(L.Account.Api,{page:number,group:'card'},result=>{
   if(requested!==context() || version!==generation)return;
   ok({...result,results:normalize(result.results || [])});
  },error=>{if(requested===context() && version===generation && fail)fail(error);});
  return true;
 }
 function finish(){settled=true;const callbacks=waiters;waiters=[];callbacks.forEach(callback=>callback());}
 function ready(callback){
  ensure();if(settled || !enabled() || !scope || !nativeHistory())return callback();
  waiters.push(callback);refresh();
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
 if(get)favorite.get=function(params){
  const records=get.apply(this,arguments);
  return enabled() && params && params.type==='history'?normalize(records):records;
 };
 const api={cards(){ensure();return cloud?cloud.results:favorite && favorite.get?favorite.get({type:'history'}) || []:[];},refresh,page,ready};
 instances.set(L,api);return api;
}
