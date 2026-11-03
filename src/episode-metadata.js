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
export default function episodeMetadata(L){
 const cache=new Map(),pending=new Map(),queue=[];let running=0;
 function request(path,done){
  if(cache.has(path))return done(cache.get(path));
  if(pending.has(path))return pending.get(path).push(done);
  if(queue.length>=24)return done(null);
  pending.set(path,[done]);queue.push(path);pump();
 }
 function pump(){
  while(running<2 && queue.length){
   const path=queue.shift();running++;let finished=false;
   const finish=value=>{if(finished)return;finished=true;running--;cache.set(path,value);if(cache.size>32)cache.delete(cache.keys().next().value);const callbacks=pending.get(path)||[];pending.delete(path);callbacks.forEach(fn=>fn(value));pump();};
   const api=L.Api && L.Api.sources && L.Api.sources.tmdb;
   if(!api || !api.get){finish(null);continue;}
   try{api.get(path,{},finish,()=>finish(null));}catch(error){finish(null);}
  }
 }
 return {alternate:alternativeNumbering,book(card,number,numbers,actual,done){
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
     const book={};rows.forEach((e,i)=>{const episode=((books[e.season_number] && books[e.season_number].episodes)||[]).find(v=>Number(v.episode_number)===Number(e.episode_number));if(episode)book[i+1]={...episode,lampa_grouped:true};});
     done(Object.keys(book).length===rows.length?book:null,true);
    }));
   });
  });return true;
 }};
}
