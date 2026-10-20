import tmdbGet from './tmdb.js';
import {isAnime} from './metadata.js';
import cacheControl from './cache-control.js';
const instances=new WeakMap();
export function releaseYear(c){const value=c.first_air_date || c.release_date || c.aired_on || c.year || '';const match=/^(\d{4})(?:-\d{2}-\d{2})?$/.exec(String(value));return match && Number(match[1])>=1870 && Number(match[1])<=new Date().getFullYear()+20?match[1]:'';}

// Saved native cards omit genres and custom flags. Retain only catalogue
// metadata, independently of favorites/history and their synchronization.
export default function cardInfo(L){
 if(instances.has(L))return instances.get(L);
 const storage='minimal_card_info_v1',cache=new Map(),pending=new Map(),queue=[];
 let running=0,timer,ratingGeneration=0;
 const kind=c=>c.media_type==='movie'?'movie':c.media_type==='tv' || c.name || c.original_name || c.first_air_date?'tv':'movie';
 const source=c=>c.source==='minimal_shiki'?'minimal_shiki':['tmdb','cub','minimal_search',undefined,''].includes(c.source)?'tmdb':'';
 const key=c=>source(c) && /^\d+$/.test(String(c.id))?source(c)+':'+kind(c)+':'+c.id:'';
 const array=value=>Array.isArray(value)?value:value?[value]:[];
 const names=c=>[c.title,c.name,c.original_title,c.original_name,...array(c.english),...array(c.synonyms),...((c.alternative_titles || {}).results || (c.alternative_titles || {}).titles || []).filter(t=>!t.iso_3166_1 || ['RU','US','GB','JP'].includes(t.iso_3166_1)).map(t=>t.title)].filter(n=>typeof n==='string' && n.trim()).map(n=>n.trim()).slice(0,16);
 const fresh=e=>e && Date.now()-e.time<7*86400000;
 const save=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(L.Storage && L.Storage.set)L.Storage.set(storage,Array.from(cache.entries()).slice(-400));},250);};
 if(L.Storage){const saved=L.Storage.get(storage,[]);if(Array.isArray(saved))saved.slice(-400).forEach(pair=>{if(Array.isArray(pair) && typeof pair[0]==='string' && fresh(pair[1]))cache.set(pair[0],pair[1]);});}
 function remember(c,complete=false,ratings=true){
  const id=key(c);if(!id)return;
  const old=cache.get(id),entry={...(fresh(old)?old:{}),time:Date.now()};
  const genres=Array.from(new Set([...(c.genre_ids || []),...(c.genres || [])].map(g=>Number(g.id || g)).filter(Number.isFinite)));
  if(genres.length)entry.genre_ids=genres;
  if(c.original_language)entry.original_language=c.original_language;
  if(c.origin_country && c.origin_country.length)entry.origin_country=c.origin_country;
  if(releaseYear(c)){const date=String(c.first_air_date || c.release_date || c.aired_on || c.year);entry[kind(c)==='tv'?'first_air_date':'release_date']=date;}
  const vote=Number(c.vote_average || (source(c)==='minimal_shiki' && c.score));
  if(ratings && Number.isFinite(vote) && vote>0 && vote<=10)entry.vote_average=vote;
  if(isAnime(c))entry.minimal_anime=true;
  entry.names=Array.from(new Set([...(entry.names || []),...names(c)])).slice(0,16);
  if(complete){entry.complete=true;delete entry.failed;}
  cache.delete(id);cache.set(id,entry);if(cache.size>400)cache.delete(cache.keys().next().value);save();
 }
 function read(c){
  const entry=cache.get(key(c));if(!fresh(entry))return c;
  return {...c,...(!releaseYear(c)?{...(entry.release_date?{release_date:entry.release_date}:{}),...(entry.first_air_date?{first_air_date:entry.first_air_date}:{})}:{}),...(!c.genre_ids || !c.genre_ids.length?{genre_ids:entry.genre_ids}:{}),...(!c.original_language?{original_language:entry.original_language}:{}),...(!c.origin_country || !c.origin_country.length?{origin_country:entry.origin_country}:{}),...(!(Number(c.vote_average)>0) && entry.vote_average?{vote_average:entry.vote_average}:{}),...(entry.minimal_anime?{minimal_anime:true}:{})};
 }
 const paused=()=>document.body.matches('.pt-wheel-active,.pt-tv-busy') || document.hidden;
 function pump(){
  while(!paused() && running<2 && queue.length){
   const job=queue.shift();if(!job.listeners.some(l=>!l.alive || l.alive())){pending.delete(job.id);continue;}
   running++;let settled=false;
   const done=result=>{
    if(settled)return;settled=true;running--;pending.delete(job.id);
    const json=result && String(result.id)===String(job.card.shikimori_id || job.card.id)?result:null;
    if(json){remember({...job.card,...json,...(source(job.card)==='minimal_shiki'?{minimal_anime:true}:{})},true,job.ratingGeneration===ratingGeneration);}
    else {const entry=cache.get(job.id) || {time:Date.now()};entry.failed=Date.now();cache.set(job.id,entry);}
    job.listeners.forEach(l=>{if(!l.alive || l.alive())l.ok(json?read(job.card):null);});pump();
   };
   const shiki=L.Api && L.Api.sources && L.Api.sources.minimal_shiki;
   if(source(job.card)==='minimal_shiki'){
    if(shiki && shiki.metadata)shiki.metadata(job.card.shikimori_id || job.card.id,done,()=>done(null));else done(null);
   }else tmdbGet(L,kind(job.card)+'/'+job.card.id+'?append_to_response=alternative_titles',{},done,()=>done(null),{life:7*86400000});
  }
 }
 function fetch(c,ok,alive){
  const id=key(c),entry=cache.get(id);if(!id || entry && entry.failed && Date.now()-entry.failed<120000)return ok(null);
  if(fresh(entry) && entry.complete && releaseYear(read(c)))return ok(read(c));
  if(pending.has(id)){pending.get(id).listeners.push({ok,alive});return;}
  if(queue.length>=40)return ok(null);
  const job={id,card:c,listeners:[{ok,alive}],ratingGeneration};pending.set(id,job);queue.push(job);pump();
 }
 function incomplete(c){const data=read(c),entry=cache.get(key(c));if(!releaseYear(data))return true;if(fresh(entry) && entry.complete)return false;const genres=data.genre_ids || data.genres || [];return !isAnime(data) && (!genres.length || genres.some(g=>Number(g.id || g)===16) && !data.original_language && !(data.origin_country || []).length);}
 // Normalize fields before native clearCard drops full-detail genres/keywords.
 if(L.Utils && L.Utils.clearCard){const clear=L.Utils.clearCard;L.Utils.clearCard=function(c){remember(c);const data=read(c),out=clear.call(this,data);if(data.genres && (!out.genre_ids || !out.genre_ids.length))out.genre_ids=data.genres.map(g=>g.id || g);return out;};}
 if(typeof document!=='undefined')['minimal:wheel-idle','minimal:tv-idle','visibilitychange'].forEach(event=>document.addEventListener(event,pump));
 cacheControl(L).register('ratings',()=>{ratingGeneration++;cache.forEach(entry=>{delete entry.vote_average;});clearTimeout(timer);if(L.Storage && L.Storage.set)L.Storage.set(storage,Array.from(cache.entries()));});
 const api={remember,read,incomplete,fetch,names(c){const entry=cache.get(key(c));return Array.from(new Set([...names(c),...(fresh(entry)?entry.names || []:[])]));}};instances.set(L,api);return api;
}
