import {readCache,writeCache} from './transient-cache.js';
// Public first-page metadata only; no credentials, watch history or image blobs.
const KEY='minimal_catalogue_cache_v1',MAX_AGE=86400000,MAX_BYTES=384*1024;
const fields=['id','title','name','original_title','original_name','original_language','release_date','first_air_date','poster_path','backdrop_path','genre_ids','origin_country','vote_average','vote_count','popularity','overview','media_type','status','type'];
export default function catalogueCache(L){
 let entries=[],timer;
 try{const stored=L.Storage && readCache(L,KEY,[]);if(Array.isArray(stored))entries=stored.filter(entry=>entry && typeof entry.key==='string' && entry.at<=Date.now() && Date.now()-entry.at<MAX_AGE && entry.value && Array.isArray(entry.value.results)).slice(-16);}catch(error){}
 function put(key,value,at){
  if(!value.results.length)return;
  const results=value.results.slice(0,20).map(card=>{const out={};fields.forEach(field=>{if(card[field]!==undefined)out[field]=field==='overview'?String(card[field]).slice(0,1200):card[field];});return out;});
  entries=entries.filter(entry=>entry.key!==key && Date.now()-entry.at<MAX_AGE);entries.push({key,at,value:{page:1,total_pages:value.total_pages || 1,results}});
  while(entries.length>16 || JSON.stringify(entries).length*2>MAX_BYTES)entries.shift();
  if(!timer && L.Storage && L.Storage.set)timer=setTimeout(()=>{timer=null;try{writeCache(L,KEY,entries);}catch(error){}},200);
 }
 return {get:key=>entries.find(entry=>entry.key===key && Date.now()-entry.at<MAX_AGE),put};
}
