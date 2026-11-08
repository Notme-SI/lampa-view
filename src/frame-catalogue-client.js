import {version,titleKeys,shardFor,validFrames} from './frame-catalogue.cjs';
import {version as pluginVersion} from '../package.json';

const base='https://notme-si.github.io/lampa-view/frames/v1/';
const pools=new WeakMap(),storageKey='minimal_frame_catalogue_v1',life=21600000;

function pool(L){
 if(pools.has(L))return pools.get(L);
 let saved;
 try{saved=L.Storage?.get(storageKey,{});}catch(error){}
 const memory=new Map(),pending=new Map();
 for(const [key,row] of Object.entries(saved || {})){
  if(/^[0-3][0-9a-f]$/.test(key) && row?.at>Date.now()-7*86400000 && validShard(row.data))memory.set(key,row);
 }
 function persist(){
  try{L.Storage?.set(storageKey,Object.fromEntries([...memory].slice(-8)));}catch(error){}
 }
 async function read(key){
  const old=memory.get(key);
  if((old?.release===pluginVersion && old.at>Date.now()-life) || old?.retry>Date.now())return old.data;
  if(pending.has(key))return pending.get(key);
  if(typeof fetch!=='function' || typeof AbortController!=='function')return old?.data || null;
  const task=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1700);
   try{
    const response=await fetch(base+key+'.json',{signal:controller.signal,credentials:'omit',cache:'no-cache'});
    if(!response.ok)throw new Error('Frame catalogue unavailable');
    const data=await response.json();
    if(!validShard(data))throw new Error('Invalid frame catalogue');
    memory.delete(key);memory.set(key,{at:Date.now(),release:pluginVersion,data});
    while(memory.size>8)memory.delete(memory.keys().next().value);
    persist();
    return data;
   }catch(error){
    memory.set(key,{at:old?.at || 0,data:old?.data || null,retry:Date.now()+60000});
    while(memory.size>8)memory.delete(memory.keys().next().value);
    return old?.data || null;
   }finally{clearTimeout(timer);}
  })();
  pending.set(key,task);
  try{return await task;}finally{pending.delete(key);}
 }
 const result={read};pools.set(L,result);return result;
}

function validShard(data){
 return data?.version===version && data.entries && typeof data.entries==='object' &&
  !Array.isArray(data.entries) && Object.keys(data.entries).length<=2000 &&
  typeof data.records==='object' && data.records && !Array.isArray(data.records);
}

export default async function catalogueFrames(L,card,media,readTmdb){
 const id=Number(card.tmdb_id || (['tmdb','cub'].includes(card.source)?card.id:0));
 const year=String(media==='tv'?card.first_air_date:card.release_date).slice(0,4);
 const exact=id>0?['tmdb:'+media+':'+id]:[];
 const original=[card.original_title,card.original_name].flatMap(title=>titleKeys(media,title,year));
 const localized=[card.title,card.name].flatMap(title=>titleKeys(media,title,year));
 const unique=[...new Set([...exact,...original,...localized])],shards=new Map();
 async function find(lookup){
  const names=[...new Set(lookup.map(shardFor))];
  await Promise.all(names.map(async name=>{if(!shards.has(name))shards.set(name,await pool(L).read(name));}));
  const matches=new Map();
  for(const key of lookup){
   const data=shards.get(shardFor(key)),ids=data?.entries[key];
   if(!Array.isArray(ids))continue;
   for(const identity of ids){
    const row=data.records[identity];
    if(row?.media!==media || !row.keys?.includes(key) || !validFrames(row.frames).length)continue;
    if(row.tmdb && id>0 && row.tmdb!==id)continue;
    if(key.startsWith('tmdb:') && row.tmdb!==id)continue;
    matches.set(identity,row);
   }
  }
  if(!matches.size)return [];
  // Multiple sources for one release share an identity. Ambiguous names stay empty.
  const identities=new Set([...matches.values()].map(row=>row.tmdb?'tmdb:'+row.tmdb:row.titleIdentity));
  if(identities.size>1)return [];
  const rows=[...matches.values()].sort((a,b)=>a.priority-b.priority || a.id.localeCompare(b.id));
  return validFrames(rows.flatMap(row=>row.frames)).map(row=>({img:row.img,minimal_still_url:row.url,width:row.width}));
 }
 await Promise.all([...new Set(unique.map(shardFor))].map(async name=>shards.set(name,await pool(L).read(name))));
 const direct=exact.length?await find(exact):[];
 if(direct.length)return direct;
 const canonical=await find(original);
 const named=canonical.length?canonical:await find(localized);
 if(named.length || media!=='movie' || !(id>0) || !card.original_language || card.original_language==='en')return named;
 const english=await new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(null),900);
  try{readTmdb('movie/'+id+'?language=en-US',value=>{clearTimeout(timer);resolve(value);},()=>{clearTimeout(timer);resolve(null);});}
  catch(error){clearTimeout(timer);resolve(null);}
 });
 if(Number(english?.id)!==id)return [];
 return find(titleKeys(media,english.title,year));
}
