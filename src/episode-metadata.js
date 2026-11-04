import {isAnime} from './metadata.js';
// Only partition a complete absolute provider list using confirmed catalogue counts.
export function absoluteSeasons(card,files){
 const numbers=[...new Set(files.map(Number))].sort((a,b)=>a-b),seasons=(Array.isArray(card && card.seasons)?card.seasons:[]).filter(s=>Number(s.season_number)>0).slice().sort((a,b)=>Number(a.season_number)-Number(b.season_number));
 if(!isAnime(card) || seasons.length<2 || seasons.length>100 || !numbers.length || numbers.length>3000 || !numbers.every((n,i)=>n===i+1) || seasons.some((s,i)=>!Number.isSafeInteger(Number(s.season_number)) || !Number.isSafeInteger(Number(s.episode_count)) || Number(s.episode_count)<=0 || i && Number(s.season_number)===Number(seasons[i-1].season_number)) || seasons.reduce((n,s)=>n+Number(s.episode_count),0)!==numbers.length)return null;
 let offset=0;return seasons.map(s=>{const count=Number(s.episode_count),episodes=numbers.slice(offset,offset+count);offset+=count;return {number:Number(s.season_number),name:String(s.name || ''),count,episodes,native:true};});
}
export function groupBook(book,group){
 if(!book || !group)return null;
 const rows=Object.values(book).sort((a,b)=>Number(a.episode_number)-Number(b.episode_number));
 if(rows.length!==group.count || !rows.every((e,i)=>Number(e.episode_number)===group.episodes[i]) && !rows.every((e,i)=>Number(e.episode_number)===i+1))return null;
 const result={};rows.forEach((e,i)=>result[group.episodes[i]]={...e,lampa_grouped:true});return result;
}
export function seasonName(card,number){
 const row=(Array.isArray(card && card.seasons)?card.seasons:[]).find(s=>Number(s.season_number)===Number(number)),name=String(row && row.name || '').trim();
 return /^(?:(?:season|сезон|сезонът|temporada|saison|sezon|série|עונה|季|第)\s*\d+|\d+\s*(?:season|сезон|temporada|saison|sezon|季))$/i.test(name)?'':name;
}
// Alternative episode groups change metadata coordinates, never playback hashes.
export function alternativeNumbering(card,numbers){
 const count=Number(card && card.number_of_seasons),rows=Array.from(new Set(numbers.map(Number))).sort((a,b)=>a-b);
 return count>0 && rows.length>count && rows.length<=30 && rows.every((n,i)=>n===i+1);
}
export function namedSeason(card,number){
 const row=(Array.isArray(card && card.seasons)?card.seasons:[]).find(s=>Number(s.season_number)===Number(number)),name=String(row && row.name || '').trim();
 return /(?:part|часть|частина|частка|parte|partie|teil|część|část|חלק|部分|部)\s*\d+/i.test(name)?name:'';
}
export function namedPartCount(card){
 const names=(Array.isArray(card && card.seasons)?card.seasons:[]).map(s=>namedSeason(card,s.season_number)).filter(Boolean),numbers=names.map(n=>Number((n.match(/\d+/)||[])[0])||0);
 return numbers.length?Math.max(...numbers):0;
}
export default function episodeMetadata(L,kino){
 const cache=new Map(),pending=new Map(),queue=[];let running=0;
 function request(path,done){
  if(cache.has(path))return done(cache.get(path));
  if(pending.has(path))return pending.get(path).push(done);
  if(queue.length>=24)return done(null);
  pending.set(path,[done]);queue.push({path,attempt:0});pump();
 }
 function pump(){
  while(running<2 && queue.length){
   const job=queue.shift(),path=job.path;running++;let finished=false;
   const finish=value=>{
    if(finished)return;finished=true;running--;
    const valid=value && (path.includes('/episode_groups?')?Array.isArray(value.results):path.includes('/episode_group/')?Array.isArray(value.groups):Array.isArray(value.episodes) || Array.isArray(value.seasons));
    // Keep concurrent readers coalesced during one bounded retry. A transport
    // failure or malformed response must never become a permanent cache entry.
    if(!valid && job.attempt===0){setTimeout(()=>{queue.push({path,attempt:1});pump();},400);pump();return;}
    if(valid){cache.set(path,value);if(cache.size>32)cache.delete(cache.keys().next().value);}
    const callbacks=pending.get(path)||[];pending.delete(path);callbacks.forEach(fn=>fn(valid?value:null));pump();
   };
   const api=L.Api && L.Api.sources && L.Api.sources.tmdb;
   if(!api || !api.get){finish(null);continue;}
   try{api.get(path,{},finish,()=>finish(null));}catch(error){finish(null);}
  }
 }
 function legacyBook(card,number,numbers,actual,done){
  if(!alternativeNumbering(card,numbers))return false;
  const id=Number(card.tmdb_id || card.id),language=String(L.Storage.get('language','ru')),suffix='?language='+encodeURIComponent(language),networks=(card.networks || []).map(n=>Number(n.id));
  request('tv/'+id+'/episode_groups'+suffix,index=>{
   let candidates=((index && index.results)||[]).filter(g=>Number(g.group_count)===numbers.length && Number(g.episode_count)>0 && (!Number(card.number_of_episodes) || Number(g.episode_count)===Number(card.number_of_episodes)));
   const network=candidates.filter(g=>g.network && (!networks.length || networks.includes(Number(g.network.id))));
   if(network.length)candidates=network;
   if(candidates.length!==1)return done(null,true);
   request('tv/episode_group/'+encodeURIComponent(candidates[0].id)+suffix,data=>{
    const groups=(data && Array.isArray(data.groups)?data.groups:[]).slice().sort((a,b)=>Number(a.order)-Number(b.order)),start=groups.length?Number(groups[0].order):0,group=groups[Number(number)-1],episodes=group && group.episodes;
    if(groups.length!==numbers.length || ![0,1].includes(start) || groups.some((g,i)=>Number(g.order)!==start+i) || !Array.isArray(episodes) || !episodes.length || actual>0 && episodes.length!==actual)return done(null,true);
    const seen=new Set(),rows=episodes.slice().sort((a,b)=>Number(a.order)-Number(b.order));
    if(rows.some((e,i)=>Number(e.order)!==i || !(Number(e.season_number)>0 && Number(e.episode_number)>0) || seen.has(e.season_number+':'+e.episode_number) || !seen.add(e.season_number+':'+e.episode_number)))return done(null,true);
    const seasons=Array.from(new Set(rows.map(e=>Number(e.season_number))));let left=seasons.length;const books={};
    seasons.forEach(season=>request('tv/'+id+'/season/'+season+suffix,value=>{books[season]=value;if(--left)return;
     const book={};rows.forEach((e,i)=>{const episode=((books[e.season_number] && (books[e.season_number].episodes_original || books[e.season_number].episodes))||[]).find(v=>Number(v.episode_number)===Number(e.episode_number));if(episode)book[i+1]={...episode,lampa_grouped:true};});
     done(Object.keys(book).length===rows.length?book:null,true);
    }));
   });
  });return true;
 };
 function groups(card,files,done){
  if(!isAnime(card))return done(null);
  function fallback(){
   const ready=absoluteSeasons(card,files);if(ready)return done(ready);
   const id=Number(card && (card.tmdb_id || card.id));if(!Number.isSafeInteger(id) || id<=0 || card.source==='minimal_shiki' && !card.tmdb_id || files.length<2)return done(null);
   request('tv/'+id+'?language='+encodeURIComponent(L.Storage.get('language','ru')),data=>done(data?absoluteSeasons({...card,seasons:data.seasons},files):null));
  }
  if(kino && kino.enabled())kino.groups(card,files,value=>value?done(value):fallback());else fallback();
 }
 return {alternate:alternativeNumbering,groups,groupBook,seasonName,book(card,number,numbers,actual,done,files=[]){
  if(kino && kino.enabled() && files.length){kino.book(card,number,numbers,files,book=>{if(book)return done(book,true);if(!legacyBook(card,number,numbers,actual,done))done(null,false);});return true;}
  return legacyBook(card,number,numbers,actual,done);
 }};
}
