const {frameLimit,validFrames}=require('../src/frame-catalogue.cjs');
const base='https://kino.mail.ru';
const moviePath=/^\/(?:(?:cinema\/movies|series)\/|(?:series|tvshow)_)[1-9]\d*_[a-z\d_-]+\/$/;
function image(value){
 if(value?.baseURL!=='https://resizer.mail.ru/p/' || value.error!=='NO_ERROR' || !/^[a-f\d-]{36}$/.test(value.uuid || '') || !/^[\w-]+$/.test(value.key || '') || value.width<480 || value.width/value.height<1.35)return '';
 return value.baseURL+value.uuid+'/'+value.key+'.jpg';
}
function parseGallery(html,path){
 if(!moviePath.test(path))return null;
 const script=html.match(/<script\b[^>]*\bid="kinotv-preload-script-event_movie"[^>]*>([\s\S]*?)<\/script>/)?.[1];
 const payload=script?.match(/window\.__PRELOADED_STATE__EVENT_MOVIE\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)?.[1];
 let data;try{data=JSON.parse(payload).page_data;}catch{return null;}
 const info=data?.event_info,gallery=data?.gallery;
 if(info?.url!==base+path || !info.name || !/^\d{4}$/.test(String(info.year)) || !/^Кадры из (?:фильма|сериала|телешоу|шоу) «/.test(gallery?.title || ''))return null;
 const frames=validFrames((gallery.items || []).filter(row=>row.galleryId===gallery.gallery_id && /^Кадр (?:из (?:фильма|сериала|телешоу|шоу)|к [1-9]\d* сезону (?:сериала|телешоу)) «/.test(row.title || ''))
  .map(row=>({img:image(row.base) || image(row.large),url:image(row.large),width:row.large?.width}))).slice(0,frameLimit);
 if(!frames.length)return null;
 return {media:path.startsWith('/cinema/movies/')?'movie':'tv',title:info.name,year:Number(info.year),aliases:[info.name_eng].filter(Boolean),
  imdb:info.imdb_url?.match(/^https:\/\/www\.imdb\.com\/title\/(tt\d+)\//)?.[1],source:'kinomail',origin:base+path,priority:30,frames};
}
function discover(html){return [...new Set(Array.from(html.matchAll(/href="(?:https:\/\/kino\.mail\.ru)?(\/(?:(?:cinema\/movies|series)\/|(?:series|tvshow)_)[1-9]\d*_[a-z\d_-]+\/)"/g),m=>m[1]))].slice(0,400);}
async function read(path){const response=await fetch(base+path,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('HTTP '+response.status);return response.text();}
async function collect(seeds){
 const year=new Date().getUTCFullYear(),paths=new Set(seeds.kinomail || []);
 const lists=await Promise.allSettled(['/cinema/all/'+year+'/','/cinema/all/'+(year-1)+'/','/series/all/','/series/total/','/tvshow/all/'].map(read));
 for(const result of lists)if(result.status==='fulfilled')discover(result.value).forEach(path=>paths.add(path));
 const queue=[...paths].filter(path=>moviePath.test(path)),rows=[];let failures=0;
 async function worker(){for(let path;(path=queue.shift());){try{const row=parseGallery(await read(path),path);if(row)rows.push(row);}catch{failures++;}await new Promise(resolve=>setTimeout(resolve,350));}}
 await Promise.all(Array.from({length:3},worker));
 if(failures)console.warn('Kino Mail: '+failures+' requests failed');
 if(!rows.length)throw Error('No verified Kino Mail galleries');
 return rows;
}
module.exports={parseGallery,discover,collect};
