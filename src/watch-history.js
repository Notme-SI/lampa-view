import cardInfo from './card-info.js';
const instances=new WeakMap();

// Home and the History screen read the same native, profile-scoped CUB list.
// Watched/discarded flags do not remove a title from its viewing history.
export default function watchHistory(L){
 if(instances.has(L))return instances.get(L);
 const info=cardInfo(L),favorite=L.Favorite,get=favorite && favorite.get;
 const enabled=()=>!L.Storage || ![false,'false',0,'0'].includes(L.Storage.get('lampa_view_enabled',true));
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
 if(get)favorite.get=function(params){
  const records=get.apply(this,arguments);
  return enabled() && params && params.type==='history'?normalize(records):records;
 };
 const api={cards:()=>favorite && favorite.get?favorite.get({type:'history'}) || []:[]};
 instances.set(L,api);return api;
}
