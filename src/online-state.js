// Selected metadata/progress fixes adapted from the user-provided community interface.
// Read the host's timeline; opening the online screen never rewrites watch history.
const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
const stamp=value=>typeof value==='string' && !/^\d+$/.test(value)?Date.parse(value) || 0:number(value);
// Resolve a provider's search folder only when it identifies this title.
// Ambiguous results and a different season remain a manual choice.
export function folderTarget(rows,card,season=1){
 if(!card || !Array.isArray(rows) || rows.some(row=>/^(play|call)$/.test(row.method)))return '';
 const normalize=value=>String(value || '').toLowerCase().replace(/ё/g,'е').replace(/(?:сезон|season)\s*\d+|\d+\s*(?:сезон|season)|\bs\d+\b/gi,' ').replace(/\b(?:19|20)\d{2}\b/g,' ').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]+/g,' ').trim();
 const names=new Set([card.title,card.name,card.original_title,card.original_name].filter(Boolean).map(normalize).filter(Boolean));
 const year=Number(String(card.release_date || card.first_air_date || '').slice(0,4));
 const candidates=rows.filter(row=>{
  if(row.method!=='link' || typeof row.url!=='string' || !/^(?:https?:\/\/|\/)/i.test(row.url))return false;
  const title=String(row.text || row.title || row.name || '');if(!names.has(normalize(title)))return false;
  const found=title.match(/(?:сезон|season)\s*(\d+)|(\d+)\s*(?:сезон|season)|\bs(\d+)\b/i),param=row.url.match(/[?&](?:s|season)=(\d+)/);
  const ownSeason=Number(row.season || (found && (found[1] || found[2] || found[3])) || (param && param[1]));
  if(ownSeason && ownSeason!==Number(season))return false;
  const ownYear=Number(String(row.year || row.start_date || '').slice(0,4)) || Number((title.match(/\b(?:19|20)\d{2}\b/) || [])[0]);
  return !year || !ownYear || Math.abs(year-ownYear)<=1;
 });
 return candidates.length===1?candidates[0].url:'';
}
export function catalogueRows(body){
 if(typeof body!=='string')return [];
 const clean=body.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,''),tags=clean.match(/<(?:div|span|a)\b[^>]*>/gi) || [],decoder=document.createElement('textarea'),rows=[];
 for(const tag of tags){
  const cls=tag.match(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i),data=tag.match(/\bdata-json\s*=\s*(["'])([\s\S]*?)\1/i);
  if(!cls || !/(^|\s)videos__item(\s|$)/.test(cls[2]) || !data)continue;
  try{decoder.innerHTML=data[2].replace(/</g,'&lt;');const row=JSON.parse(decoder.value);if(row && typeof row.url==='string' && row.url.trim() && !row.similar && /^(play|call|link)$/.test(row.method))rows.push(row);}catch(error){}
 }
 return rows;
}
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
 function resume(card){
  const key=[file(),card.source || 'tmdb',card.name || card.original_name?'tv':'movie',card.id || '',...names(card)].join('|'),old=snapshots.get(key);
  if(old && old.revision===revision && Date.now()-old.at<5000)return old.value;
  const read=reader(card),seasons=Array.isArray(card.seasons)?card.seasons:[],max=Math.min(60,number(card.number_of_seasons) || seasons.reduce((n,s)=>Math.max(n,number(s.season_number)),0) || 1);let latest=null;
  for(let s=1;s<=max;s++){
   const detail=seasons.find(row=>Number(row.season_number)===s),total=number(detail && detail.episode_count),limit=Math.min(500,total || 100);
   for(let e=1;e<=limit;e++){
    const record=read(s,e);if(!record.percent && !record.time)continue;
    if(!latest || record.updated>latest.record.updated || record.updated===latest.record.updated && (s>latest.season || s===latest.season && e>latest.episode))latest={season:s,episode:e,total,record};
   }
  }
  let value=null;
  if(latest){value={season:latest.season,episode:latest.episode,time:latest.record.time,percent:latest.record.percent};if(value.percent>=90){value.episode++;value.time=0;value.percent=0;if(latest.total && value.episode>latest.total){if(value.season<max){value.season++;value.episode=1;}else{value.episode=latest.episode;value.complete=true;}}}}
  snapshots.set(key,{at:Date.now(),revision,value});if(snapshots.size>100)snapshots.delete(snapshots.keys().next().value);return value;
 }
 if(L.Timeline && L.Timeline.listener)L.Timeline.listener.follow('update',()=>{revision++;snapshots.clear();});
 function seasonIndex(body,season){
  const rows=catalogueRows(body);if(rows.some(row=>row.method==='play' || row.method==='call'))return -1;
  const links=rows.filter(row=>row.method==='link');if(links.length<2)return -1;
  return links.findIndex(row=>{const param=row.url.match(/[?&](?:s|season)=(\d+)/),name=String(row.name || row.title || '').match(/(?:сезон|season)\s*(\d+)|(\d+)\s*(?:сезон|season)/i);return Number(row.season || (param?param[1]:name?name[1] || name[2]:0))===Number(season);});
 }
 return {availability,reader,resume,seasonIndex,folderTarget};
}
