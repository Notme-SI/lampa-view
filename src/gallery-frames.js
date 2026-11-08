import catalogueFrames from './frame-catalogue-client.js';
import {frameLimit} from './frame-catalogue.cjs';
export {frameLimit} from './frame-catalogue.cjs';

export const galleryFramesKey='minimal_poiskkino_frames_key';

const cache=new Map();
const https=url=>typeof url==='string' && /^https:\/\//i.test(url);
const tmdbPath=value=>String(value || '').match(/(?:^|\/t\/p\/(?:original|w\d+))(\/[\w.-]+\.(?:jpg|jpeg|png|webp))$/i)?.[1] || '';
const seriesCard=card=>card.media_type==='tv' || card.media_type!=='movie' && !!(card.name || card.first_air_date);
const tmdbId=card=>Number(card.tmdb_id || (['tmdb','cub'].includes(card.source)?card.id:0));

function readGalleryData(read,path,timeout){
 return new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(null),timeout);
  const complete=value=>{clearTimeout(timer);resolve(value);};
  try{read(path,complete,()=>complete(null));}catch(error){complete(null);}
 });
}

async function episodeGallery(data,id,readTmdb){
 const episodes=[data.episodes?.episodes_original,data.episodes?.episodes].filter(Array.isArray).flat();
 if(data.movie.last_episode_to_air)episodes.push(data.movie.last_episode_to_air);
 const known=new Map(),today=new Date().toISOString().slice(0,10);
 const aired=date=>/^\d{4}-\d{2}-\d{2}$/.test(date || '') && date<=today;
 const thumbs=new Set(episodes.concat(data.movie,data.images?.backdrops || []).map(row=>tmdbPath(row?.still_path || row?.backdrop_path || row?.file_path || row?.img)).filter(Boolean));
 function addEpisodes(rows){
  for(const row of rows){
   const preview=tmdbPath(row?.still_path);
   if(preview)thumbs.add(preview);
   const season=Number(row?.season_number),episode=Number(row?.episode_number);
   if(Number.isSafeInteger(season) && season>0 && Number.isSafeInteger(episode) && episode>0 &&
      aired(row.air_date) && !row.comeing)known.set(season+':'+episode,{season,episode});
  }
 }
 addEpisodes(episodes);
 const ordered=[...known.values()].sort((a,b)=>b.season-a.season || b.episode-a.episode);
 const first=ordered.at(-1),recent=ordered.slice(0,8).filter(row=>row!==first);
 const candidates=recent.slice(0,2).concat(first || [],recent.slice(2));
 const paths=new Map(),started=Date.now();
 const remaining=()=>3000-(Date.now()-started);
 async function readFrames(batch){
  const time=remaining();
  if(time<=0)return;
  await Promise.all(batch.map(async ({season,episode})=>{
   const result=await readGalleryData(readTmdb,'tv/'+id+'/season/'+season+'/episode/'+episode+'/images?include_image_language=null',Math.min(time,1000));
   for(const row of Array.isArray(result?.stills)?result.stills:[]){
    const path=tmdbPath(row?.file_path),width=Number(row?.width)||0;
    if(path && !thumbs.has(path) && (!width || width>=480))paths.set(path,Math.max(width,paths.get(path) || 0));
   }
  }));
 }
 await readFrames(candidates.slice(0,3));
 if(paths.size<frameLimit && remaining()>0){
  // The detail card can contain only a handful of recent episodes.
  const sampledSeasons=new Set(candidates.map(row=>row.season));
  const otherSeasons=(data.movie.seasons || []).filter(row=>Number.isSafeInteger(row?.season_number) &&
   row.season_number>0 && aired(row.air_date) && !sampledSeasons.has(row.season_number))
   .sort((a,b)=>a.season_number-b.season_number);
  const extra=await Promise.all(otherSeasons.slice(0,2).map(row=>readGalleryData(readTmdb,'tv/'+id+'/season/'+row.season_number,Math.min(remaining(),850))));
  const previouslyKnown=new Set(known.keys());
  for(const book of extra)if(Array.isArray(book?.episodes))addEpisodes(book.episodes);
  const other=[...known].filter(([key])=>!previouslyKnown.has(key)).map(([,row])=>row);
  const sample=[...new Set([other[0],other[Math.floor(other.length/2)],other.at(-1)])].filter(Boolean);
  candidates.splice(3,0,...sample);
 }
 for(let i=3;i<candidates.length && paths.size<frameLimit && remaining()>0;i+=3)await readFrames(candidates.slice(i,i+3));
 for(const preview of thumbs)paths.delete(preview);
 return [...paths].sort((a,b)=>b[1]-a[1]).slice(0,frameLimit).map(([still_path,width])=>({still_path,width}));
}

