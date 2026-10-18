import shikimoriMatch from './shikimori-match.js';
const BASE='https://shikimori.io';
export const SHIKI_ALL='minimal:shikimori:all';
export function shikiCard(a,base=BASE){
 const tv=a.kind!=='movie',date=a.aired_on || '',img=a.image && a.image.original || '';
 const url=value=>value?(value.startsWith('http')?value:base+value):'';
 const posterSources={maximum:url(img),high:url(img),medium:url(a.image && a.image.preview || img)};
 return {id:a.id,shikimori_id:a.id,title:a.russian || a.name,original_title:a.name,...(tv?{name:a.russian || a.name,original_name:a.name,first_air_date:date}:{release_date:date}),media_type:tv?'tv':'movie',source:'minimal_shiki',img:url(img),minimalPosterSources:posterSources,vote_average:Number(a.score) || 0};
}
export default function shikimori(L){
 const cache=new Map(),pending=new Map(),queue=[];let timer=null,running=0,lastStart=0;
 const hosts=[BASE,'https://shikimori.one'];let preferred=0,unavailableUntil=0;
 function api(path,ok,fail,postData,valid=Array.isArray){
  if(!postData && Date.now()<unavailableUntil)return fail();let attempt=0;
  function send(){
   const index=preferred,request=new L.Reguest();request.timeout(7000);let settled=false;
   function error(){if(settled)return;settled=true;attempt++;preferred=(index+1)%hosts.length;if(attempt<hosts.length)send();else{if(!postData)unavailableUntil=Date.now()+30000;fail();}}
   request.silent(hosts[index]+path,json=>{if(settled)return;if(!valid(json))return error();settled=true;preferred=index;unavailableUntil=0;ok(json,hosts[index]);},error,postData);
  }
  send();
 }
 function deliver(json,ok){ok({...json,results:json.results.map(card=>({...card}))});}
 function pump(){
  if(timer!==null || !queue.length || running>=2)return;
  const wait=350-(Date.now()-lastStart);if(wait>0){timer=setTimeout(()=>{timer=null;pump();},wait);return;}
  const job=queue.shift();lastStart=Date.now();running++;let settled=false;
  function finish(json){if(settled)return;settled=true;running--;pending.delete(job.key);if(json){cache.set(job.key,{time:Date.now(),json});if(cache.size>40)cache.delete(cache.keys().next().value);}job.listeners.forEach(([ok,fail])=>json?deliver(json,ok):fail());pump();}
  api('/api/animes?limit=24&page='+job.page+'&'+job.query,(json,base)=>{
   finish({results:json.map(card=>shikiCard(card,base)),page:job.page,total_pages:json.length===24?job.page+1:job.page});
  },()=>finish(null));pump();
 }
 function list(params,ok,fail){
  // Keep All independently configurable but share unfiltered popularity pages.
  const query=params.url===SHIKI_ALL?'order=popularity':String(params.url || 'order=popularity').replace(/^\?/,''),page=Math.max(1,Number(params.page)||1),key=query+'|'+page,cached=cache.get(key);
  if(cached && Date.now()-cached.time<900000)return deliver(cached.json,ok);
  cache.delete(key);const listener=[ok,fail || (()=>{})];if(pending.has(key)){pending.get(key).listeners.push(listener);return;}
  const job={key,query,page,listeners:[listener]};pending.set(key,job);queue.push(job);pump();
 }
 const full=shikimoriMatch(L,(id,ok,fail)=>/^\d+$/.test(id)?api('/api/animes/'+id,ok,fail,null,json=>!!(json && Number(json.id)===Number(id))):fail());
 function retry(){unavailableUntil=0;preferred=0;}
 function genres(ok,fail){api('/api/genres',ok,fail);}
 function posters(ids,ok,fail){
  const clean=Array.from(new Set(ids.map(String).filter(id=>/^\d+$/.test(id)))).slice(0,12);if(!clean.length)return ok([]);
  const query='{ animes(ids: "'+clean.join(',')+'", limit: 12) { id poster { originalUrl mainUrl previewUrl } } }';
  api('/api/graphql',json=>ok(json.data.animes),fail,{query},json=>!!(json && json.data && Array.isArray(json.data.animes)));
 }
 L.Api.sources.minimal_shiki={list,full,genres,posters,retry,clear(){}};
 return {list,genres,posters,retry};
}
