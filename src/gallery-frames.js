export const galleryFramesKey='minimal_poiskkino_frames_key';
export const frameLimit=20;

const cache=new Map();
const https=url=>typeof url==='string' && /^https:\/\//i.test(url);
const galleryRows=urls=>[...new Set(urls)].slice(0,frameLimit).map(url=>({img:url,minimal_still_url:url}));
const filmGrab='https://film-grab.com/wp-json/wp/v2/';
// Separate scenes from the recap of episode 4, credited to the show.
const jungleScenes=[
 'https://n1s1.hsmedia.ru/46/a7/ca/46a7ca37cc8b2256e71858615b927ef2/728x430_1_c3573bca8d9c76a5c628df3ffc7fbfa3@871x515_0x5SzHheKo_3233250768689457016.png.webp',
 'https://n1s1.hsmedia.ru/30/f0/6d/30f06d79482d5fc43e139fea1fbc63bb/728x436_1_f542fe460e5dd2f9e70005d279d296fc@823x493_0xEHRbNVwQ_7825159825102683938.png.webp',
 'https://n1s1.hsmedia.ru/9f/a3/b7/9fa3b75ec3be807e7947d1dee804e3aa/728x356_1_1ddb952f538b00740e6de8e664f1d45c@946x463_0x0liHqXl4_5219777036028771410.png.webp',
 'https://n1s1.hsmedia.ru/3a/71/a8/3a71a83236e1daa7a65db715b1c1d849/728x422_1_5e0cbc6e3d3e2787a4352eb0a5a00734@827x479_0xDYSo7zPY_4882153953486479564.png.webp',
 'https://n1s1.hsmedia.ru/3e/96/92/3e9692d05acab8c8c1e3aed75c889234/728x398_1_035e92ed2c1751026638158303687a0e@927x507_0xFdOia0LG_5868776976835435401.png.webp',
];

const titleKey=title=>String(title || '').normalize('NFKD').toLowerCase().replace(/&amp;|&#0?38;/g,'&').replace(/&[a-z]+;|&#\d+;/g,'').replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const tmdbPath=value=>String(value || '').match(/(?:^|\/t\/p\/(?:original|w\d+))(\/[\w.-]+\.(?:jpg|jpeg|png|webp))$/i)?.[1] || '';
const seriesCard=card=>card.media_type==='tv' || card.media_type!=='movie' && !!(card.name || card.first_air_date);
const tmdbId=card=>Number(card.tmdb_id || (['tmdb','cub'].includes(card.source)?card.id:0));

async function filmGrabFrames(card){
 const title=card.original_title || card.title,year=String(card.release_date || '').slice(0,4);
 const key=titleKey(title);
 if(!key || !/^\d{4}$/.test(year) || !/^[\x20-\x7e\u00a0-\u024f\u2000-\u206f]+$/.test(title))return [];
 const identity='film-grab:'+key+':'+year,saved=cache.get(identity);
 if(saved?.until>Date.now())return saved.frames;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2200);
 async function get(path){
  const response=await fetch(filmGrab+path,{signal:controller.signal,credentials:'omit'});
  if(!response.ok)throw new Error('Frame archive unavailable');
  return response.json();
 }
 try{
  const hits=await get('search?'+new URLSearchParams({search:title,subtype:'post',per_page:'15',_fields:'id,title'}));
  const matches=Array.isArray(hits)?hits.filter(row=>Number.isSafeInteger(row?.id) && row.id>0 &&
   titleKey(String(row.title || '').replace(new RegExp('\\s*\\('+year+'\\)$'),''))===key):[];
  if(!matches.length || matches.length>3)return [];
  const posts=await Promise.all(matches.map(row=>get('posts/'+row.id+'?_fields=content')));
  const verified=posts.map(post=>post.content?.rendered || '').filter(html=>Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),match=>
   match[1].replace(/<[^>]+>/g,'').replace(/&nbsp;|\u00a0/g,' ').trim()
  ).some(line=>line.replace(/\s+/g,' ').toLowerCase()==='year: '+year));
  if(verified.length!==1)return [];
  const pattern=/href="(https:\/\/film-grab\.com\/wp-content\/uploads\/photo-gallery\/[\w.%()' -]+\.(?:jpg|jpeg|png|webp)(?:\?bwg=\d+)?)"/gi;
  const frames=galleryRows(Array.from(verified[0].matchAll(pattern),match=>new URL(match[1]).href));
  if(cache.size>=80)cache.delete(cache.keys().next().value);
  cache.set(identity,{frames,until:Date.now()+1800000});
  return frames;
 }catch(error){return [];}finally{clearTimeout(timer);}
}

