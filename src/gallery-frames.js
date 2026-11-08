import catalogueFrames from './frame-catalogue-client.js';
import {frameLimit,stableSample} from './frame-catalogue.cjs';
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

const cardIdentity=card=>{
 const media=seriesCard(card)?'tv':'movie',id=tmdbId(card);
 return media+':'+(id>0?'tmdb:'+id:card.imdb_id || card.external_ids?.imdb_id ||
  (card.original_title || card.original_name || card.title || card.name)+':'+(card.release_date || card.first_air_date));
};

export function selectGalleryFrames(rows,seed){
 const unique=new Map(),tiers=new Map();
 for(const row of rows){
  const key=row.still_path || row.minimal_still_url,old=unique.get(key);
  if(key && (!old || (row.minimal_frame_season || 0)>(old.minimal_frame_season || 0)))unique.set(key,row);
 }
 for(const row of unique.values()){
  const season=row.minimal_frame_season || 0,groups=tiers.get(season) || new Map();
  const group=row.minimal_frame_group || 'gallery',frames=groups.get(group) || [];
  frames.push(row);groups.set(group,frames);tiers.set(season,groups);
 }
 const selected=[];
 for(const season of [...tiers.keys()].sort((a,b)=>b-a)){
  const groups=tiers.get(season),seasonSeed=seed+':'+season;
  const queues=stableSample([...groups],seasonSeed,groups.size,row=>row[0])
   .map(([key,frames])=>stableSample(frames,seasonSeed+':'+key,frames.length));
  const tier=[];
  for(let at=0;selected.length+tier.length<frameLimit && queues.some(rows=>at<rows.length);at++){
   for(const rows of queues)if(rows[at] && selected.length+tier.length<frameLimit)tier.push(rows[at]);
  }
  selected.push(...stableSample(tier,seasonSeed));
  if(selected.length===frameLimit)break;
 }
 return selected;
}

async function episodeGallery(data,id,readTmdb,releaseSeasons){
 const episodes=[data.episodes?.episodes_original,data.episodes?.episodes].filter(Array.isArray).flat();
 if(data.movie.last_episode_to_air)episodes.push(data.movie.last_episode_to_air);
 const known=new Map(),today=new Date().toISOString().slice(0,10);
 const aired=date=>/^\d{4}-\d{2}-\d{2}$/.test(date || '') && date<=today;
 const thumbs=new Set([data.movie,...(data.images?.backdrops || [])].map(row=>tmdbPath(row?.backdrop_path || row?.file_path || row?.img)).filter(Boolean));
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
 const seasons=new Map([...known.values()].map(({season})=>[season,0]));
 for(const row of data.movie.seasons || []){
  const number=Number(row?.season_number);
  if(Number.isSafeInteger(number) && number>0 && (seasons.has(number) || aired(row.air_date)))seasons.set(number,Number(row.episode_count)||0);
 }
 const seed=cardIdentity(data.movie),paths=new Map();
 let deadline=Date.now()+4500;
 const remaining=()=>deadline-Date.now();
 let requests=0;
 for(const [season,count] of [...seasons].sort(([a],[b])=>b-a).slice(0,3)){
  if(remaining()<=0 || requests>=24 || paths.size>=frameLimit)break;
  let book,rows=[...known.values()].filter(row=>row.season===season);
  if(!rows.length || !count || rows.length<count || (releaseSeasons && seasons.size===1)){
   book=await readGalleryData(readTmdb,'tv/'+id+'/season/'+season,Math.min(remaining(),1100));
   if(Array.isArray(book?.episodes)){
    addEpisodes(book.episodes.filter(row=>Number(row.season_number)===season));
    rows=[...known.values()].filter(row=>row.season===season);
   }
  }
  // Anime releases may share one catalogue season. Use only a verified map
  // of its episode coordinates, and preserve the actual requests to TMDB.
  const mappingStarted=Date.now();
  const rankEpisodes=book && seasons.size===1?await releaseSeasons:null;
  deadline+=Date.now()-mappingStarted;
  const ranks=rankEpisodes?.(season,book);
  const tiers=new Map();
  for(const row of rows){
   const rank=ranks?.get(row.episode) || season,items=tiers.get(rank) || [];
   items.push(row);tiers.set(rank,items);
  }
  for(const [rank,items] of [...tiers].sort(([a],[b])=>b-a)){
   const candidates=stableSample(items,seed+':season:'+rank,12,row=>row.episode);
   for(let i=0;i<candidates.length && remaining()>0 && requests<24 && paths.size<frameLimit;i+=6){
    const batch=candidates.slice(i,i+Math.min(6,24-requests)),timeout=Math.min(remaining(),1250);
    requests+=batch.length;
    const results=await Promise.all(batch.map(async ({season,episode})=>{
     const result=await readGalleryData(readTmdb,'tv/'+id+'/season/'+season+'/episode/'+episode+'/images?include_image_language=null',timeout);
     return Array.isArray(result?.stills)?result.stills.map(row=>({row,episode})):[];
    }));
    for(const {row,episode} of results.flat()){
     const path=tmdbPath(row?.file_path),width=Number(row?.width)||0;
     if(path && !thumbs.has(path) && (!width || width>=480) && !paths.has(path)){
      paths.set(path,{still_path:path,width,minimal_frame_group:'episode:'+season+':'+episode,minimal_frame_season:rank});
     }
    }
   }
  }
  for(const preview of thumbs)paths.delete(preview);
 }
 return [...paths.values()];
}

export function hasGallerySource(L,data){
 const card=data.movie;
 if(!card || card.adult || card.blocked)return false;
 const date=seriesCard(card)?card.first_air_date:card.release_date;
 return tmdbId(card)>0 || !!((card.original_title || card.original_name || card.title || card.name) && /^\d{4}-/.test(date || ''));
}

export async function loadDetailGallery(L,data,readTmdb,releaseSeasons){
 const card=data.movie;
 if(!hasGallerySource(L,data))return [];
 const isSeries=seriesCard(card),id=tmdbId(card);
 const [catalogue,episodes]=await Promise.all([
  catalogueFrames(L,card,isSeries?'tv':'movie',readTmdb),
  isSeries && id>0?episodeGallery(data,id,readTmdb,releaseSeasons):[],
 ]);
 const seed=cardIdentity(card),frames=selectGalleryFrames(episodes.concat(catalogue),seed);
 if(frames.length===frameLimit)return frames;
 return selectGalleryFrames(episodes.concat(catalogue,await loadGalleryFrames(L,card)),seed);
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
  const frames=selectGalleryFrames(stills.map(row=>({img:https(row.previewUrl)?row.previewUrl:row.url,minimal_still_url:row.url})),cardIdentity(card));
  if(cache.size>=80)cache.delete(cache.keys().next().value);
  cache.set(identity,{frames,until:Date.now()+1800000});
  return frames;
 }catch(error){return [];}finally{clearTimeout(timer);}
}
