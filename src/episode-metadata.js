import {isAnime} from './metadata.js';
function plannedSeason(card,season,today){
 const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
 if(valid(season.air_date))return season.air_date>today;
 const last=card.last_episode_to_air,aired=last && valid(last.air_date) && last.air_date<=today?Number(last.season_number):0;
 if(aired && Number(season.season_number)<=aired)return false;
 return aired && Number(season.season_number)>aired || (card.minimal_unreleased_seasons || []).includes(Number(season.season_number));
}
export function publishedSeasonCount(card,today=new Date().toISOString().slice(0,10)){
 const seasons=(card.seasons || []).filter(s=>Number(s.season_number)>0);
 if(!seasons.length)return Number(card.number_of_seasons)||0;
 return seasons.some(s=>plannedSeason(card,s,today))?seasons.filter(s=>!plannedSeason(card,s,today)).length:Number(card.number_of_seasons)||seasons.length;
}
export function publishedEpisodeCount(card,today=new Date().toISOString().slice(0,10)){
 const seasons=(card.seasons || []).filter(s=>Number(s.season_number)>0),count=publishedSeasonCount(card,today);
 if(!count || count>=seasons.length)return Number(card.number_of_episodes)||0;
 const rows=seasons.filter(s=>!plannedSeason(card,s,today));
 return rows.length===count && rows.every(s=>Number(s.episode_count)>0)?rows.reduce((n,s)=>n+Number(s.episode_count),0):Number(card.number_of_episodes)||0;
}
// Only partition a complete absolute provider list using confirmed catalogue counts.
export function absoluteSeasons(card,files){
 const numbers=[...new Set(files.map(Number))].sort((a,b)=>a-b),seasons=(Array.isArray(card && card.seasons)?card.seasons:[]).filter(s=>Number(s.season_number)>0).slice().sort((a,b)=>Number(a.season_number)-Number(b.season_number));
 if(!isAnime(card) || seasons.length<2 || seasons.length>100 || !numbers.length || numbers.length>3000 || !numbers.every((n,i)=>n===i+1) || seasons.some((s,i)=>!Number.isSafeInteger(Number(s.season_number)) || !Number.isSafeInteger(Number(s.episode_count)) || Number(s.episode_count)<=0 || i && Number(s.season_number)===Number(seasons[i-1].season_number)) || seasons.reduce((n,s)=>n+Number(s.episode_count),0)!==numbers.length)return null;
 let offset=0;return seasons.map(s=>{const count=Number(s.episode_count),episodes=numbers.slice(offset,offset+count);offset+=count;return {number:Number(s.season_number),name:String(s.name || ''),count,episodes,native:true};});
}
export function groupBook(book,group){
 if(!book || !group)return null;
 if(group.coordinates){const keys=Object.keys(book).map(Number).sort((a,b)=>a-b),offset=group.coordinates[0].number-group.coordinates[0].episode,count=group.canonical_count,local=keys.length===count && keys.every((n,i)=>n===i+1),absolute=keys.length===count && keys.every((n,i)=>n===offset+i+1);if(!local && !absolute)return null;const result={};for(const row of group.coordinates){const episode=book[local?row.episode:row.number];if(!episode)return null;result[row.number]={...episode,lampa_grouped:true};}return result;}
 const rows=Object.values(book).sort((a,b)=>Number(a.episode_number)-Number(b.episode_number));
 if(rows.length!==group.count || !rows.every((e,i)=>Number(e.episode_number)===group.episodes[i]) && !rows.every((e,i)=>Number(e.episode_number)===i+1))return null;
 const result={};rows.forEach((e,i)=>result[group.episodes[i]]={...e,lampa_grouped:true});return result;
}
// Some dubs expose only an absolute tail or have gaps. Require numbers beyond
// the first canonical season, so an ordinary local 1..N list is not reassigned.
export function absoluteRangeSeasons(card,files){
 const seasons=(Array.isArray(card && card.seasons)?card.seasons:[]).filter(s=>Number(s.season_number)>0).slice().sort((a,b)=>a.season_number-b.season_number),numbers=files.map(Number).sort((a,b)=>a-b),total=seasons.reduce((n,s)=>n+Number(s.episode_count||0),0);
 if(!isAnime(card) || seasons.length<2 || seasons.length>100 || numbers.length<2 || numbers.length>3000 || !seasons.every((s,i)=>Number(s.season_number)===i+1 && Number.isSafeInteger(Number(s.episode_count)) && s.episode_count>0) || numbers[numbers.length-1]<=Number(seasons[0].episode_count) || !numbers.every((n,i)=>Number.isSafeInteger(n) && n>0 && n<=total && (!i || n>numbers[i-1])))return null;
 let offset=0;const groups=[];for(const s of seasons){const selected=numbers.filter(n=>n>offset && n<=offset+Number(s.episode_count)),coordinates=selected.map(number=>({number,episode:number-offset}));offset+=Number(s.episode_count);if(selected.length)groups.push({number:Number(s.season_number),name:String(s.name || ''),count:selected.length,episodes:selected,coordinates,canonical_count:Number(s.episode_count),native:true});}return groups.length?groups:null;
}
export function seasonName(card,number,series=card){
 const row=(Array.isArray(card && card.seasons)?card.seasons:[]).find(s=>Number(s.season_number)===Number(number));let name=String(row && row.name || '').trim();
 // Series titles are sometimes reused as the first season's name.
 const clean=value=>String(value || '').normalize('NFKC').toLowerCase().replace(/[\s.,:;!?'’"«»()[\]…—–_-]+/g,'');
 const title=name.replace(/(?:season|сезон)\s*\d+|\d+\s*(?:season|сезон)/gi,'');
 const aliases=[series.name,series.title,series.original_name,series.original_title,...(series.lampa_series_names || [])].map(clean).filter(Boolean);
 const split=name.match(/^(.+?)\s*:\s*(.+)$/);if(split && aliases.includes(clean(split[1])))name=split[2].trim();
 const unnumbered=name.replace(/(?:[\s:._–—-]+|\s*\()(?:s(?:eason)?\s*|сезон\s*|part\s*|часть\s*|cour\s*)?\d+(?:st|nd|rd|th)?(?:\s*(?:season|сезон|part|часть|cour))?\)?$/i,'');
 if([name,title,unnumbered].some(value=>aliases.includes(clean(value))))return '';
 if(/^(?:part|часть|частина|частка|parte|partie|teil|część|část|חלק|部分|部)\s*\d+$/i.test(name))return '';
 return /^(?:(?:season|сезон|сезонът|temporada|saison|sezon|série|עונה|季|第)\s*\d+|\d+\s*(?:season|сезон|temporada|saison|sezon|季))$/i.test(name)?'':name.replace(/^(?:season|сезон)\s*\d+\s*[:–—.-]\s*/i,'');
}
// Keep a published schedule separate from a provider's available video files.
export function availableMetadata(rows,files,season,allowFuture=true){
 const actual=new Set(files.map(Number)),now=Date.now();
 return rows.filter(row=>actual.has(Number(row.episode_number)) || allowFuture && Number(row.season_number)===Number(season) && typeof row.air_date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(row.air_date) && Date.parse(row.air_date+'T00:00:00Z')>now);
}
// Alternative episode groups change metadata coordinates, never playback hashes.
export function alternativeNumbering(card,numbers){
 const count=Number(card && card.number_of_seasons),rows=Array.from(new Set(numbers.map(Number))).filter(n=>n!==0).sort((a,b)=>a-b);
 return count>0 && rows.length>0 && rows.length<=30 && ((rows.length>count || isAnime(card) && rows.length<count) && rows.every((n,i)=>n===i+1) || isAnime(card) && rows.length===1 && rows[0]>1);
}
// Validate the complete published coordinate map before using any of its groups.
// Equal episode counts by themselves are never evidence of a season mapping.
export function episodeGroupModel(card,data,groupCount,episodeCount){
 if(!Number.isSafeInteger(groupCount) || groupCount<1 || groupCount>30 || !Number.isSafeInteger(episodeCount) || episodeCount<1 || episodeCount>3000)return null;
 const groups=(data && Array.isArray(data.groups)?data.groups:[]).slice().sort((a,b)=>Number(a.order)-Number(b.order)),start=groups.length?Number(groups[0].order):-1;
 if(groups.length!==groupCount || ![0,1].includes(start))return null;
 const known=new Map(),seen=new Set(),result=[];
 for(const s of card.seasons || []){
  const number=Number(s.season_number),count=Number(s.episode_count || 0);if(number===0)continue;
  if(!Number.isSafeInteger(number) || number<1 || known.has(number) || !Number.isSafeInteger(count) || count<0 || count>3000)return null;
  known.set(number,count);
 }
 for(let i=0;i<groups.length;i++){
  const group=groups[i],rows=(Array.isArray(group.episodes)?group.episodes:[]).slice().sort((a,b)=>Number(a.order)-Number(b.order));
  if(Number(group.order)!==start+i || !rows.length || rows.length>3000)return null;
  for(let j=0;j<rows.length;j++){
   const e=rows[j],s=Number(e.season_number),n=Number(e.episode_number),key=s+':'+n;
   if(Number(e.order)!==j || !Number.isSafeInteger(s) || s<=0 || !Number.isSafeInteger(n) || n<=0 || known.size && (!known.has(s) || known.get(s)>0 && n>known.get(s)) || seen.has(key))return null;
   seen.add(key);
  }
  result.push({number:i+1,name:String(group.name || ''),rows});
 }
 if(seen.size!==episodeCount || Number(card.number_of_episodes)>0 && seen.size!==Number(card.number_of_episodes))return null;
 for(const [s,count] of known)if(count>0 && Array.from({length:count},(_,i)=>s+':'+(i+1)).some(key=>!seen.has(key)))return null;
 return {groups:result};
}
export function namedSeason(card,number){
 const row=(Array.isArray(card && card.seasons)?card.seasons:[]).find(s=>Number(s.season_number)===Number(number)),name=String(row && row.name || '').trim();
 return /(?:part|часть|частина|частка|parte|partie|teil|część|část|חלק|部分|部)\s*\d+/i.test(name)?name:'';
}
export function namedPartCount(card){
 const names=(Array.isArray(card && card.seasons)?card.seasons:[]).map(s=>namedSeason(card,s.season_number)).filter(Boolean),numbers=names.map(n=>Number((n.match(/\d+/)||[])[0])||0);
 return numbers.length?Math.max(...numbers):0;
}
export default function episodeMetadata(L,kino,anime){
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
    const valid=value && (path.includes('/episode_groups')?Array.isArray(value.results):path.includes('/episode_group/')?Array.isArray(value.groups):Array.isArray(value.episodes) || Array.isArray(value.seasons));
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
 function legacyBook(card,number,numbers,actual,done,files=[]){
  if(!alternativeNumbering(card,numbers))return false;
  const seasonNumbers=[...new Set(numbers.map(Number))].filter(n=>n>0);
  const id=Number(card.tmdb_id || card.id),language=String(L.Storage.get('language','ru')),suffix='?language='+encodeURIComponent(language),networks=(card.networks || []).map(n=>Number(n.id));
  request('tv/'+id+'/episode_groups'+suffix,index=>{
   let candidates=((index && index.results)||[]).filter(g=>Number(g.group_count)===seasonNumbers.length && Number(g.episode_count)>0 && (!Number(card.number_of_episodes) || Number(g.episode_count)===Number(card.number_of_episodes)));
   const network=candidates.filter(g=>g.network && (!networks.length || networks.includes(Number(g.network.id))));
   if(network.length)candidates=network;
   if(candidates.length!==1)return done(null,true);
   request('tv/episode_group/'+encodeURIComponent(candidates[0].id)+suffix,data=>{
    const model=episodeGroupModel(card,data,seasonNumbers.length,Number(candidates[0].episode_count)),group=model && model.groups.find(g=>g.number===Number(number)),rows=group && group.rows;
    if(!rows || actual>0 && rows.length!==actual || files.length && (files.length!==rows.length || !files.map(Number).sort((a,b)=>a-b).every((n,i)=>n===i+1)))return done(null,true);
    const seasons=Array.from(new Set(rows.map(e=>Number(e.season_number))));let left=seasons.length;const books={};
    seasons.forEach(season=>request('tv/'+id+'/season/'+season+suffix,value=>{books[season]=value;if(--left)return;
     const name=seasons.length===1?seasonName(card,seasons[0]):seasonName({seasons:[{season_number:number,name:group.name}]},number);
     const book={};rows.forEach((e,i)=>{const episode=((books[e.season_number] && (books[e.season_number].episodes_original || books[e.season_number].episodes))||[]).find(v=>Number(v.episode_number)===Number(e.episode_number));if(episode)book[i+1]={...episode,lampa_grouped:true,lampa_season_name:name};});
     done(Object.keys(book).length===rows.length?book:null,true);
    }));
   });
  });return true;
 };
 function catalogueGroups(card,files,done){
  const seasons=(card.seasons || []).filter(s=>s.season_number>0),total=seasons.reduce((n,s)=>n+Number(s.episode_count||0),0),numbers=files.map(Number).sort((a,b)=>a-b);
  if(!seasons.length || numbers.length<2 || numbers.length>total || numbers[0]!==1 || !numbers.every((n,i)=>Number.isSafeInteger(n) && n>0 && n<=total && (!i || n>numbers[i-1])))return done(null);
  request('tv/'+(card.tmdb_id || card.id)+'/episode_groups',index=>{
   const candidates=((index && index.results)||[]).filter(g=>g.type===1 && g.episode_count===total && g.group_count>seasons.length && g.group_count<=30);if(candidates.length!==1)return done(null);
   request('tv/episode_group/'+candidates[0].id,data=>{const model=episodeGroupModel(card,data,candidates[0].group_count,total);if(!model)return done(null);
    const canonical=seasons.slice().sort((a,b)=>a.season_number-b.season_number).flatMap(s=>Array.from({length:s.episode_count},(_,i)=>s.season_number+':'+(i+1))),published=model.groups.flatMap(g=>g.rows.map(e=>e.season_number+':'+e.episode_number));if(canonical.join('|')!==published.join('|'))return done(null);
    const selected=new Set(numbers);
    const needed=Array.from(new Set(numbers.map(number=>published[number-1].split(':')[0])));
    const books={};let left=needed.length;
    needed.forEach(season=>request('tv/'+(card.tmdb_id || card.id)+'/season/'+season,value=>{books[season]=value;if(--left)return;let offset=0;const groups=[];
     for(const g of model.groups){const book={},episodes=[];for(const e of g.rows){const number=++offset;if(!selected.has(number))continue;const metadata=((books[e.season_number] && (books[e.season_number].episodes_original || books[e.season_number].episodes))||[]).find(v=>v.episode_number===e.episode_number);if(!metadata)return done(null);episodes.push(number);book[number]={...metadata,lampa_grouped:true};}if(episodes.length)groups.push({number:g.number,name:seasonName({seasons:[{season_number:g.number,name:g.name}]},g.number),count:episodes.length,episodes,book,anime_release:true});}
     done(groups.length?groups:null);
    }));
   });
  });
 }
 function groups(card,files,done,context){
  if(!isAnime(card))return done(null);
  const nativeSeasons=(context && context.numbers || []).filter(number=>number>0);
  const partialAllowed=nativeSeasons.length<=1 && !(context && context.number>1);
  function fallback(){
   const ready=absoluteSeasons(card,files);if(ready)return done(ready);
   if(!partialAllowed && (card.seasons || []).some(season=>season.season_number>0))return done(null);
   const id=Number(card.tmdb_id || card.id);
   if(!Number.isSafeInteger(id) || id<=0 || card.source==='minimal_shiki' && !card.tmdb_id || files.length<2)return done(null);
   request('tv/'+id+'?language='+encodeURIComponent(L.Storage.get('language','ru')),data=>{
    const value=data?{...card,...data,source:'tmdb',minimal_anime:true}:card;
    const complete=data && absoluteSeasons(value,files);
    if(complete || !partialAllowed)return done(complete || null);
    const finish=groups=>done(groups || absoluteRangeSeasons(value,files) || null);
    const readCatalogue=groups=>groups?done(groups):catalogueGroups(value,files,finish);
    if(anime && anime.groups)anime.groups(value,files,readCatalogue);else readCatalogue(null);
   });
  }
  // The current episode list may contain only one of several native seasons.
  // Preserve the provider's menu unless these files cover a verified full list.
  if(partialAllowed && kino && kino.enabled())kino.groups(card,files,value=>value?done(value):fallback());else fallback();
 }
 return {isAnime,availableMetadata,alternate:alternativeNumbering,groups,groupBook,seasonName,book(card,number,numbers,actual,done,files=[],verifiedAbsolute=false,layout=null){
  // Fewer source seasons can mean a missing arc, a merged arc or a missing tail.
  // A matching length of just the selected season cannot distinguish them.
  // Full absolute lists have a separately verified partition in groups()/groupBook().
  if(!verifiedAbsolute && (layout || alternativeNumbering(card,numbers)) && anime && anime.providerBook && files.length){anime.providerBook(card,number,numbers,files,book=>{if(book)return done(book,true);const first=(card.seasons || []).find(s=>Number(s.season_number)===1);if(Number(number)===1 && first && files.length<=Number(first.episode_count) && (!layout || layout[number]?.number===1))return done(null,false);if(new Set(numbers.map(Number).filter(n=>n>0)).size<Number(card.number_of_seasons))return done(null,true);if(!legacyBook(card,number,numbers,actual,done,files))done(null,true);},layout);return true;}
  if(!verifiedAbsolute && alternativeNumbering(card,numbers) && new Set(numbers.map(Number).filter(n=>n>0)).size<Number(card.number_of_seasons)){done(null,true);return true;}
  if(kino && kino.enabled() && files.length){kino.book(card,number,numbers,files,book=>{if(book)return done(book,true);if(!legacyBook(card,number,numbers,actual,done,files))done(null,false);});return true;}
  return legacyBook(card,number,numbers,actual,done,files);
 }};
}
