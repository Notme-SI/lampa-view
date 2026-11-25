import {profileScope} from './timeline-meta.cjs';

const MAX_SEASONS=60,MAX_EPISODES=500;
const prefix=(season,episode)=>String(season)+(season>10?':':'')+episode;

function signedHash(value){
 let hash=0;
 for(let i=0;i<value.length;i++)hash=((hash<<5)-hash+value.charCodeAt(i))|0;
 return hash;
}

export default function timelineIndex(L,file){
 let current,prefixes,nativeHash,sequence=0;
 const hash=(title,season,episode)=>L.Utils.hash(season?prefix(season,episode)+title:title);

 function read(revision){
  const records=L.Storage.get(file(),{}) || {},scope=profileScope(L);
  if(L.Storage.listener && current && scope===current.scope && revision===current.revision && records===current.records)return current;
  const linked=new Map(),legacy=new Set();
  for(const [key,value] of Object.entries(records)){
   if(!value)continue;
   if(!value.card){legacy.add(key);continue;}
   if(String(key)===String(hash('',Number(value.season)||0,Number(value.episode)||0)))continue;
   if(!linked.has(value.card))linked.set(value.card,[]);
   linked.get(value.card).push([key,value]);
  }
  current={scope,revision,records,linked,legacy,id:++sequence};
  return current;
 }

 function legacyEpisodes(title,legacy,limit){
  if(!legacy.size)return [];
  if(nativeHash===undefined){
   // Keep old clients and custom hash implementations on the legacy path.
   nativeHash=typeof Math.imul==='function' && ['11A','12:300Серия','123かな','30Another Title'].every(value=>
    String(L.Utils.hash(value))===String(Math.abs(signedHash(value))));
  }
  const found=new Map();
  function add(season,episode){
   if(episode>limit(season))return;
   const key=String(hash(title,season,episode));
   if(legacy.has(key))found.set(season+':'+episode,{season,episode,key});
  }
  if(!nativeHash){
   for(let season=1;season<=MAX_SEASONS;season++)for(let episode=1;episode<=limit(season);episode++)add(season,episode);
   return found.values();
  }
  if(!prefixes){
   prefixes=new Map();
   for(let season=1;season<=MAX_SEASONS;season++)for(let episode=1;episode<=MAX_EPISODES;episode++){
    const value=signedHash(prefix(season,episode));
    if(!prefixes.has(value))prefixes.set(value,[]);
    prefixes.get(value).push([season,episode]);
   }
  }
  // Remove the title suffix; 0xbdef7bdf is the inverse of 31 modulo 2^32.
  // Both signs are possible because the native hash stores an absolute value.
  let inverse=1;
  for(let i=0;i<title.length;i++)inverse=Math.imul(inverse,0xbdef7bdf);
  const tail=signedHash(title);
  for(const key of legacy){
   const value=Number(key);
   if(!Number.isInteger(value) || value<0 || value>2147483648 || String(value)!==key)continue;
   for(const signed of [value,-value]){
    const candidates=prefixes.get(Math.imul(signed-tail,inverse));
    if(candidates)for(const [season,episode] of candidates)add(season,episode);
   }
  }
  return found.values();
 }

 return {read,legacyEpisodes,hash,maxSeasons:MAX_SEASONS,maxEpisodes:MAX_EPISODES};
}