export function hasGallerySource(L,data){
 const card=data.movie;
 if(!card || card.adult || card.blocked)return false;
 const date=seriesCard(card)?card.first_air_date:card.release_date;
 return tmdbId(card)>0 || !!((card.original_title || card.original_name || card.title || card.name) && /^\d{4}-/.test(date || ''));
}

export async function loadDetailGallery(L,data,readTmdb){
 const card=data.movie;
 if(!hasGallerySource(L,data))return [];
 const isSeries=seriesCard(card),id=tmdbId(card);
 let frames=await catalogueFrames(L,card,isSeries?'tv':'movie',readTmdb);
 if(frames.length<frameLimit && isSeries && id>0)frames=frames.concat(await episodeGallery(data,id,readTmdb));
 if(frames.length<frameLimit)frames=frames.concat(await loadGalleryFrames(L,card));
 const unique=new Map();
 for(const row of frames){
  const key=row.still_path || row.minimal_still_url;
  if(key && !unique.has(key))unique.set(key,row);
 }
 return [...unique.values()].slice(0,frameLimit);
}

export async function loadGalleryFrames(L,card){
 const key=String(L.Storage?.get(galleryFramesKey,'') || '').trim();
 if(!key || !card || card.adult || card.blocked || typeof fetch!=='function' || typeof AbortController!=='function')return [];
 const isSeries=seriesCard(card);
 const kp=Number(card.kinopoisk_id || card.external_ids?.kinopoisk_id);
 const tmdb=tmdbId(card);
 const imdb=String(card.imdb_id || card.external_ids?.imdb_id || '');
 const hasImdb=/^tt\d{5,12}$/.test(imdb);
 if(!(kp>0 || tmdb>0 || hasImdb))return [];
 const identity=(kp>0?'kp:'+kp:hasImdb?'imdb:'+imdb:'tmdb:'+tmdb)+':'+isSeries;
 const saved=cache.get(identity);
 if(saved?.until>Date.now())return saved.frames;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
 async function get(path,params){
  const response=await fetch('https://api.poiskkino.dev/v1.5/'+path+'?'+new URLSearchParams(params),{
   headers:{'X-API-KEY':key},signal:controller.signal,redirect:'error'
  });
  if(!response.ok)throw new Error('Frame service unavailable');
  return (await response.json()).docs || [];
 }
 try{
  let id=kp;
  if(!(id>0)){
   const lookup=async field=>{
    const byImdb=field==='imdb',value=byImdb?imdb:tmdb;
    const matches=await get('movie',{['externalId.'+field]:value,isSeries,limit:2});
    if(matches.length!==1 || matches[0].isSeries!==isSeries)return 0;
    const ids=matches[0].externalId || {};
    if(tmdb>0 && ids.tmdb && Number(ids.tmdb)!==tmdb || hasImdb && ids.imdb && ids.imdb!==imdb)return 0;
    return (byImdb?ids.imdb===imdb:Number(ids.tmdb)===tmdb)?Number(matches[0].id):0;
   };
   id=hasImdb?await lookup('imdb'):0;
   if(!(id>0) && tmdb>0)id=await lookup('tmdb');
   if(!(id>0))return [];
  }
  const query=new URLSearchParams({movieId:id,limit:40});
  const frameTypes=['frame','screenshot','still'];
  frameTypes.forEach(type=>query.append('type',type));
  const images=await get('image',query);
  const stills=images.filter(row=>frameTypes.includes(row.type) && Number(row.movieId)===id && https(row.url))
   .sort((a,b)=>(Number(b.width)||0)-(Number(a.width)||0));
  const frames=[...new Map(stills.map(row=>[row.url,{img:https(row.previewUrl)?row.previewUrl:row.url,minimal_still_url:row.url}])).values()].slice(0,frameLimit);
  if(cache.size>=80)cache.delete(cache.keys().next().value);
  cache.set(identity,{frames,until:Date.now()+1800000});
  return frames;
 }catch(error){return [];}finally{clearTimeout(timer);}
}
