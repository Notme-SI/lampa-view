export const galleryFramesKey='minimal_poiskkino_frames_key';
export const frameLimit=20;

const cache=new Map();
const https=url=>typeof url==='string' && /^https:\/\//i.test(url);

export async function loadGalleryFrames(L,card){
 const key=String(L.Storage?.get(galleryFramesKey,'') || '').trim();
 if(!key || !card || card.adult || card.blocked || typeof fetch!=='function' || typeof AbortController!=='function')return [];
 const isSeries=card.media_type==='tv' || card.media_type!=='movie' && !!(card.name || card.first_air_date);
 const kp=Number(card.kinopoisk_id || card.external_ids?.kinopoisk_id);
 const tmdb=Number(card.tmdb_id || (['tmdb','cub'].includes(card.source)?card.id:0));
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
  const frames=urls.map(url=>({img:url,minimal_still_url:url,minimal_gallery_art:true}));
  if(cache.size>=80)cache.delete(cache.keys().next().value);
  cache.set(identity,{frames,until:Date.now()+1800000});
  return frames;
 }catch(error){return [];}finally{clearTimeout(timer);}
}
