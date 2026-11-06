import {animeEpisodeMap} from './anime-index.js';
import {isAnime} from './metadata.js';

const positive=value=>Number.isSafeInteger(Number(value)) && Number(value)>0;
const today=()=>new Date().toISOString().slice(0,10);
const titleKey=value=>String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[\s.,:;!?'’"«»()[\]…—–_-]+/g,'');
const playable=row=>row.method==='play' || row.method==='call';

// A separate provider entry is eligible only if its catalogue episode map
// fits a later season of this same TV card and the main story leads to it.
export function continuationPlan(card,model,files){
 const story=model && model.complete && model.rows.find(row=>row.key==='story');
 const nodes=model && model.nodes;
 if(!story || !Array.isArray(nodes) || !files.length)return [];
 const byId=new Map(nodes.map(node=>[node.id,node]));
 const releases=story.results.map(row=>byId.get(row.id)).filter(node=>node && ['tv','ona'].includes(node.kind) && node.record && Number(node.record.tv)===Number(card.tmdb_id || card.id));
 const first=releases[0],season=(card.seasons || []).find(row=>Number(row.season_number)===1);
 if(!first || !season || first.episodes!==Number(season.episode_count) || first.record.season!==1 || first.record.offset || !files.every(row=>Number(row.season)===1 && positive(row.episode) && Number(row.episode)<=first.episodes))return [];
 const output=[];
 for(const release of releases.slice(1)){
  if(!release.aired || release.aired>today() || release.status==='anons' || !release.original)continue;
  const map=animeEpisodeMap(release.record,release.episodes,card),start=map && map[0];
  if(!start || start.season<=1 || !map.every((row,index)=>row.season===start.season && row.episode===start.episode+index))continue;
  const offset=start.episode-1,count=map.length;
  if(output.some(part=>part.season===start.season && offset<part.offset+part.count && part.offset<offset+count))return [];
  output.push({order:output.length+1,name:release.name,original:release.original,year:release.year,season:start.season,offset,count});
 }
 return output.length<=8?output:[];
}

export function kodikRoute(value,base){
 try{
  const page=typeof location==='undefined'?undefined:location.href,url=new URL(value,base || page);
  if(!/^https?:$/.test(url.protocol) || url.username || url.password || !/\/lite\/kodik(?:_snack)?\/?$/i.test(url.pathname))return null;
  if(base){const origin=new URL(base,page);if(url.origin!==origin.origin || url.pathname!==origin.pathname)return null;}
  return url;
 }catch(error){return null;}
}

export function matchContinuations(parts,rows,base){
 const entries=[];
 for(const part of parts){
  const names=[part.name,part.original].map(titleKey).filter(Boolean);
  const urls=new Set();
  for(const row of rows){
   if(!row.similar || row.method!=='link' || String(row.year || row.start_date || '').slice(0,4)!==part.year)continue;
   if(!String(row.title || row.name || row.text || '').split(/\s+[\/|]\s+/).some(name=>names.includes(titleKey(name))))continue;
   const url=kodikRoute(row.url,base);
   if(url && url.searchParams.get('pick') && !url.searchParams.has('s'))urls.add(url.href);
  }
  if(urls.size===1)entries.push({...part,url:[...urls][0]});
 }
 return entries;
}

export function continuationFiles(part,rows){
 const files=rows.filter(playable);
 if(!files.length)return rows;
 const numbers=files.map(file=>Number(file.episode));
 if(!numbers.every(positive))return [];
 const local=numbers.every(number=>number<=part.count);
 const absolute=numbers.every(number=>number>part.offset && number<=part.offset+part.count);
 if((!local && !absolute) || (local && absolute && part.offset>0))return [];
 return rows.map(row=>playable(row)?{...row,season:part.season,episode:Number(row.episode)+(local?part.offset:0)}:row);
}

export default function animeContinuations(L,anime,online){
 const cache=new Map();
 return function find(card,base,files,done){
  if(!card || !isAnime(card) || !kodikRoute(base))return done([]);
  const original=String(card.original_name || card.original_title || card.name || '');
  if(!original)return done([]);
  anime.canonical(card,value=>{
   if(!value || (value.seasons || []).filter(row=>Number(row.season_number)>0).length<2)return done([]);
   anime.collection(value,model=>{
    const parts=continuationPlan(value,model,files);
    if(!parts.length)return done([]);
    const url=kodikRoute(base),query=url.searchParams;
    for(const key of ['id','imdb_id','kinopoisk_id','tmdb_id','mal_id','shikimori_id','kid','pick','s','t','e','rjson','nojson'])query.delete(key);
    query.set('title',original);
    query.set('original_title',original);
    query.set('clarification','0');
    query.set('similar','false');
    const account={account_email:'account_email',uid:'lampac_unic_id',nws_id:'lampac_nws_id'};
    for(const name of Object.keys(account)){
     const value=L.Storage.get(account[name],'');
     if(value && !query.has(name))query.set(name,value);
    }
    const kit=L.Storage.get('kit_aesgcmkey',''),headers=kit?{'X-Kit-AesGcm':kit}:{};
    const key=url.href,hit=cache.get(key);
    if(hit && Date.now()-hit.at<120000)return done(matchContinuations(parts,hit.rows,base));
    const network=new L.Reguest();
    network.timeout(4500);
    network.native(url.href,body=>{
     const rows=online.folderRows(body);
     if(rows.length){cache.set(key,{rows,at:Date.now()});if(cache.size>16)cache.delete(cache.keys().next().value);}
     done(matchContinuations(parts,rows,base));
    },()=>done([]),false,{dataType:'text',headers});
   });
  });
 };
}
