import tmdbGet from './tmdb.js';
// Selected metadata/progress fixes adapted from the user-provided community interface.
// Read the host's timeline; opening the online screen never rewrites watch history.
const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
const stamp=value=>typeof value==='string' && !/^\d+$/.test(value)?Date.parse(value) || 0:number(value);
// Resolve a provider's search folder only when it identifies this title.
// Ambiguous results and a different season remain a manual choice.
export function folderTarget(rows,card,season=1){
 if(!card || !Array.isArray(rows) || rows.some(row=>/^(play|call)$/.test(row.method)))return '';
 const normalize=value=>String(value || '').toLowerCase().replace(/ё/g,'е').replace(/(?:сезон|season)\s*\d+|\d+\s*(?:сезон|season)|\bs\d+\b/gi,' ').replace(/\b(?:19|20)\d{2}\b/g,' ').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]+/g,' ').trim();
 const aliases=value=>Array.from(new Set([String(value || ''),...String(value || '').split(/\s+[\/|]\s+/)].map(normalize).filter(Boolean)));
 const names=new Set([card.title,card.name,card.original_title,card.original_name].flatMap(aliases));
 const year=Number(String(card.first_air_date || card.release_date || '').slice(0,4));
 const candidates=rows.filter(row=>{
  if(row.method!=='link' || typeof row.url!=='string' || !/^(?:https?:\/\/|\/)/i.test(row.url))return false;
  const title=String(row.title || row.name || row.text || '');if(!aliases(title).some(name=>names.has(name)))return false;
  const found=title.match(/(?:сезон|season)\s*(\d+)|(\d+)\s*(?:сезон|season)|\bs(\d+)\b/i),param=row.url.match(/[?&](?:s|season)=(\d+)/);
  const ownSeason=Number(row.season || (found && (found[1] || found[2] || found[3])) || (param && param[1]));
  if(ownSeason && ownSeason!==Number(season))return false;
  const ownYear=Number(String(row.year || row.start_date || '').slice(0,4)) || Number((title.match(/\b(?:19|20)\d{2}\b/) || [])[0]);
  return !year || !ownYear || Math.abs(year-ownYear)<=1;
 });
 return candidates.length===1?candidates[0].url:'';
}
// Search responses vary by provider: native HTML, a JSON string, or an object.
// Read only data attributes; never mount provider HTML or load its images.
export function folderSeasons(rows,card){
 if(!card || !(card.name || card.original_name) || !Array.isArray(rows))return [];
 const names=[card.name,card.original_name,card.title,card.original_title].filter(Boolean);
 const clean=v=>String(v || '').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]+/g,' ').trim();
 const aliases=v=>String(v || '').split(/\s*[\/|]\s*/).map(clean).filter(Boolean);
 const family=new Set(names.flatMap(aliases)),year=Number(String(card.first_air_date || card.release_date || '').slice(0,4));
 const known=Math.max(1,Number(card.number_of_seasons)||0,...(Array.isArray(card.seasons)?card.seasons.map(row=>Number(row.season_number)||0):[])),found=[];
 for(const row of rows){
  if(!row.similar || row.method!=='link' || !/^(?:https?:\/\/|\/)/i.test(row.url || ''))continue;
  const title=String(row.title || row.name || row.text || ''),match=title.match(/(?:сезон|season)\s*(\d+)|(\d+)\s*(?:сезон|season)|\bs(\d+)\b/i);
  let season=Number(row.season || (match && (match[1] || match[2] || match[3])));
  const base=title.replace(/(?:сезон|season)\s*\d+|\d+\s*(?:сезон|season)|\bs\d+\b/gi,' ');
  const hit=aliases(base).find(name=>family.has(name) || [...family].some(alias=>{
   if(!name.startsWith(alias+' '))return false;
   const tail=name.slice(alias.length+1);if(!/^[1-9]\d?$/.test(tail))return false;
   if(Number(tail)>known)return false;if(!season)season=Number(tail);return season===Number(tail);
  }));
  if(!hit)continue;
  if(!season){const param=(row.url || '').match(/[?&](?:s|season)=(\d+)/);season=Number(param && param[1]) || 1;}
  const ownYear=Number(row.year || String(row.start_date || '').slice(0,4));
  if(year && ownYear && (season===1?Math.abs(year-ownYear)>1:ownYear<year))continue;
  if(found.some(value=>value.season===season))return [];
  found.push({season,title:'Сезон '+season,method:'link',url:row.url});
 }
 return found.length>1?found.sort((a,b)=>a.season-b.season):[];
}
// Provider fuzzy matches are not alternatives to the requested movie.
// Keep same-title seasons; never touch playable entries or native voice lists.
export function relevantFolders(rows,card){
 if(!card || !Array.isArray(rows) || !rows.some(row=>row.similar))return rows;
 const clean=value=>String(value || '').toLowerCase().replace(/ё/g,'е').replace(/(?:сезон|season)\s*\d+|\d+\s*(?:сезон|season)|\bs\d+\b/gi,' ').replace(/\b(?:19|20)\d{2}\b/g,' ').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]+/g,' ').trim();
 const aliases=value=>String(value || '').split(/\s+[\/|]\s+/).map(clean).filter(Boolean);
 const names=new Set([card.title,card.name,card.original_title,card.original_name].flatMap(aliases));if(!names.size)return rows;
 const serial=!!(card.name || card.original_name),year=Number(String(card.first_air_date || card.release_date || '').slice(0,4));
 const known=Math.max(1,Number(card.number_of_seasons)||0,...(Array.isArray(card.seasons)?card.seasons:[]).map(row=>Number(row.season_number)||0));
 return rows.filter(row=>{
  if(!row.similar)return true;
  if(row.method!=='link' || !/^(?:https?:\/\/|\/)/i.test(row.url || ''))return false;
  const title=String(row.title || row.name || row.text || ''),season=title.match(/(?:сезон|season)\s*(\d+)|(\d+)\s*(?:сезон|season)|\bs(\d+)\b/i);
  let part=Number(row.season || season && (season[1] || season[2] || season[3])) || 1;
  const match=aliases(title).some(name=>names.has(name) || serial && [...names].some(alias=>{
   const tail=name.startsWith(alias+' ')?name.slice(alias.length+1):'';
   if(!/^[1-9]\d?$/.test(tail) || Number(tail)>known)return false;part=Number(tail);return true;
  }));
  const ownYear=Number(String(row.year || row.start_date || '').slice(0,4));
  return match && (!year || !ownYear || part>1 && ownYear>=year || Math.abs(year-ownYear)<=1);
 });
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
  try{decoder.innerHTML=data[2].replace(/</g,'&lt;');const row=JSON.parse(decoder.value);if(row && typeof row.url==='string' && row.url.trim() && /^(play|call|link)$/.test(row.method))rows.push(row);}catch(error){}
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
 let revision=0;const snapshots=new Map();
 const file=()=>L.Timeline && L.Timeline.filename?L.Timeline.filename():'file_view';
 const names=card=>Array.from(new Set([card.original_title,card.original_name,card.title,card.name].filter(Boolean).map(String)));
 const hash=(title,season,episode)=>L.Utils.hash(season?[season,season>10?':':'',episode,title].join(''):title);
 function reader(card){
  const records=L.Storage.get(file(),{}) || {},titles=names(card);
  return (season=0,episode=0,explicit)=>{
   const keys=titles.map(title=>hash(title,season,episode));if(explicit)keys.push(explicit);let best=null;
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
  const read=reader(card),seasons=Array.isArray(card.seasons)?card.seasons:[],max=Math.min(60,Math.max(1,lastSeason,number(card.number_of_seasons),seasons.reduce((n,s)=>Math.max(n,number(s.season_number)),0)));let latest=null;
  for(let s=1;s<=max;s++){
   const detail=seasons.find(row=>Number(row.season_number)===s),total=number(detail && detail.episode_count),limit=Math.min(500,total || 100);
   for(let e=1;e<=limit;e++){
    const record=read(s,e);if(!record.percent && !record.time)continue;
    if(!latest || record.updated>latest.record.updated || record.updated===latest.record.updated && (s>latest.season || s===latest.season && e>latest.episode))latest={season:s,episode:e,total,record};
   }
  }
  const value=latest?{season:latest.season,episode:latest.episode,total:latest.total,max,hash:latest.record.hash,time:latest.record.time,duration:latest.record.duration,percent:latest.record.percent}:null;
  snapshots.set(key,{at:Date.now(),revision,value});if(snapshots.size>100)snapshots.delete(snapshots.keys().next().value);return value;
 }
 function resume(card){
  const last=lastWatched(card);if(!last)return null;
  const value={season:last.season,episode:last.episode,time:last.time,percent:last.percent};
  if(value.percent>=90){
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
  if(watched && season){
   const saved={...(L.Storage.get('online_watched_last',{}) || {})};
   for(const title of titles.slice(0,2)){const key=L.Utils.hash(title);saved[key]={...saved[key],season,episode};}
   L.Storage.set('online_watched_last',saved);
  }else if(!watched)clearLast(card,season,episode);
  for(const key of keys){
   const raw=records[key],percent=typeof raw==='number'?raw:number(raw && raw.percent);
   if(watched || percent>=90){const duration=number(raw && raw.duration) || number(season?(card.episode_run_time || [])[0]:card.runtime)*60;writeTimeline({hash:key,percent:watched?100:0,time:watched?duration:0,duration});}
  }
  revision++;snapshots.clear();
  if(L.Timeline.read)L.Timeline.read();
 }
 function setAllWatched(card,done){
  const mark=details=>{
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
   for(const row of episodes.values())setWatched({...full,episode_run_time:row.runtime?[row.runtime]:full.episode_run_time},Number(row.season_number),Number(row.episode_number),true);
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

 return {availability,reader,resume,seasonIndex,folderTarget,folderRows,folderSeasons,relevantFolders,clearProgress,clearTitleProgress,setWatched,setAllWatched,lastWatched};
}
