import {locale} from './i18n.js';
import shikimoriMatch from './shikimori-match.js';
import shikiSeason from './shiki-season.js';
const BASE='https://shikimori.io';
export const SHIKI_ALL='minimal:shikimori:all';
export function shikiCard(a,base=BASE){
 const title=locale()==='ru'?(a.russian || a.name):(a.name || a.russian);
 const tv=a.kind!=='movie',date=a.aired_on || '',img=a.image && a.image.original || '';
 const url=value=>value?(value.startsWith('http')?value:base+value):'';
 const posterSources={high:url(img),medium:url(img || a.image && a.image.preview)};
 return {id:a.id,shikimori_id:a.id,episodes:Number(a.episodes)||0,episodes_aired:Number(a.episodes_aired)||0,status:a.status || '',title,original_title:a.name,...(tv?{name:title,original_name:a.name,first_air_date:date}:{release_date:date}),media_type:tv?'tv':'movie',source:'minimal_shiki',img:url(img),minimalPosterSources:posterSources,vote_average:Number(a.score) || 0};
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
 function deliver(json,ok,params){
  ok({...json,results:json.results.map(card=>({...card}))});
  // Native Full.Next keeps the initial total_pages and ignores later responses.
  // Advance its boundary after every real page; stop at the first short page.
  const active=L.Activity && L.Activity.active && L.Activity.active(),grid=active && active.component==='category_full' && active.source==='minimal_shiki' && active.activity && active.activity.component;
  if(params && grid && grid.object && String(grid.object.url || '')===String(params.url || '') && Number(grid.object.page)===json.page)grid.total_pages=json.total_pages;
 }
 function pump(){
  if(timer!==null || !queue.length || running>=2)return;
  const wait=350-(Date.now()-lastStart);if(wait>0){timer=setTimeout(()=>{timer=null;pump();},wait);return;}
  const job=queue.shift();lastStart=Date.now();running++;let settled=false;
  function finish(json){if(settled)return;settled=true;running--;pending.delete(job.key);if(json){cache.set(job.key,{time:Date.now(),json});if(cache.size>40)cache.delete(cache.keys().next().value);}job.listeners.forEach(([ok,fail,params])=>json?deliver(json,ok,params):fail());pump();}
  api('/api/animes?limit=24&page='+job.page+'&'+job.query,(json,base)=>{
   finish({results:json.map(card=>shikiCard(card,base)),page:job.page,total_pages:json.length===24?job.page+1:job.page});
  },()=>finish(null));pump();
 }
 function list(params,ok,fail){
  // Keep All independently configurable but share unfiltered popularity pages.
  const query=params.url===SHIKI_ALL?'order=popularity':String(params.url || 'order=popularity').replace(/^\?/,''),page=Math.max(1,Number(params.page)||1),key=locale()+'|'+query+'|'+page,cached=cache.get(key);
  if(cached && Date.now()-cached.time<900000)return deliver(cached.json,ok,params);
  cache.delete(key);const listener=[ok,fail || (()=>{}),params];if(pending.has(key)){pending.get(key).listeners.push(listener);return;}
  const job={key,query,page,params,listeners:[listener]};pending.set(key,job);queue.push(job);pump();
 }
 const full=shikimoriMatch(L,(id,ok,fail)=>/^\d+$/.test(id)?api('/api/animes/'+id,ok,fail,null,json=>!!(json && Number(json.id)===Number(id))):fail());
 function retry(){unavailableUntil=0;preferred=0;}
 function genres(ok,fail){api('/api/genres',ok,fail);}
 function posters(ids,ok,fail){
  const clean=Array.from(new Set(ids.map(String).filter(id=>/^\d+$/.test(id)))).slice(0,12);if(!clean.length)return ok([]);
  const query='{ animes(ids: "'+clean.join(',')+'", limit: 12) { id poster { originalUrl mainUrl previewUrl } } }';
  api('/api/graphql',json=>ok(json.data.animes),fail,{query},json=>!!(json && json.data && Array.isArray(json.data.animes)));
 }
 const metadataCache=new Map(),metadataPending=new Map();
 const metadata=(id,ok,fail=()=>{})=>{
  id=String(id);if(!/^\d+$/.test(id))return fail();const hit=metadataCache.get(id);
  if(hit && Date.now()-hit.at<900000)return ok({...hit.json});
  if(metadataPending.has(id)){metadataPending.get(id).push([ok,fail]);return;}
  metadataPending.set(id,[[ok,fail]]);
  const finish=json=>{const listeners=metadataPending.get(id) || [];metadataPending.delete(id);if(json){metadataCache.set(id,{at:Date.now(),json});if(metadataCache.size>80)metadataCache.delete(metadataCache.keys().next().value);}for(const [success,error] of listeners)if(json)success({...json});else error();};
  api('/api/animes/'+id,finish,()=>finish(null),null,json=>!!(json && Number(json.id)===Number(id)));
 };
 const relationQueue=[];let relationBusy=false,relationLast=0;
 function relationPump(){
  if(relationBusy || !relationQueue.length)return;relationBusy=true;
  setTimeout(()=>{const [id,ok,fail]=relationQueue.shift();relationLast=Date.now();const done=(callback,value)=>{relationBusy=false;callback(value);relationPump();};api('/api/animes/'+id+'/related',rows=>done(ok,rows),()=>done(fail));},Math.max(0,350-(Date.now()-relationLast)));
 }
 const resolveSeason=shikiSeason((id,ok,fail)=>{if(relationQueue.length>=16)return fail();relationQueue.push([id,ok,fail]);relationPump();});
 const release=(id,ok,fail)=>metadata(id,json=>resolveSeason(json,season=>ok({...json,minimal_release_season:season})),fail);
 const franchiseCache=new Map(),franchisePending=new Map(),franchiseQueue=[];let franchiseBusy=false,franchiseLast=0,franchiseRevision=0;
 function franchisePump(){
  if(franchiseBusy || !franchiseQueue.length)return;franchiseBusy=true;const job=franchiseQueue.shift();
  setTimeout(()=>{if(job.revision!==franchiseRevision)return;franchiseLast=Date.now();const finish=value=>{if(job.revision!==franchiseRevision)return;franchiseBusy=false;job.done(value);franchisePump();};api(job.path,finish,()=>finish(null),null,job.valid);},Math.max(0,350-(Date.now()-franchiseLast)));
 }
 function franchiseRequest(path,valid,done){if(franchiseQueue.length>=16)return done(null);franchiseQueue.push({path,valid,done,revision:franchiseRevision});franchisePump();}
 function franchise(id,ok,fail=()=>{}){
  id=String(id);if(!/^[1-9]\d{0,8}$/.test(id))return fail();const hit=franchiseCache.get(id);if(hit && Date.now()-hit.at<900000)return ok(hit.value);
  if(franchisePending.has(id)){franchisePending.get(id).push([ok,fail]);return;}franchisePending.set(id,[[ok,fail]]);const revision=franchiseRevision;
  const finish=value=>{if(revision!==franchiseRevision)return;const callbacks=franchisePending.get(id)||[];franchisePending.delete(id);if(value){franchiseCache.set(id,{at:Date.now(),value});while(franchiseCache.size>24)franchiseCache.delete(franchiseCache.keys().next().value);}callbacks.forEach(([success,error])=>value?success(value):error());};
  franchiseRequest('/api/animes/'+id+'/franchise',json=>!!(json && Number(json.current_id)===Number(id) && Array.isArray(json.nodes) && Array.isArray(json.links) && json.nodes.length<=240),graph=>{
   if(!graph)return finish(null);const ids=[...new Set(graph.nodes.map(n=>Number(n.id)).filter(n=>Number.isSafeInteger(n) && n>0))],metadata=[];let cursor=0;
   function next(){if(revision!==franchiseRevision)return;if(cursor>=ids.length)return finish({graph,metadata});const batch=ids.slice(cursor,cursor+50);cursor+=batch.length;
    franchiseRequest('/api/animes?ids='+batch.join(',')+'&limit=50',Array.isArray,rows=>{if(!rows)return finish(null);metadata.push(...rows.filter(n=>batch.includes(Number(n.id))));next();});
   }next();
  });
 }
 function clear(){franchiseRevision++;franchiseBusy=false;franchiseLast=0;franchiseCache.clear();franchiseQueue.splice(0);const waiters=[...franchisePending.values()];franchisePending.clear();waiters.forEach(rows=>rows.forEach(([,fail])=>fail()));}
 L.Api.sources.minimal_shiki={list,full,genres,posters,metadata,release,franchise,retry,clear};
 return {list,genres,posters,metadata,franchise,retry,clear};
}