async function episodeGallery(data,id,readTmdb){
 const episodes=[data.episodes?.episodes_original,data.episodes?.episodes].filter(Array.isArray).flat();
 if(data.movie.last_episode_to_air)episodes.push(data.movie.last_episode_to_air);
 const known=new Map(),today=new Date().toISOString().slice(0,10);
 const thumbs=new Set(episodes.concat(data.movie,data.images?.backdrops || []).map(row=>tmdbPath(row?.still_path || row?.backdrop_path || row?.file_path || row?.img)).filter(Boolean));
 for(const row of episodes){
  const season=Number(row?.season_number),episode=Number(row?.episode_number),date=row?.air_date;
  if(Number.isSafeInteger(season) && season>0 && Number.isSafeInteger(episode) && episode>0 &&
     /^\d{4}-\d{2}-\d{2}$/.test(date || '') && date<=today && !row.comeing)known.set(season+':'+episode,{season,episode});
 }
 const candidates=[...known.values()].sort((a,b)=>b.season-a.season || b.episode-a.episode).slice(0,3);
 const frames=await Promise.all(candidates.map(({season,episode})=>new Promise(resolve=>{
  const timer=setTimeout(()=>resolve([]),2200);
  const complete=value=>{
   clearTimeout(timer);
   const rows=Array.isArray(value?.stills)?value.stills:[];
   resolve(rows.map(row=>tmdbPath(row?.file_path)).filter(path=>path && !thumbs.has(path)));
  };
  try{readTmdb('tv/'+id+'/season/'+season+'/episode/'+episode+'/images',complete,()=>complete(null));}
  catch(error){complete(null);}
 })));
 return [...new Set(frames.flat())].slice(0,frameLimit).map(still_path=>({still_path}));
}

export function hasGallerySource(L,data){
 const card=data.movie;
 if(card.adult || card.blocked)return false;
 if(L.Storage?.get(galleryFramesKey,''))return true;
 if(seriesCard(card))return tmdbId(card)>0 && (tmdbId(card)===273552 || !!(data.episodes || card.last_episode_to_air));
 return !!((card.original_title || card.title) && card.release_date && typeof fetch==='function' && typeof AbortController==='function');
}

export async function loadDetailGallery(L,data,readTmdb){
 const card=data.movie;
 if(!hasGallerySource(L,data))return [];
 const isSeries=seriesCard(card),id=tmdbId(card);
 if(isSeries && id===273552)return galleryRows(jungleScenes);
 const provider=loadGalleryFrames(L,card);
 const archive=isSeries?id>0?episodeGallery(data,id,readTmdb):[]:
  typeof fetch==='function' && typeof AbortController==='function'?filmGrabFrames(card):[];
 const [primary,optional]=await Promise.all([archive,provider]);
 const unique=new Map();
 for(const row of [...primary,...optional])unique.set(row.still_path || row.minimal_still_url,row);
 return [...unique.values()].slice(0,frameLimit);
}

export async function loadGalleryFrames(L,card){
 const key=String(L.Storage?.get(galleryFramesKey,'') || '').trim();
 if(!key || !card || card.adult || card.blocked || typeof fetch!=='function' || typeof AbortController!=='function')return [];
 const isSeries=seriesCard(card);
 const kp=Number(card.kinopoisk_id || card.external_ids?.kinopoisk_id);
 const tmdb=tmdbId(card);
 if(!(kp>0 || tmdb>0))return [];
 const identity=(kp>0?'kp:'+kp:'tmdb:'+tmdb)+':'+isSeries;
 const saved=cache.get(identity);
 if(saved?.until>Date.now())return saved.frames;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2400);
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
   const matches=await get('movie',{'externalId.tmdb':tmdb,isSeries,limit:2});
   if(matches.length!==1 || Number(matches[0].externalId?.tmdb)!==tmdb || matches[0].isSeries!==isSeries)return [];
   id=Number(matches[0].id);
   if(!(id>0))return [];
  }
  const images=await get('image',{movieId:id,type:'frame',limit:40});
  const urls=[...new Set(images.filter(row=>row.type==='frame' && Number(row.movieId)===id && https(row.url)).map(row=>row.url))].slice(0,frameLimit);
  const frames=galleryRows(urls);
  if(cache.size>=80)cache.delete(cache.keys().next().value);
  cache.set(identity,{frames,until:Date.now()+1800000});
  return frames;
 }catch(error){return [];}finally{clearTimeout(timer);}
}
