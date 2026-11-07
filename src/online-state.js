import {WATCHED_PERCENT} from './watch-threshold.js';
import tmdbGet from './tmdb.js';
import cardInfo from './card-info.js';
import {linkFor} from './timeline-meta.cjs';
// Selected metadata/progress fixes adapted from the user-provided community interface.
// Read the host's timeline; opening the online screen never rewrites watch history.
const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
const stamp=value=>typeof value==='string' && !/^\d+$/.test(value)?Date.parse(value) || 0:number(value);
// Resolve a provider's search folder only when it identifies this title.
// Ambiguous results and a different season remain a manual choice.
const titleClean=value=>String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]+/g,' ').trim();
function providerRelease(row,card){
 const title=String(row.title || row.name || row.text || ''),names=[card.name,card.title,card.original_name,card.original_title].filter(Boolean),family=new Set(names.flatMap(v=>String(v).split(/\s+[\/|]\s+/).map(titleClean)));
 const marker=title.match(/\[(?:тв|tv)(?:\s*[- ]\s*(\d+))?\]/i),explicit=title.match(/(?:сезон|season)\s*(\d+)|(\d+)\s*(?:сезон|season)|\bs(\d+)\b/i);
 let season=Number(row.season || (marker && marker[1]) || (explicit && (explicit[1] || explicit[2] || explicit[3]))) || 0;
 if((card.name || card.original_name) && !family.has(titleClean(title)) && /\b(?:ova|ona[- ]?special|movie|film|special)\b|спецвыпуск|фильм/i.test(title))return null;
 const base=title.replace(/\[(?:тв|tv)(?:\s*[- ]\s*\d+)?\]/gi,' ').replace(/(?:сезон|season)\s*\d+|\d+\s*(?:сезон|season)|\bs\d+\b/gi,' ').replace(/\b(?:19|20)\d{2}\b/g,' ');
 const match=base.split(/\s+[\/|]\s+/).some(value=>{
  let name=titleClean(value);if(family.has(name))return true;
  const roman=value.match(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\s*$/i);if(roman){name=titleClean(value.slice(0,roman.index));if(family.has(name)){if(!season)season=({II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10})[roman[1].toUpperCase()];return true;}}
  return [...family].some(alias=>{const tail=name.startsWith(alias+' ')?name.slice(alias.length+1):'';if(!/^[1-9]\d?$/.test(tail) || Number(tail)>60)return false;if(!season)season=Number(tail);return true;});
 });
 if(!match)return null;
 const param=String(row.url || '').match(/[?&](?:s|season)=(\d+)/);season=season || Number(param && param[1]) || 1;
 const year=Number(String(card.first_air_date || card.release_date || '').slice(0,4)),ownYear=Number(String(row.year || row.start_date || '').slice(0,4)) || Number((title.match(/\b(?:19|20)\d{2}\b/) || [])[0]);
 if(year && ownYear && (season===1?Math.abs(year-ownYear)>1:ownYear<year))return null;
 return {season,explicit:!!marker || !!explicit};
}
export function folderTarget(rows,card,season=1){
 if(!card || !Array.isArray(rows) || rows.some(row=>/^(play|call)$/.test(row.method)))return '';
 const matches=rows.filter(row=>row.method==='link' && /^(?:https?:\/\/|\/)/i.test(row.url || '')).map(row=>({row,release:providerRelease(row,card)})).filter(v=>v.release?.season===Number(season)),strong=matches.filter(v=>v.release.explicit),choice=strong.length?strong:matches;
 return choice.length===1?choice[0].row.url:'';
}
export function folderSeasons(rows,card){
 if(!card || !(card.name || card.original_name) || !Array.isArray(rows))return [];
 const found=new Map();
 for(const row of rows){
  if(!row.similar || row.method!=='link' || !/^(?:https?:\/\/|\/)/i.test(row.url || ''))continue;
  const release=providerRelease(row,card);if(!release)continue;
  const old=found.get(release.season);if(old){if(old.url===row.url)continue;if(old.explicit && !release.explicit)continue;if(!old.explicit && release.explicit){found.delete(release.season);}else return [];}
  found.set(release.season,{season:release.season,title:'Сезон '+release.season,method:'link',url:row.url,explicit:release.explicit});
 }
 return found.size>1?[...found.values()].sort((a,b)=>a.season-b.season).map(({explicit,...row})=>row):[];
}
// Preserve native voice/file responses and filter only provider search folders.
export function relevantFolders(rows,card){
 if(!card || !Array.isArray(rows) || !rows.some(row=>row.similar))return rows;
 return rows.filter(row=>!row.similar || row.method==='link' && /^(?:https?:\/\/|\/)/i.test(row.url || '') && providerRelease(row,card));
}
// Some provider replies mix dub choices and actual episodes. Coordinates
// come from the provider, never from the card's position in the returned list.
export function episodeRows(rows){
 const video=row=>row.method==='call' || row.method==='play';
 const episode=row=>row.episode!=null && row.episode!=='' && Number.isInteger(Number(row.episode)) && Number(row.episode)>=0;
 return rows.some(row=>video(row) && episode(row))?rows.filter(row=>!video(row) || episode(row)):rows;
}
export function folderRows(body){
 let json=body;
 if(typeof body==='string'){try{json=JSON.parse(body);}catch(error){json=null;}}
 if(json && typeof json==='object')return /^(similar|season)$/.test(json.type) && Array.isArray(json.data)?json.data:[];
 if(typeof body!=='string' || !/\bvideos__season\b|\bsimilar\b/.test(body))return [];
 return htmlRows(body).filter(row=>row.method==='link');
}
function htmlRows(body){
 if(typeof body!=='string')return [];
 const clean=body.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,''),tags=clean.match(/<(?:div|span|a)\b[^>]*>/gi) || [],decoder=document.createElement('textarea'),rows=[];
 for(const tag of tags){
  const cls=tag.match(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i),data=tag.match(/\bdata-json\s*=\s*(["'])([\s\S]*?)\1/i);
  if(!cls || !/(^|\s)videos__item(\s|$)/.test(cls[2]) || !data)continue;
  try{decoder.innerHTML=data[2].replace(/</g,'&lt;');const row=JSON.parse(decoder.value);if(row && /^(play|call)$/.test(row.method)){for(const [attribute,field] of [['s','season'],['e','episode']]){const value=tag.match(new RegExp('\\s'+attribute+'\\s*=\\s*([\"\'])([0-9]+)\\1','i'));if(value)row[field]=Number(value[2]);else if(row[field]===undefined && row[attribute]!==undefined)row[field]=Number(row[attribute]);}}if(row && typeof row.url==='string' && row.url.trim() && /^(play|call|link)$/.test(row.method))rows.push(row);}catch(error){}
 }
 return rows;
}
export function catalogueRows(body){return htmlRows(body).filter(row=>!row.similar);}
export function availability(body){
 let json=body,count=0,visited=0;
 if(typeof body==='string'){try{json=JSON.parse(body);}catch(error){json=null;}}
 if(json && typeof json==='object'){
  if(json.rch || json.accsdb || json.blocked || json.error || json.error_details)return {state:'unknown',count:0};
  function walk(value,depth){
   if(!value || typeof value!=='object' || depth>6 || ++visited>500)return;
   if(typeof value.url==='string' && value.url.trim() && !value.similar && /^(play|call|link)$/.test(value.method))count++;
   if(Array.isArray(value))value.forEach(row=>walk(row,depth+1));else for(const key of ['data','results','items','list','playlists'])walk(value[key],depth+1);
  }
  walk(json,0);return {state:count?'ok':Array.isArray(json) || Array.isArray(json.data) || Array.isArray(json.results)?'empty':'unknown',count};
 }
 if(typeof body!=='string' || !body.trim())return {state:'unknown',count:0};
 // Inspect attributes without inserting provider HTML or starting image/iframe loads.
 count=catalogueRows(body).length;
 const clean=body.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 return {state:count?'ok':/\bvideos__(?:item|line|empty|body)\b/.test(clean)?'empty':'unknown',count};
}
export default function onlineState(L){
 let revision=0,batching=0;const snapshots=new Map();
 const file=()=>L.Timeline && L.Timeline.filename?L.Timeline.filename():'file_view';
 const info=L.Storage && L.Storage.get?cardInfo(L):null;
 const names=card=>Array.from(new Set([card.original_title,card.original_name,card.title,card.name,...(info?info.names(card):[])].filter(value=>typeof value==='string' && value.trim()).map(value=>value.trim())));
 const hash=(title,season,episode)=>L.Utils.hash(season?[season,season>10?':':'',episode,title].join(''):title);
 function linkedRecords(card,records){
  const identity=linkFor(L,card,1,1);
  if(!identity)return [];
  return Object.entries(records).filter(([,value])=>value && typeof value==='object' && value.card===identity.card);
 }
 function reader(card){
  const records=L.Storage.get(file(),{}) || {},titles=names(card);
  const linked=new Map();
  for(const [key,value] of linkedRecords(card,records)){
   const coordinate=number(value.season)+':'+number(value.episode),old=linked.get(coordinate);
   if(!old || stamp(value.updated)>stamp(old.value.updated))linked.set(coordinate,{key,value});
  }
  return (season=0,episode=0,explicit)=>{
   const keys=titles.map(title=>hash(title,season,episode)),match=linked.get(season+':'+episode);if(match)keys.push(match.key);if(explicit)keys.push(explicit);let best=null;
   for(const key of new Set(keys)){
    const value=records[key],raw=typeof value==='number'?{percent:value}:value;
    if(!raw || typeof raw!=='object')continue;
    const row={hash:key,found:true,percent:Math.min(100,number(raw.percent)),time:number(raw.time),duration:number(raw.duration),updated:stamp(raw.updated)};
    if(!best || row.updated>best.updated || row.updated===best.updated && row.percent>best.percent)best=row;
   }
   return best || {found:false,percent:0,time:0,duration:0,updated:0};
  };
 }
 function lastWatched(card){
  const titles=names(card),saved=L.Storage.get('online_watched_last',{}) || {},lastSeason=titles.reduce((max,title)=>Math.max(max,number(saved[L.Utils.hash(title)] && saved[L.Utils.hash(title)].season)),0);
  const key=[file(),card.source || 'tmdb',card.name || card.original_name?'tv':'movie',card.id || '',card.number_of_seasons || 0,lastSeason,(Array.isArray(card.seasons)?card.seasons:[]).map(season=>season.season_number+':'+season.episode_count).join(','),...titles].join('|'),old=snapshots.get(key);
  if(old && old.revision===revision && Date.now()-old.at<5000)return old.value;
  // Release metadata and the local resume hint can lag behind another device.
  // Search the supported season range in the shared records, not just seasons
  // that this particular card/device happened to cache. Focus snapshots bound it.
  const records=L.Storage.get(file(),{}) || {},seasons=Array.isArray(card.seasons)?card.seasons:[],max=60;let latest=null;
  for(const [key,raw] of linkedRecords(card,records)){
   const season=Number(raw.season),episode=Number(raw.episode),percent=Math.min(100,number(raw.percent)),time=number(raw.time),updated=stamp(raw.updated);
   if(!Number.isInteger(season) || season<1 || !Number.isInteger(episode) || episode<1 || !percent && !time)continue;
   const detail=seasons.find(row=>Number(row.season_number)===season),total=number(detail && detail.episode_count);
   if(!latest || updated>latest.record.updated || updated===latest.record.updated && (season>latest.season || season===latest.season && episode>latest.episode))latest={season,episode,total,record:{hash:key,percent,time,duration:number(raw.duration),updated}};
  }
  // Most candidates have no record. Do not allocate an array, Set and empty
  // result object for every episode while a TV is moving through its cards.
  if(Object.keys(records).length)for(let s=1;s<=max;s++){
   const detail=seasons.find(row=>Number(row.season_number)===s),total=number(detail && detail.episode_count),limit=Math.min(500,Math.max(100,total));
   for(let e=1;e<=limit;e++)for(const title of titles){
    const key=hash(title,s,e),raw=records[key];if(!raw)continue;
    const percent=Math.min(100,number(typeof raw==='number'?raw:raw.percent)),time=number(raw.time);if(!percent && !time)continue;
    const updated=stamp(raw.updated);
    if(!latest || updated>latest.record.updated || updated===latest.record.updated && (s>latest.season || s===latest.season && (e>latest.episode || e===latest.episode && percent>latest.record.percent)))latest={season:s,episode:e,total,record:{hash:key,percent,time,duration:number(raw.duration),updated}};
   }
  }
  const value=latest?{season:latest.season,episode:latest.episode,total:latest.total,max,hash:latest.record.hash,time:latest.record.time,duration:latest.record.duration,percent:latest.record.percent}:null;
  snapshots.set(key,{at:Date.now(),revision,value});if(snapshots.size>100)snapshots.delete(snapshots.keys().next().value);return value;
 }
 function seasonWatched(card,season,total){
  if(!Number.isInteger(total) || total<1 || total>500)return false;
  const read=reader(card);
  // Credits may be skipped: use the same threshold as resume, for every episode.
  for(let episode=1;episode<=total;episode++)if(read(season,episode).percent<WATCHED_PERCENT)return false;
  return true;
 }
 function resume(card){
  const last=lastWatched(card);if(!last)return null;
  const value={season:last.season,episode:last.episode,time:last.time,percent:last.percent};
  if(value.percent>=WATCHED_PERCENT){
   const aired=card.last_episode_to_air,seasons=Array.isArray(card.seasons)?card.seasons:[];
   const released=date=>!!date && Number.isFinite(Date.parse(date)) && Date.parse(date)<=Date.now();
   const bound=aired && Number(aired.season_number)>0 && Number(aired.episode_number)>0 && released(aired.air_date)?aired:null;
   value.episode++;value.time=0;value.percent=0;
   if(last.total && value.episode>last.total){
    const next=seasons.find(season=>Number(season.season_number)===value.season+1);
    // A planned season count is not evidence that its episodes are available.
    const nextReleased=bound?Number(bound.season_number)>value.season:next && Number(next.episode_count)>0 && released(next.air_date);
    if(nextReleased){value.season++;value.episode=1;}
    else value.complete=true;
   }
   if(bound && (value.season>Number(bound.season_number) || value.season===Number(bound.season_number) && value.episode>Number(bound.episode_number)))value.complete=true;
   if(value.complete){value.season=last.season;value.episode=last.episode;}
  }
  return value;
 }

 if(L.Timeline && L.Timeline.listener)for(const event of ['update','read'])L.Timeline.listener.follow(event,()=>{revision++;snapshots.clear();});
 // CUB/profile reads may replace storage independently of Timeline's in-memory cache.
 if(L.Listener && L.Listener.follow)L.Listener.follow('state:changed',event=>{if(event.target==='timeline'){revision++;snapshots.clear();}});
 if(L.Storage && L.Storage.listener)L.Storage.listener.follow('change',event=>{if(event.name===file()){revision++;snapshots.clear();}});
 function writeTimeline(value){
  const current=L.Timeline.view?L.Timeline.view(value.hash):{};
  const permit=L.Account && L.Account.Permit,profile=permit && permit.sync && permit.account && permit.account.profile;
  L.Timeline.update({...value,profile:current && current.profile || profile && profile.id || 0});
 }
 function seasonIndex(body,season){
  const rows=catalogueRows(body);if(rows.some(row=>row.method==='play' || row.method==='call'))return -1;
  const links=rows.filter(row=>row.method==='link');if(links.length<2)return -1;
  return links.findIndex(row=>{const param=row.url.match(/[?&](?:s|season)=(\d+)/),name=String(row.name || row.title || '').match(/(?:сезон|season)\s*(\d+)|(\d+)\s*(?:сезон|season)/i);return Number(row.season || (param?param[1]:name?name[1] || name[2]:0))===Number(season);});
 }
 function clearLast(card,season,episode){
  const saved=L.Storage.get('online_watched_last',{}) || {},next={...saved};let changed=false;
  for(const title of names(card)){
   const key=L.Utils.hash(title),row=saved[key];
   if(row && (season===undefined || Number(row.season)===Number(season) && Number(row.episode)===Number(episode))){delete next[key];changed=true;}
  }
  if(changed)L.Storage.set('online_watched_last',next);
 }
 function clearProgress(card,season=0,episode=0,explicit){
  if(!L.Timeline || !L.Timeline.update)return;
  const records=L.Storage.get(file(),{}) || {},keys=names(card).map(title=>hash(title,season,episode));
  if(explicit)keys.push(explicit);
  clearLast(card,season,episode);
  for(const key of new Set(keys))if(records[key] || key===explicit)writeTimeline({hash:key,percent:0,time:0,duration:0});
  revision++;snapshots.clear();
  if(L.Timeline.read)L.Timeline.read();
 }
 function setWatched(card,season,episode,watched,explicit){
  if(!L.Timeline || !L.Timeline.update)return;
  const titles=names(card),records=L.Storage.get(file(),{}) || {},keys=new Set();
  if(titles.length)keys.add(hash(titles[0],season,episode));
  if(explicit)keys.add(explicit);
  for(const title of titles){const key=hash(title,season,episode);if(records[key])keys.add(key);}
  if(watched && season && !batching){
   const saved={...(L.Storage.get('online_watched_last',{}) || {})};
   for(const title of titles.slice(0,2)){const key=L.Utils.hash(title);saved[key]={...saved[key],season,episode};}
   L.Storage.set('online_watched_last',saved);
  }else if(!watched)clearLast(card,season,episode);
  for(const key of keys){
   const raw=records[key],percent=typeof raw==='number'?raw:number(raw && raw.percent);
   if(watched || percent>=WATCHED_PERCENT){const duration=number(raw && raw.duration);writeTimeline({hash:key,percent:watched?100:0,time:watched?number(raw && raw.time):0,duration});}
  }
  revision++;snapshots.clear();
  if(!batching && L.Timeline.read)L.Timeline.read();
 }
 function markRows(card,rows){
  batching++;
  try{for(const row of rows)setWatched(card,row.season,row.episode,true,row.hash);}finally{batching--;}
  const last=rows[rows.length-1];
  if(last){const saved={...(L.Storage.get('online_watched_last',{}) || {})};for(const title of names(card).slice(0,2)){const key=L.Utils.hash(title);saved[key]={...saved[key],season:last.season,episode:last.episode};}L.Storage.set('online_watched_last',saved);}
  if(L.Timeline.read)L.Timeline.read();
 }
 function setPreviousWatched(card,season,episode,done,explicit=[]){
  season=Number(season);episode=Number(episode);
  if(!Number.isInteger(season) || season<1 || season>100 || !Number.isInteger(episode) || episode<1 || episode>500){if(done)done(0);return;}
  const supplied=new Map(explicit.map(row=>[Number(row.episode),row]));
  const rows=Array.from({length:episode},(_,i)=>({season,episode:i+1,hash:supplied.get(i+1) && supplied.get(i+1).hash})).filter(row=>!(supplied.get(row.episode) || {}).soon);
  markRows(card,rows);if(done)done(rows.length);
 }
 function setAllWatched(card,done){
  const scope=file();
  const mark=details=>{
   if(file()!==scope){if(done)done(0);return;}
   const full={...card,...details},table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(full) || []:[];
   const today=new Date().toISOString().slice(0,10),last=full.last_episode_to_air;
   const aired=last && last.air_date && String(last.air_date).slice(0,10)<=today?last:null;
   const episodes=new Map();
   for(const row of table)if(row.air_date && String(row.air_date).slice(0,10)<=today && Number(row.season_number)>0)episodes.set(row.season_number+':'+row.episode_number,row);
   if(aired)for(const season of Array.isArray(full.seasons)?full.seasons:[]){
    const n=Number(season.season_number);if(n<=0 || n>Number(aired.season_number))continue;
    const count=n===Number(aired.season_number)?Number(aired.episode_number):Number(season.episode_count);
    for(let e=1;e<=Math.min(count,500);e++)if(!episodes.has(n+':'+e))episodes.set(n+':'+e,{season_number:n,episode_number:e});
   }
   markRows(full,Array.from(episodes.values()).map(row=>({season:Number(row.season_number),episode:Number(row.episode_number)})).sort((a,b)=>a.season-b.season || a.episode-b.episode));
   if(done)done(episodes.size);
  };
  if(Number(card.id)>0 && (!card.source || ['tmdb','cub','trakt'].includes(card.source)))tmdbGet(L,'tv/'+card.id,{},value=>mark(value && Number(value.id)===Number(card.id)?value:{}),()=>mark({}),{life:60});
  else mark({});
 }
 function clearTitleProgress(card,explicit=[]){
  if(!L.Timeline || !L.Timeline.update)return;
  const records=L.Storage.get(file(),{}) || {},titles=names(card),keys=new Set(explicit.filter(Boolean));
  const serial=card.media_type==='tv' || card.name || card.original_name || card.first_air_date;
  if(serial){
   const seasons=Array.isArray(card.seasons)?card.seasons:[],limits=new Map();
   const remember=(season,total)=>{season=number(season);if(season>0 && season<=100)limits.set(season,Math.min(5000,Math.max(100,limits.get(season)||0,number(total))));};
   for(const row of seasons)remember(row.season_number,row.episode_count);
   const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(card) || []:[];
   for(const row of table)remember(row.season_number,row.episode_number);
   const last=L.Storage.get('online_watched_last',{}) || {};
   for(const title of titles){const row=last[L.Utils.hash(title)];if(row)remember(row.season,row.episode);}
   const max=Math.min(100,Math.max(1,number(card.number_of_seasons),...limits.keys()));
   for(let season=1;season<=max;season++)for(let episode=1;episode<=(limits.get(season)||100);episode++)for(const title of titles)keys.add(hash(title,season,episode));
  }else for(const title of titles)keys.add(hash(title));
  // Zero via the native API so the active profile and its normal sync are kept.
  // Never clear the complete timeline store or another title's history.
  clearLast(card);
  for(const key of keys){const row=records[key];if(row && (typeof row==='number'?row:row.percent || row.time))writeTimeline({hash:key,percent:0,time:0,duration:0});}
  revision++;snapshots.clear();
  if(L.Timeline.read)L.Timeline.read();
 }

 return {availability,reader,resume,seasonIndex,folderTarget,folderRows,folderSeasons,relevantFolders,episodeRows,clearProgress,clearTitleProgress,setWatched,setAllWatched,setPreviousWatched,setWatchedRows:markRows,lastWatched,seasonWatched};
}
